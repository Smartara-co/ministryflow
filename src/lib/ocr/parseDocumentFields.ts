/**
 * Pattern-matching over free-form OCR text to suggest field values —
 * deliberately NOT a full document-understanding system. Every result here
 * is surfaced to the applicant as a checkbox suggestion, never silently
 * applied (see DocumentInsights.tsx / applyExtractedFields).
 *
 * Patterns below are tuned against real sample documents (PMO appointment
 * letters, MoH posting notifications, GRA TIN certificates, ECOWAS ID
 * cards, Gambian birth certificates) rather than assumed formats — several
 * assumptions from the first pass turned out wrong against real samples:
 *  - ID cards label the ID field "Document number", not "National ID No".
 *  - Dates appear both numerically (26/11/1998) and spelled out
 *    ("26 November 1998") depending on document type.
 *  - MoH posting letters use region names that don't match Gambia's
 *    standard 7-region list (e.g. "North Bank East Region" — a health-
 *    sector administrative subdivision) — so posting_region is matched
 *    generically ("<name> Region") rather than against a fixed list.
 *
 * date_joined (assumption-of-duty date) is intentionally never parsed
 * here — it drives the payroll cutoff calculation directly, and a bad OCR
 * read on that field has real financial consequences. It stays
 * manual-entry only, no matter how reliable the other parsers get.
 */

export interface ExtractedField {
  /** Matches a column name in the `applications` table (and the
   *  EXTRACTABLE_FIELDS allowlist in the applicant server actions). */
  field: string;
  label: string;
  value: string;
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const NUMERIC_DATE = '\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}';
const TEXTUAL_DATE = `\\d{1,2}\\s+(?:${MONTH_NAMES.join('|')})\\s+\\d{4}`;
/** Matches either "26/11/1998" or "26 November 1998" — real documents use
 *  both depending on issuer (ID cards are numeric; GRA/birth certificates
 *  spell the month out). */
const DATE_PATTERN = `(?:${NUMERIC_DATE}|${TEXTUAL_DATE})`;

/** Accepts either date format normalizeDate above matches. Returns null
 *  (rather than a best-guess) on anything ambiguous — an invalid or
 *  misread date is worse than no suggestion at all. */
export function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();

