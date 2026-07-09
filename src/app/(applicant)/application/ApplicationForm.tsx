'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import type {
  Application,
  Department,
  Ministry,
  PayScaleRow,
} from '@/lib/types';
import { saveApplication, submitApplication, type ActionResult } from '../actions';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';
const labelClass = 'block text-sm font-medium text-slate-700';

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

export function ApplicationForm({
  application,
  ministries,
  departments,
  payScale,
}: {
  application: Application | null;
  ministries: Ministry[];
  departments: Department[];
  payScale: PayScaleRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [ministryId, setMinistryId] = useState(
    application?.ministry_id ?? ministries[0]?.id ?? '',
  );
  const [grade, setGrade] = useState(application?.grade ?? '');
  const [gradePoint, setGradePoint] = useState(application?.grade_point ?? '');
  const [basicSalary, setBasicSalary] = useState(
    application?.basic_salary != null ? String(application.basic_salary) : '',
  );
  const [paymentType, setPaymentType] = useState(application?.payment_type ?? '');
  const [employmentStatus, setEmploymentStatus] = useState(
    application?.employment_status ?? '',
  );

  const grades = useMemo(
    () => Array.from(new Set(payScale.map((row) => row.grade))),
    [payScale],
  );
  const gradePoints = useMemo(
    () => payScale.filter((row) => row.grade === grade),
    [payScale, grade],
  );

  function onGradePointChange(point: string) {
    setGradePoint(point);
    const row = payScale.find(
      (r) => r.grade === grade && r.grade_point === point,
    );
    if (row) {
      // Monthly basic = annual salary from the 2025 Integrated Pay Scale / 12.
      setBasicSalary((row.annual_salary / 12).toFixed(2));
    }
  }

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  }

  function handleSave() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    run(() => saveApplication(data));
  }

  function handleSubmitApplication() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    run(async () => {
      const saved = await saveApplication(data);
      if (!saved.ok) return saved;
      return submitApplication();
    });
  }

  const errors = result?.fieldErrors ?? {};
  const departmentsForMinistry = departments.filter(
    (d) => d.ministry_id === ministryId,
  );

  return (
    <form ref={formRef} className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Posting" description="Where you have been appointed.">
        <Field label="Ministry" name="ministry_id" error={errors.ministry_id}>
          <select
            id="ministry_id"
            name="ministry_id"
            className={inputClass}
            value={ministryId}
            onChange={(e) => setMinistryId(e.target.value)}
          >
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" name="department_id" error={errors.department_id}>
          <select
            id="department_id"
            name="department_id"
            className={inputClass}
            defaultValue={application?.department_id ?? ''}
          >
            <option value="">— Select —</option>
            {departmentsForMinistry.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget entity" name="budget_entity" error={errors.budget_entity}>
          <input
            id="budget_entity"
            name="budget_entity"
            className={inputClass}
            defaultValue={application?.budget_entity ?? ''}
          />
        </Field>
        <Field
          label="Sub budget entity"
          name="sub_budget_entity"
          error={errors.sub_budget_entity}
        >
          <input
            id="sub_budget_entity"
            name="sub_budget_entity"
            className={inputClass}
            defaultValue={application?.sub_budget_entity ?? ''}
          />
        </Field>
        <Field label="Duty station / location" name="location" error={errors.location}>
          <input
            id="location"
            name="location"
            className={inputClass}
            defaultValue={application?.location ?? ''}
          />
        </Field>
        <Field
          label="Posting region (as on Posting Notification letter)"
          name="posting_region"
          error={errors.posting_region}
        >
          <input
            id="posting_region"
            name="posting_region"
            className={inputClass}
            defaultValue={application?.posting_region ?? ''}
            placeholder="e.g. Central River Region"
          />
        </Field>
      </Section>

      <Section title="Personal details" description="As on your national ID or passport.">
        <Field label="Title" name="title" error={errors.title}>
          <select
            id="title"
            name="title"
            className={inputClass}
            defaultValue={application?.title ?? ''}
          >
            <option value="">— Select —</option>
            {['Mr', 'Miss', 'Mrs', 'Ms', 'Dr'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Surname" name="surname" error={errors.surname}>
          <input
            id="surname"
            name="surname"
            className={inputClass}
            defaultValue={application?.surname ?? ''}
          />
        </Field>
        <Field label="First name" name="first_name" error={errors.first_name}>
          <input
            id="first_name"
            name="first_name"
            className={inputClass}
            defaultValue={application?.first_name ?? ''}
          />
        </Field>
        <Field label="National ID number" name="national_id_no" error={errors.national_id_no}>
          <input
            id="national_id_no"
            name="national_id_no"
            className={inputClass}
            defaultValue={application?.national_id_no ?? ''}
          />
        </Field>
        <Field label="Date of birth" name="date_of_birth" error={errors.date_of_birth}>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            className={inputClass}
            defaultValue={application?.date_of_birth ?? ''}
          />
        </Field>
        <Field label="Gender" name="gender" error={errors.gender}>
          <select
            id="gender"
            name="gender"
            className={inputClass}
            defaultValue={application?.gender ?? ''}
          >
            <option value="">— Select —</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="TIN" name="tin" error={errors.tin}>
          <input
            id="tin"
            name="tin"
            className={inputClass}
            defaultValue={application?.tin ?? ''}
          />
        </Field>
        <Field label="Mobile phone" name="mobile_phone" error={errors.mobile_phone}>
          <input
            id="mobile_phone"
            name="mobile_phone"
            className={inputClass}
            defaultValue={application?.mobile_phone ?? ''}
          />
        </Field>
        <Field label="Email" name="email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            className={inputClass}
            defaultValue={application?.email ?? ''}
          />
        </Field>
      </Section>

      <Section
        title="Employment"
        description="From your appointment letter. The grade on the appointment letter also determines allowances."
      >
        <Field label="Job title" name="job_title" error={errors.job_title}>
          <input
            id="job_title"
            name="job_title"
            className={inputClass}
            defaultValue={application?.job_title ?? ''}
          />
        </Field>
        <Field label="Employee number (if known)" name="employee_no" error={errors.employee_no}>
          <input
            id="employee_no"
            name="employee_no"
            className={inputClass}
            defaultValue={application?.employee_no ?? ''}
          />
        </Field>
        <Field label="Grade" name="grade" error={errors.grade}>
          {grades.length > 0 ? (
            <select
              id="grade"
              name="grade"
              className={inputClass}
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setGradePoint('');
              }}
            >
              <option value="">— Select —</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="grade"
              name="grade"
              className={inputClass}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          )}
        </Field>
        <Field label="Grade point" name="grade_point" error={errors.grade_point}>
          {gradePoints.length > 0 ? (
            <select
              id="grade_point"
              name="grade_point"
              className={inputClass}
              value={gradePoint}
              onChange={(e) => onGradePointChange(e.target.value)}
            >
              <option value="">— Select —</option>
              {gradePoints.map((row) => (
                <option key={row.id} value={row.grade_point}>
                  {row.grade_point}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="grade_point"
              name="grade_point"
              className={inputClass}
              value={gradePoint}
              onChange={(e) => setGradePoint(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Basic salary (monthly, D)"
          name="basic_salary"
          error={errors.basic_salary}
        >
          <input
            id="basic_salary"
            name="basic_salary"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={basicSalary}
            onChange={(e) => setBasicSalary(e.target.value)}
          />
        </Field>
        <Field
          label="Grade on Appointment letter"
          name="appointment_grade"
          error={errors.appointment_grade}
        >
          <input
            id="appointment_grade"
            name="appointment_grade"
            className={inputClass}
            defaultValue={application?.appointment_grade ?? ''}
            placeholder="Used for allowance lookup"
          />
        </Field>
        <Field
          label="Employment status"
          name="employment_status"
          error={errors.employment_status}
        >
          <select
            id="employment_status"
            name="employment_status"
            className={inputClass}
            value={employmentStatus}
            onChange={(e) => setEmploymentStatus(e.target.value)}
          >
            <option value="">— Select —</option>
            <option value="established">Established</option>
            <option value="unestablished">Unestablished</option>
            <option value="contract">Contract</option>
            <option value="temporary">Temporary</option>
          </select>
        </Field>
        <Field label="Hired from" name="hired_from_date" error={errors.hired_from_date}>
          <input
            id="hired_from_date"
            name="hired_from_date"
            type="date"
            className={inputClass}
            defaultValue={application?.hired_from_date ?? ''}
          />
        </Field>
        {(employmentStatus === 'contract' || employmentStatus === 'temporary') && (
          <Field label="Hired to" name="hired_to_date" error={errors.hired_to_date}>
            <input
              id="hired_to_date"
              name="hired_to_date"
              type="date"
              className={inputClass}
              defaultValue={application?.hired_to_date ?? ''}
            />
          </Field>
        )}
        <Field
          label="Assumption of duty date"
          name="date_joined"
          error={errors.date_joined}
        >
          <input
            id="date_joined"
            name="date_joined"
            type="date"
            className={inputClass}
            defaultValue={application?.date_joined ?? ''}
          />
        </Field>
      </Section>

      <Section title="Payment & statutory">
        <Field label="Payment type" name="payment_type" error={errors.payment_type}>
          <select
            id="payment_type"
            name="payment_type"
            className={inputClass}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="">— Select —</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </Field>
        <Field label="Tax type" name="tax_type" error={errors.tax_type}>
          <select
            id="tax_type"
            name="tax_type"
            className={inputClass}
            defaultValue={application?.tax_type ?? ''}
          >
            <option value="">— Select —</option>
            <option value="standard">Standard</option>
            <option value="exempt">Exempt</option>
            <option value="assessed">Assessed</option>
          </select>
        </Field>
        <Field label="Member / partial" name="member_or_partial" error={errors.member_or_partial}>
          <input
            id="member_or_partial"
            name="member_or_partial"
            className={inputClass}
            defaultValue={application?.member_or_partial ?? ''}
          />
        </Field>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="liable_soc_security"
            name="liable_soc_security"
            type="checkbox"
            defaultChecked={application?.liable_soc_security ?? false}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          <label htmlFor="liable_soc_security" className="text-sm text-slate-700">
            Liable for social security
          </label>
        </div>
        <Field
          label="Social security number"
          name="soc_security_no"
          error={errors.soc_security_no}
        >
          <input
            id="soc_security_no"
            name="soc_security_no"
            className={inputClass}
            defaultValue={application?.soc_security_no ?? ''}
          />
        </Field>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="liable_wops"
            name="liable_wops"
            type="checkbox"
            defaultChecked={application?.liable_wops ?? false}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          <label htmlFor="liable_wops" className="text-sm text-slate-700">
            Liable for WOPS
          </label>
        </div>
      </Section>

      {paymentType === 'bank' && (
        <Section title="Bank details" description="Must match your uploaded bank details document.">
          <Field label="Account name" name="bank_account_name" error={errors.bank_account_name}>
            <input
              id="bank_account_name"
              name="bank_account_name"
              className={inputClass}
              defaultValue={application?.bank_account_name ?? ''}
            />
          </Field>
          <Field label="Account number" name="bank_account_no" error={errors.bank_account_no}>
            <input
              id="bank_account_no"
              name="bank_account_no"
              className={inputClass}
              defaultValue={application?.bank_account_no ?? ''}
            />
          </Field>
          <Field label="Branch code" name="bank_branch_code" error={errors.bank_branch_code}>
            <input
              id="bank_branch_code"
              name="bank_branch_code"
              className={inputClass}
              defaultValue={application?.bank_branch_code ?? ''}
            />
          </Field>
          <Field label="Account type" name="bank_account_type" error={errors.bank_account_type}>
            <select
              id="bank_account_type"
              name="bank_account_type"
              className={inputClass}
              defaultValue={application?.bank_account_type ?? ''}
            >
              <option value="">— Select —</option>
              <option value="current">Current</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
        </Section>
      )}

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.message}
          {result.message?.startsWith('Missing required documents') && (
            <Link
              href="/application/documents"
              className="mt-2 block font-medium underline"
            >
              Go to the documents page to upload them →
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={handleSubmitApplication}
          disabled={pending}
          className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? 'Working…' : 'Submit for review'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Submitting sends your application to the Accounts Office. Make sure all
        required documents are uploaded first.
      </p>
    </form>
  );
}
