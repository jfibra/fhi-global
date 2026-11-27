import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT, canManageEvents, canUseEventsArea, isAdminStaffRole, roleInList } from "@/lib/app-roles"
import { SITE_URL } from "@/lib/seo"

/**
 * Claude sign-in for the MCP server (boss via Juliecor, 2026-11-24): FHI as
 * the sign-in provider claude.ai and Claude Code understand — OAuth 2.1 the
 * way the MCP authorization spec asks for it (authorization code + PKCE,
 * protected-resource and authorization-server metadata, dynamic client
 * registration, refresh tokens). The person signs in on /oauth/authorize
 * with their FHI login and presses Allow; the pass FHI issues names them,
 * and POST /api/mcp/me answers every tool call as that person.
 *
 * Tables (migration 093, service role only): oauth_clients, oauth_codes,
 * oauth_grants (one per Allow — what Connected apps lists and disconnects),
 * oauth_tokens (hashes only). Nothing here reads the agent's data: that is
 * lib/mcp/personal.ts (the agent FHI Assistant's tools) and, for admin
 * staff, lib/mcp/server.ts.
 */

export const OAUTH_SCOPE = "fhi:read"
/**
 * Create, edit and publish events from Claude (2026-11-27,
 * lib/mcp/events.ts): company events for admin staff, their OWN events for
 * agents and team leaders. The one permission that writes: offered on the
 * consent screen only to a role that runs events in the dashboard, granted
 * only when the person leaves it ticked, and stored on the grant — a
 * connection made before it existed stays reading-only until it is added again.
 */
export const OAUTH_SCOPE_EVENTS = "fhi:events"
export const OAUTH_SCOPES: readonly string[] = [OAUTH_SCOPE, OAUTH_SCOPE_EVENTS]
export const MCP_ME_PATH = "/api/mcp/me"
export const CONSENT_PATH = "/oauth/authorize"

const ACCESS_TTL_S = 60 * 60
const REFRESH_TTL_S = 90 * 24 * 60 * 60
const CODE_TTL_S = 10 * 60

/** Who may sign in: the roles the agent FHI Assistant serves, plus admin staff (who get the admin tools). */
export const MCP_SIGN_IN_ROLES: readonly string[] = [...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF]
export const mcpSignInAllowed = (role: string | null | undefined) => roleInList(role, MCP_SIGN_IN_ROLES)

/** May this role be offered the events permission? The dashboard's own rule: admin staff, and the roles that run their own events. */
export const eventsScopeAllowed = (role: string | null | undefined) => canUseEventsArea(role)

/** The box's words on the consent screen: whose events this person's Claude may write. */
export const eventsScopeLabel = (role: string | null | undefined) =>
  canManageEvents(role) ? "Create, change and publish company events" : "Create, change and publish your own events"

/** Does a stored scope string ("fhi:read fhi:events") hold this permission? */
export const scopeHas = (scope: string | null | undefined, one: string) => (scope ?? "").split(/\s+/).includes(one)

/**
 * What a sign-in is granted: reading always; events only for a role that
 * may have it AND when the person ticked it on the consent screen. Decided
 * here from the role and the person's choice — never from what the app asked for.
 */
export function grantedScope(role: string | null | undefined, wantsEvents: boolean): string {
  return wantsEvents && eventsScopeAllowed(role) ? `${OAUTH_SCOPE} ${OAUTH_SCOPE_EVENTS}` : OAUTH_SCOPE
}

/** What the consent screen lists for a role — the plain words, matching the tools the person then gets. */
export function consentItems(role: string | null | undefined): string[] {
  if (isAdminStaffRole(role)) {
    return [
      "Everything the admin FHI Assistant can read: company sales, the pipeline, accounts, teams, leads, listings, clients, reviews, tickets, purchases, the activity log",
      "Website traffic and Google search keywords",
      "Projects, developers, events, news and data health",
    ]
  }
  const items = [
    "Your own sales record: validated, pending and rejected deals, amounts, month by month",
    "Your leads from the Buyers Link and Sellers Link",
    "Your listings, website, events and reviews",
    "Your recruits, with their deal counts",
    "Your private client notes, reminders and sales goal (read only)",
    "The Top Sales board, projects, developers and news, as the dashboard shows them",
  ]
  if (role === "team_leader") items.splice(1, 0, "Your team's sales with amounts per member, subteams included, and who in the team needs help")
  return items
}

