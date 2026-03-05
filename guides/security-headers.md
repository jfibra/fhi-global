# Security Headers — FHI Global

**Added:** March 5, 2026  
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

### 4. `X-XSS-Protection`
```
1; mode=block
```
Activates the legacy XSS auditor in older browsers (Chrome < 78, IE). Modern browsers use CSP instead, but this header covers stragglers.

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

The CSP was built by auditing every external resource used in the codebase. Full directive breakdown:

| Directive | Value | Justification |
|-----------|-------|---------------|
| `default-src` | `'self'` | Catch-all fallback — block anything not explicitly allowed |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' va.vercel-scripts.com` | Next.js App Router requires inline script chunks for hydration; `unsafe-eval` needed for dev source maps; Vercel Analytics loads its script from `va.vercel-scripts.com` |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind CSS and Next.js inject inline `<style>` tags at runtime |
| `img-src` | `'self' data: blob: https://hefwmaoborpfuyhbguzv.supabase.co https://flagcdn.com` | Supabase Storage serves all project/developer/news images; `flagcdn.com` serves the UAE flag in the hero section; `blob:` allows camera capture previews; `data:` covers inline SVG backgrounds |
| `font-src` | `'self' data:` | `next/font/google` downloads fonts at build-time and self-hosts them under `/_next/static/` — no runtime request to `fonts.googleapis.com` needed |
| `connect-src` | `'self' https://hefwmaoborpfuyhbguzv.supabase.co wss://hefwmaoborpfuyhbguzv.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com` | All Supabase REST, Auth, and Realtime (WebSocket) calls; Vercel Analytics beacon (`vitals.vercel-insights.com`) and script host |
| `media-src` | `'self' blob:` | Camera stream captured via `getUserMedia` is exposed as a `blob:` URL to the `<video>` element in the ID-capture and face-verification modals |
| `worker-src` | `'self' blob:` | Next.js may spawn inline web workers (particularly in dev mode) |
| `object-src` | `'none'` | No Flash or plugin-based embeds |
| `frame-src` | `'none'` | No iframes embedded in this app |
| `frame-ancestors` | `'none'` | This app cannot be framed by anyone (clickjacking defence) |
| `form-action` | `'self'` | All `<form>` submissions must stay on the same origin |
| `base-uri` | `'self'` | Prevents `<base href>` injection (a vector for relative-URL attacks) |
| `upgrade-insecure-requests` | *(flag)* | Instructs browsers to transparently rewrite HTTP sub-resource requests to HTTPS |

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
| `hefwmaoborpfuyhbguzv.supabase.co` | Supabase DB, Auth, Storage, Realtime | `img-src`, `connect-src` (https + wss) |
| `flagcdn.com` | UAE flag image in hero section | `img-src` |
| `va.vercel-scripts.com` | Vercel Analytics script loader | `script-src`, `connect-src` |
| `vitals.vercel-insights.com` | Vercel Analytics beacon endpoint | `connect-src` |
| *(Google Fonts)* | `next/font/google` — self-hosted at build time | Not needed in CSP |

---

## Notes for Future Development

- **Adding a new external image domain** → add it to `img-src` in the `CSP` array in `next.config.mjs`.
- **Adding a new third-party script** (e.g. analytics, chat widget) → add its hostname to `script-src` and `connect-src`.
- **Production hardening** → If you want to remove `'unsafe-eval'` in production, use the `NEXT_PUBLIC_VERCEL_ENV` environment variable to conditionally include it only in development.
- **Nonce-based CSP** → For maximum strictness you can replace `'unsafe-inline'` in `script-src` with per-request nonces using Next.js middleware. This is a future hardening step.
- **`report-uri`** → Consider adding a `report-uri` or `report-to` endpoint (e.g. [report-uri.com](https://report-uri.com)) to receive CSP violation reports in production.
