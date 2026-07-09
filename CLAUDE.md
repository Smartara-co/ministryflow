# CLAUDE.md — MinistryFlow (Gambia Government Staff Onboarding Platform)

This file gives Claude Code full context for building this project. Read it before writing any code.

## 1. Project Overview

**Client:** Abdul Aziz Jallow, Data Entry Clerk at The Gambia Ministry of Health (Smartara lead).

**Problem:** Newly appointed government staff currently go through a manual, paper/Excel-based onboarding process to get their salary set up. Abdul Aziz automated parts of this with Excel VBA, then prototyped a web version in Lovable AI. We are now building the production version.

**What the platform does:**
1. A newly appointed staff member uploads required onboarding documents (ID, appointment letter, qualifications, bank details, etc.) through a web form.
2. A Ministry Administrator reviews the submission — approves it, or rejects it with comments requesting corrections (staff can then resubmit).
3. On approval, the system generates a **SAL 1 form** — the salary input document — based on the **2025 Integrated Pay Scale** and any ministry-specific allowances.
4. A Super Administrator has cross-ministry visibility, manages ministry admin accounts, and can view audit trails.

**Business model (long-term, not MVP scope):** Same platform, reused across all Gambian ministries/departments (they share an identical onboarding format), licensed per-ministry or run as hosted SaaS. The MVP proves the concept for the Ministry of Health; the data model should not have to change when a second ministry is added.

## 2. Cost Constraint — READ THIS FIRST

**This project must be built and run at $0 cost.** Every technology choice below is picked because it has a genuinely free tier sufficient for an MVP / pilot with realistic government usage (tens to low hundreds of staff records, not millions). Do not introduce a paid service, paid API, or paid plan without flagging it to the user first and explaining why the free tier is insufficient.

If a free tier limit becomes a real constraint (e.g. storage cap), stop and surface it — don't silently work around it in a way that degrades the product (e.g. don't silently drop document storage).

## 3. Tech Stack (all free-tier)

| Layer | Choice | Why / free tier limits |
|---|---|---|
| Frontend framework | Next.js 14+ (App Router), TypeScript | Free, matches Smartara's standard stack |
| Styling | Tailwind CSS | Free |
| Backend / DB | Supabase (Postgres) | Free tier: 500MB DB, 1GB file storage, 50k monthly active users — plenty for MVP |
| Auth | Supabase Auth | Free, built-in row-level security (RLS) — critical since this is sensitive HR/payroll data |
| File storage (document uploads) | Supabase Storage | Free tier 1GB — monitor usage, compress/limit file sizes on upload |
| Email notifications | Supabase Auth emails for auth flows; for workflow notifications (submission received, approved, rejected) use **Resend free tier** (3,000 emails/month, no credit card) | Free |
| Hosting | Netlify (free tier) | Free, auto-deploys from GitHub, generous bandwidth for this use case. Next.js is fully supported via the official Netlify Next.js runtime |
| Domain | Netlify-provided `*.netlify.app` subdomain for MVP/demo | Custom domain is a future paid add-on the client can decide on later |
| Version control / CI | GitHub (free, public or private repo) | Free |
| PDF generation (SAL 1 form) | `@react-pdf/renderer` or `pdf-lib` (client/server-side JS, no external API) | Free, no per-document API cost |

Do not use: paid AI APIs for anything in the core workflow, paid email services beyond free tier volume, paid DB hosting, paid file storage, or any service requiring a credit card that could silently start billing.

## 4. User Roles & Permissions

Three roles, enforced both in the UI and via Supabase Row-Level Security (never rely on frontend checks alone for a government data app):

1. **Applicant / New Staff**
   - Can create an account (or be invited) and submit one onboarding application
   - Can upload/replace documents while status is `draft` or `needs_correction`
   - Can view their own application status and any admin comments
   - Cannot see other applicants' data

2. **Ministry Admin**
   - **Confirmed (pilot):** the Accounts Office at the Ministry of Health holds this role
   - Scoped to their own ministry only
   - Can view all applications submitted to their ministry
   - Can approve, reject, or request corrections, each with a **free-text comment** (see "Approval/Rejection Rules" below — do not build a fixed dropdown of reasons)
   - Can view/generate SAL 1 forms for approved applications
   - Cannot see other ministries' data

3. **Super Admin**
   - **Confirmed (pilot):** Abdul Aziz Jallow holds this role during the pilot phase
   - Cross-ministry visibility (relevant once Phase 2 begins)
   - Manages ministry admin accounts and ministry/department records
   - Can view full audit trail
   - Can view aggregate reporting across ministries

