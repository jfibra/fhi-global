import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest } from "@/lib/rate-limit"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { A2AInputSchema, a2aSchemaError } from "@/lib/a2a-agreements/schema"
import { missingForSubmit, partyNames } from "@/lib/a2a-agreements/shared"
import { A2A_ROLES, AGREEMENT_META_COLUMNS } from "@/lib/a2a-agreements/server"

/**
 * Save a new A2A agreement (migration 082) for the signed-in user — as a draft,
 * or straight to Completed (status 'submitted', from Save & Download Agreement
 * PDF) when the form passes the same rules as the download. The first
 * attachment on a never-saved agreement also lands here (as a draft), so the
 * file has a record to belong to. The owner is always the session user.
 */
export const runtime = "nodejs"

const BodySchema = z.object({
  data: A2AInputSchema,
  submit: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context

  if (!allowRequest(`a2a-write:${userId}`, 120, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many saves — please wait a moment." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: a2aSchemaError(parsed.error) }, { status: 400 })
  const { data, submit = false } = parsed.data

  if (submit) {
    const missing = missingForSubmit(data)
    if (missing.length > 0) {
      return NextResponse.json({ error: "Some required details are missing.", missing }, { status: 422 })
    }
  }

  const now = new Date().toISOString()
  const admin = createAdminSupabase()
  const { data: row, error } = await admin
    .from("a2a_agreements")
    .insert({
      created_by: userId,
      status: submit ? "submitted" : "draft",
      data,
      party_names: partyNames(data),
      submitted_at: submit ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select(AGREEMENT_META_COLUMNS)
    .single()
  if (error || !row) {
    return NextResponse.json({ error: "Could not save the agreement. Please try again." }, { status: 500 })
  }

  const label = partyNames(data) || "Untitled A2A agreement"
  await logAuditEvent({
    category: "a2a_agreements",
    event: submit ? "completed" : "created",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname, role: profile.role },
    subjectType: "a2a_agreements",
    subjectId: row.id,
    subjectLabel: label,
    description: submit
      ? `Completed the A2A agreement "${label}" (saved and downloaded the PDF)`
      : `Saved a draft A2A agreement "${label}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ agreement: row })
}
