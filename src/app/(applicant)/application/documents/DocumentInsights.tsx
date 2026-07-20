'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ExtractedField } from '@/lib/ocr/parseDocumentFields';
import { applyExtractedFields, type ActionResult } from '../../actions';

/** Review panel for OCR suggestions — nothing here is ever saved without
 *  the applicant explicitly ticking a field and clicking Apply. */
export function DocumentInsights({ fields }: { fields: ExtractedField[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(fields.map((_, i) => i)),
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function apply() {
    const payload: Record<string, string> = {};
    fields.forEach((f, i) => {
      if (selected.has(i)) payload[f.field] = f.value;
    });
    startTransition(async () => {
      const outcome = await applyExtractedFields(payload);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  if (result?.ok) {
    return (
      <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Applied — you can still edit these on the application form.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
      <p className="text-xs font-medium text-sky-900">
        We read some details from this document — check they&apos;re correct, then apply:
      </p>
      <ul className="mt-2 space-y-1.5">
        {fields.map((f, i) => (
          <li key={f.field} className="flex items-center gap-2 text-xs text-sky-900">
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              className="h-3.5 w-3.5 rounded border-sky-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span className="font-medium">{f.label}:</span>
            <span>{f.value}</span>
          </li>
        ))}
      </ul>
      {result && !result.ok && (
        <p className="mt-2 text-xs text-red-600">{result.message}</p>
      )}
      <button
        type="button"
        onClick={apply}
        disabled={pending || selected.size === 0}
        className="mt-2 rounded-full bg-emerald-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? 'Applying…' : 'Apply to application'}
      </button>
    </div>
  );
}
