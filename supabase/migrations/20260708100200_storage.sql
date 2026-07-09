-- MinistryFlow — document storage
--
-- Rerunnable: the bucket upsert refreshes its limits, policies are dropped
-- and recreated.
--
-- Private bucket for onboarding document uploads.
-- Free-tier storage is 1GB total, so uploads are capped at 5MB per file and
-- restricted to PDF/JPEG/PNG at the bucket level (enforced server-side by
-- Supabase, in addition to client/server validation in the app).
--
-- Path convention: <application_id>/<doc_type>/<filename>
-- The first path segment ties every object to an application row, which is
-- what the policies below key on.
--
-- Note: RLS policies and triggers on storage tables remain explicitly allowed
-- under Supabase's 2025 storage-schema restrictions. If a hosted project ever
-- rejects the bucket INSERT below, create the bucket once via the dashboard
-- with the same id/limits — the policies are unaffected.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  5242880, -- 5MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Applicants: full manage rights on files under their own application, but
-- only while the application is editable (draft / needs_correction).
-- Note: upsert (file replacement) needs INSERT + SELECT + UPDATE, hence all
-- four policies.

drop policy if exists "Applicants can read own application files" on storage.objects;
create policy "Applicants can read own application files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.applicant_id = (select auth.uid())
    )
  );

drop policy if exists "Applicants can upload while editable" on storage.objects;
create policy "Applicants can upload while editable"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  );

drop policy if exists "Applicants can replace files while editable" on storage.objects;
create policy "Applicants can replace files while editable"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  )
  with check (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  );

drop policy if exists "Applicants can delete files while editable" on storage.objects;
create policy "Applicants can delete files while editable"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'needs_correction')
    )
  );

-- Ministry admins: read-only access to files for applications in their ministry.
drop policy if exists "Ministry admins can read their ministry's files" on storage.objects;
create policy "Ministry admins can read their ministry's files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and private.current_user_role() = 'ministry_admin'
    and exists (
      select 1 from public.applications a
      where a.id::text = (storage.foldername(name))[1]
        and a.ministry_id = private.current_user_ministry_id()
    )
  );

drop policy if exists "Super admins can read all application files" on storage.objects;
create policy "Super admins can read all application files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and private.current_user_role() = 'super_admin'
  );
