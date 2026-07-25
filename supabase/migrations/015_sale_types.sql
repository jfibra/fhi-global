-- Migration 015: sale types (project / brokerage / rental)
-- Brokerage and rental deals have no developer or project — those columns
-- become nullable, with a CHECK keeping them mandatory for project sales.
-- property_type/property_address describe the property on non-project deals.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.sales_reports ALTER COLUMN developer_id DROP NOT NULL;
ALTER TABLE public.sales_reports ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.sales_reports ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'project';
ALTER TABLE public.sales_reports ADD COLUMN IF NOT EXISTS property_type text;
ALTER TABLE public.sales_reports ADD COLUMN IF NOT EXISTS property_address text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_reports_sale_type_check') THEN
    ALTER TABLE public.sales_reports
      ADD CONSTRAINT sales_reports_sale_type_check
      CHECK (sale_type IN ('project', 'brokerage', 'rental'));
  END IF;
END $$;

-- Project sales keep their developer + project mandatory.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_reports_project_fields_check') THEN
    ALTER TABLE public.sales_reports
      ADD CONSTRAINT sales_reports_project_fields_check
      CHECK (sale_type <> 'project' OR (developer_id IS NOT NULL AND project_id IS NOT NULL));
  END IF;
END $$;

COMMIT;
