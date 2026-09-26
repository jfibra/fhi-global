import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { COUNTRY_CODES } from "@/lib/user-service"
import { BUDGET_OPTIONS, BUYER_LINK_CODE_RE, BUYER_LINK_MAX_PROJECTS, CONTACT_TIME_OPTIONS } from "@/lib/buyer-links"

/**
 * A client's details from a Buyers Link page (/b/<code>, migration 060).
 * Public by design: Zod-validated, honeypot-guarded, per-IP rate-limited, and
 * inserted on the service role (the table has no client write path). The
 * owning agent is read from the link, never from the request; the ticked
 * projects are narrowed to the link's own. The agent sees it on their Buyers
 * Link page (no email for now).
 */

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIAL_CODES = new Set(COUNTRY_CODES.map((c) => c.value))
const BUDGETS = new Set<string>(BUDGET_OPTIONS.map((o) => o.value))
const CONTACT_TIMES = new Set<string>(CONTACT_TIME_OPTIONS.map((o) => o.value))

const LeadSchema = z.object({
  code: z.string().regex(BUYER_LINK_CODE_RE, "This link is not valid."),
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  whatsappCode: z.string().refine((v) => DIAL_CODES.has(v), "Pick a valid country code."),
  whatsapp: z.string().trim().regex(/^[0-9 ()-]{4,20}$/, "Please enter a valid WhatsApp number."),
  email: z.string().trim().max(320).optional().default("").refine((v) => !v || EMAIL_RE.test(v), "Please enter a valid email."),
  budget: z.string().optional().default("").refine((v) => !v || BUDGETS.has(v), "Pick a budget from the list."),
  contactTime: z.string().optional().default("").refine((v) => !v || CONTACT_TIMES.has(v), "Pick a time from the list."),
  message: z.string().trim().max(2000, "Keep the message under 2,000 characters.").optional().default(""),
  projectIds: z.array(z.number().int().positive()).max(BUYER_LINK_MAX_PROJECTS).optional().default([]),
  website: z.string().optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest) {
  if (!allowRequest(`buyer-lead:${clientIp(req.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests — please try again in a few minutes." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = LeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form and try again." }, { status: 400 })
  }
  const data = parsed.data
  // Bots fill the hidden field; pretend it worked and keep nothing.
  if (data.website) return NextResponse.json({ ok: true })

  const admin = createAdminSupabase()
  const { data: link } = await admin
    .from("buyer_links")
    .select("id, agent_id, title, project_ids, is_active")
    .eq("code", data.code)
    .maybeSingle<{ id: string; agent_id: string; title: string; project_ids: number[]; is_active: boolean }>()
  const { data: agent } = link
    ? await admin
        .from("profiles")
        .select("id, role, status, is_deleted")
        .eq("id", link.agent_id)
        .maybeSingle<{ id: string; role: string | null; status: string | null; is_deleted: boolean | null }>()
    : { data: null }
  if (!link || !link.is_active || !agent || agent.is_deleted || agent.status !== "active" || !canUseBuyerLinks(agent.role)) {
    return NextResponse.json({ error: "This link is no longer active." }, { status: 404 })
  }

  const offered = new Set(link.project_ids)
  const ticked = data.projectIds.filter((id) => offered.has(id))
  const projectIds = ticked.length > 0 ? ticked : link.project_ids

  const { error } = await admin.from("buyer_link_leads").insert({
    link_id: link.id,
    agent_id: link.agent_id,
    name: data.name,
    whatsapp_code: data.whatsappCode,
    whatsapp: data.whatsapp,
    email: data.email || null,
    budget: data.budget || null,
    contact_time: data.contactTime || null,
    message: data.message || null,
    project_ids: projectIds,
    ip_address: clientIp(req.headers),
    user_agent: req.headers.get("user-agent"),
  })
  if (error) {
    console.error("[buyer-links/lead] insert failed:", error.message)
    return NextResponse.json({ error: "Could not send your details — please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
