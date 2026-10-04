-- Migration 076: change a registration's days (boss via Juliecor, 2026-10-04).
--
-- One registration per email per event, so someone who ticked Day 1 and later
-- wants Day 2 can't sign up again — the organizer changes their days from the
-- registrations list instead ("Change days").
--
-- event_registration_set_days() locks the event row like event_register()
-- (075), so it can't race a public sign-up for a date's last seat. Only days
-- being ADDED are checked: dropping a day frees its seat, and a day the person
-- already holds is never re-checked (a pax lowered below the current count
-- never blocks an edit that keeps it). NULL days = every day, so nothing is
-- being added for such a registration.
--
-- Returns (ok, full_day): (true, NULL) saved; (false, day) that day is full;
-- (false, NULL) no such registration on this event. Service role only.
--
-- Idempotent for the runner.

BEGIN;

CREATE OR REPLACE FUNCTION public.event_registration_set_days(
  p_event_id        uuid,
  p_registration_id uuid,
  p_days            smallint[]
)
RETURNS TABLE (ok boolean, full_day smallint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pax     jsonb;
  v_current smallint[];
  v_day     int;
  v_cap     int;
  v_taken   int;
BEGIN
  -- Seats are counted one change at a time per event, as in event_register().
  PERFORM 1 FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  SELECT e.day_pax INTO v_pax FROM public.events e WHERE e.id = p_event_id;

  SELECT r.days INTO v_current
    FROM public.event_registrations r
   WHERE r.id = p_registration_id
     AND r.event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::smallint;
    RETURN;
  END IF;

  IF v_current IS NOT NULL THEN
    FOR v_day IN
      SELECT d FROM unnest(p_days) AS d WHERE NOT (d = ANY (v_current))
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
          RETURN QUERY SELECT false, v_day::smallint;
          RETURN;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.event_registrations r
     SET days = p_days
   WHERE r.id = p_registration_id
     AND r.event_id = p_event_id;

  RETURN QUERY SELECT true, NULL::smallint;
END;
$$;

REVOKE ALL ON FUNCTION public.event_registration_set_days(uuid, uuid, smallint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_registration_set_days(uuid, uuid, smallint[]) TO service_role;

COMMIT;