  const numeric = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (numeric) {
    const [, d, m, yRaw] = numeric;
    const day = Number(d);
    const month = Number(m);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const textual = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (textual) {
    const [, d, monthName, y] = textual;
    const day = Number(d);
    const monthIndex = MONTH_NAMES.indexOf(monthName.toLowerCase());
    if (monthIndex === -1 || day < 1 || day > 31) return null;
    return `${y}-${(monthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  return null;
}

/** Finds `label`, then searches up to `window` characters after it
 *  (including across line breaks — real forms often put the value on the
 *  line below a bilingual label, not beside it) for `valuePattern`. */
function findLabeledValue(
  text: string,
  labelPattern: string,
  valuePattern: string,
  window: number,
): string | null {
  const re = new RegExp(`(?:${labelPattern})[\\s\\S]{0,${window}}?(${valuePattern})`, 'i');
  return re.exec(text)?.[1] ?? null;
}

export function parseIdCard(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  // Real Gambian ECOWAS ID cards label this "Document number" (bilingual:
  // "Numero de document") — not "National ID No" as a first guess assumed.
  const idValue = findLabeledValue(
    text,
    'document\\s*number|numero\\s*de\\s*document|national\\s*id\\s*(?:no\\.?|number)?|\\bnin\\b|id\\s*no\\.?',
    '[0-9][0-9\\- ]{6,19}[0-9]',
    30,
  );
  if (idValue) {
    fields.push({ field: 'national_id_no', label: 'National ID number', value: idValue.trim() });
  }

  // ID cards often show 3 dates (birth, issue, expiry) — anchor on the
  // "date of birth" label specifically rather than grabbing the first
  // date-like text in the document, to avoid picking up issue/expiry.
  const dobValue = findLabeledValue(
    text,
    'date\\s*of\\s*birth|date\\s*de\\s*naissance',
    DATE_PATTERN,
    40,
  );
  if (dobValue) {
    const iso = normalizeDate(dobValue);
    if (iso) fields.push({ field: 'date_of_birth', label: 'Date of birth', value: iso });
  }

  const genderValue = findLabeledValue(text, '\\bsex\\b|\\bgender\\b', 'male|female|\\bm\\b|\\bf\\b', 40);
  if (genderValue) {
    const value = genderValue.toLowerCase().startsWith('m') ? 'male' : 'female';
    fields.push({ field: 'gender', label: 'Gender', value });
  }

  return fields;
}

export function parseTinCertificate(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  const tinValue = findLabeledValue(text, '\\bTIN\\b', '[0-9][0-9-]{5,14}[0-9]', 30);
  if (tinValue) {
    fields.push({ field: 'tin', label: 'TIN', value: tinValue.trim() });
  }

  // GRA TIN certificates also print the holder's birth date — a useful
  // cross-check/fallback alongside the ID card.
  const dobValue = findLabeledValue(text, 'birth\\s*date|date\\s*of\\s*birth', DATE_PATTERN, 30);
  if (dobValue) {
    const iso = normalizeDate(dobValue);
    if (iso) fields.push({ field: 'date_of_birth', label: 'Date of birth', value: iso });
  }

  return fields;
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

  // PMO appointment letters use the template phrase "...approved your
  // appointment as <Job Title> with the Government of The Gambia...".
  const jobMatch =
    /appointment\s+as\s+([A-Za-z][A-Za-z '-]{2,60}?)\s+with\s+the\s+government/i.exec(text);
  if (jobMatch) {
    fields.push({ field: 'job_title', label: 'Job title', value: jobMatch[1].trim() });
  }

  // Stated as an ANNUAL amount, e.g. "GMD 74,220 (...) per annum" — our
  // schema stores a MONTHLY basic salary, so this is divided by 12. Shown
  // with its derivation in the label so it can be sanity-checked, since
  // this is the one financial figure this pipeline computes rather than
  // just transcribes.
  const salaryMatch = /(?:GMD|D)\s*([\d,]{4,12})[\s\S]{0,80}?per\s+annum/i.exec(text);
  if (salaryMatch) {
    const annual = Number(salaryMatch[1].replace(/,/g, ''));
    if (Number.isFinite(annual) && annual > 0) {
      const monthly = Math.round((annual / 12) * 100) / 100;
      fields.push({
        field: 'basic_salary',
        label: `Basic salary (monthly, from GMD ${annual.toLocaleString('en-GM')}/year)`,
        value: monthly.toFixed(2),
      });
    }
  }

  return fields;
}

/** Common filler words that can precede "Region" without being part of
 *  the actual region name (e.g. "posted to the North Bank East Region" —
 *  "the" must be trimmed off, "North Bank East" kept). */
const REGION_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'in',
  'at',
  'no',
  'any',
  'some',
  'which',
  'what',
  'this',
  'that',
  'said',
  'your',
  'our',
  'above',
  'same',
  'and',
  'of',
  'for',
]);

/** Matches "<name> Region" generically rather than against a fixed list —
 *  MoH posting letters use health-sector regional subdivisions (e.g.
 *  "North Bank East Region") that don't match Gambia's standard 7-region
 *  civil administrative list, so a closed list silently misses them. */
export function parsePostingNotification(text: string): ExtractedField[] {
  const match = /\b((?:[A-Za-z]+\s+){1,6})Region\b/i.exec(text);
  if (!match) return [];

  const words = match[1].trim().split(/\s+/);
  const kept: string[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    if (REGION_STOPWORDS.has(words[i].toLowerCase())) break;
    kept.unshift(words[i]);
  }
  if (kept.length === 0) return [];

  const canonical = `${kept
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')} Region`;
  return [{ field: 'posting_region', label: 'Posting region', value: canonical }];
}

export function parseBirthCertificate(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  const dobValue = findLabeledValue(text, 'date\\s*of\\s*birth', DATE_PATTERN, 30);
  if (dobValue) {
    const iso = normalizeDate(dobValue);
    if (iso) fields.push({ field: 'date_of_birth', label: 'Date of birth', value: iso });
  }

  // Cross-check/fallback alongside the ID card.
  const genderValue = findLabeledValue(text, '\\bsex\\b', 'male|female|\\bm\\b|\\bf\\b', 20);
  if (genderValue) {
    const value = genderValue.toLowerCase().startsWith('m') ? 'male' : 'female';
    fields.push({ field: 'gender', label: 'Gender', value });
  }

  return fields;
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
