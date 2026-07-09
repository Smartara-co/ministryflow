import { StatusBadge } from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase/server';
import type {
  Application,
  ApplicationStatus,
  AuditLogRow,
  Department,
  Ministry,
  Profile,
} from '@/lib/types';
import { AdminForms } from './AdminForms';

export const metadata = { title: 'Super admin — MinistryFlow' };

export default async function SuperAdminPage() {
  const supabase = await createClient();
  if (!supabase) return null;

  const [
    { data: ministries },
    { data: departments },
    { data: applications },
    { data: admins },
    { data: audit },
  ] = await Promise.all([
    supabase.from('ministries').select('*').order('name'),
    supabase.from('departments').select('*').order('name'),
    supabase.from('applications').select('*').neq('status', 'draft'),
    supabase.from('profiles').select('*').eq('role', 'ministry_admin'),
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const ministryList = (ministries ?? []) as Ministry[];
  const departmentList = (departments ?? []) as Department[];
  const applicationList = (applications ?? []) as Application[];
  const adminList = (admins ?? []) as Profile[];
  const auditRows = (audit ?? []) as AuditLogRow[];

  const countsByMinistry = new Map<string, Partial<Record<ApplicationStatus, number>>>();
  for (const app of applicationList) {
    const counts = countsByMinistry.get(app.ministry_id) ?? {};
    counts[app.status] = (counts[app.status] ?? 0) + 1;
    countsByMinistry.set(app.ministry_id, counts);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Cross-ministry overview
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Applications, ministry admin accounts, and the full audit trail.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Ministries</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Ministry</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Departments</th>
                <th className="py-2 pr-4 font-medium">Admins</th>
                <th className="py-2 pr-4 font-medium">Pending review</th>
                <th className="py-2 font-medium">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ministryList.map((ministry) => {
                const counts = countsByMinistry.get(ministry.id) ?? {};
                const pending =
                  (counts.submitted ?? 0) + (counts.under_review ?? 0);
                const approved =
                  (counts.approved ?? 0) + (counts.sal1_generated ?? 0);
                return (
                  <tr key={ministry.id}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {ministry.name}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{ministry.code}</td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {departmentList.filter((d) => d.ministry_id === ministry.id).length}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {adminList.filter((a) => a.ministry_id === ministry.id).length}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{pending}</td>
                    <td className="py-2.5 text-slate-700">{approved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AdminForms ministries={ministryList} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Ministry admins</h2>
        {adminList.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No ministry admin accounts yet — send an invite above.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {adminList.map((admin) => (
              <li
                key={admin.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-900">
                  {admin.full_name ?? '(no name)'}
                </span>
                <span className="text-slate-600">
                  {ministryList.find((m) => m.id === admin.ministry_id)?.name ??
                    'No ministry assigned'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Audit trail</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every application status change, recorded automatically. Latest 30 shown.
        </p>
        {auditRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No activity yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Transition</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-700">
                      {new Date(row.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{row.action}</td>
                    <td className="py-2.5 pr-4">
                      {row.to_status && (
                        <span className="inline-flex items-center gap-1">
                          {row.from_status && (
                            <>
                              <StatusBadge
                                status={row.from_status as ApplicationStatus}
                              />
                              <span className="text-slate-400">→</span>
                            </>
                          )}
                          <StatusBadge status={row.to_status as ApplicationStatus} />
                        </span>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate py-2.5 text-slate-600">
                      {row.notes ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
