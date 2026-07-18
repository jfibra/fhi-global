# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FHI Global — a real-estate platform (public property browsing + role-based internal dashboards) built on Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase (Postgres + Auth + RLS). File uploads go to S3. The README.md is v0.app boilerplate ("Glow skincare") and does not describe this app — ignore it.

## Commands

```bash
npm run dev          # dev server (webpack); npm run dev:turbo for Turbopack
npm run build        # production build
npm run lint         # eslint .
npx tsc --noEmit     # typecheck — REQUIRED, because next.config.mjs sets ignoreBuildErrors: true

# Database migrations (custom pg runner, NOT Prisma — prisma.config.ts is vestigial, there is no prisma/ dir)
npm run db:new-migration -- short_name   # creates supabase/migrations/NNN_short_name.sql
npm run db:migrate                       # applies all numbered migrations; requires DATABASE_URL in .env.local
```

There is no test suite.

Required env (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (for migrations only), `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL`. In production, `NEXT_PUBLIC_SITE_URL` must be `https://fhiglobal.ae` — every canonical tag, sitemap URL, and robots.txt line is built from it (code falls back to that domain if unset).

## Architecture

### Auth & routing: proxy.ts + lib/auth-guard.ts

- `proxy.ts` (Next 16's replacement for middleware.ts) guards `/login`, `/dashboard/*`, and `/account-inactive`: it refreshes the Supabase session, auto-creates a missing profile, redirects inactive accounts to `/account-inactive`, forces incomplete profiles to `/dashboard/profile`, and bounces users off dashboard paths their role can't access (path↔role logic lives in `lib/auth.ts`).
- API routes do their own guarding — call `requireActiveSession()` or `requireRole([...])` from `lib/auth-guard.ts` at the top of every protected route handler; they return `{ ok, response|context }` (return `session.response` on failure).

### Roles: lib/app-roles.ts is the single source of truth

`profiles.role` has nine values (`super_admin`, `admin`, `team_leader`, `unit_manager`, `agent`, `developer`, `secretary`, `team_secretary`, `member`). Each role maps to its own dashboard subtree (`app/dashboard/superadmin`, `/admin`, `/teamleader`, `/unitmanager`, `/agent`, `/developer`, `/secretary`, `/teamsecretary`, `/member`). All role checks, labels, badge colors, and dashboard paths must import from `lib/app-roles.ts` — use the exported role groups (`ROLES_ADMIN_STAFF`, `ROLES_SALES_PIPELINE`, etc.) and helpers rather than hardcoding role strings.

### Four Supabase clients — pick the right one

| Client | File | Use in |
|---|---|---|
| Browser (cookie session) | `lib/supabase/client.ts` | Client components and the `lib/*-service.ts` data services |
| Server (cookie session) | `lib/supabase/server.ts` | Server components / API routes acting as the logged-in user |
| Public anon (no cookies, cached) | `lib/supabase/public.ts` | Public SSR/ISR pages (`lib/buy/*`, `lib/data/home.ts`) — keeps routes statically cacheable |
| Service role (bypasses RLS) | `lib/admin-supabase.ts` | Server-only admin operations; never import into client code |

### Data layer

- `lib/*-service.ts` (users, teams, sales, purchases, projects, developers, support, news, …) hold the domain logic and Supabase queries; most run client-side with the browser client and rely on RLS.
- Public buy/rent browsing logic lives in `lib/buy/` and uses the anon client.
- `app/api/upload/*` routes upload files to S3 via `@aws-sdk/client-s3` after a role check; keys are namespaced under `FHI_GLOBAL/`.

### Database

- `guides/database.md` is the reference schema dump (context only — not runnable). The rest of `guides/` documents each domain (teams, sales_report, purchases, users, RLS policies, etc.) — check the matching guide before touching a domain.
- Schema changes are incremental numbered files in `supabase/migrations/` (`_TEMPLATE.sql` and `*.example.sql` are skipped by the runner). Wrap DDL in `BEGIN;`/`COMMIT;` and prefer idempotent patterns (`IF NOT EXISTS`) since the runner re-applies all files.

### UI

- `components/ui/` is shadcn/ui-style (Radix + class-variance-authority, configured via `components.json`); domain components live in `components/{buy,dashboard,developer,developers,public}/`.
- Client-side auth state comes from `context/auth-context.tsx`.

### Security headers / CSP

CSP and all security headers are centralized in `next.config.mjs`. Any new external origin (image host, script, API endpoint) must be added both to the CSP directives and, for images, to `images.remotePatterns` — otherwise it will be blocked in the browser.
