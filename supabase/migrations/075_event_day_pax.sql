-- Migration 075: pax per date (boss, 2026-10-04).
--
-- Every date of an event has its own registration list and its own pax:
--   events.day_pax jsonb — the most attendees each day takes, day 1 first
--     (index = day − 1); null / missing = no limit. Like day_times (072).
--   event_registrations.days smallint[] — the days this sign-up attends
--     (1-based); NULL = every day (one-day events, and every registration
--     made before this migration).
-- A full date closes on its own; the other dates stay open. One sign-up can
-- tick several dates and counts one pax on each.
--
-- event_register() is the only way registrations are created: it locks the
-- event row, checks each chosen day still has room, then inserts — so two
-- people can't both take a date's last seat. Called by the public register
-- route on the service-role client. event_day_counts() counts each day's
-- seats in the database, so no row cap on a read can undercount a big event.
--
-- Additive and idempotent for the runner.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS day_pax jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS days smallint[];

CREATE OR REPLACE FUNCTION public.event_register(
  p_event_id   uuid,
  p_full_name  text,
  p_email      text,
  p_whatsapp   text,
  p_invited_by text,
  p_answers    jsonb,
  p_days       smallint[]
)
RETURNS TABLE (registration_id uuid, full_day smallint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pax   jsonb;
  v_ndays int;
  v_day   int;
  v_cap   int;
  v_taken int;
  v_id    uuid;
BEGIN
  -- One registration at a time per event while seats are counted.
  SELECT e.day_pax, greatest(1, coalesce(e.event_days, 1))
    INTO v_pax, v_ndays
    FROM public.events e
   WHERE e.id = p_event_id
   FOR UPDATE;

  FOR v_day IN
    SELECT d FROM unnest(coalesce(p_days, ARRAY(SELECT generate_series(1, v_ndays)::smallint))) AS d
  LOOP
    v_cap := CASE
      WHEN jsonb_typeof(v_pax -> (v_day - 1)) = 'number' THEN floor((v_pax ->> (v_day - 1))::numeric)::int
      ELSE NULL
    END;
    IF v_cap IS NOT NULL AND v_cap > 0 THEN
      SELECT count(*) INTO v_taken
        FROM public.event_registrations r
       WHERE r.event_id = p_event_id
         AND (r.days IS NULL OR v_day = ANY (r.days));
      IF v_taken >= v_cap THEN
        RETURN QUERY SELECT NULL::uuid, v_day::smallint;
        RETURN;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.event_registrations (event_id, full_name, email, whatsapp, invited_by, answers, days)
  VALUES (p_event_id, p_full_name, p_email, p_whatsapp, p_invited_by, coalesce(p_answers, '{}'::jsonb), p_days)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, NULL::smallint;
END;
$$;

REVOKE ALL ON FUNCTION public.event_register(uuid, text, text, text, text, jsonb, smallint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_register(uuid, text, text, text, text, jsonb, smallint[]) TO service_role;

-- Seats taken per day: a registration counts once on each day it attends.
CREATE OR REPLACE FUNCTION public.event_day_counts(p_event_id uuid)
RETURNS TABLE (day int, taken int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT g.d, count(r.id)::int
    FROM public.events e
   CROSS JOIN LATERAL generate_series(1, greatest(1, coalesce(e.event_days, 1))) AS g(d)
    LEFT JOIN public.event_registrations r
      ON r.event_id = e.id
     AND (r.days IS NULL OR g.d = ANY (r.days))
   WHERE e.id = p_event_id
   GROUP BY g.d
   ORDER BY g.d;
$$;

REVOKE ALL ON FUNCTION public.event_day_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_day_counts(uuid) TO service_role;

COMMIT;
