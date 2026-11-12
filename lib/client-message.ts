import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { findBrochureProject, loadBrochure, type Brochure } from "@/lib/brochure/data"

/**
 * A message an agent sends a client about a project (boss via Juliecor,
 * 2026-11-12 — the third premium output of the agents' FHI Assistant, after
 * the brochure and the performance report): "write a WhatsApp message for
 * Maria about Azizi Venice", "follow-up email about the payment plan", "in
 * Tagalog". The tool gathers the SAME facts the brochure prints (the project's
 * from-price, units, payment plan, handover, the agent's own name, WhatsApp and
 * website link — lib/brochure/data.ts), has the chat model write the message
 * from those facts alone, and hands the chat a card with Copy and "Send on
 * WhatsApp" buttons. The message never carries a figure that is not on the
 * project's public page, and the sender is always the person asking.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type ClientMessageChannel = "whatsapp" | "email"

export type ClientMessageArgs = {
  project?: string
  /** What the message should achieve, in the agent's words ("introduce it", "follow up after the viewing", "explain the payment plan"). */
  purpose?: string
  client_name?: string
  language?: string
  channel?: string
}

/** What the chat draws under the answer: the message, with Copy and Send buttons. */
export type ClientDraft = {
  kind: "message"
  channel: ClientMessageChannel
  /** What the card is about: the project, or "Team" for a message to a member. */
  project: string
  client: string | null
  language: string
  subject: string | null
  text: string
  image: string | null
  /** A team member's WhatsApp digits (the leader's own team only): the Send button opens that chat. */
  to_whatsapp?: string | null
}

export type ModelUsage = { promptTokens: number; completionTokens: number }

const MODEL = () => process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"

const SYSTEM = `You write the messages a property consultant at FHI Global (a Dubai real estate brokerage) sends to a client about one project. You are given the FACTS and the BRIEF; write ONE message.

Rules:
- Use ONLY the facts given. Never invent or round a price, a date, a return, an availability, a discount or a payment term. If a fact is missing (no payment plan, no handover date), simply leave it out — never say "typically" or guess.
- Write in the requested language (default English), in a warm, confident, personal tone — one professional talking to one person, never a sales broadcast. No clichés like "don't miss out", no pressure, no exclamation marks in a row.
- WhatsApp: 70 to 130 words, short lines, blank lines between thoughts, at most one emoji and only if it fits. Open with the client's name exactly as greet_as gives it (a first name, or title and surname) when given, else "Hi!". Mention the project's strongest two or three facts (from price, payment plan or down payment, handover, area), include the link once on its own line, close with ONE clear next step (a call, a viewing, the brochure, a reply) and sign with the agent's first name, FHI Global.
- Email: a subject line in the same language as the body, then 120 to 180 words in two or three short paragraphs: greeting (greet_as when given), the project in facts, the next step; sign off with the agent's full name, role, FHI Global, and the WhatsApp number. Include the link once.
- Plain text only: no markdown, no asterisks, no bullet symbols other than "-", no headings.
- The purpose in the BRIEF decides the angle (introduction, follow-up, payment plan, invitation, price update); keep to it. Never assume anything the brief does not say — no earlier call, meeting, viewing or conversation, no "as discussed", no "as promised". With no purpose given, simply introduce the project.

Answer with JSON: {"subject": string or null, "text": string}.`

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name

const HONORIFIC = /^(mr|mrs|ms|miss|mx|dr|prof|sir|madam|ma'am|engr|atty|arch|hon|sheikh|sheikha|kuya|ate|tita|tito|sr|sra|mme|m)\.?$/i
/** "Maria Santos" → "Maria"; "Mr Santos" / "Dr. Ahmed Al Marri" → "Mr Santos" / "Dr. Al Marri" — the greeting form, never a bare "Mr". */
function greetingName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1 && HONORIFIC.test(parts[0])) return `${parts[0]} ${parts[parts.length - 1]}`
  return parts[0] ?? name
}

