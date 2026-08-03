# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FHI Global — a real-estate platform (public property browsing + role-based internal dashboards) built on Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase (Postgres + Auth + RLS). File uploads go to S3. The README.md is v0.app boilerplate ("Glow skincare") and does not describe this app — ignore it.

## Commands

```bash
npm run dev          # dev server (webpack); npm run dev:turbo for Turbopack
npm run build        # production build
npm run lint         # eslint . — flat config in eslint.config.mjs (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit     # typecheck — REQUIRED, because next.config.mjs sets ignoreBuildErrors: true

# Database migrations (custom pg runner, NOT Prisma — prisma.config.ts is vestigial, there is no prisma/ dir)
npm run db:new-migration -- short_name   # creates supabase/migrations/NNN_short_name.sql
npm run db:migrate                       # requires DATABASE_URL in .env.local (or .env)
```

Lint currently reports pre-existing problems across the repo (mostly `react-hooks/set-state-in-effect` errors and unused-vars warnings) — they are not caused by your change; keep new code clean rather than trying to fix them all.

There is no test suite.

## Environment (`.env.local`)

Core (required): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (migrations only), `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL`.

Feature-gated (app runs without them, the feature breaks): `GEMINI_API_KEY` + `GEMINI_MODEL` — AI copy generation (`app/api/ai/*`); `GOOGLE_CLOUD_VISION_API_KEY` — registration ID OCR (`app/api/ocr`); `GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — maps on /buy, /rent, /developers; `HOMESPH_NEWS_API_KEY` + `HOMESPH_NEWS_API_URL` (bare base, `https://api.homes.ph/api`) — external news feed called server-side by `lib/news-service.ts` (`app/api/news/view` + `/subscribe` forward view-tracking/newsletter with the key; see `guides/NewsIntegration.md`); `INDEXNOW_KEY` + `INDEXNOW_SUBMIT_SECRET` — IndexNow pings (key file at `/indexnow.txt`, manual submits via `POST /api/indexnow/submit`); Google Sign-In is a Supabase Auth provider (redirect OAuth) — no app-side Google client ID/secret env is required; configure it in the hosted Supabase dashboard (enable Google + client ID + client secret), add the app origins to the Google Cloud OAuth client's Authorized redirect URIs (the Supabase `…/auth/v1/callback` URL) and Supabase → URL Configuration → Redirect URLs (`/auth/callback`).

In production, `NEXT_PUBLIC_SITE_URL` must be `https://fhiglobal.ae` — canonicals, the sitemap index (`app/(seo-files)/sitemap.xml` → per-section shards `/sitemap-{pages,projects,developers,listings,events,news}-N.xml` served by `app/api/sitemap/*` via `next.config.mjs` rewrites; helpers in `lib/sitemap-helpers.ts` + `lib/sitemap-sections.ts`), `app/news-sitemap.xml/` (Google News, last-48h only), `app/robots.ts`, and OG images (`app/og/{developer,project}`) build URLs from it via `lib/seo.ts` (code falls back to that domain if unset).

Two Supabase projects are in play: the env-configured one holds the data; a legacy project (`hefwmaoborpfuyhbguzv.supabase.co`) still serves branding media (hero, logos, default OG image) via hardcoded URLs and is hardcoded into the CSP and image hosts in `next.config.mjs`.

## Architecture

### Auth & routing: proxy.ts + lib/auth-guard.ts

