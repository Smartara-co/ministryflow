/**
 * Payroll cutoff rule — confirmed in writing by the Ministry (CLAUDE.md §5).
 * This directly affects real people's pay; the boundaries are exact:
 *
 *   Assumption-of-duty date   | Action    | Result
 *   --------------------------|-----------|------------------------------------------
 *   1st–14th of the month     | full      | 100% of basic salary + allowances this month
 *   15th–24th of the month    | prorated  | (days worked ÷ days in month) × monthly pay
 *   25th–end of month         | zero      | excluded this month; rolls to next cycle
 */

export type PayrollAction = 'full' | 'prorated' | 'zero';

/** Accepts a Date or an ISO `YYYY-MM-DD` string (the format date columns and
 *  <input type="date"> produce). Strings are parsed by parts — never via
 *  `new Date(string)` — so the result can't shift across timezones. */
export type AssumptionDate = Date | string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

function toParts(date: AssumptionDate): DateParts {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid assumption-of-duty date');
    }
    // Date objects built from ISO strings sit at UTC midnight, so UTC
    // accessors are the ones that always return the intended calendar day.
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new Error(
      `Invalid assumption-of-duty date: "${date}" (expected YYYY-MM-DD)`,
    );
  }
  const [, year, month, day] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month)
  ) {
    throw new Error(`Invalid assumption-of-duty date: "${date}"`);
  }
  return parts;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Which payroll action applies for a given assumption-of-duty date.
 */
export function calculatePayrollAction(
  assumptionDate: AssumptionDate,
): PayrollAction {
  const { day } = toParts(assumptionDate);
  if (day <= 14) return 'full';
  if (day <= 24) return 'prorated';
  return 'zero';
}

/**
 * The amount payable in the assumption month:
 *   full     → the full monthly pay
 *   prorated → (days worked ÷ days in month) × monthly pay, where days worked
 *              runs from the assumption date to month end, inclusive
 *   zero     → 0 (the record rolls to next month's cycle)
 *
 * @param monthlyPay basic salary + allowances for one month
 */
export function calculatePayableAmount(
  assumptionDate: AssumptionDate,
  monthlyPay: number,
): number {
  const { year, month, day } = toParts(assumptionDate);
  const action = calculatePayrollAction(assumptionDate);
  if (action === 'full') return monthlyPay;
  if (action === 'zero') return 0;
  const totalDays = daysInMonth(year, month);
  const daysWorked = totalDays - day + 1;
  return (daysWorked / totalDays) * monthlyPay;
}