/** The origin the metadata and the passes are issued for: the site in production, this server otherwise. */
export function oauthIssuer(req: NextRequest): string {
  if (process.env.NODE_ENV === "production") return SITE_URL.replace(/\/$/, "")
  return req.nextUrl.origin
}

export function authorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}${CONSENT_PATH}`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [...OAUTH_SCOPES],
    client_id_metadata_document_supported: true,
    service_documentation: `${issuer}/api/mcp`,
  }
}

export function protectedResourceMetadata(issuer: string) {
  return {
    resource: `${issuer}${MCP_ME_PATH}`,
    authorization_servers: [issuer],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "FHI Global",
    resource_documentation: `${issuer}/api/mcp`,
  }
}

/* ───────────────────────── helpers ───────────────────────── */

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url")
const token = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`
const nowIso = () => new Date().toISOString()
const plusSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString()

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8")
  const y = Buffer.from(b, "utf8")
  return x.length === y.length && timingSafeEqual(x, y)
}

/** PKCE S256: the verifier the client sends must hash to the challenge it sent at sign-in. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  return sameString(sha256(verifier), challenge)
}

/**
 * Where a sign-in may send the browser back. Claude's hosted apps use one
 * fixed callback; Claude Code and local tools use a loopback address (any
 * port, RFC 8252). Nothing else — a client registering any other address is
 * refused, so a page pretending to be Claude can't collect codes.
 */
const FIXED_REDIRECTS = new Set(["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"])
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

function isLoopback(uri: string): boolean {
  try {
    const u = new URL(uri)
    return u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

export const redirectUriAcceptable = (uri: string) => FIXED_REDIRECTS.has(uri) || isLoopback(uri)

/** The actual redirect against the client's registered list — loopback ports may differ. */
export function redirectUriRegistered(client: OAuthClient, uri: string): boolean {
  if (!redirectUriAcceptable(uri)) return false
  if (client.redirect_uris.includes(uri)) return true
  if (!isLoopback(uri)) return false
  const u = new URL(uri)
  return client.redirect_uris.some((r) => {
    if (!isLoopback(r)) return false
    const x = new URL(r)
    return x.hostname === u.hostname && x.pathname === u.pathname
  })
}

/* ───────────────────────── clients ───────────────────────── */

export type OAuthClient = {
  client_id: string
  client_name: string | null
  redirect_uris: string[]
  token_endpoint_auth_method: string
  client_secret_hash: string | null
}

const AUTH_METHODS = new Set(["none", "client_secret_post", "client_secret_basic"])

export type RegisterResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string; description: string }

/** Dynamic client registration (RFC 7591) — what claude.ai does when it adds the connector. */
export async function registerClient(input: unknown): Promise<RegisterResult> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string").map((u) => u.trim()) : []
  if (!uris.length || uris.length > 10) return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris must list 1 to 10 addresses." }
  for (const u of uris) {
    if (!redirectUriAcceptable(u)) return { ok: false, error: "invalid_redirect_uri", description: `${u} is not an address FHI sends sign-ins back to (Claude's callback or a loopback address).` }
  }
  const method = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none"
  if (!AUTH_METHODS.has(method)) return { ok: false, error: "invalid_client_metadata", description: `token_endpoint_auth_method must be one of ${[...AUTH_METHODS].join(", ")}.` }
  const grants = Array.isArray(body.grant_types) ? body.grant_types.filter((g): g is string => typeof g === "string") : ["authorization_code", "refresh_token"]
  if (grants.some((g) => g !== "authorization_code" && g !== "refresh_token")) return { ok: false, error: "invalid_client_metadata", description: "Only authorization_code and refresh_token grants are supported." }
  const responses = Array.isArray(body.response_types) ? body.response_types.filter((r): r is string => typeof r === "string") : ["code"]
  if (responses.some((r) => r !== "code")) return { ok: false, error: "invalid_client_metadata", description: "Only the code response type is supported." }
  const name = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 120) : null

  const clientId = token("fhi_c_").slice(0, 40)
  const secret = method === "none" ? null : token("fhi_s_")
  const admin = createAdminSupabase()
  const { error } = await admin.from("oauth_clients").insert({
    client_id: clientId,
    client_secret_hash: secret ? sha256(secret) : null,
    client_name: name,
    redirect_uris: uris,
    token_endpoint_auth_method: method,
    metadata: { client_uri: body.client_uri ?? null, software_id: body.software_id ?? null, software_version: body.software_version ?? null, scope: body.scope ?? null },
  })
  if (error) throw new Error(error.message)
  return {
    ok: true,
    body: {
      client_id: clientId,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: method,
      grant_types: grants.length ? grants : ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: OAUTH_SCOPES.join(" "),
    },
  }
}

