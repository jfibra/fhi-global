import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { OAUTH_SCOPE_EVENTS, listGrants, scopeHas } from "@/lib/oauth/server"

/**
 * The caller's own Claude connections (Connect Claude page): one row per
 * Allow on /oauth/authorize that has not been disconnected. Disconnect is
 * DELETE /api/account/connected-apps/[id].
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  try {
    const grants = await listGrants(session.context.userId)
    return NextResponse.json(
      { apps: grants.map((g) => ({ id: g.id, client_name: g.client_name, created_at: g.created_at, last_used_at: g.last_used_at, events: scopeHas(g.scope, OAUTH_SCOPE_EVENTS) })) },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (e) {
    console.error("[connected-apps]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't load your connections." }, { status: 500 })
  }
}
