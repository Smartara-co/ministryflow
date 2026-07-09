import type { ApplicationStatus, Role } from './types';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  needs_correction: 'Needs correction',
  rejected: 'Rejected',
  approved: 'Approved',
  sal1_generated: 'SAL 1 generated',
};

export const STATUS_BADGE_CLASSES: Record<ApplicationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-sky-100 text-sky-800',
  under_review: 'bg-amber-100 text-amber-800',
  needs_correction: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
  approved: 'bg-emerald-100 text-emerald-800',
  sal1_generated: 'bg-emerald-200 text-emerald-900',
};

/** The state machine from CLAUDE.md §5. Server actions validate against this
 *  before writing; RLS limits who can write at all. */
const TRANSITIONS: Record<
  ApplicationStatus,
  Partial<Record<ApplicationStatus, Role[]>>
> = {
  draft: { submitted: ['applicant'] },
  submitted: { under_review: ['ministry_admin'] },
  under_review: {
    approved: ['ministry_admin'],
    rejected: ['ministry_admin'],
    needs_correction: ['ministry_admin'],
  },
  needs_correction: { submitted: ['applicant'] },
  approved: { sal1_generated: ['ministry_admin'] },
  rejected: {},
  sal1_generated: {},
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  role: Role,
): boolean {
  return TRANSITIONS[from]?.[to]?.includes(role) ?? false;
}

/** Statuses in which the applicant may edit the form and documents. */
export const APPLICANT_EDITABLE_STATUSES: ApplicationStatus[] = [
  'draft',
  'needs_correction',
];
