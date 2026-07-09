'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth';
import { sendStatusEmail } from '@/lib/email';
import { canTransition } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { AllowanceRow, Application, ApplicationStatus } from '@/lib/types';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** SAL 1 earning element codes confirmed from real form samples. Categories
 *  without a confirmed code get a null code — the Accounts Office fills it
 *  on the printed form. */
const SAL1_CODES: Record<string, string | null> = {
  basic_salary: '104',
  special_skills: '116',
  risk: '110',
  hardship: '142',
  travel: '41',
  responsibility: null,
  on_call_duty: null,
  teaching: null,
  specialty_nurse: null,
};

const CATEGORY_LABELS: Record<string, string> = {
  risk: 'Risk Allowance',
  responsibility: 'Responsibility Allowance',
  on_call_duty: 'On-Call Duty Allowance',
  hardship: 'Hardship Allowance',
  teaching: 'Teaching Allowance',
  special_skills: 'Special Skills Allowance',
  specialty_nurse: 'Speciality Nurse Allowance',
};

async function getAdminContext() {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== 'ministry_admin') return null;
  const supabase = await createClient();
  if (!supabase) return null;
  return { session, supabase };
}

async function transition(
  applicationId: string,
  to: ApplicationStatus,
  extra: Record<string, unknown> = {},
): Promise<{ application: Application } | { error: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: 'Not authorized.' };
  const { session, supabase } = ctx;

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();
  const application = data as Application | null;
  if (!application) return { error: 'Application not found.' };

  if (!canTransition(application.status, to, 'ministry_admin')) {
    return {
      error: `Cannot move an application from "${application.status}" to "${to}".`,
    };
  }

  const { error } = await supabase
    .from('applications')
    .update({
      status: to,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
      ...extra,
    })
    .eq('id', applicationId);
  if (error) return { error: error.message };

  return { application: { ...application, status: to } };
}

export async function startReview(applicationId: string): Promise<ActionResult> {
  const result = await transition(applicationId, 'under_review');
  if ('error' in result) return { ok: false, message: result.error };

  if (result.application.email) {
    await sendStatusEmail({
      to: result.application.email,
      applicantName: result.application.first_name,
      status: 'under_review',
    });
  }
  revalidatePath('/admin');
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true, message: 'Marked as under review.' };
}

export async function decideApplication(input: {
  applicationId: string;
  decision: 'approved' | 'rejected' | 'needs_correction';
  comments: string;
  allowanceIds: string[];
}): Promise<ActionResult> {
  const comments = input.comments.trim();
  if (input.decision !== 'approved' && comments.length === 0) {
    // Ministry requirement: rejection/correction reasons are free text and REQUIRED.
    return {
      ok: false,
      message: 'A comment explaining the decision is required.',
    };
  }

  const result = await transition(input.applicationId, input.decision, {
    admin_comments: comments.length > 0 ? comments : null,
  });
  if ('error' in result) return { ok: false, message: result.error };
  const application = result.application;

  if (input.decision === 'approved') {
    const buildError = await buildPayElements(application, input.allowanceIds);
    if (buildError) return { ok: false, message: buildError };
  }

  if (application.email) {
    await sendStatusEmail({
      to: application.email,
      applicantName: application.first_name,
      status: input.decision,
      comments,
    });
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/applications/${input.applicationId}`);
  return { ok: true, message: `Application ${input.decision.replace('_', ' ')}.` };
}

/** On approval: write the SAL 1 earning elements — basic salary plus the
 *  allowances the Accounts Office ticked after checking eligibility against
 *  the uploaded letters. */
async function buildPayElements(
  application: Application,
  allowanceIds: string[],
): Promise<string | null> {
  const ctx = await getAdminContext();
  if (!ctx) return 'Not authorized.';
  const { supabase } = ctx;

  const elements: Array<{
    application_id: string;
    element_type: 'earning';
    code: string | null;
    description: string;
    period_amount: number;
    total_amount: number;
  }> = [];

  if (application.basic_salary) {
    elements.push({
      application_id: application.id,
      element_type: 'earning',
      code: SAL1_CODES.basic_salary,
      description: 'Basic Salary',
      period_amount: application.basic_salary,
      total_amount: application.basic_salary * 12,
    });
  }

  if (allowanceIds.length > 0) {
    const { data } = await supabase
      .from('allowances')
      .select('*')
      .in('id', allowanceIds);
    for (const allowance of (data ?? []) as AllowanceRow[]) {
      const label =
        CATEGORY_LABELS[allowance.category] ?? allowance.category.replace(/_/g, ' ');
      elements.push({
        application_id: application.id,
        element_type: 'earning',
        code: SAL1_CODES[allowance.category] ?? null,
        description: allowance.subcategory ? `${label} — ${allowance.subcategory}` : label,
        period_amount: allowance.amount,
        total_amount: allowance.amount * 12,
      });
    }
  }

  // Replace any previous elements (e.g. re-approval after correction loop).
  const { error: deleteError } = await supabase
    .from('application_pay_elements')
    .delete()
    .eq('application_id', application.id);
  if (deleteError) return deleteError.message;

  if (elements.length > 0) {
    const { error } = await supabase.from('application_pay_elements').insert(elements);
    if (error) return error.message;
  }
  return null;
}

export async function markSal1Generated(applicationId: string): Promise<ActionResult> {
  const result = await transition(applicationId, 'sal1_generated');
  if ('error' in result) return { ok: false, message: result.error };
  revalidatePath('/admin');
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true, message: 'SAL 1 marked as generated.' };
}
