import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { hasMailerConfig, sendLeadInquiryEmail } from "@/lib/mailer"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import { COUNTRY_CODES } from "@/lib/user-service"
import { SITE_URL } from "@/lib/seo"

/**
 * Public "Inquire Now" lead endpoint (project pages). Unauthenticated by
 * design; inserts run through the service-role client (the inquiries table has
 * no client write path). Zod-validated, honeypot-guarded, per-IP rate-limited.
 * The project name/developer snapshot is resolved SERVER-SIDE from projectId —
 * a caller can never inject those strings. Admin staff are emailed
 * best-effort; a mail failure never loses the lead.
 */

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIAL_CODES = new Set(COUNTRY_CODES.map((c) => c.value))

const LOOKING_FOR_LABELS: Record<string, string> = {
  myself: "Looking for myself",
  agent: "I'm an agent",
}
const CATEGORY_LABELS: Record<string, string> = {
  off_plan: "Off Plan",
  ready: "Ready",
  rent: "Rent",
}

const InquirySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().max(320).regex(EMAIL_RE, "Please enter a valid email."),
  phoneCountryCode: z.string().refine((v) => DIAL_CODES.has(v), "Pick a valid country code."),
  phone: z.string().trim().regex(/^[0-9 ()-]{4,20}$/, "Please enter a valid phone number."),
  lookingFor: z.enum(["myself", "agent"], { message: "Tell us who you're looking for." }),
  propertyCategory: z.enum(["off_plan", "ready", "rent"], { message: "Pick a property category." }),
  projectId: z.number().int().positive().optional(),
  website: z.string().optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const parsed = InquirySchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check the form and try again."
    return NextResponse.json({ error: first }, { status: 400 })
  }
  const data = parsed.data

  // Bot filled the hidden field — silently accept without storing.
  if (data.website.trim() !== "") {
    return NextResponse.json({ ok: true })
  }

  if (!allowRequest(`inquiry:${clientIp(req.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many inquiries — please try again later." }, { status: 429 })
  }

  const admin = createAdminSupabase()

  // Server-side project snapshot — never trust client-sent names. An unknown
  // id just stores the lead without project context.
  let projectId: number | null = null
  let projectName: string | null = null
  let developerName: string | null = null
  if (data.projectId) {
    const { data: project } = await admin
      .from("projects")
      .select("id, name, developers(name)")
      .eq("id", data.projectId)
      .is("deleted_at", null)
      .maybeSingle()
    if (project) {
      projectId = Number(project.id)
      projectName = typeof project.name === "string" ? project.name : null
      const dev = Array.isArray(project.developers) ? project.developers[0] : project.developers
      developerName = typeof (dev as { name?: unknown } | null)?.name === "string"
        ? ((dev as { name: string }).name)
        : null
    }
  }

  const ctx = requestContextFromRequest(req)
  const { data: inserted, error } = await admin
    .from("inquiries")
    .insert({
      name: data.name,
      email: data.email,
      phone_country_code: data.phoneCountryCode,
      phone: data.phone,
      looking_for: data.lookingFor,
      property_category: data.propertyCategory,
      project_id: projectId,
      project_name: projectName,
      developer_name: developerName,
      source: "project_page",
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[inquiries] insert failed:", error.message)
    return NextResponse.json({ error: "Could not send your inquiry. Please try again." }, { status: 500 })
  }

  await logAuditEvent({
    category: "inquiry",
    event: "created",
    source: "app",
    subjectType: "inquiries",
    subjectId: inserted.id,
    subjectLabel: data.name,
    description: `New lead from ${data.name} <${data.email}>${projectName ? ` about ${projectName}` : ""}`,
    ...ctx,
  })

  // Best-effort admin notification — a mail hiccup must never lose the lead.
  if (hasMailerConfig()) {
    try {
      const { data: admins } = await admin
        .from("profiles")
        .select("id, fullname, role")
        .in("role", [...ROLES_ADMIN_STAFF])
      const lead = {
        name: data.name,
        email: data.email,
        phone: `${data.phoneCountryCode} ${data.phone}`,
        lookingFor: LOOKING_FOR_LABELS[data.lookingFor] ?? data.lookingFor,
        propertyCategory: CATEGORY_LABELS[data.propertyCategory] ?? data.propertyCategory,
        projectName,
        developerName,
      }
      await Promise.all(
        (admins ?? []).map(async (a) => {
          const authUser = await admin.auth.admin.getUserById(String(a.id)).catch(() => null)
          const to = authUser?.data?.user?.email
          if (!to) return
          await sendLeadInquiryEmail({
            to,
            adminName: typeof a.fullname === "string" ? a.fullname : null,
            lead,
            // Deep-link to this specific lead: the /leads/[id] route forwards to
            // the inbox with the conversation open (see LeadDetailClient).
            dashboardUrl: `${SITE_URL}${getDashboardRouteByRole(a.role as string)}/leads/${inserted.id}`,
          }).catch(() => {})
        }),
      )
    } catch (e) {
      console.error("[inquiries] admin notification failed:", e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true })
}
