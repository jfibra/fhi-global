import { randomBytes } from "node:crypto"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Shared server-only logic for developer invite links, used by the SSR /join
// page and every invite route so they all agree on validity + scope. Never
// import into client code — it uses the service-role client.

export type InviteDeveloper = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_verified: boolean
}

// Server-only config (never serialized wholesale to the browser).
export type DeveloperInviteConfig = {
  id: string
  autoActivate: boolean
  createdBy: string | null
  developer: InviteDeveloper | null // set → link is bound to this developer; null → generic
}

export type InviteResolution =
  | { status: "valid"; config: DeveloperInviteConfig }
  | { status: "expired" }
  | { status: "used_up" }
  | { status: "revoked" }
  | { status: "invalid" }

type InviteRow = {
  id: string
  developer_id: string | null
  created_by: string | null
  auto_activate: boolean
  expires_at: string | null
  max_uses: number | null
  use_count: number
  is_active: boolean
  deleted_at: string | null
}

/** A URL-safe 32-char token (~192 bits of entropy). */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url")
}

/**
 * Resolve a token to a display-safe config, or a specific reason it's not
 * usable. Uses the service-role client (the table is admin-RLS). Reads only —
 * the atomic use-count claim happens separately via claim_developer_invite().
 */
export async function resolveInviteToken(token: string): Promise<InviteResolution> {
  const clean = (token ?? "").trim()
  if (!clean) return { status: "invalid" }

  const admin = createAdminSupabase()
  const { data } = await admin
    .from("developer_invites")
    .select("id, developer_id, created_by, auto_activate, expires_at, max_uses, use_count, is_active, deleted_at")
    .eq("token", clean)
    .maybeSingle<InviteRow>()

  if (!data || data.deleted_at) return { status: "invalid" }
  if (!data.is_active) return { status: "revoked" }
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return { status: "expired" }
  if (data.max_uses != null && data.use_count >= data.max_uses) return { status: "used_up" }

  let developer: InviteDeveloper | null = null
  if (data.developer_id) {
    const { data: dev } = await admin
      .from("developers")
      .select("id, name, slug, logo_url, is_verified")
      .eq("id", data.developer_id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .maybeSingle<InviteDeveloper>()
    // Bound developer was removed/deactivated after the link was created → link
    // is no longer usable.
    if (!dev) return { status: "invalid" }
    developer = dev
  }

  return {
    status: "valid",
    config: {
      id: data.id,
      autoActivate: data.auto_activate,
      createdBy: data.created_by,
      developer,
    },
  }
}

/**
 * Enforce the link's scope for the developer the registrant ends up with:
 * a bound link must resolve to its own developer; a generic link must resolve
 * to an active, non-deleted developer the registrant chose. Returns null on any
 * mismatch (scope-escape attempt, or inactive/deleted choice).
 */
export async function resolveChosenDeveloper(
  config: DeveloperInviteConfig,
  chosenId: string | null | undefined,
): Promise<InviteDeveloper | null> {
  if (config.developer) {
    // Bound link: ignore any client-supplied id; use the link's developer.
    return config.developer
  }
  const id = (chosenId ?? "").trim()
  if (!id) return null
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("developers")
    .select("id, name, slug, logo_url, is_verified")
    .eq("id", id)
    .is("deleted_at", null)
    .eq("is_active", true)
    .maybeSingle<InviteDeveloper>()
  return data ?? null
}

export type ClaimResult = {
  id: string
  developer_id: string | null
  auto_activate: boolean
  created_by: string | null
  use_count: number
}

/**
 * Atomically claim one use of the link (guards expiry/max_uses/revoked in a
 * single UPDATE). Returns null if the link became unusable between resolve and
 * claim (race on the last slot). On any downstream failure the caller should
 * release the claim via releaseInviteClaim().
 */
export async function claimInvite(token: string): Promise<ClaimResult | null> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc("claim_developer_invite", { _token: token.trim() })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row as ClaimResult | undefined) ?? null
}

/** Best-effort decrement when a claimed use could not be completed (e.g. dup email).
 *  Atomic (single UPDATE under the row lock) so it can't clobber a concurrent
 *  claim's increment or drive the count negative. */
export async function releaseInviteClaim(inviteId: string): Promise<void> {
  try {
    const admin = createAdminSupabase()
    await admin.rpc("release_developer_invite", { _id: inviteId })
  } catch {
    /* best-effort */
  }
}