**Approval/Rejection Rules:** Abdul Aziz was explicit that rejection/correction reasons must stay **open-ended free text**, not a fixed set of options — reasons vary by ministry and by case and shouldn't be forced into a generic enum. Build `admin_comments` as a required free-text field on reject/needs_correction, not a reason-code dropdown.

## 5. Core Workflow / Application States

```
draft → submitted → under_review → (approved | needs_correction | rejected)
needs_correction → submitted (on resubmit, loops back to under_review)
approved → sal1_generated
```

Every state transition must write an entry to an `audit_log` table (who, what, when, before/after status) — this is a government payroll system, and traceability matters more than almost anything else here.

### Confirmed Payroll Cutoff Rule (critical business logic)

This is a hard requirement from the Ministry, confirmed in writing — get this exactly right, it directly affects real people's pay:

| Assumption-of-duty date | System action | Result |
|---|---|---|
| 1st–14th of the month | Full pay | Staff member is included in the current month's payroll cycle at 100% of basic salary and allowances |
| 15th–24th of the month | Prorated pay | `(days worked ÷ days in month) × (basic salary + allowances)` |
| 25th–end of month | Zero pay (rollover) | Staff member is excluded from the current month's payroll file entirely; their record automatically rolls to next month's cycle |

Implement this as a pure function (e.g. `calculatePayrollAction(assumptionDate): 'full' | 'prorated' | 'zero'`) with unit tests covering the exact boundary days (14th, 15th, 24th, 25th) — boundary bugs here mean someone doesn't get paid correctly.

## 6. Database Schema (Supabase / Postgres) — starting point

```sql
-- Ministries share one format, so this table drives multi-ministry scalability
ministries (
  id uuid pk,
  name text,
  code text unique,
  created_at timestamptz
)

departments (
  id uuid pk,
  ministry_id uuid fk -> ministries,
  name text
)

profiles (
  id uuid pk references auth.users,
  role text check (role in ('applicant','ministry_admin','super_admin')),
  ministry_id uuid fk -> ministries (null for super_admin),
  full_name text,
  created_at timestamptz
)

applications (
  id uuid pk,
  applicant_id uuid fk -> profiles,
  ministry_id uuid fk -> ministries,
  department_id uuid fk -> departments,
  status text check (status in ('draft','submitted','under_review','needs_correction','rejected','approved','sal1_generated')),

  -- Fields mirroring the actual SAL 1 form (Republic of The Gambia, Salary Input Form 1)
  budget_entity text,
  sub_budget_entity text,
  employee_no text,
  title text,                  -- Mr/Miss/Mrs/Ms/Dr
  surname text,
  first_name text,
  national_id_no text,
  date_of_birth date,
  gender text,
  tin text,
  mobile_phone text,
  email text,
  job_title text,
  grade text,                  -- e.g. "7", "8" — references pay_scale
  grade_point text,            -- e.g. "7.1", "8.1" — references pay_scale step
  basic_salary numeric,
  employment_status text check (employment_status in ('established','unestablished','contract','temporary')),
  hired_from_date date,
  hired_to_date date,          -- for contract/temporary only
  date_joined date,
  location text,
  payment_type text check (payment_type in ('cash','bank')),
  tax_type text check (tax_type in ('exempt','standard','assessed')),
  liable_soc_security boolean,
  soc_security_no text,
  liable_wops boolean,
  member_or_partial text,      -- "member" / "partial" (interdicted / member of parliament flags also appear on the real form)
  bank_account_no text,
  bank_branch_code text,
  bank_account_name text,
  bank_account_type text check (bank_account_type in ('current','savings')),

  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid fk -> profiles,
  admin_comments text,         -- free text, required on reject / needs_correction
  created_at timestamptz,
  updated_at timestamptz
)

-- Mirrors the SAL 1 form's "Earning Elements" / "Deduction Elements" tables (5 line rows each on the real form)
application_pay_elements (
  id uuid pk,
  application_id uuid fk -> applications,
  element_type text check (element_type in ('earning','deduction')),
  code text,                   -- e.g. "104" (Basic Salary), "116" (Special Skills), "110" (Risk), "142" (Hardship), "41" (Travel Home to Office)
  description text,
  period_amount numeric,
  total_amount numeric
)

documents (
  id uuid pk,
  application_id uuid fk -> applications,
  doc_type text check (doc_type in (
    'passport_photo',
    'appointment_letter',
    'acceptance_assumption_of_duties',   -- not required for support staff (cleaners, cooks, drivers, etc.)
    'posting_notification',
    'birth_certificate',
    'id_card_or_passport',
    'tin_certificate',
    'bank_details',                       -- up to 3 files allowed
    'pmo_clearance_letter'                 -- only required for support staff
  )),
  storage_path text,           -- Supabase Storage path
  uploaded_at timestamptz
)

-- Reference table seeded from the 2025 Integrated Pay Scale document (18-page official scan — see Section 7 for how to load it)
pay_scale (
  id uuid pk,
  grade text,
  grade_point text,            -- e.g. "7.1" — the step within a grade
  annual_salary numeric,
  effective_year int default 2025
)

-- Reference table for Ministry of Health incentive allowances — configurable per ministry, not hardcoded logic
allowances (
  id uuid pk,
  ministry_id uuid fk -> ministries,
  category text,                -- 'risk','responsibility','on_call_duty','hardship','teaching','special_skills','specialty_nurse'
  subcategory text,              -- e.g. role/region/grade/category qualifier — see notes below
  amount numeric,
  region text,                  -- for hardship allowance, which varies by region (e.g. Central River Region, Lower/North Bank, etc.)
  grade text,                   -- for special-skills allowance, which varies by grade (7–12)
  eligible_staff_note text,      -- free text describing who qualifies, since eligibility rules are staff-category-specific and not easily normalized (e.g. "nurses/lab/pharm/theatre staff on call", "OICs of health centres")
  effective_date date
)

audit_log (
  id uuid pk,
  application_id uuid fk -> applications,
  actor_id uuid fk -> profiles,
  action text,
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz
)
```

