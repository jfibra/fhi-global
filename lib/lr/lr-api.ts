// Leuterio Realty (LR) public API client — server-only. FHI Global agents are
// also LR agents in the shared LR system, so on Google sign-in we look them up
// here and import their profile. Ported from the Filipino Homes API's
// LrApiService, remapped to FHI's roles. Both endpoints are public (no key);
// they can be slow (v2 ~10s) and frequently return null fields for
// freshly-invited / Global-Partners (Dubai) agents, so everything is tolerant.

import type { AppRoleId } from "@/lib/app-roles"

const LR_V1_AGENT = "https://api.leuteriorealty.com/lr/v1/public/api/agent"
const LR_V2_AGENTS = "https://api.leuteriorealty.com/lr/v2/public/api/agents"

// LR roleId → FHI role, mapped faithfully to whatever LR reports. Only genuine
// LR staff/agent roles are elevated; anyone else (LR clients, unknown roleIds,
// or emails not in LR) becomes a member. Note: an LR admin therefore receives
// FHI admin on first Google sign-in — this is intentional (LR admins are
// trusted), gated to verified LR members via the server-side lookup.
const LR_ROLE_TO_FHI: Record<number, AppRoleId> = {
  7: "unit_manager",
  6: "team_leader",
  4: "agent",
  3: "secretary",
  1: "admin",
}

const LR_ROLE_LABELS: Record<number, string> = {
  1: "Admin",
  3: "Secretary",
  4: "Agent",
  6: "Team Leader",
  7: "Unit Manager",
}

export function mapLrRoleToFhi(roleId: number | null | undefined): AppRoleId {
  if (roleId == null) return "member"
  return LR_ROLE_TO_FHI[roleId] ?? "member"
}

/** Split LR's single `name` string into first/middle/last (same rule as the PHP). */
export function parseName(fullName: string | null | undefined): {
  first: string
  middle: string
  last: string
} {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { first: "", middle: "", last: "" }
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" }
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] }
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] }
}

type LrV1 = {
  id?: number | null
  email?: string | null
  name?: string | null
  state?: string | null
  roleId?: number | null
  verification?: string | null
  status?: string | null
  fire_certificates?: number | null
  team?: { sales_team?: { teamname?: string | null } | null } | null
  upline?: { name?: string | null } | null
}

type LrV2 = {
  agentId?: number | null
  mobile?: string | null
  photo?: string | null
  city?: string | null
  country?: string | null
} | null

export type NormalizedLrAgent = {
  agentId: number | null
  name: string | null
  roleId: number | null
  roleLabel: string | null
  mappedFhiRole: AppRoleId
  state: string | null
  mobile: string | null
  teamName: string | null
  uplineName: string | null
  verification: string | null
  status: string | null
  fireCertificates: number
}

// A definitive not-found (4xx) is distinguished from a transient failure
// (timeout, network error, 5xx). Provisioning must NOT permanently downgrade a
// real agent to member just because LR was briefly unreachable.
type FetchResult = { data: unknown | null; transient: boolean }

async function getJson(url: string, timeoutMs: number): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (res.ok) return { data: await res.json(), transient: false }
    // 4xx = definitively not an agent (LR returns 403/404 for unknown emails);
    // 5xx = transient server-side failure.
    return { data: null, transient: res.status >= 500 }
  } catch {
    // Network error or abort (timeout) — transient.
    return { data: null, transient: true }
  } finally {
    clearTimeout(timer)
  }
}

// Result of an LR lookup: a real elevated agent, a definitive non-agent
// (unknown email or non-staff LR role), or a transient error where LR couldn't
// be reached and the answer is unknown.
export type LrLookupResult =
  | { kind: "agent"; agent: NormalizedLrAgent }
  | { kind: "not_agent" }
  | { kind: "error" }

/**
 * Look up an email in LR and classify it. `kind: "agent"` only for genuine LR
 * staff/agent roles (roleId 1/3/4/6/7); LR clients and unknown emails are
 * `not_agent`; an unreachable LR is `error` so the caller can avoid a
 * permanent downgrade and retry on the next sign-in.
 */
export async function lookupLrAgent(email: string): Promise<LrLookupResult> {
  const clean = email.trim().toLowerCase()
  if (!clean) return { kind: "not_agent" }

  const v1res = await getJson(`${LR_V1_AGENT}/${encodeURIComponent(clean)}`, 10_000)
  if (v1res.transient) return { kind: "error" }
  const v1 = v1res.data && typeof v1res.data === "object" ? (v1res.data as LrV1) : null
  if (!v1) return { kind: "not_agent" }

  const roleId = typeof v1.roleId === "number" ? v1.roleId : null
  const mappedFhiRole = mapLrRoleToFhi(roleId)
  // Found in LR but not a staff/agent role (LR client) → treat as a member.
  if (mappedFhiRole === "member") return { kind: "not_agent" }

  // v2 is best-effort and slow — its only unique adds are mobile/photo. A
  // transient v2 failure must not discard the confirmed agent match.
  const v2res = await getJson(`${LR_V2_AGENTS}/${encodeURIComponent(clean)}`, 30_000)
  const v2inner =
    v2res.data && typeof v2res.data === "object" ? ((v2res.data as { data?: unknown }).data ?? null) : null
  const v2 = v2inner && typeof v2inner === "object" ? (v2inner as LrV2) : null

  const str = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : ""
    return s || null
  }

  const agent: NormalizedLrAgent = {
    agentId: typeof v2?.agentId === "number" ? v2.agentId : typeof v1.id === "number" ? v1.id : null,
    name: str(v1.name),
    roleId,
    roleLabel: roleId != null ? LR_ROLE_LABELS[roleId] ?? null : null,
    mappedFhiRole,
    state: str(v1.state),
    mobile: str(v2?.mobile),
    teamName: str(v1.team?.sales_team?.teamname),
    uplineName: str(v1.upline?.name),
    verification: str(v1.verification),
    status: str(v1.status),
    fireCertificates: typeof v1.fire_certificates === "number" ? v1.fire_certificates : 0,
  }
  return { kind: "agent", agent }
}
