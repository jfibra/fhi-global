# Merchant Partnership Programme

Built 2026-11-20 (boss via Juliecor) from the Merchant Partnership Proposal 2026–2027, the Agent Business Development Programme and the Business Development Officer Agreement (RentSouq's PDFs). RentSouq.ae is the rental platform FHI Global Property LLC runs with MCG Properties LLC; the programme lives in FHI, and rentsouq.ae reads it through the external API.

## What it is

A **merchant** (restaurant, cleaner, hotel, spa, school, supermarket…) signs a one-year Merchant Partnership Agreement through an FHI agent, displays a unique QR in its shop, and earns **AED 100 for every unit its customers rent** on rentsouq.ae after scanning it (paid the 15th of the next month). The **agent who signed the merchant** earns AED 100 per such deal too (paid the 10th), for as long as the merchant's agreement runs. A rental cancelled within 14 days is taken back. The numbers live in `lib/merchant/rules.ts` and nowhere else.

## The flow in FHI

1. **Agent shares the merchant link** — Invite › Merchants (`lib/share-links.ts` `merchantInviteUrl`: `/register?type=merchant&ref=<agent id>`), with WhatsApp wording and a QR of the link. Every selling role (`ROLES_MERCHANT_SIGNERS`).
2. **Merchant registers** through that link only (no ref → the email-code step refuses; Google falls back to a pending member). First step: business name, kind, the person who signs, WhatsApp (`lib/merchant-signup.ts`); then the email code or Google. The account is role `merchant`, **status active from sign-up** (it must log in to upload its documents); `metadata.invited_by` = the agent; a `merchants` row is created in `onboarding` (`lib/merchant/signup-server.ts`). Merchants never join the agent's team and never auto-approve.
3. **Merchant completes onboarding** at `/merchant` (the overview IS the checklist until acceptance): business profile (`/merchant/business`), the four official requirements (`/merchant/documents`): signed Merchant Agreement (sign on screen → `lib/merchant/agreement.ts` builds the pre-filled PDF with the drawn signature, or upload a signed PDF; "Download the form" = the unsigned pre-filled PDF), trade licence copy, signatory's Emirates ID, bank details (typed, IBAN sealed with `lib/merchant/secrets.ts`, or a bank letter). The signing agent and admins can upload on the merchant's behalf (`POST /api/merchant/documents?merchant=<id>`). The moment the fourth requirement is in, the status flips to `submitted` (`refreshStatus`).
4. **Admin reviews** at Accounts & Invites › Merchants (`features/dashboard/merchants/page.tsx`, drawer `merchant-drawer.tsx`): ticks each document (`PATCH /api/admin/merchants/[id]/documents/[docId]`), reveals the IBAN (`?reveal=1`, audited), then **Accept** (`POST …/accept`: code `M-XXXX`, QR, agreement dated one year from today, account active, emails to the merchant with the QR PNG + A5 flyer PDF and to the agent) or **Decline** with a reason (`POST …/decline`: account switched off, both emailed). Everything is audited under category `merchants`.
5. **The QR** opens `fhiglobal.ae/m/<code>` (`app/m/[code]/route.ts`): the scan is counted in `merchant_scans` (salted IP hash) and the customer is forwarded to rentsouq.ae with `?ref=<code>` (`MERCHANT_LANDING_URL`, default `https://rentsouq.ae/`). PNG, A5 flyer and roll-up banner come from `GET /api/merchant/qr?format=png|flyer|banner` (`lib/merchant/qr.ts`, `lib/merchant/flyer.ts`, pdf-lib, no sharp).
6. **A closed deal** is a Rental sale in Record Your Sale (both the wizard and the admin dialog) with "Came through a merchant QR" set (`sales_reports.merchant_id`, accepted merchants from `GET /api/merchants/options`), **validated** by an admin. Set invalid within the claw-back window, it drops off. `lib/merchant/service.ts` `figuresFor` builds scans, deals and incentives per month from those rows; nothing is stored twice.
7. **rentsouq.ae** reads merchants, codes, agreements and deals from `GET /api/external/merchants` (keyed; see `guides/external-api.md`) and merchant logins from the users route.

## Tables (migration 092, service role only)

- `merchants` — one per merchant account (`profile_id` unique): agent_id, business, signatory, licence, bank (`iban_sealed` + `iban_last4`), voucher, `code`, `status` (`onboarding | submitted | accepted | declined | ended`), the decision stamps, `agreement_starts_on/ends_on`.
- `merchant_documents` — the files by kind (`agreement | trade_licence | emirates_id | bank`), newest wins, `verified_at` = the admin's tick.
- `merchant_scans` — one row per QR scan.
- `sales_reports.merchant_id` — nullable, rentals only.

Access is the ONE rule in `lib/merchant/access.ts`: the merchant reads its own record, the signing agent the merchants with its `agent_id`, admin staff any. No RLS reads: the pages go through `app/api/merchant/*`, `app/api/agent/merchants`, `app/api/admin/merchants/*`.

## The role

`merchant` is the tenth role (`lib/app-roles.ts`, dashboard `/merchant`, sidebar `MERCHANT_NAV`, `proxy.ts` matcher, `next.config.mjs` noindex). It is exempt from the complete-profile gate, the headshot gate and the BRN gate (a business, not an agent), and excluded from `ROLES_INTERNAL_RESOURCES`.

## Phase two (not built)

Monthly statements with "mark paid"; trade-licence and agreement expiries on the Admin Calendar; FHI Assistant tools; the admin bell; "Add a merchant myself" for agents; the sidebar queue badge.
