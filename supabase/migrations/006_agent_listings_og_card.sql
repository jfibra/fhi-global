-- Share card: agent-saved customization for the listing's social link
-- preview, rendered by /og/listing/{id}. NULL = default card.
BEGIN;

ALTER TABLE public.agent_listings
  ADD COLUMN IF NOT EXISTS og_card_options JSONB;

COMMENT ON COLUMN public.agent_listings.og_card_options IS
  'Agent-saved share card customization (theme, badge style, price color/label, photo, toggles) rendered by /og/listing/{id}. NULL = defaults.';

-- Bound the payload at the database layer: RLS lets agents write this column
-- directly via the REST API (bypassing the typed client), and the public
-- /og/listing route parses whatever is stored. A legitimate options object is
-- well under 1 KB (one photo URL + enums/booleans).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_listings_og_card_options_size'
  ) THEN
    ALTER TABLE public.agent_listings
      ADD CONSTRAINT agent_listings_og_card_options_size
      CHECK (og_card_options IS NULL OR pg_column_size(og_card_options) <= 4096);
  END IF;
END $$;

COMMIT;