/** Client ID Metadata Documents: a client whose id is an https URL hosting its own metadata (what "Use Claude's published identity" sends). */
const cimdCache = new Map<string, { at: number; client: OAuthClient | null }>()

async function fetchClientMetadata(clientId: string): Promise<OAuthClient | null> {
  const hit = cimdCache.get(clientId)
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.client
  let client: OAuthClient | null = null
  try {
    const res = await fetch(clientId, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000), cache: "no-store" })
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>
      const uris = Array.isArray(json.redirect_uris) ? json.redirect_uris.filter((u): u is string => typeof u === "string") : []
      if (json.client_id === clientId && uris.length) {
        client = {
          client_id: clientId,
          client_name: typeof json.client_name === "string" ? json.client_name.slice(0, 120) : null,
          redirect_uris: uris.filter(redirectUriAcceptable),
          token_endpoint_auth_method: "none",
          client_secret_hash: null,
        }
      }
    }
  } catch {
    client = null
  }
  cimdCache.set(clientId, { at: Date.now(), client })
  return client
}

export async function resolveClient(clientId: string): Promise<OAuthClient | null> {
  const id = clientId.trim()
  if (!id || id.length > 512) return null
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash")
    .eq("client_id", id)
    .maybeSingle<OAuthClient>()
  if (data) return data
  if (/^https:\/\//i.test(id)) return fetchClientMetadata(id)
  return null
}

/** The client's secret, when it has one (public clients prove themselves with PKCE instead). */
export function clientSecretOk(client: OAuthClient, secret: string | null): boolean {
  if (!client.client_secret_hash) return true
  return !!secret && sameString(sha256(secret), client.client_secret_hash)
}

export const clientDisplayName = (client: OAuthClient | null | undefined) => client?.client_name?.trim() || "Claude"

/* ───────────────────────── the sign-in request ───────────────────────── */

export type AuthorizeParams = {
  client_id: string
  redirect_uri: string
  state: string
  code_challenge: string
  code_challenge_method: string
  scope: string
  resource: string
}

export type AuthorizeCheck =
  | { ok: true; client: OAuthClient; params: AuthorizeParams }
  | { ok: false; fatal: true; message: string }
  | { ok: false; fatal: false; redirect: string }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

/** Validates a sign-in request. A bad client or redirect is fatal (never redirect there); other problems go back to the app as an OAuth error. */
export async function checkAuthorizeRequest(raw: Record<string, unknown>): Promise<AuthorizeCheck> {
  const params: AuthorizeParams = {
    client_id: str(raw.client_id),
    redirect_uri: str(raw.redirect_uri),
    state: str(raw.state),
    code_challenge: str(raw.code_challenge),
    code_challenge_method: str(raw.code_challenge_method) || "S256",
    scope: str(raw.scope),
    resource: str(raw.resource),
  }
  if (!params.client_id) return { ok: false, fatal: true, message: "The sign-in request names no app (client_id is missing)." }
  const client = await resolveClient(params.client_id)
  if (!client) return { ok: false, fatal: true, message: "This app is not registered with FHI. In claude.ai, remove the connector and add it again." }
  if (!params.redirect_uri || !redirectUriRegistered(client, params.redirect_uri)) {
    return { ok: false, fatal: true, message: "The app asked to be sent back to an address FHI does not know, so the sign-in was stopped." }
  }
  const back = (error: string, description: string) => {
    const u = new URL(params.redirect_uri)
    u.searchParams.set("error", error)
    u.searchParams.set("error_description", description)
    if (params.state) u.searchParams.set("state", params.state)
    return { ok: false as const, fatal: false as const, redirect: u.toString() }
  }
  if (str(raw.response_type) !== "code") return back("unsupported_response_type", "Only response_type=code is supported.")
  if (!params.code_challenge) return back("invalid_request", "code_challenge is required (PKCE).")
  if (params.code_challenge_method !== "S256") return back("invalid_request", "code_challenge_method must be S256.")
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(params.code_challenge)) return back("invalid_request", "code_challenge is malformed.")
  return { ok: true, client, params }
}

