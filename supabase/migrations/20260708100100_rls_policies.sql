-- MinistryFlow — Row-Level Security
--
-- Rerunnable: policies are dropped and recreated, everything else is
-- naturally idempotent.
--
-- Access model (CLAUDE.md Section 4 — never rely on frontend checks alone):
--  * applicant       — sees/edits only their own application + documents
--  * ministry_admin  — scoped strictly to their own ministry's data
--  * super_admin     — cross-ministry visibility, manages admin accounts
--
-- All policies target `to authenticated`; anonymous users get nothing.

alter table public.ministries               enable row level security;
alter table public.departments              enable row level security;
alter table public.pay_scale                enable row level security;
alter table public.allowances               enable row level security;
alter table public.profiles                 enable row level security;
alter table public.applications             enable row level security;
alter table public.application_pay_elements enable row level security;
alter table public.documents                enable row level security;
alter table public.audit_log                enable row level security;

-- ---------------------------------------------------------------------------
-- ministries / departments / pay_scale — public reference data
-- (published government pay scale; applicants need these for the form)
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read ministries" on public.ministries;
create policy "Authenticated users can read ministries"
  on public.ministries for select
  to authenticated
  using (true);

drop policy if exists "Super admins manage ministries" on public.ministries;
create policy "Super admins manage ministries"
  on public.ministries for all
  to authenticated
  using (private.current_user_role() = 'super_admin')
  with check (private.current_user_role() = 'super_admin');

drop policy if exists "Authenticated users can read departments" on public.departments;
create policy "Authenticated users can read departments"
  on public.departments for select
  to authenticated
  using (true);

drop policy if exists "Super admins manage departments" on public.departments;
create policy "Super admins manage departments"
  on public.departments for all
  to authenticated
  using (private.current_user_role() = 'super_admin')
  with check (private.current_user_role() = 'super_admin');

drop policy if exists "Authenticated users can read pay scale" on public.pay_scale;
create policy "Authenticated users can read pay scale"
  on public.pay_scale for select
  to authenticated
  using (true);

drop policy if exists "Super admins manage pay scale" on public.pay_scale;
create policy "Super admins manage pay scale"
  on public.pay_scale for all
  to authenticated
  using (private.current_user_role() = 'super_admin')
  with check (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- allowances — general rows (ministry_id null) readable by any authenticated
-- user; ministry-specific rows only by that ministry's admin or a super admin
-- ---------------------------------------------------------------------------

drop policy if exists "Users can read applicable allowances" on public.allowances;
create policy "Users can read applicable allowances"
  on public.allowances for select
  to authenticated
  using (
    ministry_id is null
    or ministry_id = private.current_user_ministry_id()
    or private.current_user_role() = 'super_admin'
  );

drop policy if exists "Super admins manage allowances" on public.allowances;
create policy "Super admins manage allowances"
  on public.allowances for all
  to authenticated
  using (private.current_user_role() = 'super_admin')
  with check (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- profiles
-- (role/ministry_id changes are blocked for non-super-admins by the
--  profiles_prevent_privilege_change trigger, so self-update is safe)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Ministry admins can read profiles in their ministry" on public.profiles;
create policy "Ministry admins can read profiles in their ministry"
  on public.profiles for select
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and ministry_id is not null
    and ministry_id = private.current_user_ministry_id()
  );

drop policy if exists "Super admins manage all profiles" on public.profiles;
create policy "Super admins manage all profiles"
  on public.profiles for all
  to authenticated
  using (private.current_user_role() = 'super_admin')
  with check (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

drop policy if exists "Applicants can read their own applications" on public.applications;
create policy "Applicants can read their own applications"
  on public.applications for select
  to authenticated
  using (applicant_id = (select auth.uid()));

drop policy if exists "Applicants can create their own draft application" on public.applications;
create policy "Applicants can create their own draft application"
  on public.applications for insert
  to authenticated
  with check (
    applicant_id = (select auth.uid())
    and status = 'draft'
  );

-- Editable only while draft / needs_correction; the applicant may keep it in
-- draft or move it to submitted (the resubmission loop), nothing else.
drop policy if exists "Applicants can edit while draft or needs_correction" on public.applications;
create policy "Applicants can edit while draft or needs_correction"
  on public.applications for update
  to authenticated
  using (
    applicant_id = (select auth.uid())
    and status in ('draft', 'needs_correction')
  )
  with check (
    applicant_id = (select auth.uid())
    and status in ('draft', 'submitted')
  );

drop policy if exists "Applicants can delete their own drafts" on public.applications;
create policy "Applicants can delete their own drafts"
  on public.applications for delete
  to authenticated
  using (
    applicant_id = (select auth.uid())
    and status = 'draft'
  );

drop policy if exists "Ministry admins can read their ministry's applications" on public.applications;
create policy "Ministry admins can read their ministry's applications"
  on public.applications for select
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and ministry_id = private.current_user_ministry_id()
  );

-- Review transitions (under_review / approved / rejected / needs_correction /
-- sal1_generated). WITH CHECK pins ministry_id so an admin can never move an
-- application into another ministry.
drop policy if exists "Ministry admins can review their ministry's applications" on public.applications;
create policy "Ministry admins can review their ministry's applications"
  on public.applications for update
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and ministry_id = private.current_user_ministry_id()
  )
  with check (
    private.current_user_role() = 'ministry_admin'
    and ministry_id = private.current_user_ministry_id()
  );

