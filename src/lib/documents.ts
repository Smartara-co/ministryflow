import { isSupportStaffGrade } from './config';

export const DOC_TYPES = [
  'passport_photo',
  'appointment_letter',
  'acceptance_assumption_of_duties',
  'posting_notification',
  'birth_certificate',
  'id_card_or_passport',
  'tin_certificate',
  'bank_details',
  'pmo_clearance_letter',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

interface DocTypeConfig {
  label: string;
  maxFiles: number;
  /** 'all' | 'support_staff_only' | 'non_support_staff_only' */
  appliesTo: 'all' | 'support_staff_only' | 'non_support_staff_only';
  hint?: string;
}

export const DOCUMENT_CONFIG: Record<DocType, DocTypeConfig> = {
  passport_photo: { label: 'Passport photo', maxFiles: 1, appliesTo: 'all' },
  appointment_letter: {
    label: 'Appointment letter',
    maxFiles: 1,
    appliesTo: 'all',
  },
  acceptance_assumption_of_duties: {
    label: 'Acceptance & assumption of duties letter',
    maxFiles: 1,
    appliesTo: 'non_support_staff_only',
    hint: 'Not required for support staff (cleaners, cooks, drivers, etc.)',
  },
  posting_notification: {
    label: 'Posting notification letter',
    maxFiles: 1,
    appliesTo: 'all',
    hint: 'The region on this letter determines any hardship allowance',
  },
  birth_certificate: {
    label: 'Birth certificate',
    maxFiles: 1,
    appliesTo: 'all',
  },
  id_card_or_passport: {
    label: 'National ID card or passport',
    maxFiles: 1,
    appliesTo: 'all',
  },
  tin_certificate: { label: 'TIN certificate', maxFiles: 1, appliesTo: 'all' },
  bank_details: {
    label: 'Bank details',
    maxFiles: 3,
    appliesTo: 'all',
    hint: 'Up to 3 files',
  },
  pmo_clearance_letter: {
    label: 'PMO clearance letter',
    maxFiles: 1,
    appliesTo: 'support_staff_only',
    hint: 'Required for support staff only',
  },
};

/** Which document types this applicant must provide, given their grade.
 *  Grade may be unknown (empty) while the form is incomplete — treated as
 *  non-support staff until a grade is entered. */
export function requiredDocTypes(grade: string | null | undefined): DocType[] {
  const supportStaff = Boolean(grade && isSupportStaffGrade(grade));
  return DOC_TYPES.filter((type) => {
    const applies = DOCUMENT_CONFIG[type].appliesTo;
    if (applies === 'support_staff_only') return supportStaff;
    if (applies === 'non_support_staff_only') return !supportStaff;
    return true;
  });
}

/** Mirror of the bucket-level limits in the storage migration. Validated on
 *  the client and again in the server action before hitting Storage. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];
