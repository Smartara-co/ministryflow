import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { isSupportStaffGrade } from '@/lib/config';
import { DOCUMENT_CONFIG, type DocType } from '@/lib/documents';
import {
  calculatePayableAmount,
  calculatePayrollAction,
} from '@/lib/payroll/calculatePayrollAction';
import { createClient } from '@/lib/supabase/server';
import type {
  AllowanceRow,
  Application,
  ApplicationPayElement,
  AuditLogRow,
  DocumentRow,
} from '@/lib/types';
import { formatDalasi } from '@/lib/types';
import { ReviewPanel } from './ReviewPanel';

export const metadata = { title: 'Review application — MinistryFlow' };

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const app = data as Application | null;
  if (!app || app.status === 'draft') notFound();

  const [{ data: docs }, { data: elements }, { data: allowances }, { data: audit }] =
    await Promise.all([
      supabase.from('documents').select('*').eq('application_id', id).order('doc_type'),
      supabase.from('application_pay_elements').select('*').eq('application_id', id),
      supabase.from('allowances').select('*').order('category'),
      supabase
        .from('audit_log')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false }),
    ]);

  const documents = (docs ?? []) as DocumentRow[];
  const payElements = (elements ?? []) as ApplicationPayElement[];
  const allAllowances = (allowances ?? []) as AllowanceRow[];
  const auditRows = (audit ?? []) as AuditLogRow[];

  const signedDocs = await Promise.all(
    documents.map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from('application-documents')
        .createSignedUrl(doc.storage_path, 60 * 60);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );

  const supportStaff = Boolean(app.grade && isSupportStaffGrade(app.grade));

  // Payroll cutoff (CLAUDE.md §5) based on the assumption-of-duty date.
  const earningsTotal = payElements
    .filter((e) => e.element_type === 'earning')
    .reduce((sum, e) => sum + (e.period_amount ?? 0), 0);
  const monthlyPay = earningsTotal > 0 ? earningsTotal : (app.basic_salary ?? 0);
  const payroll = app.date_joined
    ? {
        action: calculatePayrollAction(app.date_joined),
        amount: calculatePayableAmount(app.date_joined, monthlyPay),
        basisNote:
          earningsTotal > 0
            ? 'basic salary + approved allowances'
            : 'basic salary only (allowances not yet approved)',
      }
    : null;

  const fullName =
    [app.title, app.first_name, app.surname].filter(Boolean).join(' ') || '(name not set)';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{fullName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {app.job_title ?? 'Position not set'} · Grade {app.grade ?? '—'}
            {app.grade_point ? ` (point ${app.grade_point})` : ''}
            {supportStaff && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Support staff
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Personal details</h2>
            <dl className="mt-4">
              <DetailRow label="National ID" value={app.national_id_no} />
              <DetailRow label="Date of birth" value={app.date_of_birth} />
              <DetailRow label="Gender" value={app.gender} />
              <DetailRow label="TIN" value={app.tin} />
              <DetailRow label="Mobile" value={app.mobile_phone} />
              <DetailRow label="Email" value={app.email} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Employment</h2>
            <dl className="mt-4">
              <DetailRow label="Employment status" value={app.employment_status} />
              <DetailRow label="Budget entity" value={app.budget_entity} />
              <DetailRow label="Sub budget entity" value={app.sub_budget_entity} />
              <DetailRow label="Employee no." value={app.employee_no} />
              <DetailRow
                label="Basic salary (monthly)"
                value={formatDalasi(app.basic_salary)}
              />
              <DetailRow label="Hired from" value={app.hired_from_date} />
              <DetailRow label="Hired to" value={app.hired_to_date} />
              <DetailRow label="Assumption of duty" value={app.date_joined} />
              <DetailRow label="Duty station" value={app.location} />
              <DetailRow
                label="Posting region (Posting Notification)"
                value={app.posting_region}
              />
              <DetailRow
                label="Grade (Appointment letter)"
                value={app.appointment_grade}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Payment & statutory</h2>
            <dl className="mt-4">
              <DetailRow label="Payment type" value={app.payment_type} />
              <DetailRow label="Tax type" value={app.tax_type} />
              <DetailRow
                label="Social security"
                value={app.liable_soc_security ? `Yes — ${app.soc_security_no ?? 'no number'}` : 'No'}
              />
              <DetailRow label="WOPS" value={app.liable_wops ? 'Yes' : 'No'} />
              <DetailRow label="Member / partial" value={app.member_or_partial} />
              {app.payment_type === 'bank' && (
                <>
                  <DetailRow label="Account name" value={app.bank_account_name} />
                  <DetailRow label="Account no." value={app.bank_account_no} />
                  <DetailRow label="Branch code" value={app.bank_branch_code} />
                  <DetailRow label="Account type" value={app.bank_account_type} />
                </>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Documents</h2>
            {signedDocs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No documents uploaded.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {signedDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-2.5 text-sm"
                  >
                    <span className="text-slate-700">
                      {DOCUMENT_CONFIG[doc.doc_type as DocType]?.label ?? doc.doc_type}
                    </span>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-slate-400">unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {payElements.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">
                SAL 1 earning elements
              </h2>
              <table className="mt-4 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Code</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 text-right font-medium">Period</th>
                    <th className="py-2 text-right font-medium">Total (yr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payElements.map((el) => (
                    <tr key={el.id}>
                      <td className="py-2 text-slate-700">{el.code ?? '—'}</td>
                      <td className="py-2 text-slate-700">{el.description}</td>
                      <td className="py-2 text-right text-slate-900">
                        {formatDalasi(el.period_amount)}
                      </td>
                      <td className="py-2 text-right text-slate-900">
                        {formatDalasi(el.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">History</h2>
            {auditRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No history yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {auditRows.map((row) => (
                  <li key={row.id} className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">
                      {row.from_status
                        ? `${row.from_status} → ${row.to_status}`
                        : `created (${row.to_status})`}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {new Date(row.created_at).toLocaleString('en-GB')}
                    </span>
                    {row.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{row.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {payroll && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Payroll cutoff</h2>
              <p className="mt-1 text-xs text-slate-500">
                Assumption of duty: {app.date_joined}
              </p>
              <div
                className={`mt-4 rounded-xl p-4 text-sm ${
                  payroll.action === 'full'
                    ? 'bg-emerald-50 text-emerald-900'
                    : payroll.action === 'prorated'
                      ? 'bg-amber-50 text-amber-900'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {payroll.action === 'full' && (
                  <p>
                    <strong>Full pay</strong> — included in the current month&apos;s
                    payroll at 100%: {formatDalasi(payroll.amount)} ({payroll.basisNote}).
                  </p>
                )}
                {payroll.action === 'prorated' && (
                  <p>
                    <strong>Prorated pay</strong> — {formatDalasi(payroll.amount)} this
                    month ({payroll.basisNote}), full pay from next month.
                  </p>
                )}
                {payroll.action === 'zero' && (
                  <p>
                    <strong>Rollover</strong> — excluded from the current month&apos;s
                    payroll file; the record rolls to next month&apos;s cycle
                    automatically.
                  </p>
                )}
              </div>
            </section>
          )}

          <ReviewPanel
            application={app}
            allowances={allAllowances}
            supportStaff={supportStaff}
          />
        </div>
      </div>
    </div>
  );
}
