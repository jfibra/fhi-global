import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { OAUTH_SCOPE_EVENTS, clientSecretOk, consumeCode, createGrant, issueTokens, pkceMatches, refreshTokens, resolveClient, scopeHas } from "@/lib/oauth/server"
import { allowRequest, clientIp } from "@/lib/rate-limit"

/**
 * The token endpoint of the Claude sign-in: turns the one-time code from
 * /oauth/authorize into a pass (authorization_code + PKCE), and renews a pass
 * (refresh_token). The first exchange is the moment the connection exists —
 * it creates the grant that Connected apps lists — and is written to the
 * audit log as "connected".
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, mcp-protocol-version" }
const NO_STORE = { ...CORS, "cache-control": "no-store", pragma: "no-cache" }

const fail = (error: string, description: string, status = 400) => NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE })

/** Form-encoded (the standard) or JSON, both as plain strings. */
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const type = req.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const json = (await req.json().catch(() => null)) as Record<string, unknown> | null
    for (const [k, v] of Object.entries(json ?? {})) if (typeof v === "string") out[k] = v
    return out
  }
  const form = await req.formData().catch(() => null)
  if (form) for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v
  return out
}

function basicAuth(req: NextRequest): { id: string; secret: string } | null {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.toLowerCase().startsWith("basic ")) return null
  try {
    const [id, ...rest] = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8").split(":")
    return { id: decodeURIComponent(id), secret: decodeURIComponent(rest.join(":")) }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (!allowRequest(`oauth-token:${clientIp(req.headers)}`, 120, 10 * 60_000)) return fail("invalid_request", "Too many requests — try again in a few minutes.", 429)
  const p = await readParams(req)
  const basic = basicAuth(req)
  const clientId = (p.client_id || basic?.id || "").trim()
  const secret = p.client_secret || basic?.secret || null
  if (!clientId) return fail("invalid_client", "client_id is missing.", 401)

  try {
    const client = await resolveClient(clientId)
    if (!client) return fail("invalid_client", "Unknown client.", 401)
    if (!clientSecretOk(client, secret)) return fail("invalid_client", "Wrong client secret.", 401)

    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.code_verifier) return fail("invalid_request", "code and code_verifier are required.")
      const row = await consumeCode(p.code)
      if (!row) return fail("invalid_grant", "The sign-in code is unknown, already used or expired. Sign in again.")
      if (row.client_id !== client.client_id) return fail("invalid_grant", "The code belongs to another client.")
      if (p.redirect_uri && p.redirect_uri !== row.redirect_uri) return fail("invalid_grant", "redirect_uri does not match the sign-in.")
      if (!pkceMatches(p.code_verifier, row.code_challenge)) return fail("invalid_grant", "code_verifier does not match.")

      const grantId = await createGrant({ userId: row.user_id, clientId: client.client_id, clientName: client.client_name, userAgent: req.headers.get("user-agent"), scope: row.scope })
      const tokens = await issueTokens(grantId, row.scope)

      const { data: who } = await createAdminSupabase().from("profiles").select("fullname, role").eq("id", row.user_id).maybeSingle<{ fullname: string | null; role: string | null }>()
      void logAuditEvent({
        category: "claude_sign_in",
        event: "connected",
        actor: { id: row.user_id, name: who?.fullname ?? null, role: who?.role ?? null },
        subjectType: "oauth_grant",
        subjectId: grantId,
        subjectLabel: client.client_name ?? "Claude",
        description: `${who?.fullname ?? "A member"} connected ${client.client_name ?? "Claude"} to their FHI account${scopeHas(row.scope, OAUTH_SCOPE_EVENTS) ? " and allowed it to create and publish events" : ""}`,
        ...requestContextFromRequest(req),
      })
      return NextResponse.json(tokens, { headers: NO_STORE })
    }

    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token) return fail("invalid_request", "refresh_token is required.")
      const tokens = await refreshTokens(p.refresh_token, client.client_id)
      if (!tokens) return fail("invalid_grant", "The refresh token is unknown, expired or the connection was disconnected. Sign in again.")
      return NextResponse.json(tokens, { headers: NO_STORE })
    }

    return fail("unsupported_grant_type", "Use authorization_code or refresh_token.")
  } catch (e) {
    console.error("[oauth/token]", e instanceof Error ? e.message : e)
    return fail("server_error", "FHI could not issue the pass.", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
