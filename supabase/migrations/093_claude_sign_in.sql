-- Migration 093: Claude sign-in for the MCP server (boss via Juliecor, 2026-11-24).
--
-- Agents and team leaders connect their own Claude (claude.ai, Claude Code)
-- to FHI with their FHI login instead of the shared admin key: claude.ai
-- sends them to fhiglobal.ae/oauth/authorize, they sign in and press Allow,
-- and from then on every tool call carries a pass FHI issued to that login,
-- so the answers are that person's own (the agent FHI Assistant's tools,
-- lib/fhi-agent-chat-tools.ts). The standard behind it is OAuth 2.1 as the
-- MCP authorization spec requires; the server side is lib/oauth/server.ts and
-- the routes under app/api/oauth, the endpoint is POST /api/mcp/me.
--
-- Four tables, all service role only (like assistant_notes, calendar_entries
-- and the merchant tables): the routes read and write them on the service
-- role after their own checks.
--
--   oauth_clients  the apps that registered (claude.ai registers itself —
--                  dynamic client registration; Claude Code too)
--   oauth_codes    one-time sign-in codes, 10 minutes, PKCE
--   oauth_grants   one row per "Allow" — the connection a person can see and
--                  disconnect (revoked_at); an admin can disconnect anyone
--   oauth_tokens   the passes of a grant: an access pass (1 hour) and the
--                  refresh pass that renews it; only hashes are stored
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.oauth_clients (
  client_id text PRIMARY KEY,
  client_secret_hash text,
  client_name text,
  redirect_uris text[] NOT NULL DEFAULT '{}'::text[],
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope text NOT NULL DEFAULT 'fhi:read',
  resource text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_codes_expires_idx ON public.oauth_codes (expires_at);

CREATE TABLE IF NOT EXISTS public.oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_name text,
  scope text NOT NULL DEFAULT 'fhi:read',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

CREATE INDEX IF NOT EXISTS oauth_grants_user_idx ON public.oauth_grants (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.oauth_grants (id) ON DELETE CASCADE,
  access_hash text NOT NULL UNIQUE,
  refresh_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_tokens_grant_idx ON public.oauth_tokens (grant_id);

ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.oauth_clients, public.oauth_codes, public.oauth_grants, public.oauth_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_clients, public.oauth_codes, public.oauth_grants, public.oauth_tokens TO service_role;

COMMENT ON TABLE public.oauth_grants IS 'Claude sign-ins (migration 093): one row per Allow on /oauth/authorize; revoked_at = disconnected.';

COMMIT;