/** The brochure's facts, trimmed to what a message can use. */
function facts(b: Brochure) {
  const p = b.project
  const plan = b.plan.milestones.length ? b.plan.milestones.map((m) => `${m.percent}% ${m.label}`).join(", ") : null
  return {
    project: p.name,
    developer: p.developer,
    area: p.area,
    status: p.status,
    off_plan: p.offPlan,
    handover: p.handover,
    price_from: p.priceFrom,
    price_range: p.priceRange,
    unit_mix: p.mix,
    sizes: p.sizes,
    cheapest_units: b.units.filter((u) => u.price).slice(0, 3).map((u) => `${u.type}${u.size ? ` (${u.size})` : ""}: ${u.price}`),
    payment_plan: plan,
    down_payment_percent: b.plan.downPayment,
    payment_note: b.plan.note,
    highlights: b.highlights.slice(0, 3),
    amenities: b.amenities.slice(0, 5),
    link: b.agent.shareUrl ?? p.page,
    link_is: b.agent.shareUrl ? "the project on the agent's own website" : "the project page on fhiglobal.ae",
    agent: { first_name: first(b.agent.name), full_name: b.agent.name, role: b.agent.role, whatsapp: b.agent.whatsapp, website: b.agent.website },
  }
}

const unmark = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`/g, "").trim()

/** One JSON-mode call on the chat model: the system rules, the facts and the brief → { subject, text }, with the tokens it used. */
async function writeMessage(system: string, facts: unknown, brief: unknown): Promise<{ ok: true; subject: string | null; text: string; usage: ModelUsage } | { ok: false; usage: ModelUsage }> {
  const usage: ModelUsage = { promptTokens: 0, completionTokens: 0 }
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return { ok: false, usage }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL(),
        temperature: 0.5,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `FACTS:\n${JSON.stringify(facts)}\n\nBRIEF:\n${JSON.stringify(brief)}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { ok: false, usage }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    usage.promptTokens = Number(json.usage?.prompt_tokens) || 0
    usage.completionTokens = Number(json.usage?.completion_tokens) || 0
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { subject?: unknown; text?: unknown }
    const text = typeof parsed.text === "string" ? unmark(parsed.text) : ""
    if (!text) return { ok: false, usage }
    const subject = typeof parsed.subject === "string" && parsed.subject.trim() ? unmark(parsed.subject).slice(0, 120) : null
    return { ok: true, subject, text, usage }
  } catch {
    return { ok: false, usage }
  }
}

// ─── A message to a team member (team leaders) ───────────────────────────────

const MEMBER_SYSTEM = `You write the WhatsApp messages a team leader at FHI Global (a Dubai real estate brokerage) sends to one agent in their own team. You are given the FACTS about that member and the BRIEF; write ONE message from the leader to the member.

Rules:
- Use ONLY the facts given: their deals, pending deals, how long since their last sale, when they joined. Never invent a figure, a commission, a target the leader did not set, or a conversation that did not happen.
- Warm, personal and short: 50 to 110 words, short lines, blank lines between thoughts, at most one emoji. One leader talking to one person they know — never a broadcast, never a lecture, never shaming. Praise what the facts support; where the facts show a gap, say it kindly and offer concrete help (a call, joining a client meeting, a project to pitch, the next event).
- Open with the member's first name. Close with ONE clear next step (a call tomorrow, a reply, a time to meet) and sign with the leader's first name.
- Write in the requested language (default English). Plain text only: no markdown, no asterisks, no headings.
- The purpose in the BRIEF decides the angle (encouragement, a pending deal, a quiet spell, a welcome, congratulations); keep to it.

Answer with JSON: {"subject": null, "text": string}.`

export type MemberFacts = {
  member: { first_name: string; full_name: string; role: string | null; joined_fhi: string | null; days_with_fhi: number | null }
  last_90_days: { validated_deals: number; validated_value: string; pending_deals: number }
  last_validated_sale: string | null
  days_since_last_sale: number | null
  pending_deals: Array<{ project: string; date: string; days_waiting: number }>
  rank_in_team_last_90_days: number | null
  leader: { first_name: string; full_name: string }
}

/** The leader's message to a member, from the member's own figures; `to_whatsapp` lets the card open that member's chat. */
export async function buildMemberMessage(
  facts: MemberFacts,
  args: { purpose?: string; language?: string },
  toWhatsappDigits: string | null,
): Promise<{ result: Record<string, unknown>; usage: ModelUsage | null }> {
  const brief = { language: args.language?.trim() || "English", purpose: args.purpose?.trim() || "check in, encourage, and offer help" }
  const out = await writeMessage(MEMBER_SYSTEM, facts, brief)
  if (!out.ok) return { result: { error: "Couldn't write the message just now — try again" }, usage: out.usage }
  const draft: ClientDraft = { kind: "message", channel: "whatsapp", project: "Team", client: facts.member.full_name, language: brief.language, subject: null, text: out.text, image: null, to_whatsapp: toWhatsappDigits }
  return {
    result: {
      member: facts.member.full_name,
      language: brief.language,
      message: "ready",
      facts_used: [
        `${facts.last_90_days.validated_deals} validated deal${facts.last_90_days.validated_deals === 1 ? "" : "s"} in the last 90 days`,
        facts.pending_deals.length ? `${facts.pending_deals.length} pending` : null,
        facts.days_since_last_sale != null ? `${facts.days_since_last_sale} days since their last sale` : "no validated sale yet",
      ].filter(Boolean),
      opens_their_chat: Boolean(toWhatsappDigits),
      how_to_answer: "Say the message is ready below — the card has Copy and Send buttons (Send opens the member's WhatsApp when their number is on file) — and in ONE line which facts it uses. Do NOT repeat or paraphrase the message. Offer to change the tone, language or angle.",
      _drafts: [draft],
    },
    usage: out.usage,
  }
}

