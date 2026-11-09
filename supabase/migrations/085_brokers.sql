-- Migration 085: Brokers — RERA broker records pulled from the Dubai Land
-- Department open-data register (dataset "brokers"), one row per BRN.
--
-- Filled on demand: the profile page's "Open broker details" calls
-- GET /api/brokers/<brn>, which reads this table first and only asks DLD
-- (binary search over the register, lib/dld-search.ts) when the BRN is
-- missing here or the saved copy is older than a day. `data` keeps the full
-- DLD row as returned, so nothing DLD sends is lost; the typed columns are
-- the ones the modal shows and that are worth querying.
--
-- Server-only: written and read through the service-role client in
-- app/api/brokers/[brn]. RLS is enabled with no policies, so the anon and
-- authenticated keys can never read it directly.
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.brokers (
  broker_number       BIGINT PRIMARY KEY,
  broker_en           TEXT,
  broker_ar           TEXT,
  gender_en           TEXT,
  license_start_date  DATE,
  license_end_date    DATE,
  real_estate_number  TEXT,
  real_estate_en      TEXT,
  real_estate_ar      TEXT,
  phone               TEXT,
  fax                 TEXT,
  webpage             TEXT,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brokers_real_estate_number ON public.brokers (real_estate_number);
CREATE INDEX IF NOT EXISTS idx_brokers_license_end_date ON public.brokers (license_end_date);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

COMMIT;
