-- Allow anonymous (anon key) read of published agent listings for public /buy and /rent.
BEGIN;

CREATE POLICY "agent_listings_select_public_published"
  ON public.agent_listings FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'published'
  );

COMMIT;
