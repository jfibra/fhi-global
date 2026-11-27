import { NextRequest, NextResponse } from "next/server"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canManageEvents, canManageOwnEvents, isAdminStaffRole } from "@/lib/app-roles"
import { requestContextFromRequest } from "@/lib/audit-log"
import { getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"
import type { AgentChatCaller } from "@/lib/fhi-agent-chat-tools"
import type { EventWriter } from "@/lib/mcp/events"
import { buildPersonalMcpServer } from "@/lib/mcp/personal"
import { MCP_SERVER_NAME, buildFhiMcpServer } from "@/lib/mcp/server"
import { MCP_ME_PATH, OAUTH_SCOPE_EVENTS, authenticateAccessToken, bearerToken, mcpSignInAllowed, oauthIssuer, scopeHas, touchGrant } from "@/lib/oauth/server"
import { allowRequest } from "@/lib/rate-limit"

/**
 * POST /api/mcp/me — FHI's MCP endpoint for a SIGNED-IN person (2026-11-24).
 * Unlike /api/mcp (the shared admin key, open handshake), every request here
 * must carry a pass issued by the Claude sign-in (lib/oauth/server.ts); a
 * request without one is answered 401 with the resource-metadata pointer
 * the MCP spec defines, which is what sends claude.ai to /oauth/authorize.
 *
 * Each call re-reads the account: the pass must be live (not expired,
 * rotated or disconnected), the profile active, the role one the assistant
 * serves. Agents and team leaders get the agent FHI Assistant's tools bound
 * to them (lib/mcp/personal.ts); admin staff get the admin server
 * (lib/mcp/server.ts) with the server's own key. Either gets the event
 * tools that write (lib/mcp/events.ts) when their connection carries the
 * events permission (the ticked box on the consent screen) AND their role
 * runs events in the dashboard: admin staff act on company events, an agent
 * or team leader only on the events they own. Both are re-checked on every
 * call, so a role change or a reading-only connection never reaches them.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Who = { caller: AgentChatCaller; admin: boolean; events?: EventWriter }

const adminAuthorization = () => {
  const key = process.env.FHI_EXTERNAL_API_KEY?.trim()
  return key ? `Bearer ${key}` : ""
}

const handler = createMcpHandler(
  (ctx) => {
    const who = ctx.authInfo?.extra?.who as Who | undefined
    if (!who) throw new Error("No identity on the request")
    return who.admin ? buildFhiMcpServer(adminAuthorization(), { events: who.events }) : buildPersonalMcpServer(who.caller, { events: who.events })
  },
  { legacy: "stateless", responseMode: "json", onerror: (e) => console.error("[mcp/me]", e.message) },
)

type ProfileRow = { id: string; fullname: string | null; role: string | null; status: string | null; is_deleted: boolean | null }

async function serve(req: NextRequest) {
  const issuer = oauthIssuer(req)
  const metadataUrl = `${issuer}/.well-known/oauth-protected-resource${MCP_ME_PATH}`
  const challenge = (error: string | null, description: string) =>
    NextResponse.json(
      { error: error ?? "unauthorized", error_description: description },
      {
        status: 401,
        headers: {
          "www-authenticate": `Bearer realm="FHI Global"${error ? `, error="${error}", error_description="${description}"` : ""}, resource_metadata="${metadataUrl}"`,
          "cache-control": "no-store",
        },
      },
    )

  const token = bearerToken(req)
  if (!token) return challenge(null, "Sign in with your FHI account.")

  const identity = await authenticateAccessToken(token)
  if (!identity) return challenge("invalid_token", "The pass is expired or the connection was disconnected. Sign in again.")

  const { data: profile } = await createAdminSupabase().from("profiles").select("id, fullname, role, status, is_deleted").eq("id", identity.userId).maybeSingle<ProfileRow>()
  if (!profile || isInactiveProfile(profile)) {
    return NextResponse.json({ error: "account_inactive", error_description: "This FHI account is not active." }, { status: 403, headers: { "cache-control": "no-store" } })
  }
  if (!mcpSignInAllowed(profile.role)) {
    return NextResponse.json({ error: "role_not_allowed", error_description: "Claude tools are not available for this account's role." }, { status: 403, headers: { "cache-control": "no-store" } })
  }
  if (!allowRequest(`mcp-me:${identity.grantId}`, 300, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited", error_description: "Too many requests — try again in a few minutes." }, { status: 429, headers: { "cache-control": "no-store" } })
  }
  void touchGrant(identity).catch(() => undefined)

  const admin = isAdminStaffRole(profile.role)
  // Whose events this person may write from Claude: the dashboard's two tiers (lib/events/access.ts).
  const eventScope: EventWriter["scope"] | null = !scopeHas(identity.scope, OAUTH_SCOPE_EVENTS)
    ? null
    : admin && canManageEvents(profile.role)
      ? { kind: "all" }
      : !admin && canManageOwnEvents(profile.role)
        ? { kind: "own", agentId: profile.id }
        : null
  const events: EventWriter | undefined = eventScope
    ? {
        actor: { id: profile.id, name: profile.fullname, role: profile.role },
        request: requestContextFromRequest(req),
        origin: issuer,
        dashboard: getDashboardRouteByRole(profile.role),
        scope: eventScope,
      }
    : undefined
  const who: Who = { caller: { userId: profile.id, name: profile.fullname, role: profile.role }, admin, events }
  return handler.fetch(req, {
    authInfo: { token, clientId: identity.clientId || MCP_SERVER_NAME, scopes: identity.scope.split(/\s+/).filter(Boolean), expiresAt: identity.expiresAt, extra: { who } },
  })
}

export async function POST(req: NextRequest) {
  return serve(req)
}

export async function GET(req: NextRequest) {
  return serve(req)
}

export async function DELETE(req: NextRequest) {
  return serve(req)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { allow: "POST, GET, DELETE, OPTIONS" } })
}
