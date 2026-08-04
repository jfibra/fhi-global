-- Migration 013: developer_invites — NEUTRALIZED.
-- The developer-invite feature was removed (replaced by admin-only direct
-- developer-account creation). This file is intentionally a no-op so the
-- re-apply-all runner no longer recreates the table; migration 026 drops the
-- table and its RPCs. Kept as a placeholder to preserve migration numbering.

SELECT 1;
