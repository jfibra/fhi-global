import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { audienceOf, cleanMessages, conversationSession, titleFrom } from "@/lib/assistant-conversations"

/**
 * One of the signed-in person's conversations (migration 081). Every query is
 * filtered by their user id — another person's id simply finds nothing.
 *   GET    ?audience=…                         → { id, title, messages, updated_at }
 *   PATCH  { audience, messages?, title? }     → saved
 *   DELETE ?audience=…                         → removed (their own chat, from the history list)
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

async function guard(req: NextRequest, ctx: Ctx, audienceRaw: unknown) {
  const { id } = await ctx.params
  if (!UUID.test(id)) return { ok: false as const, response: NextResponse.json({ error: "Not found." }, { status: 404 }) }
  const audience = audienceOf(audienceRaw)
  if (!audience) return { ok: false as const, response: NextResponse.json({ error: "Unknown assistant." }, { status: 400 }) }
  const session = await conversationSession(audience)
  if (!session.ok) return session
  return { ok: true as const, id, audience, userId: session.userId }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const g = await guard(req, ctx, req.nextUrl.searchParams.get("audience"))
  if (!g.ok) return g.response
  const { data, error } = await createAdminSupabase()
    .from("assistant_conversations")
    .select("id, title, messages, updated_at")
    .eq("id", g.id)
    .eq("user_id", g.userId)
    .eq("audience", g.audience)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Couldn't open the chat." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 })
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const body = (await req.json().catch(() => null)) as { audience?: unknown; messages?: unknown; title?: unknown } | null
  const g = await guard(req, ctx, body?.audience)
  if (!g.ok) return g.response
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body?.messages !== undefined) patch.messages = cleanMessages(body.messages)
  if (typeof body?.title === "string") patch.title = titleFrom(body.title)
  const { data, error } = await createAdminSupabase()
    .from("assistant_conversations")
    .update(patch)
    .eq("id", g.id)
    .eq("user_id", g.userId)
    .eq("audience", g.audience)
    .select("id, title, updated_at")
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Couldn't save the chat." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = await guard(req, ctx, req.nextUrl.searchParams.get("audience"))
  if (!g.ok) return g.response
  const { error } = await createAdminSupabase().from("assistant_conversations").delete().eq("id", g.id).eq("user_id", g.userId).eq("audience", g.audience)
  if (error) return NextResponse.json({ error: "Couldn't delete the chat." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
