import { NextRequest, NextResponse } from "next/server"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { requireExternalKey } from "@/lib/external-api"
import { MCP_SERVER_NAME, buildFhiMcpServer } from "@/lib/mcp/server"

/**
 * POST /api/mcp — FHI's MCP endpoint (Streamable HTTP, stateless): the keyed
 * external API as tools for Claude. Same key as the API, sent as
 * `Authorization: Bearer <key>` (claude.ai custom connector header, Claude
 * Code `--header`, the Messages API's `authorization_token`). 401 without
 * it, 503 when no key is configured, the API's own rate limit. Every tool is
 * read-only. GET and DELETE (session operations) answer 405.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const handler = createMcpHandler((ctx) => buildFhiMcpServer(ctx.authInfo?.token ? `Bearer ${ctx.authInfo.token}` : ""), {
  legacy: "stateless",
  responseMode: "json",
  onerror: (e) => console.error("[mcp]", e.message),
})

async function serve(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) {
    if (denied.status === 401) denied.headers.set("WWW-Authenticate", 'Bearer realm="fhiglobal.ae", error="invalid_token"')
    return denied
  }
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("key") ?? "").trim()
  return handler.fetch(req, { authInfo: { token, clientId: MCP_SERVER_NAME, scopes: ["read"], expiresAt: Math.floor(Date.now() / 1000) + 3600 } })
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
