import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { MAX_CONVERSATIONS_LISTED, audienceOf, cleanMessages, conversationSession, titleFrom } from "@/lib/assistant-conversations"

/**
 * The signed-in person's FHI Assistant conversations (migration 081).
 *   GET  ?audience=admin|agent             → newest first: id, title, updated_at
 *   POST { audience, messages, title? }    → a new conversation → { id, title }
 */

export async function GET(req: NextRequest) {
  const audience = audienceOf(req.nextUrl.searchParams.get("audience"))
  if (!audience) return NextResponse.json({ error: "Unknown assistant." }, { status: 400 })
  const session = await conversationSession(audience)
  if (!session.ok) return session.response
  const { data, error } = await createAdminSupabase()
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .eq("user_id", session.userId)
    .eq("audience", audience)
    .order("updated_at", { ascending: false })
    .limit(MAX_CONVERSATIONS_LISTED)
  if (error) return NextResponse.json({ error: "Couldn't load your chats." }, { status: 500 })
  return NextResponse.json({ conversations: data ?? [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { audience?: unknown; messages?: unknown; title?: unknown } | null
  const audience = audienceOf(body?.audience)
  if (!audience) return NextResponse.json({ error: "Unknown assistant." }, { status: 400 })
  const session = await conversationSession(audience)
  if (!session.ok) return session.response
  const messages = cleanMessages(body?.messages)
  const firstQuestion = (messages.find((m) => (m as { role: string }).role === "user") as { content?: string } | undefined)?.content ?? ""
  const title = titleFrom(typeof body?.title === "string" && body.title.trim() ? body.title : firstQuestion)
  const { data, error } = await createAdminSupabase()
    .from("assistant_conversations")
    .insert({ user_id: session.userId, audience, title, messages })
    .select("id, title, updated_at")
    .single()
  if (error || !data) return NextResponse.json({ error: "Couldn't save the chat." }, { status: 500 })
  return NextResponse.json(data)
}
