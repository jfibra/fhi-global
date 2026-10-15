import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { sseResponse } from "@/lib/fhi-chat-stream"
import { MAX_HISTORY, runAdminChat } from "@/lib/fhi-admin-chat"

/**
 * FHI Assistant — the admin analytics assistant. The model (OpenAI, same account
 * as the AI Photo Studio) answers questions about FHI's own data by calling
 * the predefined tools in lib/fhi-chat-tools.ts; it never writes SQL and
 * never invents numbers — every figure in an answer came out of a tool run
 * this request. Admin staff only: the tools read the whole business (all
 * sales values, all agents) through the service-role client.
 */

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await requireRole([...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "FHI Assistant is not configured on the server (OPENAI_API_KEY missing)." },
      { status: 503 },
    )
  }

  const body = (await req.json().catch(() => null)) as { messages?: Array<{ role: string; content: string }> } | null
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }))
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send at least one user message." }, { status: 422 })
  }

  const sender = { email: session.context.email, name: session.context.profile.fullname }
  // The page asks for a live stream (words as they are written, which lookups
  // are running); anything else gets the whole answer as one JSON object.
  if (req.headers.get("accept")?.includes("text/event-stream")) {
    return sseResponse(async (send) => {
      const out = await runAdminChat(history, sender, apiKey, send)
      send(out.ok ? { type: "done", ...out.payload } : { type: "error", error: out.error, status: out.status })
    })
  }
  const out = await runAdminChat(history, sender, apiKey, () => {})
  return out.ok ? NextResponse.json(out.payload) : NextResponse.json({ error: out.error }, { status: out.status })
}

