import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { allowRequest } from "@/lib/rate-limit"
import { COUNTRY_CODES } from "@/lib/user-service"
import { CATEGORY_LABELS, LOOKING_FOR_LABELS } from "@/lib/inquiries-service"
import { CHAT_SOURCE } from "@/lib/lead-source"
import { notifyAdminsOfLead } from "@/lib/lead-notify"
import { siteChatTranscript } from "@/lib/site-chat-usage"
import { SITE_URL } from "@/lib/seo"

/**
 * "Talk to a consultant" in the website chat (boss via Juliecor, 2026-11-06):
 * the visitor's name, email, WhatsApp number and what they're after become an
 * ordinary inquiry (source "chat") — it lands in Emails like every Inquire
 * Now lead and every admin gets the usual email. The conversation excerpt
 * the lead came from is built HERE from our own record of the chat
 * (site_chat_messages), never from the browser, so it can't be forged; the
 * project it names is the last one the chat showed, resolved server-side.
 * Honeypot-guarded and per-IP rate-limited like the other public forms.
 */

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIAL_CODES = new Set(COUNTRY_CODES.map((c) => c.value))

const Body = z.object({
  session: z.string().regex(UUID_RE),
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().max(320).regex(EMAIL_RE, "Please enter a valid email."),
  phoneCountryCode: z.string().refine((v) => DIAL_CODES.has(v), "Pick a valid country code."),
  phone: z.string().trim().regex(/^[0-9 ()-]{4,20}$/, "Please enter a valid WhatsApp number."),
  category: z.enum(["off_plan", "ready", "rent"], { message: "Tell us what you're looking for." }),
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  website: z.string().max(200).optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form and try again." }, { status: 400 })
  const data = parsed.data

  // Bot filled the hidden field — silently accept without storing.
  if (data.website.trim() !== "") return NextResponse.json({ ok: true })

  const ctx = requestContextFromRequest(req)
  if (!allowRequest(`site-chat-lead:${ctx.ip ?? "unknown"}`, 3, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests — please try again later, or message us on WhatsApp." }, { status: 429 })
  }

  const admin = createAdminSupabase()

  // The conversation this lead came from — our record, never the browser's.
  let transcript: Awaited<ReturnType<typeof siteChatTranscript>> = []
  try {
    transcript = await siteChatTranscript(admin, data.session, 8)
  } catch {
    // The lead still lands without its context.
  }
  const page = data.page ?? transcript[transcript.length - 1]?.page ?? null
  const message = transcript.length
    ? [`Left in the website chat${page ? ` on ${page}` : ""}:`, "", ...transcript.flatMap((t) => [`Visitor: ${t.question}`, `FHI Assistant: ${(t.answer ?? "").replace(/\s+/g, " ").slice(0, 400)}`, ""])].join("\n").trim()
    : `Left their details in the website chat${page ? ` on ${page}` : ""} without asking a question.`

  // The last project the chat showed them, resolved by name on the server.
  let projectId: number | null = null
  let projectName: string | null = null
  let developerName: string | null = null
  const named = [...transcript].reverse().flatMap((t) => t.projects)[0]
  if (named) {
    const { data: project } = await admin.from("projects").select("id, name, developers(name)").eq("name", named).is("deleted_at", null).limit(1).maybeSingle()
    if (project) {
      projectId = Number(project.id)
      projectName = typeof project.name === "string" ? project.name : null
      const dev = Array.isArray(project.developers) ? project.developers[0] : project.developers
      developerName = typeof (dev as { name?: unknown } | null)?.name === "string" ? (dev as { name: string }).name : null
    }
  }

  const row = {
    name: data.name,
    email: data.email,
    phone_country_code: data.phoneCountryCode,
    phone: data.phone,
    looking_for: "myself",
    property_category: data.category,
    project_id: projectId,
    project_name: projectName,
    developer_name: developerName,
    source: CHAT_SOURCE,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
  }
  let inserted = await admin.from("inquiries").insert({ ...row, message, chat_session_id: data.session }).select("id").single()
  // 42703 = migration 083 not applied yet: the lead still lands, without its chat columns.
  if (inserted.error?.code === "42703") inserted = await admin.from("inquiries").insert(row).select("id").single()
  if (inserted.error || !inserted.data) {
    console.error("[site-chat/lead] insert failed:", inserted.error?.message)
    return NextResponse.json({ error: "Could not send your details. Please try again, or message us on WhatsApp." }, { status: 500 })
  }
  const id = String(inserted.data.id)

  await logAuditEvent({
    category: "inquiry",
    event: "created",
    source: "app",
    subjectType: "inquiries",
    subjectId: id,
    subjectLabel: data.name,
    description: `New lead from ${data.name} <${data.email}> in the website chat${projectName ? ` about ${projectName}` : ""}${page ? ` (${page})` : ""}`,
    ...ctx,
  })

  await notifyAdminsOfLead(admin, id, {
    name: data.name,
    email: data.email,
    phone: `${data.phoneCountryCode} ${data.phone}`,
    lookingFor: LOOKING_FOR_LABELS.myself,
    propertyCategory: CATEGORY_LABELS[data.category] ?? data.category,
    projectName,
    developerName,
    pageLabel: "Website chat",
    pageUrl: page ? `${SITE_URL}${page}` : null,
    message,
  })

  return NextResponse.json({ ok: true })
}