drop policy if exists "Super admins can read all applications" on public.applications;
create policy "Super admins can read all applications"
  on public.applications for select
  to authenticated
  using (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- application_pay_elements — access follows the parent application
-- ---------------------------------------------------------------------------

drop policy if exists "Applicants can read their own pay elements" on public.application_pay_elements;
create policy "Applicants can read their own pay elements"
  on public.application_pay_elements for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists "Ministry admins manage pay elements in their ministry" on public.application_pay_elements;
create policy "Ministry admins manage pay elements in their ministry"
  on public.application_pay_elements for all
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.ministry_id = private.current_user_ministry_id()
    )
  )
  with check (
    private.current_user_role() = 'ministry_admin'
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.ministry_id = private.current_user_ministry_id()
    )
  );

drop policy if exists "Super admins can read all pay elements" on public.application_pay_elements;
create policy "Super admins can read all pay elements"
  on public.application_pay_elements for select
  to authenticated
  using (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- documents — applicants may add/replace files only while the application is
-- editable (draft / needs_correction); admins get read access for review
-- ---------------------------------------------------------------------------

drop policy if exists "Applicants can read their own documents" on public.documents;
create policy "Applicants can read their own documents"
  on public.documents for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists "Applicants can add documents while editable" on public.documents;
create policy "Applicants can add documents while editable"
  on public.documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  );

drop policy if exists "Applicants can remove documents while editable" on public.documents;
create policy "Applicants can remove documents while editable"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  );

drop policy if exists "Ministry admins can read their ministry's documents" on public.documents;
create policy "Ministry admins can read their ministry's documents"
  on public.documents for select
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.ministry_id = private.current_user_ministry_id()
    )
  );

drop policy if exists "Super admins can read all documents" on public.documents;
create policy "Super admins can read all documents"
  on public.documents for select
  to authenticated
  using (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- audit_log — append-only via the SECURITY DEFINER trigger; deliberately NO
-- insert/update/delete policies, so entries cannot be forged or tampered with
-- ---------------------------------------------------------------------------

drop policy if exists "Ministry admins can read their ministry's audit trail" on public.audit_log;
create policy "Ministry admins can read their ministry's audit trail"
  on public.audit_log for select
  to authenticated
  using (
    private.current_user_role() = 'ministry_admin'
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.ministry_id = private.current_user_ministry_id()
    )
  );

drop policy if exists "Super admins can read the full audit trail" on public.audit_log;
create policy "Super admins can read the full audit trail"
  on public.audit_log for select
  to authenticated
  using (private.current_user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- Table grants (least privilege)
--
-- Since April 2026, new tables are no longer automatically exposed to the
-- Data API, so grants must be explicit. RLS decides WHICH ROWS; these grants
-- decide which OPERATIONS are possible at all, as defense in depth:
--  * anon gets nothing — every workflow requires a signed-in user
--  * audit_log is SELECT-only — even a future buggy policy could not allow
--    users to write it (inserts happen via the SECURITY DEFINER trigger)
--  * documents has no UPDATE — files are replaced by delete + re-upload
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table
  public.ministries,
  public.departments,
  public.pay_scale,
  public.allowances
to authenticated;  -- writes reach only super_admin via RLS

grant select, insert, update, delete on table public.profiles     to authenticated;
grant select, insert, update, delete on table public.applications to authenticated;
grant select, insert, update, delete on table public.application_pay_elements to authenticated;
grant select, insert, delete         on table public.documents    to authenticated;
grant select                         on table public.audit_log    to authenticated;

-- Service role (server-side only) bypasses RLS but still needs table grants.
grant all on all tables in schema public to service_role;