/* ───────────────────────── codes ───────────────────────── */

type CodeRow = {
  code_hash: string
  client_id: string
  user_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  scope: string
  resource: string | null
}

export async function issueCode(p: { clientId: string; userId: string; redirectUri: string; codeChallenge: string; resource: string; scope: string }): Promise<string> {
  const code = token("fhi_ac_")
  const admin = createAdminSupabase()
  const { error } = await admin.from("oauth_codes").insert({
    code_hash: sha256(code),
    client_id: p.clientId,
    user_id: p.userId,
    redirect_uri: p.redirectUri,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    scope: p.scope,
    resource: p.resource || null,
    expires_at: plusSeconds(CODE_TTL_S),
  })
  if (error) throw new Error(error.message)
  return code
}

/** Marks the code used and returns it — once; a second use, or an expired code, returns null. */
export async function consumeCode(code: string): Promise<CodeRow | null> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("oauth_codes")
    .update({ used_at: nowIso() })
    .eq("code_hash", sha256(code))
    .is("used_at", null)
    .gt("expires_at", nowIso())
    .select("code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource")
    .maybeSingle<CodeRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

/* ───────────────────────── grants and passes ───────────────────────── */

export type GrantRow = {
  id: string
  user_id: string
  client_id: string
  client_name: string | null
  scope: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export type IssuedTokens = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string }

export async function createGrant(p: { userId: string; clientId: string; clientName: string | null; userAgent: string | null; scope: string }): Promise<string> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("oauth_grants")
    .insert({ user_id: p.userId, client_id: p.clientId, client_name: p.clientName, scope: p.scope || OAUTH_SCOPE, user_agent: p.userAgent?.slice(0, 300) ?? null })
    .select("id")
    .single<{ id: string }>()
  if (error) throw new Error(error.message)
  return data.id
}

/** A pass pair for a grant. `scope` is the grant's own — what the person allowed — echoed to the app. */
export async function issueTokens(grantId: string, scope: string): Promise<IssuedTokens> {
  const access = token("fhi_at_")
  const refresh = token("fhi_rt_")
  const admin = createAdminSupabase()
  const { error } = await admin.from("oauth_tokens").insert({
    grant_id: grantId,
    access_hash: sha256(access),
    refresh_hash: sha256(refresh),
    access_expires_at: plusSeconds(ACCESS_TTL_S),
    refresh_expires_at: plusSeconds(REFRESH_TTL_S),
  })
  if (error) throw new Error(error.message)
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: scope || OAUTH_SCOPE }
}

type TokenRow = {
  id: string
  grant_id: string
  access_expires_at: string
  refresh_expires_at: string
  rotated_at: string | null
  oauth_grants: GrantRow | null
}

const TOKEN_SELECT = "id, grant_id, access_expires_at, refresh_expires_at, rotated_at, oauth_grants(id, user_id, client_id, client_name, scope, created_at, last_used_at, revoked_at)"

