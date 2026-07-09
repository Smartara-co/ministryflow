import { describe, expect, it } from 'vitest';
import {
  calculatePayableAmount,
  calculatePayrollAction,
} from './calculatePayrollAction';

describe('calculatePayrollAction', () => {
  describe('boundary days (per the Ministry-confirmed cutoff table)', () => {
    it('14th → full (last day of the full-pay window)', () => {
      expect(calculatePayrollAction('2026-07-14')).toBe('full');
    });

    it('15th → prorated (first day of the prorated window)', () => {
      expect(calculatePayrollAction('2026-07-15')).toBe('prorated');
    });

    it('24th → prorated (last day of the prorated window)', () => {
      expect(calculatePayrollAction('2026-07-24')).toBe('prorated');
    });

    it('25th → zero (first day of the rollover window)', () => {
      expect(calculatePayrollAction('2026-07-25')).toBe('zero');
    });
  });

  describe('window interiors and month ends', () => {
    it('1st → full', () => {
      expect(calculatePayrollAction('2026-07-01')).toBe('full');
    });

    it('31st (long month end) → zero', () => {
      expect(calculatePayrollAction('2026-07-31')).toBe('zero');
    });

    it('30th (short month end) → zero', () => {
      expect(calculatePayrollAction('2026-06-30')).toBe('zero');
    });

    it('Feb 28th (non-leap year) → zero', () => {
      expect(calculatePayrollAction('2026-02-28')).toBe('zero');
    });

    it('Feb 29th (leap year) → zero', () => {
      expect(calculatePayrollAction('2028-02-29')).toBe('zero');
    });
  });

  describe('input handling', () => {
    it('accepts Date objects (UTC calendar day)', () => {
      expect(calculatePayrollAction(new Date('2026-07-14'))).toBe('full');
      expect(calculatePayrollAction(new Date('2026-07-15'))).toBe('prorated');
    });

    it('rejects malformed strings', () => {
      expect(() => calculatePayrollAction('14/07/2026')).toThrow();
      expect(() => calculatePayrollAction('')).toThrow();
    });

    it('rejects impossible calendar dates', () => {
      expect(() => calculatePayrollAction('2026-02-30')).toThrow();
      expect(() => calculatePayrollAction('2026-13-01')).toThrow();
      // Feb 29 in a non-leap year
      expect(() => calculatePayrollAction('2026-02-29')).toThrow();
    });

    it('rejects invalid Date objects', () => {
      expect(() => calculatePayrollAction(new Date('nonsense'))).toThrow();
    });
  });
});

describe('calculatePayableAmount', () => {
  const MONTHLY_PAY = 3000; // basic salary + allowances, dalasi

  it('full window → the entire monthly amount', () => {
    expect(calculatePayableAmount('2026-07-14', MONTHLY_PAY)).toBe(3000);
  });

  it('zero window → nothing this month (rolls over)', () => {
    expect(calculatePayableAmount('2026-07-25', MONTHLY_PAY)).toBe(0);
  });

  it('prorates inclusively from the assumption date to month end', () => {
    // June 15 in a 30-day month → 16 days worked (15th through 30th)
    expect(calculatePayableAmount('2026-06-15', MONTHLY_PAY)).toBeCloseTo(
      (16 / 30) * 3000,
      10,
    );
  });

  it('uses the actual month length (31-day month)', () => {
    // July 24 → 8 days worked (24th through 31st) of 31
    expect(calculatePayableAmount('2026-07-24', MONTHLY_PAY)).toBeCloseTo(
      (8 / 31) * 3000,
      10,
    );
  });

  it('uses the actual month length (leap February)', () => {
    // Feb 20, 2028 → 10 days worked (20th through 29th) of 29
    expect(calculatePayableAmount('2028-02-20', MONTHLY_PAY)).toBeCloseTo(
      (10 / 29) * 3000,
      10,
    );
  });
});
