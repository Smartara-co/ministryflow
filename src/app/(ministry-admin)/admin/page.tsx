import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/lib/status';
import { createClient } from '@/lib/supabase/server';
import type { Application, ApplicationStatus } from '@/lib/types';

export const metadata = { title: 'Applications — MinistryFlow' };

const FILTERS: Array<ApplicationStatus | 'all'> = [
  'all',
  'submitted',
  'under_review',
  'needs_correction',
  'approved',
  'sal1_generated',
  'rejected',
];

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  if (!supabase) return null;

  let query = supabase
    .from('applications')
    .select('*')
    .neq('status', 'draft') // drafts are the applicant's private workspace
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data } = await query;
  const applications = (data ?? []) as Application[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Onboarding applications
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Submissions to your ministry, most recent first.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = (status ?? 'all') === filter;
          return (
            <Link
              key={filter}
              href={filter === 'all' ? '/admin' : `/admin?status=${filter}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-emerald-700 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {filter === 'all' ? 'All' : STATUS_LABELS[filter]}
            </Link>
          );
        })}
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          No applications{status && status !== 'all' ? ' with this status' : ''} yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Applicant</th>
                <th className="px-6 py-3 font-medium">Position</th>
                <th className="px-6 py-3 font-medium">Grade</th>
                <th className="px-6 py-3 font-medium">Assumed duty</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Submitted</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {[app.title, app.first_name, app.surname].filter(Boolean).join(' ') ||
                      '(name not set)'}
                  </td>
                  <td className="px-6 py-4 text-slate-700">{app.job_title ?? '—'}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {app.grade ?? '—'}
                    {app.grade_point ? ` / ${app.grade_point}` : ''}
                  </td>
                  <td className="px-6 py-4 text-slate-700">{app.date_joined ?? '—'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {app.submitted_at
                      ? new Date(app.submitted_at).toLocaleDateString('en-GB')
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
