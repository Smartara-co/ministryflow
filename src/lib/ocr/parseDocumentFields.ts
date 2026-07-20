/**
 * Pattern-matching over free-form OCR text to suggest field values —
 * deliberately NOT a full document-understanding system. Every result here
 * is surfaced to the applicant as a checkbox suggestion, never silently
 * applied (see DocumentInsights.tsx / applyExtractedFields).
 *
 * date_joined (assumption-of-duty date) is intentionally never parsed here
 * — it drives the payroll cutoff calculation directly, and a bad OCR read
 * on that field has real financial consequences. It stays manual-entry only.
 */

export interface ExtractedField {
  /** Matches a column name in the `applications` table (and the
   *  EXTRACTABLE_FIELDS allowlist in the applicant server actions). */
  field: string;
  label: string;
  value: string;
}

const GAMBIA_REGIONS = [
  'Banjul',
  'Kanifing',
  'West Coast Region',
  'North Bank Region',
  'Lower River Region',
  'Central River Region',
  'Upper River Region',
];

/** Accepts DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY — the common local format.
 *  Returns null (rather than a best-guess) on anything ambiguous, since an
 *  invalid or misread date is worse than no suggestion at all. */
export function normalizeDate(raw: string): string | null {
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(raw.trim());
  if (!match) return null;
  const [, d, m, yRaw] = match;
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function parseIdCard(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  const idMatch = /(?:national\s*id\s*(?:no\.?|number)?|\bnin\b|id\s*no\.?)[:\s]*([\d ]{9,20})/i.exec(
    text,
  );
  if (idMatch) {
    fields.push({
      field: 'national_id_no',
      label: 'National ID number',
      value: idMatch[1].trim(),
    });
  }

  const dobMatch = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/.exec(text);
  if (dobMatch) {
    const iso = normalizeDate(dobMatch[1]);
    if (iso) fields.push({ field: 'date_of_birth', label: 'Date of birth', value: iso });
  }

  const genderMatch = /\b(?:sex|gender)[:\s]*\b(male|female|m|f)\b/i.exec(text);
  if (genderMatch) {
    const value = genderMatch[1].toLowerCase().startsWith('m') ? 'male' : 'female';
    fields.push({ field: 'gender', label: 'Gender', value });
  }

  return fields;
}

export function parseTinCertificate(text: string): ExtractedField[] {
  const match = /\bTIN\b[:#\s]*([0-9-]{6,15})/i.exec(text);
  return match ? [{ field: 'tin', label: 'TIN', value: match[1].trim() }] : [];
}

export function parseAppointmentLetter(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const gradeMatch = /\bgrade\b[:\s]*([0-9]{1,2}(?:\.[0-9]{1,2})?)/i.exec(text);
  if (gradeMatch) {
    const raw = gradeMatch[1];
    const grade = raw.split('.')[0];
    fields.push({ field: 'grade', label: 'Grade', value: grade });
    fields.push({
      field: 'appointment_grade',
      label: 'Grade (from Appointment letter)',
      value: grade,
    });
    if (raw.includes('.')) {
      fields.push({ field: 'grade_point', label: 'Grade point', value: raw });
    }
  }
  return fields;
}

/** Matches against the closed list of Gambian regions rather than a generic
 *  label pattern — far more reliable than free-text extraction. */
export function parsePostingNotification(text: string): ExtractedField[] {
  const pattern = new RegExp(`\\b(${GAMBIA_REGIONS.join('|')})\\b`, 'i');
  const match = pattern.exec(text);
  if (!match) return [];
  const canonical = GAMBIA_REGIONS.find((r) => r.toLowerCase() === match[1].toLowerCase());
  return canonical
    ? [{ field: 'posting_region', label: 'Posting region', value: canonical }]
    : [];
}

export function parseBirthCertificate(text: string): ExtractedField[] {
  const dobMatch = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/.exec(text);
  if (!dobMatch) return [];
  const iso = normalizeDate(dobMatch[1]);
  return iso ? [{ field: 'date_of_birth', label: 'Date of birth', value: iso }] : [];
}

const PARSERS: Record<string, (text: string) => ExtractedField[]> = {
  id_card_or_passport: parseIdCard,
  tin_certificate: parseTinCertificate,
  appointment_letter: parseAppointmentLetter,
  posting_notification: parsePostingNotification,
  birth_certificate: parseBirthCertificate,
};

export function hasParserForDocType(docType: string): boolean {
  return docType in PARSERS;
}

export function parseFieldsForDocType(docType: string, text: string): ExtractedField[] {
  return PARSERS[docType]?.(text) ?? [];
}
