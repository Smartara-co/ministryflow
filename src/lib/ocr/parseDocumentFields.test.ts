import { describe, expect, it } from 'vitest';
import {
  normalizeDate,
  parseAppointmentLetter,
  parseBirthCertificate,
  parseIdCard,
  parsePostingNotification,
  parseTinCertificate,
} from './parseDocumentFields';

describe('normalizeDate', () => {
  it('parses DD/MM/YYYY (ID card format)', () => {
    expect(normalizeDate('26/11/1998')).toBe('1998-11-26');
  });

  it('parses DD-MM-YYYY with 2-digit year', () => {
    expect(normalizeDate('18-07-94')).toBe('2094-07-18');
  });

  it('parses "DD Month YYYY" (GRA/birth certificate format)', () => {
    expect(normalizeDate('26 November 1998')).toBe('1998-11-26');
  });

  it('is case-insensitive on the month name', () => {
    expect(normalizeDate('5 march 1990')).toBe('1990-03-05');
  });

  it('rejects an out-of-range month/day', () => {
    expect(normalizeDate('40/13/1994')).toBeNull();
  });

  it('rejects an unrecognized month name', () => {
    expect(normalizeDate('26 Smarch 1998')).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(normalizeDate('not a date')).toBeNull();
  });
});

// Text below is transcribed directly from real sample documents in
// test-documents/ (synthetic identity, not a real staff member's data).
describe('parseIdCard — real ECOWAS ID card layout', () => {
  const text = `
    ECOWAS IDENTITY CARD
    Surname / Nom
    MBOWE
    First name / Prenom
    MARIAMA
    Date of birth / Date de naissance
    26/11/1998
    Date of issue / Date d'emission
    10/02/2026
    Date of expiry / Date d'expiration
    10/02/2031
    Place of issue / Lieu de delivrance
    BANJUL
    Sex / Sexe    Height / Taille
    F             165
    Document number / Numero de document
    261198-020-022
  `;

  it('extracts the document number as national_id_no, not the issue/expiry dates', () => {
    const fields = parseIdCard(text);
    expect(fields).toContainEqual({
      field: 'national_id_no',
      label: 'National ID number',
      value: '261198-020-022',
    });
  });

  it('extracts date of birth specifically, not the issue or expiry date', () => {
    const fields = parseIdCard(text);
    expect(fields).toContainEqual({
      field: 'date_of_birth',
      label: 'Date of birth',
      value: '1998-11-26',
    });
  });

  it('extracts gender across the bilingual "Sex / Sexe" label', () => {
    const fields = parseIdCard(text);
    expect(fields).toContainEqual({ field: 'gender', label: 'Gender', value: 'female' });
  });
});

describe('parseTinCertificate — real GRA certificate layout', () => {
  const text = `
    GAMBIA REVENUE AUTHORITY
    TAXPAYER IDENTIFICATION NUMBER (TIN) CERTIFICATE
    ISSUE OFFICE: KANIFING
    TIN            2200340096
    NAME           MBOWE MARIAMA
    TRADING NAME:
    BIRTH DATE     26 November 1998
    ADDRESS        PHYSICAL ADDRESS BIJILO
    ISSUE DATE     17 May 2022
  `;

  it('extracts the TIN without picking up the issue date', () => {
    expect(parseTinCertificate(text)).toContainEqual({
      field: 'tin',
      label: 'TIN',
      value: '2200340096',
    });
  });

  it('extracts date of birth (spelled-out month format)', () => {
    expect(parseTinCertificate(text)).toContainEqual({
      field: 'date_of_birth',
      label: 'Date of birth',
      value: '1998-11-26',
    });
  });
});

describe('parseAppointmentLetter — real PMO letter template', () => {
  const text = `
    On behalf of the Public Service Commission, the Appointment, Promotion and
    Discipline Committee of Health Personnel has approved your appointment as
    Enrolled Nurse with the Government of The Gambia, with effect from the date
    you assume duties. Your posting will be at the Ministry of Health.

    The post attracts a salary of GMD 74,220 (Seven-Four Thousand, Two Hundred
    and Twenty Dalasis) per annum on Grade 6 of the Government's Integrated Pay
    Scale.
  `;

  it('extracts grade and mirrors it into appointment_grade', () => {
    const fields = parseAppointmentLetter(text);
    expect(fields).toContainEqual({ field: 'grade', label: 'Grade', value: '6' });
    expect(fields).toContainEqual({
      field: 'appointment_grade',
      label: 'Grade (from Appointment letter)',
      value: '6',
    });
  });

  it('extracts the job title from the "appointment as X with the Government" phrase', () => {
    expect(parseAppointmentLetter(text)).toContainEqual({
      field: 'job_title',
      label: 'Job title',
      value: 'Enrolled Nurse',
    });
  });

  it('converts the annual salary to an exact monthly figure', () => {
    const fields = parseAppointmentLetter(text);
    const salary = fields.find((f) => f.field === 'basic_salary');
    expect(salary?.value).toBe('6185.00');
    expect(salary?.label).toContain('74,220');
  });

  it('omits grade_point when only a whole grade is present', () => {
    expect(parseAppointmentLetter('Grade 7').some((f) => f.field === 'grade_point')).toBe(false);
  });
});

describe('parsePostingNotification — real region, not on the standard 7-region list', () => {
  it('extracts "North Bank East Region" (a MoH health-sector subdivision)', () => {
    const text = `
      You are hereby notified of your redeployment to the North Bank East
      Region with effect from 20th July 2026.
    `;
    expect(parsePostingNotification(text)).toEqual([
      { field: 'posting_region', label: 'Posting region', value: 'North Bank East Region' },
    ]);
  });

  it('still matches a standard region name', () => {
    expect(parsePostingNotification('posted to Central River Region')).toEqual([
      { field: 'posting_region', label: 'Posting region', value: 'Central River Region' },
    ]);
  });

  it('trims a leading filler word ("the") out of the captured name', () => {
    expect(parsePostingNotification('assigned to the West Coast Region')).toEqual([
      { field: 'posting_region', label: 'Posting region', value: 'West Coast Region' },
    ]);
  });

  it('returns nothing when no region name appears', () => {
    expect(parsePostingNotification('no region mentioned here')).toEqual([]);
  });
});

describe('parseBirthCertificate — real certificate layout', () => {
  const text = `
    Republic of The Gambia
    Birth Certificate
    Certificate Number: 7176803099
    ID Number: 261198322073
    Surname: Mbowe
    Given Name(s): Mariama
    Date of Birth: 26 November 1998
    Sex: F
    Date of Registration: 29 September 2022
  `;

  it('extracts date of birth, not the later registration date', () => {
    expect(parseBirthCertificate(text)).toContainEqual({
      field: 'date_of_birth',
      label: 'Date of birth',
      value: '1998-11-26',
    });
  });

  it('extracts gender', () => {
    expect(parseBirthCertificate(text)).toContainEqual({
      field: 'gender',
      label: 'Gender',
      value: 'female',
    });
  });
});
