-- Rename the sales area/price columns from _sqm to _sqft.
--
-- Agents always entered the figure printed on the SPA; Dubai SPAs state area in
-- SQUARE FEET, so the columns now carry the correct unit in their name. This is
-- a pure column rename — existing values are preserved unchanged (they were the
-- SPA figure all along; only the label was wrong).
--
-- Idempotent: the migration runner re-applies every file on each run and does
-- not wrap files in a transaction, so each rename is guarded to run only when
-- the old column still exists and the new one does not.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_reports' AND column_name = 'price_per_sqm'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_reports' AND column_name = 'price_per_sqft'
  ) THEN
    ALTER TABLE public.sales_reports RENAME COLUMN price_per_sqm TO price_per_sqft;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_reports' AND column_name = 'total_area_sqm'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_reports' AND column_name = 'total_area_sqft'
  ) THEN
    ALTER TABLE public.sales_reports RENAME COLUMN total_area_sqm TO total_area_sqft;
  END IF;
END $$;

COMMIT;