- `proxy.ts` (Next 16's replacement for middleware.ts) guards `/login`, `/dashboard/*`, and `/account-inactive`: it refreshes the Supabase session (via `lib/supabase/middleware.ts`), auto-creates a missing profile, redirects inactive accounts to `/account-inactive`, forces incomplete profiles to `/dashboard/profile` (skipped for admin staff; "incomplete" = missing fname/lname/timezone/phone), redirects already-logged-in users off `/login` to their role dashboard, and bounces users off dashboard paths their role can't access (path↔role logic lives in `lib/auth.ts`).
- API routes do their own guarding. `lib/auth-guard.ts` exports `requireActiveSession()` and `requireRole([...])`, returning `{ ok, response|context }` (return `session.response` on failure) — use these for new routes. Most existing routes instead do inline `supabase.auth.getUser()` + a `lib/app-roles.ts` predicate (`isAdminStaffRole`, `canUseSupportPortal`, …); both patterns are live.

### Roles: lib/app-roles.ts is the single source of truth

`profiles.role` has nine values (`super_admin`, `admin`, `team_leader`, `unit_manager`, `agent`, `developer`, `secretary`, `team_secretary`, `member`). Each maps to its own dashboard subtree (`app/dashboard/superadmin`, `/admin`, `/teamleader`, `/unitmanager`, `/agent`, `/developer`, `/secretary`, `/teamsecretary`, `/member`). In addition, `SHARED_DASHBOARD_PREFIXES` in `lib/auth.ts` opens cross-role areas to every role — `/dashboard/{profile,admin/users,developers,teams,projects,tax-entities,purchase-categories,purchases,sales,listings,support}` — and super_admin can access everything. All role checks, labels, badge colors, and dashboard paths must import from `lib/app-roles.ts` (role groups like `ROLES_ADMIN_STAFF`, `ROLES_SALES_PIPELINE`, and predicate helpers) rather than hardcoding role strings.

Registration (`/register`, `/register/developer` → `app/api/register/route.ts`) runs on the service-role client, defaults the role to `member` (`developer` on the developer path), and creates accounts with `status: "pending"` — new users are bounced to `/account-inactive` until an admin activates them. The flow includes ID capture + Google Vision OCR (`app/api/ocr`).

Google Sign-In (`components/auth/GoogleAuthFlow.tsx` on `/login` + `/register`) uses Supabase's `signInWithOAuth` redirect flow (not a popup — reliable regardless of third-party-cookie settings): click → Google → `app/auth/callback/route.ts` (`exchangeCodeForSession`) → `app/auth/google/continue` shows the imported Leuterio Realty agent profile in a modal (session-based lookup via `app/api/lr/lookup` + `lib/lr/lr-api.ts`, LR public API, no key). On confirm, `app/api/auth/google/finalize` provisions the FHI profile via the service-role client — mapping the LR role to the matching FHI role (`unit_manager`/`team_leader`/`agent`/`secretary`), `active`, guarded by `metadata.google_provisioned` so returning users and admin role changes are never overwritten. Non-LR emails become `member` (pending). LR is read-only (no agent-create API). `lib/auth.ts` least-privilege defaults (migration 007: role `member`, status `pending`) mean a skipped/failed provisioning step never yields elevated access.

### Supabase clients — pick the right one

| Client | File | Use in |
|---|---|---|
| Browser (cookie session) | `lib/supabase/client.ts` | Client components and the `lib/*-service.ts` data services |
| Server (cookie session) | `lib/supabase/server.ts` | Server components / API routes acting as the logged-in user |
| Public anon (no cookies, cached) | `lib/supabase/public.ts` | Public SSR/ISR pages (`lib/buy/*`, `lib/data/home.ts`) — keeps routes statically cacheable |
| Service role (bypasses RLS) | `lib/admin-supabase.ts` | Server-only admin operations (`app/api/admin/*`, registration); never import into client code |

A fifth factory, `lib/supabase/middleware.ts` (`updateSession`), exists solely for `proxy.ts`.

### Data layer

- `lib/*-service.ts` (teams, sales, purchases, projects, developers, support, agent-listings, …) hold the domain logic and Supabase queries; they run client-side with the browser client and rely on RLS. Two exceptions: `lib/user-service.ts` is types/constants/helpers only — user CRUD lives in `app/api/admin/users/*` on the service-role client — and `lib/news-service.ts` is server-only, calling the external HomesPH news API.
- Public buy/rent browsing logic lives in `lib/buy/` and uses the anon client.
- `app/api/upload/*` routes upload to S3 via `@aws-sdk/client-s3`. Key prefixes are inconsistent — uppercase `FHI_GLOBAL/` (developer, team, project, agent-listing, purchase-file), lowercase `fhi_global/` (sale-file, support-ticket-file, register-id), and `avatars/` (avatar) — match the existing prefix of the domain you touch. `register-id` is intentionally unauthenticated (public registration); the others check roles.
- AI copy generation (`app/api/ai/listing-description`, `app/api/ai/project-copy`) calls Google Gemini.

### Database

- `guides/database.md` is the reference schema dump (context only — not runnable). The rest of `guides/` documents each domain (teams, sales_report, purchases, users, support_tickets, RLS policies, the external news API, etc.) — check the matching guide before touching a domain.
- Schema changes are incremental numbered files in `supabase/migrations/` (leading-underscore files like `_TEMPLATE.sql` and `*.example.sql` are skipped by the runner). The runner re-applies ALL files every run — it has no applied-migrations tracking and does not wrap files in a transaction — so wrap DDL in `BEGIN;`/`COMMIT;` and use idempotent patterns (`IF NOT EXISTS`).

### UI

- `components/ui/` is shadcn/ui-style (Radix + class-variance-authority, configured via `components.json`); domain components live in `components/{buy,dashboard,developer,developers,public}/`.
- Client-side auth state comes from `context/auth-context.tsx` (populated from server-passed props — it does not subscribe to auth-state changes).

### Security headers / CSP

CSP and all security headers are centralized in `next.config.mjs`. Any new external origin (image host, script, API endpoint) must be added both to the CSP directives and, for images, to `images.remotePatterns` — otherwise it will be blocked in the browser. The same file applies `X-Robots-Tag: noindex` to private paths (`/dashboard`, `/api`, `/login`, `/register`, `/profile`, `/admin`, `/internal`).
