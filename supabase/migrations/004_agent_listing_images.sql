-- Extra photos on agent listings (unit/room), shown after developer project gallery on public pages.
BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.agent_listings (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_listing_images_listing_id
  ON public.agent_listing_images (listing_id);

COMMENT ON TABLE public.agent_listing_images IS 'Sales-uploaded photos for a listing; public when parent listing is published.';

ALTER TABLE public.agent_listing_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_listing_images_select_public" ON public.agent_listing_images;
CREATE POLICY "agent_listing_images_select_public"
  ON public.agent_listing_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.status = 'published'
    )
  );

DROP POLICY IF EXISTS "agent_listing_images_select_owner" ON public.agent_listing_images;
CREATE POLICY "agent_listing_images_select_owner"
  ON public.agent_listing_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_listing_images_insert_own_listing" ON public.agent_listing_images;
CREATE POLICY "agent_listing_images_insert_own_listing"
  ON public.agent_listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_listing_images_update_own_listing" ON public.agent_listing_images;
CREATE POLICY "agent_listing_images_update_own_listing"
  ON public.agent_listing_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "agent_listing_images_delete_own_listing" ON public.agent_listing_images;
CREATE POLICY "agent_listing_images_delete_own_listing"
  ON public.agent_listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_listings al
      WHERE al.id = listing_id
        AND al.deleted_at IS NULL
        AND al.agent_id = auth.uid()
    )
  );

COMMIT;
