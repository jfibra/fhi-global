import { NextRequest, NextResponse } from "next/server"
import { registerClient } from "@/lib/oauth/server"
import { allowRequest, clientIp } from "@/lib/rate-limit"

/**
 * Dynamic client registration (RFC 7591): claude.ai (and Claude Code)
 * register themselves here when the connector is added, before the person
 * is sent to sign in. Only Claude's callback and loopback addresses are
 * accepted as redirect_uris (lib/oauth/server.ts), so registration is open
 * but useless to anyone who isn't Claude or a local tool.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, mcp-protocol-version" }

export async function POST(req: NextRequest) {
  if (!allowRequest(`oauth-register:${clientIp(req.headers)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "invalid_request", error_description: "Too many registrations — try again in a few minutes." }, { status: 429, headers: CORS })
  }
  const body = await req.json().catch(() => null)
  try {
    const result = await registerClient(body)
    if (!result.ok) return NextResponse.json({ error: result.error, error_description: result.description }, { status: 400, headers: CORS })
    return NextResponse.json(result.body, { status: 201, headers: { ...CORS, "cache-control": "no-store" } })
  } catch (e) {
    console.error("[oauth/register]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "server_error", error_description: "FHI could not save the registration." }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
