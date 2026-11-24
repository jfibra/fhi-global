import { NextRequest, NextResponse } from "next/server"
import { authorizationServerMetadata, oauthIssuer } from "@/lib/oauth/server"

/**
 * OAuth authorization server metadata (RFC 8414) for the Claude sign-in —
 * served at /.well-known/oauth-authorization-server (and
 * /.well-known/openid-configuration, which some clients try first) through
 * the rewrites in next.config.mjs. Public by nature: it only says where the
 * sign-in page and the token endpoint are.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type, mcp-protocol-version" }

export async function GET(req: NextRequest) {
  return NextResponse.json(authorizationServerMetadata(oauthIssuer(req)), { headers: { ...CORS, "cache-control": "public, max-age=300" } })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
