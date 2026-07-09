/**
 * PROVISIONAL (CLAUDE.md §12): Abdul Aziz is still confirming the exact
 * support-staff grade range with his seniors. Grades 1–2 is the working
 * assumption. Update HERE ONLY when he confirms — nothing else in the
 * codebase may hardcode this range.
 *
 * Support staff (cleaners, cooks, drivers, etc.):
 *  - skip the `acceptance_assumption_of_duties` document
 *  - must provide the `pmo_clearance_letter` document
 *  - are exempt from the Hardship allowance
 */
export const SUPPORT_STAFF_GRADES: readonly string[] = ['1', '2'];

export function isSupportStaffGrade(grade: string): boolean {
  return SUPPORT_STAFF_GRADES.includes(grade.trim());
}
