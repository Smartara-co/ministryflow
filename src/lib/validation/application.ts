import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker (YYYY-MM-DD)');

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalDate = isoDate
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .enum(values)
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Draft save: everything optional — applicants save partial progress. */
export const applicationDraftSchema = z.object({
  department_id: optionalText,
  budget_entity: optionalText,
  sub_budget_entity: optionalText,
  employee_no: optionalText,
  title: optionalEnum(['Mr', 'Miss', 'Mrs', 'Ms', 'Dr'] as const),
  surname: optionalText,
  first_name: optionalText,
  national_id_no: optionalText,
  date_of_birth: optionalDate,
  gender: optionalEnum(['male', 'female'] as const),
  tin: optionalText,
  mobile_phone: optionalText,
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  job_title: optionalText,
  grade: optionalText,
  grade_point: optionalText,
  basic_salary: z.coerce
    .number()
    .positive()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  employment_status: optionalEnum([
    'established',
    'unestablished',
    'contract',
    'temporary',
  ] as const),
  hired_from_date: optionalDate,
  hired_to_date: optionalDate,
  date_joined: optionalDate,
  location: optionalText,
  posting_region: optionalText,
  appointment_grade: optionalText,
  payment_type: optionalEnum(['cash', 'bank'] as const),
  tax_type: optionalEnum(['exempt', 'standard', 'assessed'] as const),
  liable_soc_security: z.coerce.boolean().optional(),
  soc_security_no: optionalText,
  liable_wops: z.coerce.boolean().optional(),
  member_or_partial: optionalText,
  bank_account_no: optionalText,
  bank_branch_code: optionalText,
  bank_account_name: optionalText,
  bank_account_type: optionalEnum(['current', 'savings'] as const),
});

export type ApplicationDraftInput = z.infer<typeof applicationDraftSchema>;

/** Submission: the fields the Accounts Office cannot review without. */
export const applicationSubmitSchema = applicationDraftSchema.superRefine(
  (data, ctx) => {
    const required: Array<[keyof ApplicationDraftInput, string]> = [
      ['title', 'Title'],
      ['surname', 'Surname'],
      ['first_name', 'First name'],
      ['national_id_no', 'National ID number'],
      ['date_of_birth', 'Date of birth'],
      ['gender', 'Gender'],
      ['mobile_phone', 'Mobile phone'],
      ['job_title', 'Job title'],
      ['grade', 'Grade'],
      ['grade_point', 'Grade point'],
      ['employment_status', 'Employment status'],
      ['date_joined', 'Assumption of duty date'],
      ['location', 'Location'],
      ['posting_region', 'Posting region (from Posting Notification letter)'],
      ['appointment_grade', 'Grade on Appointment letter'],
      ['payment_type', 'Payment type'],
      ['tax_type', 'Tax type'],
    ];
    for (const [key, label] of required) {
      const value = data[key];
      if (value === null || value === undefined || value === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${label} is required`,
        });
      }
    }

    if (data.payment_type === 'bank') {
      for (const key of [
        'bank_account_no',
        'bank_branch_code',
        'bank_account_name',
        'bank_account_type',
      ] as const) {
        if (!data[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'Required when payment type is bank',
          });
        }
      }
    }

    if (
      (data.employment_status === 'contract' ||
        data.employment_status === 'temporary') &&
      !data.hired_to_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hired_to_date'],
        message: 'Hired-to date is required for contract/temporary staff',
      });
    }

    if (data.liable_soc_security && !data.soc_security_no) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['soc_security_no'],
        message: 'Social security number is required when liable',
      });
    }
  },
);
