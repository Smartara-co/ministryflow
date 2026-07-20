'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PayScaleRow } from '@/lib/types';
import { startApplicationWithGrade } from '../../actions';

/** The one field needed before the required-documents list can be shown:
 *  grade determines support-staff vs non-support-staff document types. */
export function GradeGate({ payScale }: { payScale: PayScaleRow[] }) {
  const router = useRouter();
  const [grade, setGrade] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grades = useMemo(
    () => Array.from(new Set(payScale.map((row) => row.grade))),
    [payScale],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!grade.trim()) {
      setError('Enter your grade to continue.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await startApplicationWithGrade(grade);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? 'Something went wrong.');
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8"
    >
      <label htmlFor="grade" className="block text-sm font-medium text-slate-700">
        Your grade (from your appointment letter)
      </label>
      {grades.length > 0 ? (
        <select
          id="grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        >
          <option value="">— Select —</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      ) : (
        <input
          id="grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="e.g. 7"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-full bg-emerald-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
