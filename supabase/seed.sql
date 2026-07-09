-- Local/dev seed data — synthetic only.
--
-- Deliberately NOT seeded here: pay_scale and allowances. Those must be
-- transcribed from the official 2025 Integrated Pay Scale and the MoH
-- incentive allowance memo (CLAUDE.md §12) — seeding invented salary figures
-- into a payroll system would be worse than seeding nothing. The app degrades
-- gracefully: grade fields fall back to free-text inputs and the review
-- screen shows a "no allowance rates loaded" warning until real data exists.
--
-- Never seed real staff personal data (national IDs, TINs, bank accounts).

insert into public.ministries (name, code)
values ('Ministry of Health', 'MOH')
on conflict (code) do nothing;

insert into public.departments (ministry_id, name)
select m.id, d.name
from public.ministries m
cross join (values
  ('Directorate of Health Services'),
  ('Directorate of Planning & Information'),
  ('Human Resources'),
  ('Accounts Office')
) as d(name)
where m.code = 'MOH'
  and not exists (
    select 1 from public.departments existing
    where existing.ministry_id = m.id and existing.name = d.name
  );
