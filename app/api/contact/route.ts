import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Public contact form endpoint. Unauthenticated by design; inserts run through
// the service-role client (the contact_submissions table has no client write
// path). Zod-validated, with a honeypot field to drop obvious bots.

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().max(320).regex(EMAIL_RE, "Please enter a valid email."),
  phone: z.string().trim().max(50).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1, "Please enter a message.").max(5000),
  website: z.string().optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check the form and try again."
    return NextResponse.json({ error: first }, { status: 400 })
  }
  const data = parsed.data

  // Bot filled the hidden field — silently accept without storing.
  if (data.website.trim() !== "") {
    return NextResponse.json({ ok: true })
  }

  const ctx = requestContextFromRequest(req)
  const admin = createAdminSupabase()
  const { data: inserted, error } = await admin
    .from("contact_submissions")
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone.trim() || null,
      company: data.company.trim() || null,
      subject: data.subject.trim() || null,
      message: data.message,
      source: "contact_page",
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[contact] insert failed:", error.message)
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 500 })
  }

  await logAuditEvent({
    category: "contact",
    event: "created",
    source: "app",
    subjectType: "contact_submissions",
    subjectId: inserted.id,
    subjectLabel: data.name,
    description: `New contact inquiry${data.subject.trim() ? ` (${data.subject.trim()})` : ""} from ${data.name} <${data.email}>`,
    ...ctx,
  })

  return NextResponse.json({ ok: true })
}
