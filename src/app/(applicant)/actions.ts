'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth';
import {
  ALLOWED_MIME_TYPES,
  DOC_TYPES,
  DOCUMENT_CONFIG,
  MAX_FILE_SIZE_BYTES,
  requiredDocTypes,
  type DocType,
} from '@/lib/documents';
import { sendStatusEmail } from '@/lib/email';
import { APPLICANT_EDITABLE_STATUSES, canTransition } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { Application, DocumentRow } from '@/lib/types';
import {
  applicationDraftSchema,
  applicationSubmitSchema,
} from '@/lib/validation/application';

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

async function getContext() {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'applicant') {
    return null;
  }
  const supabase = await createClient();
  if (!supabase) return null;
  return { session, supabase };
}

function formToRaw(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') raw[key] = value;
  }
  // Unchecked checkboxes are absent from FormData — make them explicit false.
  raw.liable_soc_security = formData.get('liable_soc_security') === 'on';
  raw.liable_wops = formData.get('liable_wops') === 'on';
  return raw;
}

/** Create or update the applicant's single application while it is editable. */
export async function saveApplication(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Not signed in.' };
  const { session, supabase } = ctx;

  const parsed = applicationDraftSchema.safeParse(formToRaw(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors };
  }

  const ministryId = String(formData.get('ministry_id') ?? '');
  if (!ministryId) {
    return { ok: false, message: 'Select a ministry.' };
  }

  const { data: existing } = await supabase
    .from('applications')
    .select('id,status')
    .eq('applicant_id', session.userId)
    .maybeSingle();

  if (existing) {
    if (!APPLICANT_EDITABLE_STATUSES.includes(existing.status)) {
      return {
        ok: false,
        message: 'This application is with the Accounts Office and can no longer be edited.',
      };
    }
    const { error } = await supabase
      .from('applications')
      .update({ ...parsed.data, ministry_id: ministryId })
      .eq('id', existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase.from('applications').insert({
      ...parsed.data,
      applicant_id: session.userId,
      ministry_id: ministryId,
      status: 'draft',
      email: parsed.data.email ?? session.email,
    });
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/application');
  revalidatePath('/application/documents');
  return { ok: true, message: 'Saved.' };
}

/** Validate everything, then move draft/needs_correction → submitted. */
export async function submitApplication(): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Not signed in.' };
  const { session, supabase } = ctx;

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('applicant_id', session.userId)
    .maybeSingle();
  const application = data as Application | null;
  if (!application) return { ok: false, message: 'Fill in the application form first.' };

  if (!canTransition(application.status, 'submitted', 'applicant')) {
    return { ok: false, message: 'This application cannot be submitted from its current status.' };
  }

  const parsed = applicationSubmitSchema.safeParse({
    ...application,
    liable_soc_security: application.liable_soc_security ?? false,
    liable_wops: application.liable_wops ?? false,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return {
      ok: false,
      message: 'The form is incomplete — please fill in the missing fields.',
      fieldErrors,
    };
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('doc_type')
    .eq('application_id', application.id);
  const uploadedTypes = new Set((docs ?? []).map((d) => d.doc_type));
  const missing = requiredDocTypes(application.grade).filter(
    (type) => !uploadedTypes.has(type),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required documents: ${missing
        .map((type) => DOCUMENT_CONFIG[type].label)
        .join(', ')}.`,
    };
  }

  const { error } = await supabase
    .from('applications')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      admin_comments: null,
    })
    .eq('id', application.id);
  if (error) return { ok: false, message: error.message };

  if (session.email) {
    await sendStatusEmail({
      to: session.email,
      applicantName: session.profile.full_name,
      status: 'submitted',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/application');
  return { ok: true, message: 'Application submitted.' };
}

/** Upload one document into Storage and record it, while editable. */
export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Not signed in.' };
  const { session, supabase } = ctx;

  const docType = String(formData.get('doc_type') ?? '') as DocType;
  if (!DOC_TYPES.includes(docType)) {
    return { ok: false, message: 'Unknown document type.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a file to upload.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: 'File is larger than the 5MB limit.' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, message: 'Only PDF, JPEG, and PNG files are accepted.' };
  }

  const { data } = await supabase
    .from('applications')
    .select('id,status')
    .eq('applicant_id', session.userId)
    .maybeSingle();
  if (!data) return { ok: false, message: 'Save the application form first.' };
  if (!APPLICANT_EDITABLE_STATUSES.includes(data.status)) {
    return { ok: false, message: 'Documents can no longer be changed at this stage.' };
  }

  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('application_id', data.id)
    .eq('doc_type', docType);
  if ((count ?? 0) >= DOCUMENT_CONFIG[docType].maxFiles) {
    return {
      ok: false,
      message: `Only ${DOCUMENT_CONFIG[docType].maxFiles} file(s) allowed for ${DOCUMENT_CONFIG[docType].label}. Remove one first.`,
    };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const storagePath = `${data.id}/${docType}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { error: insertError } = await supabase.from('documents').insert({
    application_id: data.id,
    doc_type: docType,
    storage_path: storagePath,
  });
  if (insertError) {
    await supabase.storage.from('application-documents').remove([storagePath]);
    return { ok: false, message: insertError.message };
  }

  revalidatePath('/application/documents');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Uploaded.' };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Not signed in.' };
  const { supabase } = ctx;

  // RLS only returns the row if it belongs to this applicant's editable application.
  const { data } = await supabase
    .from('documents')
    .select('id,storage_path')
    .eq('id', documentId)
    .maybeSingle();
  const doc = data as Pick<DocumentRow, 'id' | 'storage_path'> | null;
  if (!doc) return { ok: false, message: 'Document not found.' };

  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);
  if (deleteError) return { ok: false, message: deleteError.message };

  await supabase.storage.from('application-documents').remove([doc.storage_path]);

  revalidatePath('/application/documents');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Removed.' };
}