/**
 * Finds the project, loads the facts as the brochure does, and writes the
 * message. Returns what the chat model reads (`result`) with the card in
 * `_drafts`, plus the tokens this extra call used so the question's cost
 * counts them.
 */
export async function buildClientMessage(
  admin: Admin,
  caller: { userId: string },
  args: ClientMessageArgs,
): Promise<{ result: Record<string, unknown>; usage: ModelUsage | null }> {
  const q = (args.project ?? "").trim()
  if (!q) return { result: { error: "Which project is the message about? Give its name." }, usage: null }
  const found = await findBrochureProject(admin, q)
  if (!found) return { result: { error: `No published project matching "${q}"` }, usage: null }
  const b = await loadBrochure(admin, found.id, { userId: caller.userId, email: null })
  if (!b) return { result: { error: `No published project matching "${q}"` }, usage: null }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return { result: { error: "The assistant is not configured to write messages right now" }, usage: null }
  const channel: ClientMessageChannel = (args.channel ?? "").toLowerCase().includes("mail") ? "email" : "whatsapp"
  const language = args.language?.trim() || "English"
  const client = args.client_name?.trim() || null
  const brief = {
    channel,
    language,
    client_name: client,
    greet_as: client ? greetingName(client) : null,
    purpose: args.purpose?.trim() || "introduce the project and invite a reply",
  }

  const model = MODEL()
  let text = ""
  let subject: string | null = null
  const usage: ModelUsage = { promptTokens: 0, completionTokens: 0 }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `FACTS:\n${JSON.stringify(facts(b))}\n\nBRIEF:\n${JSON.stringify(brief)}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { result: { error: "Couldn't write the message just now — try again" }, usage }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    usage.promptTokens = Number(json.usage?.prompt_tokens) || 0
    usage.completionTokens = Number(json.usage?.completion_tokens) || 0
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { subject?: unknown; text?: unknown }
    text = typeof parsed.text === "string" ? unmark(parsed.text) : ""
    subject = channel === "email" && typeof parsed.subject === "string" && parsed.subject.trim() ? unmark(parsed.subject).slice(0, 120) : null
  } catch {
    return { result: { error: "Couldn't write the message just now — try again" }, usage }
  }
  if (!text) return { result: { error: "Couldn't write the message just now — try again" }, usage }
  // The link is the point of the message: make sure it is there.
  const link = b.agent.shareUrl ?? b.project.page
  if (!text.includes(link)) text = `${text}\n\n${link}`

  const draft: ClientDraft = { kind: "message", channel, project: b.project.name, client, language, subject, text, image: b.project.image }
  const used = [
    b.project.priceFrom ? `from price ${b.project.priceFrom}` : null,
    b.plan.milestones.length ? "the payment plan" : b.plan.downPayment ? `${b.plan.downPayment}% down payment` : null,
    b.project.handover ? `handover ${b.project.handover}` : null,
    b.agent.shareUrl ? "the project on your website" : "the project page",
  ].filter(Boolean)
  return {
    result: {
      project: b.project.name,
      developer: b.project.developer,
      channel,
      language,
      client,
      ...(found.others.length ? { other_matches: found.others } : {}),
      message: "ready",
      facts_used: used,
      missing: [!b.project.priceFrom ? "no price on file" : null, !b.plan.milestones.length && !b.plan.downPayment ? "no payment plan on file" : null, !b.project.handover ? "no handover date on file" : null].filter(Boolean),
      how_to_answer: "Say the message is ready below — the card has Copy and Send buttons — and in ONE line which facts it uses (facts_used) and anything in `missing`. Do NOT repeat or paraphrase the message text; the card shows it. Offer to adjust the tone, the language or the angle.",
      _drafts: [draft],
    },
    usage,
  }
}
