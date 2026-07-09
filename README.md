# MinistryFlow

Staff onboarding and salary setup (SAL 1) platform for the Government of The
Gambia. Pilot ministry: **Ministry of Health**. See [.claude/CLAUDE.md](.claude/CLAUDE.md)
for the full specification.

**Stack:** Next.js (App Router, TypeScript, Tailwind) · Supabase (Postgres,
Auth, Storage, RLS) · Resend (email) · pdf-lib (SAL 1 PDF) — all free-tier.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env.local` and fill in the
   values from your Supabase project (Settings → API) and Resend.

3. **Apply database migrations** to your Supabase project:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   Or run locally with Docker: `npx supabase start` (applies migrations +
   `supabase/seed.sql` automatically).

4. **Bootstrap the super admin** (Abdul Aziz during the pilot). After that
   account signs up through the app, promote it once via the Supabase SQL
   editor:

   ```sql
   update public.profiles
   set role = 'super_admin', ministry_id = null
   where id = (select id from auth.users where email = 'THEIR_EMAIL');
   ```

   Ministry admins (Accounts Office) are then invited from the super admin
   dashboard at `/super-admin` — no SQL needed.

5. **Run**

   ```bash
   npm run dev    # app
   npm test       # payroll cutoff unit tests
   ```

## Remaining data task — pay scale & allowances (important)

`pay_scale` and `allowances` are intentionally **empty** until the official
documents are transcribed (CLAUDE.md §12):

- Pages 1–12 of the 2025 Integrated Pay Scale → `pay_scale` + general
  allowance rows (`allowances.ministry_id = null`).
- Remaining pages (MoH incentive allowances) → `allowances` scoped to the
  Ministry of Health.
- **Handwritten figures in the source PDFs are the current, revised amounts**
  (e.g. Risk Allowance is D2,000, not the printed D1,000).
- Cross-check entries (e.g. grade 7.1, 8.1) against the sample SAL 1 forms.

Until then the app runs, but grade dropdowns fall back to free-text and the
review screen warns that no allowance rates are loaded.

## Key invariants

- **Payroll cutoff** (`src/lib/payroll/calculatePayrollAction.ts`): assumption
  of duty on the 1st–14th → full pay; 15th–24th → prorated; 25th–end → zero
  (rolls to next month). Boundary-tested; do not change without written
  confirmation from the Ministry.
- **Audit log**: written by a database trigger on every status change —
  application code cannot skip it, and no one can insert audit rows directly.
- **Rejection/correction comments** are required free text (DB constraint),
  never a fixed reason list.
- **Support staff grade range** (provisionally 1–2) lives only in
  `src/lib/config.ts` — update there when Abdul Aziz confirms.
- **RLS everywhere**: applicants see only their own application; ministry
  admins only their ministry; super admin sees all. The UI never relies on
  frontend checks alone.