/** A new pass for a refresh pass — the old pair stops working; the grant stays, so Connected apps shows the same connection. */
export async function refreshTokens(refreshToken: string, clientId: string): Promise<IssuedTokens | null> {
  if (!refreshToken.startsWith("fhi_rt_")) return null
  const admin = createAdminSupabase()
  const { data } = await admin.from("oauth_tokens").select(TOKEN_SELECT).eq("refresh_hash", sha256(refreshToken)).maybeSingle<TokenRow>()
  const grant = data?.oauth_grants
  if (!data || !grant || data.rotated_at || grant.revoked_at) return null
  if (new Date(data.refresh_expires_at).getTime() < Date.now()) return null
  if (grant.client_id !== clientId) return null
  const { data: rotated } = await admin.from("oauth_tokens").update({ rotated_at: nowIso() }).eq("id", data.id).is("rotated_at", null).select("id").maybeSingle<{ id: string }>()
  if (!rotated) return null
  return issueTokens(grant.id, grant.scope)
}

export type McpIdentity = { grantId: string; userId: string; clientId: string; expiresAt: number; lastUsedAt: string | null; scope: string }

/** The person behind an access pass — null when the pass is unknown, expired, rotated or its connection disconnected. */
export async function authenticateAccessToken(accessToken: string): Promise<McpIdentity | null> {
  if (!accessToken.startsWith("fhi_at_")) return null
  const admin = createAdminSupabase()
  const { data } = await admin.from("oauth_tokens").select(TOKEN_SELECT).eq("access_hash", sha256(accessToken)).maybeSingle<TokenRow>()
  const grant = data?.oauth_grants
  if (!data || !grant || data.rotated_at || grant.revoked_at) return null
  const expiresAt = Math.floor(new Date(data.access_expires_at).getTime() / 1000)
  if (expiresAt * 1000 < Date.now()) return null
  return { grantId: grant.id, userId: grant.user_id, clientId: grant.client_id, expiresAt, lastUsedAt: grant.last_used_at, scope: grant.scope || OAUTH_SCOPE }
}

/** last_used_at, written at most every five minutes so a chat full of questions is one update. */
export async function touchGrant(id: McpIdentity): Promise<void> {
  const last = id.lastUsedAt ? new Date(id.lastUsedAt).getTime() : 0
  if (Date.now() - last < 5 * 60_000) return
  const admin = createAdminSupabase()
  await admin.from("oauth_grants").update({ last_used_at: nowIso() }).eq("id", id.grantId)
}

/** Disconnects: every pass of the grant is refused from the next call. `onlyUser` limits it to the person's own grant. */
export async function revokeGrant(grantId: string, by: string | null, onlyUser?: string): Promise<GrantRow | null> {
  const admin = createAdminSupabase()
  let q = admin.from("oauth_grants").update({ revoked_at: nowIso(), revoked_by: by }).eq("id", grantId).is("revoked_at", null)
  if (onlyUser) q = q.eq("user_id", onlyUser)
  const { data, error } = await q.select("id, user_id, client_id, client_name, scope, created_at, last_used_at, revoked_at").maybeSingle<GrantRow>()
  if (error) throw new Error(error.message)
  return data ?? null
}

/** RFC 7009: the app gives a pass back (sign-out on its side); the whole connection is closed. */
export async function revokeByToken(anyToken: string): Promise<void> {
  const admin = createAdminSupabase()
  const h = sha256(anyToken)
  const column = anyToken.startsWith("fhi_rt_") ? "refresh_hash" : "access_hash"
  const { data } = await admin.from("oauth_tokens").select("grant_id").eq(column, h).maybeSingle<{ grant_id: string }>()
  if (data) await revokeGrant(data.grant_id, null)
}

/** The live connections of one person, or of everyone (admin). */
export async function listGrants(userId?: string): Promise<GrantRow[]> {
  const admin = createAdminSupabase()
  let q = admin.from("oauth_grants").select("id, user_id, client_id, client_name, scope, created_at, last_used_at, revoked_at").is("revoked_at", null).order("created_at", { ascending: false }).limit(500)
  if (userId) q = q.eq("user_id", userId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as GrantRow[]
}

/** The Bearer token of a request, or "" — the only place the MCP endpoint reads it from. */
export function bearerToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? ""
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
}
