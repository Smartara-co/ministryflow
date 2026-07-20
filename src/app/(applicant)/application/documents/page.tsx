import Link from 'next/link';
import { getSessionProfile } from '@/lib/auth';
import { requiredDocTypes } from '@/lib/documents';
import { APPLICANT_EDITABLE_STATUSES } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { Application, DocumentRow, PayScaleRow } from '@/lib/types';
import { DocumentsManager } from './DocumentsManager';
import { GradeGate } from './GradeGate';

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

  // Documents-first: grade is the one thing needed before the required-
  // document list can be shown (it decides support-staff vs not). Gate on
  // it whenever there's no application yet, or a still-editable one that
  // hasn't set it.
  const needsGrade =
    !application ||
    (!application.grade && APPLICANT_EDITABLE_STATUSES.includes(application.status));

  if (needsGrade) {
    const { data: payScale } = await supabase
      .from('pay_scale')
      .select('*')
      .order('grade')
      .order('grade_point');

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Start your onboarding
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            First, tell us your grade — from your appointment letter — so we
            can show exactly which documents you need. You&apos;ll fill in
            the rest of your details afterwards.
          </p>
        </div>
        <GradeGate payScale={(payScale ?? []) as PayScaleRow[]} />
      </div>
    );
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application.id)
    .order('uploaded_at');

  const editable = APPLICANT_EDITABLE_STATUSES.includes(application.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Required documents
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Upload clear scans or photos (PDF, JPEG, or PNG, max 5MB each) —
          list shown for grade {application.grade}.
        </p>
      </div>
      <DocumentsManager
        documents={(documents ?? []) as DocumentRow[]}
        requiredTypes={requiredDocTypes(application.grade)}
        editable={editable}
      />
      {editable && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Once your documents are uploaded, continue to fill in the rest of
            your application details.
          </p>
          <Link
            href="/application"
            className="mt-4 inline-block rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Continue to application form →
          </Link>
        </div>
      )}
    </div>
  );
}
