# Security Headers — FHI Global

**Added:** March 5, 2026  
**Updated:** October 6, 2026 — `/editor` + `/globalpartner` noindex headers and slash-form `robots.txt` Disallow list; CSP table rewritten to match `next.config.mjs` (it still listed the dead legacy Supabase host), `X-XSS-Protection` and the blanket `X-Robots-Tag` removed, `X-Powered-By` disabled.  
**File modified:** `next.config.mjs`

---

## Overview

All HTTP security headers are configured in `next.config.mjs` via Next.js's `headers()` async function. They are applied to **every route** (`source: "/(.*)"`) so both page routes and API routes inherit full protection.

---

## Headers Applied

### 1. `Strict-Transport-Security` (HSTS)
```
max-age=63072000; includeSubDomains; preload
```
Forces HTTPS for 2 years. Includes all subdomains and is eligible for browser preload lists. Prevents protocol-downgrade and cookie-hijacking attacks.

---

### 2. `X-Content-Type-Options`
```
nosniff
```
Prevents browsers from MIME-sniffing a response away from the declared `Content-Type`. Stops content-type confusion attacks (e.g. serving a JS file as an image that then gets executed).

---

### 3. `X-Frame-Options`
```
DENY
```
Prevents this app from being embedded in any `<iframe>`, `<frame>`, or `<object>` on external domains. Belt-and-suspenders alongside the CSP `frame-ancestors 'none'` directive.

---

### 4. `X-XSS-Protection` — removed
No longer sent. The legacy XSS auditor it controlled was removed from every current browser, and in old engines it could itself be abused to create vulnerabilities; OWASP recommends omitting the header. The CSP below is the real defence. (`X-Powered-By: Next.js` is also disabled via `poweredByHeader: false`.)

---

### 5. `Referrer-Policy`
```
strict-origin-when-cross-origin
```
Sends the full referrer URL for same-origin requests, but only the origin (no path/query) when crossing origins. Prevents leaking internal paths, user IDs, or tokens embedded in URLs to third-party servers.

---

### 6. `Permissions-Policy`
```
camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
```

| Feature          | Policy   | Reason |
|------------------|----------|--------|
| `camera`         | `(self)` | Required for the ID-capture and face-verification steps in the registration flow |
| `microphone`     | `()`     | Disabled — not used |
| `geolocation`    | `()`     | Disabled — not used |
| `payment`        | `()`     | Disabled — not used |
| `usb`            | `()`     | Disabled — not used |
| `interest-cohort`| `()`     | Disables Google FLoC tracking |

---

### 7. `Content-Security-Policy` (CSP)

One static header built from the `CSP` array in `next.config.mjs` (no nonce — a per-request nonce would force every page to render dynamically and defeat ISR). Directive breakdown:

| Directive | Value | Justification |
|-----------|-------|---------------|
| `default-src` | `'self'` | Catch-all fallback — block anything not explicitly allowed |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` + Google Maps (`maps.googleapis.com`, `maps.gstatic.com`), Vercel Analytics (`va.vercel-scripts.com`), Cloudflare Web Analytics (`static.cloudflareinsights.com`), Tag Manager (`www.googletagmanager.com`) | Next.js App Router needs inline chunks for hydration; `unsafe-eval` is only needed for dev source maps and some Maps features — dropping it in production needs a preview-deploy test of every Maps page first |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Tailwind/Next inject inline styles; the Google Maps JS API loads its Roboto stylesheet from `fonts.googleapis.com` |
| `img-src` | `'self' data: blob:` + the env-configured Supabase project, `flagcdn.com`, `i.ytimg.com`, Google Maps/Google/gstatic/ggpht/googleusercontent, `*.amazonaws.com`, `*.cloudfront.net`, Gravatar, `*.google-analytics.com`, `www.googletagmanager.com` | Project/listing/news media on S3 and Supabase, map tiles, Google avatars, YouTube poster thumbnails, GA4 and Tag Manager's measurement pixel (`/td`) |
| `font-src` | `'self' data: https://fonts.gstatic.com` | `next/font` self-hosts our fonts; the Maps stylesheet pulls Roboto from `fonts.gstatic.com` |
| `connect-src` | `'self'` + the env-configured Supabase project (https + wss), Vercel vitals/scripts, Google Maps, `*.googleapis.com`, Cloudflare insights, GA4 and Tag Manager | Supabase REST/Auth/Realtime, analytics beacons, Maps/Places requests |
| `media-src` | `'self' blob: https://*.amazonaws.com https://*.cloudfront.net` | Camera preview blobs in the ID-capture steps + FHI's films streamed from S3 |
| `worker-src` | `'self' blob:` | Next.js may spawn blob workers |
| `object-src` | `'none'` | No plugin embeds |
| `frame-src` | ebook host, the uploads bucket (dashboard PDF reader), YouTube/Vimeo/Facebook/Instagram/TikTok/Google Drive players, and the virtual-tour providers listed in `lib/embed-hosts.json` | Video and 360° tour tiles on project pages; sign-in with Google is a full-page redirect, not a frame |
| `frame-ancestors` | `'none'` | This app cannot be framed by anyone (clickjacking defence) |
| `form-action` | `'self'` | All `<form>` submissions must stay on the same origin |
| `base-uri` | `'self'` | Prevents `<base href>` injection |
| `upgrade-insecure-requests` | *(flag, production only)* | Rewrites HTTP sub-resource requests to HTTPS; in dev over `http://localhost` it would break RSC fetches |

