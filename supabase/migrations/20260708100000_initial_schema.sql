-- MinistryFlow — initial schema
-- Gambia Government Staff Onboarding Platform (CLAUDE.md Section 6)
--
-- Rerunnable: every statement is idempotent (IF NOT EXISTS / OR REPLACE /
-- DROP IF EXISTS), so this file can be executed repeatedly in the SQL editor
-- without errors. Note that IF NOT EXISTS does not alter tables that already
-- exist with a different shape — column changes still need a new migration.
--
-- Design notes:
--  * `private` schema holds helper/trigger functions that must not be exposed
--    through the Data API (only `public` is exposed by default).
--  * Audit logging of application status changes is enforced by a trigger, so
--    no code path can transition an application without a corresponding
--    audit_log row.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

-- Ministries share one onboarding format; this table drives multi-ministry
-- scalability (Phase 2 adds rows here, not schema changes).
create table if not exists public.ministries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id),
  name        text not null
);

-- Seeded from the 2025 Integrated Pay Scale (pages 1-12 of the source PDF).
create table if not exists public.pay_scale (
  id             uuid primary key default gen_random_uuid(),
  grade          text not null,
  grade_point    text not null,          -- step within a grade, e.g. "7.1"
  annual_salary  numeric not null,
  effective_year int not null default 2025,
  unique (grade, grade_point, effective_year)
);

-- Incentive allowances. ministry_id null = general/cadre-specific allowance
-- from the Integrated Pay Scale (platform-wide); non-null = ministry-specific
-- (e.g. the Ministry of Health incentive allowance memo).
-- `category` is deliberately unchecked text: MoH categories are
-- 'risk','responsibility','on_call_duty','hardship','teaching',
-- 'special_skills','specialty_nurse', but the general/cadre pages of the pay
-- scale introduce further categories that must seed without a schema change.
create table if not exists public.allowances (
  id                  uuid primary key default gen_random_uuid(),
  ministry_id         uuid references public.ministries(id),
  category            text not null,
  subcategory         text,              -- role/region/grade/category qualifier
  amount              numeric not null,
  region              text,              -- hardship: varies by region (from Posting Notification)
  grade               text,              -- special skills: varies by grade 7-12 (from Appointment letter)
  eligible_staff_note text,              -- free text; eligibility is staff-category-specific
  effective_date      date
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'applicant'
              check (role in ('applicant','ministry_admin','super_admin')),
  ministry_id uuid references public.ministries(id),   -- null for super_admin
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Applications (fields mirror the real SAL 1 form)
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references public.profiles(id),
  ministry_id   uuid not null references public.ministries(id),
  department_id uuid references public.departments(id),
  status        text not null default 'draft'
                check (status in ('draft','submitted','under_review',
                                  'needs_correction','rejected','approved',
                                  'sal1_generated')),

  -- SAL 1: Budget / identity
  budget_entity     text,
  sub_budget_entity text,
  employee_no       text,
  title             text,               -- Mr/Miss/Mrs/Ms/Dr
  surname           text,
  first_name        text,
  national_id_no    text,
  date_of_birth     date,
  gender            text,
  tin               text,
  mobile_phone      text,
  email             text,

  -- SAL 1: Employment
  job_title         text,
  grade             text,               -- references pay_scale.grade
  grade_point       text,               -- references pay_scale.grade_point
  basic_salary      numeric,
  employment_status text check (employment_status in
                     ('established','unestablished','contract','temporary')),
  hired_from_date   date,
  hired_to_date     date,               -- contract/temporary only
  date_joined       date,               -- assumption-of-duty date (payroll cutoff input)
  location          text,

  -- Hardship allowance lookup is document-driven (CLAUDE.md Section 12):
  -- region comes from the Posting Notification letter, grade from the
  -- Appointment letter. Captured explicitly, confirmed by the admin against
  -- the uploaded documents — never inferred from a generic profile field.
  posting_region    text,
  appointment_grade text,

  -- SAL 1: Payment / statutory
  payment_type       text check (payment_type in ('cash','bank')),
  tax_type           text check (tax_type in ('exempt','standard','assessed')),
  liable_soc_security boolean,
  soc_security_no    text,
  liable_wops        boolean,
  member_or_partial  text,              -- member / partial (interdicted / MP flags on real form)
  bank_account_no    text,
  bank_branch_code   text,
  bank_account_name  text,
  bank_account_type  text check (bank_account_type in ('current','savings')),

  -- Review workflow
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles(id),
  admin_comments text,                  -- open free text — deliberately NOT a reason-code enum
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Free-text comment is REQUIRED on reject / needs_correction
  constraint admin_comments_required_on_rejection check (
    status not in ('rejected','needs_correction')
    or (admin_comments is not null and length(trim(admin_comments)) > 0)
  )
);

