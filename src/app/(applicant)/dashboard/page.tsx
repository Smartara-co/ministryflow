import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { getSessionProfile } from '@/lib/auth';
import { DOCUMENT_CONFIG, requiredDocTypes } from '@/lib/documents';
import { APPLICANT_EDITABLE_STATUSES } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { Application } from '@/lib/types';

export const metadata = { title: 'Dashboard — MinistryFlow' };

export default async function ApplicantDashboard() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  if (!session || !supabase) return null;

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('applicant_id', session.userId)
    .maybeSingle();
  const application = data as Application | null;

  const { data: docs } = application
    ? await supabase
        .from('documents')
        .select('doc_type')
        .eq('application_id', application.id)
    : { data: [] };
  const uploadedTypes = new Set((docs ?? []).map((d) => d.doc_type));
  const required = requiredDocTypes(application?.grade);
  const missingDocs = required.filter((t) => !uploadedTypes.has(t));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome{session.profile.full_name ? `, ${session.profile.full_name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Track your onboarding application for salary setup.
        </p>
      </div>

      {!application ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Start your onboarding application
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Fill in your details as they appear on your appointment letter,
            upload the required documents, and submit for review by the
            Accounts Office.
          </p>
          <Link
            href="/application"
            className="mt-6 inline-block rounded-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Start application
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Your application
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {application.job_title ?? 'Position not set'} · Grade{' '}
                  {application.grade ?? '—'}
                  {application.grade_point ? ` (point ${application.grade_point})` : ''}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </div>

            {application.status === 'needs_correction' && (
              <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-900">
                  The Accounts Office requested corrections:
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-orange-900">
                  {application.admin_comments}
                </p>
                <p className="mt-3 text-sm text-orange-800">
                  Update your form and documents, then resubmit from the
                  application page.
                </p>
              </div>
            )}

            {application.status === 'rejected' && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900">
                  Your application was rejected:
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-red-900">
                  {application.admin_comments}
                </p>
              </div>
            )}

            {(application.status === 'approved' ||
              application.status === 'sal1_generated') && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Your application has been approved. The Accounts Office is
                processing your salary input (SAL 1) form.
              </div>
            )}

            {APPLICANT_EDITABLE_STATUSES.includes(application.status) && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/application"
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
                >
                  Edit application
                </Link>
                <Link
                  href="/application/documents"
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Manage documents
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            <p className="mt-1 text-sm text-slate-600">
              {required.length - missingDocs.length} of {required.length} required
              document types uploaded.
            </p>
            {missingDocs.length > 0 && (
              <ul className="mt-4 list-inside list-disc text-sm text-slate-600">
                {missingDocs.map((type) => (
                  <li key={type}>{DOCUMENT_CONFIG[type].label} — missing</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
