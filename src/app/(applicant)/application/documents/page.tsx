import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { requiredDocTypes } from '@/lib/documents';
import { APPLICANT_EDITABLE_STATUSES } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { Application, DocumentRow } from '@/lib/types';
import { DocumentsManager } from './DocumentsManager';

export const metadata = { title: 'Documents — MinistryFlow' };

export default async function DocumentsPage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  if (!session || !supabase) return null;

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('applicant_id', session.userId)
    .maybeSingle();
  const application = data as Application | null;

  if (!application) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h1 className="text-lg font-semibold text-slate-900">Documents</h1>
        <p className="mt-2 text-sm text-slate-600">
          Save your application form first — the documents are attached to it.
        </p>
        <Link
          href="/application"
          className="mt-6 inline-block rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
        >
          Go to application form
        </Link>
      </div>
    );
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application.id)
    .order('uploaded_at');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Required documents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Upload clear scans or photos (PDF, JPEG, or PNG, max 5MB each). The
          list below adjusts to your grade
          {application.grade ? ` (currently grade ${application.grade})` : ''}.
        </p>
      </div>
      <DocumentsManager
        documents={(documents ?? []) as DocumentRow[]}
        requiredTypes={requiredDocTypes(application.grade)}
        editable={APPLICANT_EDITABLE_STATUSES.includes(application.status)}
      />
    </div>
  );
}
