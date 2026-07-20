/**
 * Internal request headers used to hand the proxy-verified identity down to
 * server components, so pages don't re-query Supabase for the same answer.
 *
 * SECURITY: proxy.ts strips these from every INCOMING request before setting
 * them itself, so a client can never forge them. Anything reading these
 * headers (lib/server-identity.ts) must treat them as absent-able and fall
 * back to a full Supabase check.
 *
 * Pure constants only — this file is imported by both the Edge proxy and
 * Node server components.
 */
export const IDENTITY_HEADERS = {
  userId: "x-fhi-user-id",
  email: "x-fhi-user-email",
  profile: "x-fhi-profile",
} as const
