import type { SupabaseClient } from "@supabase/supabase-js"
import { lookupLrAgent, parseName, resolveGoogleRole, type NormalizedLrAgent } from "./lr-api"

// Shared Leuterio Realty provisioning logic used by BOTH auth entry points —
// Google sign-in (app/api/auth/google/finalize) and email OTP registration
// (app/(public-page)/(auth)/register/actions.ts). Keeping the role/status/
// metadata decision in one place means the two flows stay in sync: an LR agent
// gets the same role and active status no matter how they sign up.

export type LrProvision = {
  /** True when the email resolved to a genuine LR agent. */
  isLrAgent: boolean
  /** True when LR couldn't be reached — the answer is unknown; don't stamp the
   *  provisioned flag so the next sign-in retries instead of downgrading. */
  lrUnreachable: boolean
  /** Role to persist: LR role if the account is an un-curated `member`, else the
   *  existing role (deliberate roles are never overridden/downgraded). */
  role: string
  /** Status to persist: `active` when an LR role is applied to a member, else the
   *  account's existing status. */
  status: string
  /** LR fields to merge into profile.metadata ({} when not an agent). */
  lrMetadata: Record<string, unknown>
  /** Name parsed from the LR record (or the name hint) for fname/lname. */
  parsedName: { first: string | null; last: string | null }
  /** The raw normalized agent (null when not an agent), for callers that need it. */
  agent: NormalizedLrAgent | null
}

function lrMetadataFrom(lr: NormalizedLrAgent | null): Record<string, unknown> {
  if (!lr) return {}
  return {
    lr_agent_id: lr.agentId,
    lr_role_id: lr.roleId,
    lr_role_label: lr.roleLabel,
    lr_state: lr.state,
    lr_mobile: lr.mobile,
    lr_team: lr.teamName,
    lr_upline: lr.uplineName,
    lr_verification: lr.verification,
    lr_status: lr.status,
  }
}

/**
 * Look up the email in LR and compute what to persist. Does NOT write anything —
 * callers merge the result into their own profile update (Google and OTP write
 * different sets of fields). `currentRole`/`currentStatus` are the account's
 * present values so a deliberately-assigned role is preserved.
 */
export async function resolveLrProvision(opts: {
  email: string
  currentRole: string | null | undefined
  currentStatus: string | null | undefined
  /** Fallback full name (e.g. the Google display name) when LR has none. */
  nameHint?: string | null
}): Promise<LrProvision> {
  const result = await lookupLrAgent(opts.email)
  const lr = result.kind === "agent" ? result.agent : null
  const lrUnreachable = result.kind === "error"

  const parsed = parseName(lr?.name ?? opts.nameHint ?? null)
  const role = resolveGoogleRole(opts.currentRole, lr)
  const upgradedMember = lr != null && (opts.currentRole ?? "member") === "member"
  const status = upgradedMember ? "active" : (opts.currentStatus ?? "pending")

  return {
    isLrAgent: lr != null,
    lrUnreachable,
    role,
    status,
    lrMetadata: lrMetadataFrom(lr),
    parsedName: { first: parsed.first || null, last: parsed.last || null },
    agent: lr,
  }
}

/**
 * Guarded, one-time LR provisioning for the email-OTP LOGIN path (the unified
 * "continue with email" modal, which also creates new accounts). Runs on every
 * sign-in, so it must be idempotent and must NOT re-map returning or admin-
 * curated accounts:
 *   • already flagged (lr_provisioned / google_provisioned) → skip;
 *   • curated non-member role → just stamp the flag (no lookup, no change);
 *   • un-curated member → look up LR and upgrade role + status if it maps to a
 *     rank (admins only, per LR_ROLE_TO_FHI in lr-api.ts),
 *     stamping the flag so future logins skip the lookup. LR unreachable → leave
 *     unflagged so the next login retries.
 * Writes with the service-role client and returns the effective role/status.
 */
export async function provisionLrForOtpLogin(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<{ changed: boolean; role: string; status: string }> {
  const { data: p } = await admin
    .from("profiles")
    .select("role, status, metadata")
    .eq("id", userId)
    .maybeSingle<{ role: string | null; status: string | null; metadata: Record<string, unknown> | null }>()

  const metadata = (p?.metadata ?? {}) as Record<string, unknown>
  const role = p?.role ?? "member"
  const status = p?.status ?? "pending"

  if (metadata.lr_provisioned === true || metadata.google_provisioned === true) {
    return { changed: false, role, status }
  }

  // Curated (admin-assigned) account — never touch role/status; stamp so we
  // don't keep looking it up on every login.
  if (role !== "member") {
    await admin.from("profiles").update({ metadata: { ...metadata, lr_provisioned: true } }).eq("id", userId)
    return { changed: false, role, status }
  }

  const prov = await resolveLrProvision({ email, currentRole: role, currentStatus: status })
  if (prov.lrUnreachable) {
    // Unknown answer — don't flag, retry on the next sign-in.
    return { changed: false, role, status }
  }

  await admin
    .from("profiles")
    .update({
      role: prov.role,
      status: prov.status,
      metadata: { ...metadata, ...prov.lrMetadata, lr_provisioned: true },
    })
    .eq("id", userId)

  return { changed: prov.isLrAgent, role: prov.role, status: prov.status }
}