---

### 8. `Cross-Origin-Opener-Policy`
```
same-origin
```
Prevents other origins from retaining a reference to this window via `window.opener`. Mitigates cross-origin information leaks and Spectre-class side-channel attacks.

---

### 9. `Cross-Origin-Resource-Policy`
```
same-origin
```
Prevents other origins from loading our responses as sub-resources (e.g. `<img src="https://fhi-global.com/api/...">`). Adds a layer of protection against cross-origin data exfiltration.

---

## External Domains Audited

| Domain | Usage | CSP directives |
|--------|-------|----------------|
| env-configured Supabase project (`NEXT_PUBLIC_SUPABASE_URL`) | DB, Auth, Storage, Realtime | `img-src`, `connect-src` (https + wss) |
| `*.amazonaws.com`, `*.cloudfront.net` | Project, listing, news and event media; FHI films | `img-src`, `media-src` |
| `flagcdn.com` | Flag images | `img-src` |
| `maps.googleapis.com`, `maps.gstatic.com`, `fonts.googleapis.com`, `fonts.gstatic.com` | Google Maps JS API (scripts, tiles, Roboto stylesheet + fonts) | `script-src`, `img-src`, `connect-src`, `style-src`, `font-src` |
| `www.googletagmanager.com`, `*.google-analytics.com` | GA4 / Tag Manager (script, measurement pixel, beacons) | `script-src`, `img-src`, `connect-src` |
| `va.vercel-scripts.com`, `vitals.vercel-insights.com` | Vercel Analytics | `script-src`, `connect-src` |
| `static.cloudflareinsights.com`, `cloudflareinsights.com` | Cloudflare Web Analytics beacon | `script-src`, `connect-src` |
| `i.ytimg.com`, `www.youtube-nocookie.com`, `player.vimeo.com` | Video poster thumbnails and players | `img-src`, `frame-src` |
| *(legacy `hefwmaoborpfuyhbguzv.supabase.co`)* | **Dead (HTTP 402) and removed** — do not reference | — |

---

## Notes for Future Development

- **Adding a new external image domain** → add it to `img-src` in the `CSP` array in `next.config.mjs`.
- **Adding a new third-party script** (e.g. analytics, chat widget) → add its hostname to `script-src` and `connect-src`.
- **Production hardening** → If you want to remove `'unsafe-eval'` in production, use the `NEXT_PUBLIC_VERCEL_ENV` environment variable to conditionally include it only in development.
- **Nonce-based CSP** → For maximum strictness you can replace `'unsafe-inline'` in `script-src` with per-request nonces using Next.js middleware. This is a future hardening step.
- **`report-uri`** → Consider adding a `report-uri` or `report-to` endpoint (e.g. [report-uri.com](https://report-uri.com)) to receive CSP violation reports in production.
- **Indexing signals (`X-Robots-Tag`)** → there is deliberately NO site-wide `X-Robots-Tag` header. Public pages are indexable by default and set their own `robots` through the Metadata API (`app/layout.tsx` carries only the googleBot `max-*` snippet/preview directives; pages that must stay out of the index — non-property news, filtered `/projects` views, business cards — return `robots: { index: false, follow: true }`). Private paths (every role dashboard — including `/editor` and `/globalpartner`, which had no header of their own and, being outside `proxy.ts`'s matcher, served an anonymous crawler a 200 shell —, `/api`, sign-in, registration, `/internal`, `/owner-documents`, `/template`) get `PRIVATE_NOINDEX_HEADERS`, which appends an explicit `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`. A blanket "index, follow" header would contradict every one of those page-level `noindex` tags.
- **`robots.txt` Disallow entries all end in a slash** (`/admin/`, `/api/`, …; the `PRIVATE_DISALLOW` list in `app/robots.ts`). A bare `/admin` is a *prefix* rule and would also block a developer whose slug starts with it (`/administration-realty`) — developers choose their own slugs at the site root. The slash form blocks the children only; the exact roots (`/admin`, `/dashboard`, …) are covered by the `X-Robots-Tag` header above, which a crawler can only read if it is allowed to fetch the page. `/agent/` and `/developer/` keep the slash so they never block the public `/agents`, `/agent-websites` and `/developers`. When you add a role dashboard, add it to BOTH `PRIVATE_DISALLOW` and a `PRIVATE_NOINDEX_HEADERS` entry in `next.config.mjs`.
