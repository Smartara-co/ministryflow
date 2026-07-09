/** Row types mirroring supabase/migrations/20260708100000_initial_schema.sql.
 *  Hand-maintained until we wire up `supabase gen types`. */

export type Role = 'applicant' | 'ministry_admin' | 'super_admin';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'needs_correction'
  | 'rejected'
  | 'approved'
  | 'sal1_generated';

export type EmploymentStatus =
  | 'established'
  | 'unestablished'
  | 'contract'
  | 'temporary';

export interface Ministry {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Department {
  id: string;
  ministry_id: string;
  name: string;
}

export interface Profile {
  id: string;
  role: Role;
  ministry_id: string | null;
  full_name: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  applicant_id: string;
  ministry_id: string;
  department_id: string | null;
  status: ApplicationStatus;

  budget_entity: string | null;
  sub_budget_entity: string | null;
  employee_no: string | null;
  title: string | null;
  surname: string | null;
  first_name: string | null;
  national_id_no: string | null;
  date_of_birth: string | null;
  gender: string | null;
  tin: string | null;
  mobile_phone: string | null;
  email: string | null;

  job_title: string | null;
  grade: string | null;
  grade_point: string | null;
  basic_salary: number | null;
  employment_status: EmploymentStatus | null;
  hired_from_date: string | null;
  hired_to_date: string | null;
  date_joined: string | null;
  location: string | null;

  posting_region: string | null;
  appointment_grade: string | null;

  payment_type: 'cash' | 'bank' | null;
  tax_type: 'exempt' | 'standard' | 'assessed' | null;
  liable_soc_security: boolean | null;
  soc_security_no: string | null;
  liable_wops: boolean | null;
  member_or_partial: string | null;
  bank_account_no: string | null;
  bank_branch_code: string | null;
  bank_account_name: string | null;
  bank_account_type: 'current' | 'savings' | null;

  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationPayElement {
  id: string;
  application_id: string;
  element_type: 'earning' | 'deduction';
  code: string | null;
  description: string | null;
  period_amount: number | null;
  total_amount: number | null;
}

export interface DocumentRow {
  id: string;
  application_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_at: string;
}

export interface PayScaleRow {
  id: string;
  grade: string;
  grade_point: string;
  annual_salary: number;
  effective_year: number;
}

export interface AllowanceRow {
  id: string;
  ministry_id: string | null;
  category: string;
  subcategory: string | null;
  amount: number;
  region: string | null;
  grade: string | null;
  eligible_staff_note: string | null;
  effective_date: string | null;
}

export interface AuditLogRow {
  id: string;
  application_id: string | null;
  actor_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
}

/** Gambian dalasi, as written on the SAL 1 form (e.g. "D2,000.00"). */
export function formatDalasi(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `D${amount.toLocaleString('en-GM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
