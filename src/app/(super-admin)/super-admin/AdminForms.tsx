'use client';

import { useRef, useState, useTransition } from 'react';
import type { Ministry } from '@/lib/types';
import {
  addDepartment,
  addMinistry,
  inviteMinistryAdmin,
  type ActionResult,
} from '../actions';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';
const labelClass = 'block text-sm font-medium text-slate-700';
const buttonClass =
  'mt-4 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60';

function ResultNote({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-700'
      }`}
    >
      {result.message}
    </p>
  );
}

export function AdminForms({ ministries }: { ministries: Ministry[] }) {
  const [pending, startTransition] = useTransition();
  const [inviteResult, setInviteResult] = useState<ActionResult | null>(null);
  const [ministryResult, setMinistryResult] = useState<ActionResult | null>(null);
  const [departmentResult, setDepartmentResult] = useState<ActionResult | null>(null);
  const inviteRef = useRef<HTMLFormElement>(null);
  const ministryRef = useRef<HTMLFormElement>(null);
  const departmentRef = useRef<HTMLFormElement>(null);

  function submit(
    formRef: React.RefObject<HTMLFormElement | null>,
    action: (data: FormData) => Promise<ActionResult>,
    setResult: (r: ActionResult) => void,
  ) {
    return (event: React.FormEvent) => {
      event.preventDefault();
      if (!formRef.current) return;
      const data = new FormData(formRef.current);
      startTransition(async () => {
        const result = await action(data);
        setResult(result);
        if (result.ok) formRef.current?.reset();
      });
    };
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Invite ministry admin
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sends an email invite; they set a password on first sign-in.
        </p>
        <form
          ref={inviteRef}
          onSubmit={submit(inviteRef, inviteMinistryAdmin, setInviteResult)}
          className="mt-4 space-y-3"
        >
          <div>
            <label htmlFor="invite_full_name" className={labelClass}>
              Full name
            </label>
            <input id="invite_full_name" name="full_name" className={inputClass} />
          </div>
          <div>
            <label htmlFor="invite_email" className={labelClass}>
              Email
            </label>
            <input
              id="invite_email"
              name="email"
              type="email"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="invite_ministry" className={labelClass}>
              Ministry
            </label>
            <select id="invite_ministry" name="ministry_id" required className={inputClass}>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>
            Send invite
          </button>
          <ResultNote result={inviteResult} />
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Add ministry</h2>
        <p className="mt-1 text-xs text-slate-500">
          The onboarding format is shared — new ministries reuse it as-is.
        </p>
        <form
          ref={ministryRef}
          onSubmit={submit(ministryRef, addMinistry, setMinistryResult)}
          className="mt-4 space-y-3"
        >
          <div>
            <label htmlFor="ministry_name" className={labelClass}>
              Name
            </label>
            <input
              id="ministry_name"
              name="name"
              required
              className={inputClass}
              placeholder="Ministry of…"
            />
          </div>
          <div>
            <label htmlFor="ministry_code" className={labelClass}>
              Code
            </label>
            <input
              id="ministry_code"
              name="code"
              required
              className={inputClass}
              placeholder="e.g. MOH"
            />
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>
            Add ministry
          </button>
          <ResultNote result={ministryResult} />
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Add department</h2>
        <form
          ref={departmentRef}
          onSubmit={submit(departmentRef, addDepartment, setDepartmentResult)}
          className="mt-4 space-y-3"
        >
          <div>
            <label htmlFor="department_ministry" className={labelClass}>
              Ministry
            </label>
            <select
              id="department_ministry"
              name="ministry_id"
              required
              className={inputClass}
            >
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="department_name" className={labelClass}>
              Department name
            </label>
            <input id="department_name" name="name" required className={inputClass} />
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>
            Add department
          </button>
          <ResultNote result={departmentResult} />
        </form>
      </section>
    </div>
  );
}
