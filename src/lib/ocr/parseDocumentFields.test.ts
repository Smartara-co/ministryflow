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
  it('parses DD/MM/YYYY', () => {
    expect(normalizeDate('18/07/1994')).toBe('1994-07-18');
  });

  it('parses DD-MM-YYYY with 2-digit year', () => {
    expect(normalizeDate('18-07-94')).toBe('2094-07-18');
  });

  it('rejects an out-of-range month/day', () => {
    expect(normalizeDate('40/13/1994')).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(normalizeDate('not a date')).toBeNull();
  });
});

describe('parseIdCard', () => {
  it('extracts national ID number, DOB, and gender', () => {
    const text = `
      REPUBLIC OF THE GAMBIA
      NATIONAL ID CARD
      Name: HABEEB OLUWATOBI JOHN
      National ID No: 180794 110 002
      Date of Birth: 18/07/1994
      Sex: Male
    `;
    const fields = parseIdCard(text);
    expect(fields).toContainEqual({
      field: 'national_id_no',
      label: 'National ID number',
      value: '180794 110 002',
    });
    expect(fields).toContainEqual({
      field: 'date_of_birth',
      label: 'Date of birth',
      value: '1994-07-18',
    });
    expect(fields).toContainEqual({ field: 'gender', label: 'Gender', value: 'male' });
  });

  it('returns no fields when nothing matches', () => {
    expect(parseIdCard('completely unrelated garbled OCR noise')).toEqual([]);
  });
});

describe('parseTinCertificate', () => {
  it('extracts the TIN', () => {
    expect(parseTinCertificate('Taxpayer Identification Number\nTIN: 2600161033')).toEqual([
      { field: 'tin', label: 'TIN', value: '2600161033' },
    ]);
  });
});

describe('parseAppointmentLetter', () => {
  it('extracts grade and mirrors it into appointment_grade', () => {
    const fields = parseAppointmentLetter('You are appointed to Grade 8.1 as House Officer.');
    expect(fields).toContainEqual({ field: 'grade', label: 'Grade', value: '8' });
    expect(fields).toContainEqual({
      field: 'appointment_grade',
      label: 'Grade (from Appointment letter)',
      value: '8',
    });
    expect(fields).toContainEqual({ field: 'grade_point', label: 'Grade point', value: '8.1' });
  });

  it('omits grade_point when only a whole grade is present', () => {
    const fields = parseAppointmentLetter('Grade 7');
    expect(fields.some((f) => f.field === 'grade_point')).toBe(false);
  });
});

describe('parsePostingNotification', () => {
  it('matches a known Gambian region', () => {
    expect(parsePostingNotification('You have been posted to Central River Region.')).toEqual([
      { field: 'posting_region', label: 'Posting region', value: 'Central River Region' },
    ]);
  });

  it('is case-insensitive', () => {
    expect(parsePostingNotification('posted to banjul health centre')).toEqual([
      { field: 'posting_region', label: 'Posting region', value: 'Banjul' },
    ]);
  });

  it('returns nothing when no region name appears', () => {
    expect(parsePostingNotification('no region mentioned here')).toEqual([]);
  });
});

describe('parseBirthCertificate', () => {
  it('extracts date of birth', () => {
    expect(parseBirthCertificate('Date of Birth: 05-03-1990')).toEqual([
      { field: 'date_of_birth', label: 'Date of birth', value: '1990-03-05' },
    ]);
  });
});
