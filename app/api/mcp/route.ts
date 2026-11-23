import { NextRequest, NextResponse } from "next/server"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { MCP_SERVER_NAME, buildFhiMcpServer } from "@/lib/mcp/server"

/**
 * POST /api/mcp — FHI's MCP endpoint (Streamable HTTP, stateless): the keyed
 * external API as tools for Claude. Same key as the API, sent as
 * `Authorization: Bearer <key>` (claude.ai custom connector header, Claude
 * Code `--header`, the Messages API's `authorization_token`) or as `?key=`
 * on the server URL. A tool call without it answers with a message saying
 * so (the endpoints behind the tools enforce the key, the 503 when none is
 * configured, and the API's own rate limit). Every tool is read-only. GET
 * and DELETE (session operations) answer 405.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const handler = createMcpHandler((ctx) => buildFhiMcpServer(ctx.authInfo?.token ? `Bearer ${ctx.authInfo.token}` : ""), {
  legacy: "stateless",
  responseMode: "json",
  onerror: (e) => console.error("[mcp]", e.message),
})

/**
 * The protocol itself is open — the handshake and the tool list carry nothing
 * secret (the same catalog is on the API page and in the guide) — and the key
 * is checked by every tool call, because each tool runs an external endpoint
 * that demands it. claude.ai probes a "no sign-in" connector with no
 * credentials and refuses to add it when that probe is answered 401 (seen
 * 2026-11-23 on the organisation account); with the key missing, a tool
 * answers with a plain message saying where to put it instead.
 */
async function serve(req: NextRequest) {
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