**Important allowance eligibility notes (from the Ministry's own incentive allowance memo, confirmed with Abdul Aziz):**
- Nurse allowances are exempt from the Special Skills allowance.
- Support staff are exempt from the Hardship allowance. Support staff are provisionally Grades 1–2 (Abdul Aziz is still confirming this internally — treat as a config value, not a hardcoded constant).
- **Hardship Allowance lookup is document-driven, not just a region/grade dropdown:** the applicable **region** comes from the staff member's **Posting Notification letter**, and the applicable **grade** comes from their **Appointment letter**. Capture these two values explicitly during onboarding/review (e.g. as fields the admin confirms against the uploaded documents) rather than pulling region/grade from a generic profile field.
- **Rule for resolving printed vs. handwritten figures across all source documents: the handwritten figure is the current, revised amount.** Confirmed for Risk Allowance (currently **D2,000**, not the printed D1,000), and applies as a general rule elsewhere in the source PDFs too.
- The pay scale source PDF has two parts: pages 1–12 are the Integrated Pay Scale with general/cadre-specific allowances (platform-wide, relevant for Phase 2); the remaining pages are Ministry of Health-specific allowances (seed scoped to this ministry only). See Section 12 for the full seeding plan.

Enable Row-Level Security on every table. Applicants can only read/write rows where `applicant_id = auth.uid()`. Ministry admins can only read/write rows where `ministry_id` matches their own `profiles.ministry_id`. Super admins bypass ministry scoping via a policy checking `role = 'super_admin'`.

## 7. MVP Scope (Phase 1)

Build this first, for the Ministry of Health only, before generalizing to multi-ministry:

- [ ] Auth: sign up / login (applicant), invite-based login for admins
- [ ] Applicant: onboarding form (fields per Section 6's `applications` table) + document upload for the 9 required document types (conditional: `acceptance_assumption_of_duties` skipped for support staff; `pmo_clearance_letter` shown only for support staff)
- [ ] Ministry Admin (Accounts Office): dashboard listing submissions, review screen (approve / reject / request correction with required free-text comment)
- [ ] Payroll cutoff logic implemented exactly per the table in Section 5 (full / prorated / zero pay based on assumption date)
- [ ] Applicant: resubmission flow after `needs_correction`
- [ ] SAL 1 PDF generation on approval, replicating the real form's layout (see Section 6 fields + `application_pay_elements`), pulling grade/salary from the seeded `pay_scale` table and applicable rows from `allowances`
- [ ] Audit log written on every status change
- [ ] Basic email notification on status change (Resend free tier)
- [ ] Load the real 2025 Integrated Pay Scale and Ministry of Health incentive allowances (both provided as source PDFs) into the `pay_scale` and `allowances` tables — see the data-seeding note below

## 8. Phase 2 (post-MVP, only after client validation)

- Super admin dashboard, multi-ministry onboarding (add ministries/departments dynamically)
- Reporting/analytics
- Configurable document requirements per ministry
- Custom domain, org branding per ministry

## 9. Coding Conventions

- TypeScript strict mode
- App Router, Server Components by default; Client Components only where interactivity is needed
- Form validation with `zod`
- Keep Supabase client calls in a `lib/supabase` directory; never scatter raw client instantiation across components
- All file uploads validated for type and size on both client and server before hitting Storage
- No secrets in code — use `.env.local` (never committed) for Supabase URL/anon key

## 10. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only, never exposed to client
RESEND_API_KEY=
```

## 11. Confirmed From Abdul Aziz (as of this version)

- **Required documents:** passport photo, appointment letter, acceptance & assumption of duties letter (waived for support staff), posting notification letter, birth certificate, ID card/passport, TIN certificate, bank details (up to 3 files), PMO clearance letter (support staff only)
- **Admin structure:** Ministry of Health Accounts Office = Ministry Admin; Abdul Aziz Jallow = Super Admin during the pilot
- **Approval/rejection rules:** must stay open free-text, not a fixed reason list
- **SAL 1 form layout:** confirmed from real form samples (see Section 6 schema)
- **Payroll cutoff logic:** confirmed (see Section 5)
- **Incentive allowances:** confirmed categories and current rates (see Section 6 schema notes) — Risk, Responsibility, On-Call-Duty, Hardship (region + grade based, sourced from Posting Notification and Appointment letters respectively), Teaching, Special Skills (by grade), Speciality Nurse Allowance (by category). Handwritten figures in source docs = current/revised amounts.
- **Support staff grade range:** provisionally Grades 1–2, pending final confirmation from Abdul Aziz's seniors
- **Branding:** Ministry of Health logo provided by Abdul Aziz; Smartara to propose the platform's color scheme

## 12. Remaining Data-Seeding Task

**Confirmed by Abdul Aziz (latest round):**

- The pay scale document is actually two parts in one file: the first **12 pages** are the Integrated Pay Scale itself, containing the **Approved Revised General and Cadre-Specific Allowances**; the remaining pages are the **Ministry of Health-specific allowances**. When transcribing, split seeding into two passes accordingly — general/cadre allowances apply platform-wide (useful once Phase 2 adds other ministries), while the MoH-specific pages seed `allowances` rows scoped to `ministry_id` = Ministry of Health only.
- **Handwritten figures are the current, revised amounts** — this applies as a general rule across the source documents, not just the Risk Allowance. Where a printed figure has a handwritten number next to or over it, use the handwritten one. Risk Allowance is confirmed at **D2,000**.
- The Hardship Allowance table in the memo is confirmed current as-is. Critically: the **region** used to look up the rate comes from the staff member's **Posting Notification letter**, and the **grade** comes from their **Appointment letter** — not from a general profile field. Make sure the onboarding form/data model captures region and grade specifically from those two documents (or has the admin confirm/enter them during review) rather than inferring from elsewhere.
- **Support staff (tentative):** Grades 1–2. Abdul Aziz is still confirming this with his seniors — treat as provisional until he confirms. Don't hardcode the support-staff grade range as final; keep it as an easily-updatable config value (e.g. a constant or a `ministries`/`allowances`-adjacent settings row) rather than scattering the literal grade check through the codebase.

**Steps:**

1. OCR / manually transcribe pages 1–12 of the pay scale PDF (general/cadre allowances) into `pay_scale` and the general-allowance rows of `allowances`.
2. Transcribe the remaining pages (Ministry of Health-specific allowances) into `allowances` scoped to the Ministry of Health.
3. Apply the "handwritten = current" rule throughout — don't seed superseded printed figures.
4. Cross-check a handful of entries against the sample completed SAL 1 forms Abdul Aziz provided (e.g. Grade 7 point 7.1, Grade 8 point 8.1) to confirm the transcription lines up with real payroll records.
5. Treat all sample/filled SAL 1 forms as structural references only — do not carry any real staff member's personal data (national ID, TIN, bank account numbers, etc.) into seed data, fixtures, or documentation. Use synthetic placeholder data for any test/demo records.
6. Once Abdul Aziz confirms the exact support-staff grade range, update the config value accordingly before relying on it to toggle document requirements (`acceptance_assumption_of_duties` / `pmo_clearance_letter`).
