import { NextRequest, NextResponse } from "next/server"
import { oauthIssuer, protectedResourceMetadata } from "@/lib/oauth/server"

/**
 * Protected resource metadata (RFC 9728) for POST /api/mcp/me — the file a
 * client reads after a 401 to learn which sign-in server to use. Served at
 * /.well-known/oauth-protected-resource and
 * /.well-known/oauth-protected-resource/api/mcp/me through the rewrites in
 * next.config.mjs.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type, mcp-protocol-version" }

export async function GET(req: NextRequest) {
  return NextResponse.json(protectedResourceMetadata(oauthIssuer(req)), { headers: { ...CORS, "cache-control": "public, max-age=300" } })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
