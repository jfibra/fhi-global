-- Migration 092: the Merchant Partnership Programme (boss via Juliecor, 2026-11-20).
--
-- A merchant (a restaurant, cleaner, hotel, spa, school, supermarket…) signs
-- a one-year Merchant Partnership Agreement through an FHI agent, displays a
-- unique QR code in its shop, and earns AED 100 for every unit its customers
-- rent on rentsouq.ae after scanning it. The agent who signed the merchant
-- earns AED 100 per such deal too. The rules live in lib/merchant/rules.ts.
--
-- Merchants log into FHI with their own account: a tenth role, `merchant`,
-- registered here for profiles_role_fkey like global_partner (migration 050).
-- Their account is active from sign-up (so they can upload their documents);
-- what the admins gate is the merchant RECORD below: onboarding → submitted
-- (all four official documents in) → accepted (code + QR issued, agreement
-- dated) or declined.
--
-- A closed deal is a Rental sale in Record Your Sale tagged with the merchant
-- (sales_reports.merchant_id) and validated by an admin; set invalid within
-- the claw-back window it drops off the statement.
--
-- All three tables are service role only (like assistant_notes and
-- calendar_entries): the merchant reads its own record, an agent the ones they
-- signed and admins everything — through the routes under app/api/merchant,
-- app/api/agent/merchants and app/api/admin/merchants. Idempotent for the runner.

BEGIN;

INSERT INTO public.user_roles (name, label)
VALUES ('merchant', 'Merchant')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

CREATE TABLE IF NOT EXISTS public.merchants (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The merchant's login (role merchant). One record per account.
  profile_id              uuid        NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- The agent who signed them (metadata.invited_by at registration). The
  -- merchant stays in this agent's name for the whole agreement.
  agent_id                uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  business_name           text        NOT NULL,
  category                text,
  address                 text,
  emirate                 text,
  website                 text,
  -- The person who signs for the business.
  signatory_name          text,
  signatory_title         text,
  emirates_id_number      text,
  emirates_id_expires_on  date,
  trade_licence_number    text,
  trade_licence_authority text,
  trade_licence_expires_on date,
  -- Where the incentive is paid. The IBAN is AES-GCM sealed in the app
  -- (lib/merchant/secrets.ts, the developer-logins recipe); only its last
  -- four digits are kept in clear for the pages.
  bank_account_name       text,
  bank_name               text,
  iban_sealed             text,
  iban_last4              text,
  -- The discount the merchant gives each customer who rents through its QR.
  voucher_offer           text,
  -- Issued on acceptance; the QR opens fhiglobal.ae/m/<code>.
  code                    text        UNIQUE,
  status                  text        NOT NULL DEFAULT 'onboarding'
                                      CHECK (status IN ('onboarding', 'submitted', 'accepted', 'declined', 'ended')),
  submitted_at            timestamptz,
  accepted_at             timestamptz,
  accepted_by             uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  declined_at             timestamptz,
  declined_by             uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  decline_reason          text,
  agreement_starts_on     date,
  agreement_ends_on       date,
  ended_at                timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchants_agent  ON public.merchants (agent_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);

-- The four official requirements, as files: the signed agreement, the trade
-- licence copy, the signatory's Emirates ID, a bank letter (the bank details
-- may also be typed in). A newer upload of the same kind supersedes an older
-- one; the history is kept.
CREATE TABLE IF NOT EXISTS public.merchant_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   uuid        NOT NULL REFERENCES public.merchants (id) ON DELETE CASCADE,
  kind          text        NOT NULL CHECK (kind IN ('agreement', 'trade_licence', 'emirates_id', 'bank')),
  file_name     text        NOT NULL,
  file_url      text        NOT NULL,
  file_type     text,
  uploaded_by   uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploaded_role text,
  -- "signed on screen" when the agreement was signed in the dashboard.
  note          text,
  verified_at   timestamptz,
  verified_by   uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_documents_merchant ON public.merchant_documents (merchant_id, kind, created_at DESC);

-- One row per scan of the merchant's QR (app/m/[code]): the day's counts come
-- from here. The IP is kept only as a salted hash.
CREATE TABLE IF NOT EXISTS public.merchant_scans (
  id          bigserial   PRIMARY KEY,
  merchant_id uuid        NOT NULL REFERENCES public.merchants (id) ON DELETE CASCADE,
  scanned_at  timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  user_agent  text,
  referer     text
);

CREATE INDEX IF NOT EXISTS idx_merchant_scans_merchant ON public.merchant_scans (merchant_id, scanned_at DESC);

-- A rental that came through a merchant's QR (Record Your Sale → Rental →
-- "Came through a merchant QR").
ALTER TABLE public.sales_reports ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_reports_merchant ON public.sales_reports (merchant_id) WHERE merchant_id IS NOT NULL;

ALTER TABLE public.merchants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_scans      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.merchants, public.merchant_documents, public.merchant_scans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchants, public.merchant_documents, public.merchant_scans TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.merchant_scans_id_seq TO service_role;

COMMIT;