-- Mirrors the SAL 1 form's Earning/Deduction Elements tables (5 line rows each)
create table if not exists public.application_pay_elements (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  element_type   text not null check (element_type in ('earning','deduction')),
  code           text,                  -- e.g. "104" Basic Salary, "110" Risk, "142" Hardship
  description    text,
  period_amount  numeric,
  total_amount   numeric
);

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  doc_type       text not null check (doc_type in (
    'passport_photo',
    'appointment_letter',
    'acceptance_assumption_of_duties',  -- not required for support staff
    'posting_notification',
    'birth_certificate',
    'id_card_or_passport',
    'tin_certificate',
    'bank_details',                     -- up to 3 files allowed
    'pmo_clearance_letter'              -- only required for support staff
  )),
  storage_path   text not null,         -- Supabase Storage path
  uploaded_at    timestamptz not null default now()
);

create table if not exists public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id),
  actor_id       uuid references public.profiles(id),
  action         text not null,
  from_status    text,
  to_status      text,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists applications_applicant_id_idx on public.applications (applicant_id);
create index if not exists applications_ministry_id_status_idx on public.applications (ministry_id, status);
create index if not exists application_pay_elements_application_id_idx on public.application_pay_elements (application_id);
create index if not exists documents_application_id_idx on public.documents (application_id);
create index if not exists audit_log_application_id_idx on public.audit_log (application_id);
create index if not exists departments_ministry_id_idx on public.departments (ministry_id);
create index if not exists allowances_ministry_id_idx on public.allowances (ministry_id);
create index if not exists pay_scale_grade_point_idx on public.pay_scale (grade, grade_point);
create index if not exists profiles_ministry_id_idx on public.profiles (ministry_id);

-- ---------------------------------------------------------------------------
-- Helper functions (private schema — not exposed via the Data API)
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER is required so RLS policies on `profiles` itself (and on
-- tables whose policies consult profiles) can look up the CALLER'S OWN role
-- and ministry without recursing into profiles' RLS. Both functions are keyed
-- exclusively off auth.uid(), so they can never read another user's row.
create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.current_user_ministry_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ministry_id from public.profiles where id = auth.uid();
$$;

-- RLS policy expressions run as the querying role, which therefore needs
-- schema usage + execute on exactly these two functions and nothing else.
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_user_ministry_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function private.set_updated_at();

-- Auto-create a profile when a user signs up. Role defaults to 'applicant';
-- admin roles are only ever assigned by a super admin / service role.
-- full_name from user metadata is display-only and never used for authz.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Privilege-escalation guard: only a super admin (or the service role /
-- direct SQL, where auth.uid() is null) may change a profile's role or
-- ministry assignment. Without this, the self-update RLS policy would let an
-- applicant promote themselves.
create or replace function private.prevent_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
          or new.ministry_id is distinct from old.ministry_id)
     and private.current_user_role() is distinct from 'super_admin' then
    raise exception 'only a super admin can change roles or ministry assignments';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_change on public.profiles;
create trigger profiles_prevent_privilege_change
  before update on public.profiles
  for each row execute function private.prevent_privilege_change();

-- Government payroll system: EVERY status transition writes an audit_log row.
-- Enforced here as a trigger so no application code path can skip it.
-- SECURITY DEFINER lets the insert bypass audit_log RLS, which has no INSERT
-- policy at all — audit entries cannot be forged or written directly.
create or replace function private.log_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (application_id, actor_id, action, from_status, to_status)
    values (new.id, auth.uid(), 'application_created', null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.audit_log (application_id, actor_id, action, from_status, to_status, notes)
    values (
      new.id,
      auth.uid(),
      'status_change',
      old.status,
      new.status,
      case when new.status in ('rejected', 'needs_correction')
           then new.admin_comments end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists applications_log_status_change on public.applications;
create trigger applications_log_status_change
  after insert or update on public.applications
  for each row execute function private.log_application_status_change();
