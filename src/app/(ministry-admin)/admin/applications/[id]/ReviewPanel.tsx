'use client';

import { useState, useTransition } from 'react';
import type { AllowanceRow, Application } from '@/lib/types';
import { formatDalasi } from '@/lib/types';
import {
  decideApplication,
  markSal1Generated,
  startReview,
  type ActionResult,
} from '../../../actions';

/** Preselect the hardship allowance row that matches the region on the
 *  Posting Notification letter and the grade on the Appointment letter —
 *  the document-driven lookup rule. Support staff are exempt from hardship. */
function isSuggested(
  allowance: AllowanceRow,
  application: Application,
  supportStaff: boolean,
): boolean {
  if (allowance.category !== 'hardship') return false;
  if (supportStaff) return false;
  if (!allowance.region || !application.posting_region) return false;
  const regionMatches =
    allowance.region.trim().toLowerCase() ===
    application.posting_region.trim().toLowerCase();
  const gradeMatches =
    !allowance.grade ||
    allowance.grade.trim() === (application.appointment_grade ?? '').trim();
  return regionMatches && gradeMatches;
}

export function ReviewPanel({
  application,
  allowances,
  supportStaff,
}: {
  application: Application;
  allowances: AllowanceRow[];
  supportStaff: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [comments, setComments] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        allowances
          .filter((a) => isSuggested(a, application, supportStaff))
          .map((a) => a.id),
      ),
  );

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const decide = (decision: 'approved' | 'rejected' | 'needs_correction') =>
    run(() =>
      decideApplication({
        applicationId: application.id,
        decision,
        comments,
        allowanceIds: decision === 'approved' ? Array.from(selected) : [],
      }),
    );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Review actions</h2>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}

      {application.status === 'submitted' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => startReview(application.id))}
          className="mt-4 w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Start review'}
        </button>
      )}

      {application.status === 'under_review' && (
        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700">
              Allowances (tick those that apply)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Check eligibility against the appointment letter and posting
              notification. The matching hardship rate is preselected.
              {supportStaff && ' Support staff are exempt from hardship allowance.'}
            </p>
            {allowances.length === 0 ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No allowance rates are loaded yet — seed the allowances table
                from the ministry&apos;s approved rates before approving with
                allowances.
              </p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {allowances.map((allowance) => (
                  <li key={allowance.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.has(allowance.id)}
                        onChange={() => toggle(allowance.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                      <span>
                        <span className="font-medium text-slate-900">
                          {allowance.category.replace(/_/g, ' ')}
                          {allowance.subcategory ? ` — ${allowance.subcategory}` : ''}
                        </span>{' '}
                        <span className="text-slate-600">
                          {formatDalasi(allowance.amount)}/mo
                        </span>
                        {(allowance.region || allowance.grade) && (
                          <span className="block text-xs text-slate-500">
                            {allowance.region && `Region: ${allowance.region}`}
                            {allowance.region && allowance.grade && ' · '}
                            {allowance.grade && `Grade: ${allowance.grade}`}
                          </span>
                        )}
                        {allowance.eligible_staff_note && (
                          <span className="block text-xs text-slate-500">
                            {allowance.eligible_staff_note}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="comments" className="text-sm font-medium text-slate-700">
              Comments{' '}
              <span className="font-normal text-slate-500">
                (required for reject / request correction)
              </span>
            </label>
            <textarea
              id="comments"
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Explain what must be corrected, or why the application is rejected…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('approved')}
              className="w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('needs_correction')}
              className="w-full rounded-full border border-orange-300 px-5 py-2.5 text-sm font-medium text-orange-800 transition hover:bg-orange-50 disabled:opacity-60"
            >
              Request corrections
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('rejected')}
              className="w-full rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {(application.status === 'approved' ||
        application.status === 'sal1_generated') && (
        <div className="mt-4 space-y-3">
          <a
            href={`/api/applications/${application.id}/sal1`}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-full bg-emerald-700 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Open SAL 1 form (PDF)
          </a>
          {application.status === 'approved' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markSal1Generated(application.id))}
              className="w-full rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              {pending ? 'Working…' : 'Mark SAL 1 as issued'}
            </button>
          )}
        </div>
      )}

      {(application.status === 'rejected' ||
        application.status === 'needs_correction') && (
        <p className="mt-4 text-sm text-slate-600">
          {application.status === 'rejected'
            ? 'This application was rejected.'
            : 'Waiting for the applicant to make corrections and resubmit.'}
        </p>
      )}
    </section>
  );
}
