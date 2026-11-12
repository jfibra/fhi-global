import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { requestContextFromRequest } from "@/lib/audit-log"
import { allowRequest } from "@/lib/rate-limit"
import { companyWhatsappHref } from "@/lib/company"
import { runSiteChat } from "@/lib/site-chat"
import { matchSiteChatFaq } from "@/lib/site-chat-faq"
import { SITE_CHAT_LIMITS, blockMessage, ipHash, recordSiteChat, siteChatGate } from "@/lib/site-chat-usage"
import { sseResponse, type ChatStreamEvent } from "@/lib/fhi-chat-stream"

/**
 * The website chat (boss via Juliecor, 2026-11-06): the public FHI Assistant
 * on fhiglobal.ae, for visitors — no login. Unauthenticated by design, so the
 * wall is here, before anything reaches the model (lib/site-chat-usage.ts):
 *
 *   1. a honeypot field: a bot that fills it gets a polite nothing;
 *   2. per-IP per-minute limit in memory — the cheap wall against floods;
 *   3. the database gate in one round trip: per-IP hourly and daily limits,
 *      the per-conversation limit, the site-wide hourly limit, and the daily
 *      and monthly spend caps. Refusals are recorded for the admin page.
 *
 * The browser keeps the conversation and sends it back; the server trims it
 * (SITE_CHAT_LIMITS) so a long or stuffed history can't inflate the bill, and
 * every message that reaches the model is logged with its cost.
 *
 * Questions about the website itself — how to register, how to sign in, how
 * to reach the office, who FHI is — never reach the model: they are answered
 * from lib/site-chat-faq.ts right after the per-minute wall (free, instant,
 * and still answered when the spend caps have closed the chat), and logged
 * with tools = ["faq"] at no cost.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const Body = z.object({
  session: z.string().regex(UUID_RE),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .min(1)
    .max(SITE_CHAT_LIMITS.historyTurns * 2 + 2),
  /** The page they're on — path only, for the usage page. */
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  website: z.string().max(200).optional().default(""), // honeypot — humans leave this empty
})

const whatsapp = () => companyWhatsappHref("Hi! I was chatting on fhiglobal.ae and would like to speak to a consultant.")

/** A ready answer typed out like the model's — a word at a time, the whole answer within about two seconds — instead of landing as a block. */
async function typeOut(text: string, send: (e: ChatStreamEvent) => void) {
  const pieces = text.match(/\S+\s*/g) ?? [text]
  const pause = Math.max(12, Math.min(28, Math.round(2200 / pieces.length)))
  for (const piece of pieces) {
    send({ type: "delta", text: piece })
    await new Promise((r) => setTimeout(r, pause))
  }
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: "Please check your message and try again." }, { status: 400 })
  const body = parsed.data

  // Bot filled the hidden field — a polite nothing, stored nowhere.
  if (body.website.trim() !== "") return NextResponse.json({ reply: "Thanks for your message! A consultant will be in touch.", cards: [], used: [] })

  const ctx = requestContextFromRequest(req)
  const ip = ctx.ip ?? "unknown"
  if (!allowRequest(`site-chat:${ip}`, SITE_CHAT_LIMITS.ipPerMinute, 60_000)) {
    return NextResponse.json({ error: blockMessage("ip_minute"), whatsapp: whatsapp() }, { status: 429 })
  }

  const history = body.messages
    .slice(-SITE_CHAT_LIMITS.historyTurns * 2)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? SITE_CHAT_LIMITS.questionChars : 2500) }))
    .filter((m) => m.content.length > 0)
  const last = history[history.length - 1]
  if (!last || last.role !== "user") return NextResponse.json({ error: "Type a message first." }, { status: 422 })
  const question = last.content

  const admin = createAdminSupabase()
  const hash = ipHash(ctx.ip)
  const country = req.headers.get("cf-ipcountry")?.trim().toUpperCase().slice(0, 2) || null
  const page = body.page ?? null
  const wantsStream = req.headers.get("accept")?.includes("text/event-stream") ?? false

  // A ready answer (lib/site-chat-faq.ts): nothing to protect, so no gate and no model.
  const faq = matchSiteChatFaq(question)
  if (faq) {
    const payload = { reply: faq.answer, cards: [], used: ["faq"] }
    const record = () => recordSiteChat(admin, { session: body.session, ipHash: hash, country, page, question, answer: faq.answer, tools: ["faq"], ok: true })
    if (wantsStream) {
      // Typed out like a model answer; the log is written before the stream closes.
      return sseResponse(async (send) => {
        await typeOut(faq.answer, send)
        send({ type: "done", ...payload })
        await record()
      })
    }
    await record()
    return NextResponse.json(payload)
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: "The chat is not available right now.", whatsapp: whatsapp() }, { status: 503 })

  let gate
  try {
    gate = await siteChatGate(admin, hash, body.session)
  } catch {
    return NextResponse.json({ error: "The chat is not available right now.", whatsapp: whatsapp() }, { status: 503 })
  }
  if (!gate.ok) {
    await recordSiteChat(admin, { session: body.session, ipHash: hash, country, page, question, blocked: gate.reason, ok: false })
    return NextResponse.json({ error: blockMessage(gate.reason), whatsapp: whatsapp() }, { status: 429 })
  }

  const run = async (emit: (e: ChatStreamEvent) => void) => {
    const result = await runSiteChat(history, apiKey, emit)
    // Every message that reached the model counts, answered or not — it cost tokens.
    await recordSiteChat(admin, {
      session: body.session,
      ipHash: hash,
      country,
      page,
      question,
      answer: result.reply ?? null,
      tools: result.used,
      projects: result.projects,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      ok: result.ok,
      error: result.error,
    })
    if (!result.ok) return { ok: false as const, status: result.status ?? 500, error: result.error ?? "I couldn't answer that — please try again." }
    return { ok: true as const, payload: { reply: result.reply, cards: result.cards, used: result.used } }
  }

  if (wantsStream) {
    return sseResponse(async (send) => {
      const out = await run(send)
      send(out.ok ? { type: "done", ...out.payload } : { type: "error", error: out.error, status: out.status })
    })
  }
  const out = await run(() => {})
  return out.ok ? NextResponse.json(out.payload) : NextResponse.json({ error: out.error, whatsapp: whatsapp() }, { status: out.status })
}
