-- 040_feedback_transaction_types.sql
-- Re-label the customer-feedback transaction types to the business's own
-- vocabulary: BUY / RESELL / RENT (was sale / rent / purchase).
--
-- Existing rows are converted first, then the CHECK is swapped — the reverse
-- order would fail the constraint on legacy values. 'sale' and 'purchase'
-- both described a completed acquisition, so both become 'buy'; the
-- secondary-market case ('resell') simply had no option before.
--
-- Idempotent: the runner re-applies every file on each run. Once converted,
-- the UPDATEs match nothing and the constraint is recreated identically.

BEGIN;

ALTER TABLE public.agent_feedback
  DROP CONSTRAINT IF EXISTS agent_feedback_transaction_type_check;

UPDATE public.agent_feedback SET transaction_type = 'buy'
  WHERE transaction_type IN ('sale', 'purchase');

ALTER TABLE public.agent_feedback
  ADD CONSTRAINT agent_feedback_transaction_type_check
  CHECK (transaction_type IN ('buy', 'resell', 'rent'));

COMMIT;
