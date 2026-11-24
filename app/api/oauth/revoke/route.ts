import { NextRequest, NextResponse } from "next/server"
import { revokeByToken } from "@/lib/oauth/server"
import { allowRequest, clientIp } from "@/lib/rate-limit"

/**
 * Token revocation (RFC 7009): the app hands a pass back when the person
 * removes the connector on its side. The whole connection is closed, the
 * same as Disconnect in the dashboard. Always answers 200, as the RFC asks.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, mcp-protocol-version" }

export async function POST(req: NextRequest) {
  if (!allowRequest(`oauth-revoke:${clientIp(req.headers)}`, 60, 10 * 60_000)) return NextResponse.json({}, { status: 429, headers: CORS })
  let tokenValue = ""
  const type = req.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const json = (await req.json().catch(() => null)) as { token?: unknown } | null
    tokenValue = typeof json?.token === "string" ? json.token : ""
  } else {
    const form = await req.formData().catch(() => null)
    const v = form?.get("token")
    tokenValue = typeof v === "string" ? v : ""
  }
  try {
    if (tokenValue) await revokeByToken(tokenValue.trim())
  } catch (e) {
    console.error("[oauth/revoke]", e instanceof Error ? e.message : e)
  }
  return NextResponse.json({}, { headers: { ...CORS, "cache-control": "no-store" } })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
