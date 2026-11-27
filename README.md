# GovtJobs Hub

A Next.js 16 and Supabase recruitment information portal. Public pages read only published or closed listings; administrator operations require a row in the protected `public.admin_users` table.

## Stack

- Next.js App Router, React, TypeScript and Tailwind CSS
- Supabase Auth, PostgreSQL, RLS and Storage
- Zod validation for server-side job publishing
- Responsive public job discovery, listing and details, plus an admin workspace

## Environment

Copy `.env.example` to `.env.local` for a local checkout and provide the Supabase values from the connected project. The deployed v0 project already has its Supabase variables provisioned. `SUPABASE_SERVICE_ROLE_KEY` is never used by browser code and is not required by the current implementation. Set `NEXT_PUBLIC_SITE_URL` to the canonical deployed domain for sitemap and metadata.

## Database

The `govtjobs_hub_phase1` migration has been applied to the connected Supabase project. It creates the recruitment, taxonomy, saved-job, profile, audit and future ingestion tables; indexes; admin authorization helper; RLS policies; and the public PDF notification bucket. For a separate Supabase project, apply the SQL in `supabase/migrations/202611260001_govtjobs_hub_phase1.sql` using the project’s migration workflow.

### First administrator

1. Register an account at `/auth/login` using a real email address and confirm the email if confirmation is enabled.
2. As the database owner, add only the intended account to the protected admin allowlist:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@your-domain.example'
   on conflict (user_id) do nothing;
   ```

3. Sign in, then visit `/admin`. Do not expose or use the service-role key in the browser. Ordinary users cannot grant themselves an admin role.

## Running locally

Install dependencies with the package manager in `package.json`, then run the `dev` script. Create a confirmed user and bootstrap an administrator before testing the protected authoring flow.

## Current Phase 1 scope

- Public home page, searchable and filterable jobs directory, detail pages, sitemap and robots routes.
- Public home, searchable/filterable directory, deadline and application-status filters, detail pages, state/qualification/organization/category routes, saved jobs, sitemap and robots routes.
- Admin overview, protected job creation/editing, taxonomy creation, review/publish/close/archive/delete actions, server-side validation, audit logging, and a sortable, searchable paginated job table.
- Fee and vacancy breakdowns can be entered as validated JSON arrays. Public admit-card/result views are backed by job date fields, and exam calendar uses published preliminary exam dates. Answer-key and syllabus pages remain honest empty states until dedicated verified records are modeled.
- `supabase/seed.sql` is development-only and inserts real facet names plus two clearly fictitious SAMPLE ONLY, unverified, draft notices. It is never applied to the connected production database and its jobs are not publicly visible.
- Follow-up work: friendlier repeatable fee/vacancy row controls, taxonomy editing/deletion, duplicate and bulk actions, views analytics, dedicated answer-key/syllabus tables and workflows, admin management of sources/review queue/admit cards/results, email alerts, and automated ingestion. No fabricated active recruitment data is included.
- Supabase Auth and RLS are connected. Notification PDF storage is restricted to administrators for uploads. This MVP has not been audited for production compliance and should receive a security review before broad public launch.
# sarkari-naukari
