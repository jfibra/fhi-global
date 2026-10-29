import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest } from "@/lib/rate-limit"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { deleteS3ObjectsByUrl } from "@/lib/s3-transit"
import { A2AInputSchema, a2aSchemaError } from "@/lib/a2a-agreements/schema"
import { missingForSubmit, partyNames } from "@/lib/a2a-agreements/shared"
import {
  A2A_DOCS_BUCKET,
  A2A_ROLES,
  AGREEMENT_META_COLUMNS,
  loadAgreementAccess,
} from "@/lib/a2a-agreements/server"

/**
 * One saved A2A agreement (migration 082).
 *
 * PATCH — the creator's state changes, each a conditional update so a stale or
 * repeated request answers 409 instead of silently flipping the status:
 *   save      draft only: replace the form data.
 *   submit    draft → submitted ("Completed" on the page — Save & Download
 *             Agreement PDF), after the same rules as the download (names + scope).
 *   withdraw  submitted → draft ("Edit again"); status only.
 * A draft save never carries a status, so a late one can't reopen or complete anything.
 *
 * DELETE — the creator deletes a draft; admin staff delete a completed
 * agreement. Files go from S3 and the transit bucket first, then the row
 * (file rows cascade).
 */
export const runtime = "nodejs"

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), data: A2AInputSchema }),
  z.object({ action: z.literal("submit"), data: A2AInputSchema }),
  z.object({ action: z.literal("withdraw") }),
])

const NOT_FOUND = () => NextResponse.json({ error: "Agreement not found." }, { status: 404 })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id } = await params

  if (!allowRequest(`a2a-write:${userId}`, 120, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many saves — please wait a moment." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: a2aSchemaError(parsed.error) }, { status: 400 })
  const input = parsed.data

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  // Someone else's agreement is "not found" — never confirm it exists.
  if (!access || !access.isOwner) return NOT_FOUND()

  const now = new Date().toISOString()
  const fromStatus = input.action === "withdraw" ? "submitted" : "draft"
  if (input.action === "submit") {
    const missing = missingForSubmit(input.data)
    if (missing.length > 0) {
      return NextResponse.json({ error: "Some required details are missing.", missing }, { status: 422 })
    }
  }
  const patch =
    input.action === "save"
      ? { data: input.data, party_names: partyNames(input.data), updated_at: now }
      : input.action === "submit"
        ? { data: input.data, party_names: partyNames(input.data), status: "submitted", submitted_at: now, updated_at: now }
        : { status: "draft", submitted_at: null, updated_at: now }

  const { data: row, error } = await admin
    .from("a2a_agreements")
    .update(patch)
    .eq("id", id)
    .eq("created_by", userId)
    .eq("status", fromStatus)
    .select(AGREEMENT_META_COLUMNS)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Could not save the agreement. Please try again." }, { status: 500 })
  if (!row) {
    // The status moved on since the page loaded it (another tab, a repeat
    // click): the update matched nothing, so it's the other status now.
    const status = fromStatus === "draft" ? "submitted" : "draft"
    return NextResponse.json(
      {
        error:
          status === "submitted"
            ? "This agreement is already completed — press Edit again to change it."
            : "This agreement is already a draft.",
        status,
      },
      { status: 409 },
    )
  }

  if (input.action !== "save") {
    const label = row.party_names || "Untitled A2A agreement"
    await logAuditEvent({
      category: "a2a_agreements",
      event: input.action === "submit" ? "completed" : "reopened",
      source: "dashboard",
      actor: { id: userId, name: profile.fullname, role: profile.role },
      subjectType: "a2a_agreements",
      subjectId: id,
      subjectLabel: label,
      description:
        input.action === "submit"
          ? `Completed the A2A agreement "${label}" (saved and downloaded the PDF)`
          : `Reopened the completed A2A agreement "${label}" as a draft (Edit again)`,
      ...requestContextFromRequest(req),
    })
  }

  return NextResponse.json({ agreement: row })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id } = await params

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  if (!access) return NOT_FOUND()
  const { agreement, isOwner, isStaff } = access
  const allowed = (isOwner && agreement.status === "draft") || (isStaff && agreement.status === "submitted")
  if (!allowed) {
    if (!isOwner) return NOT_FOUND()
    return NextResponse.json(
      { error: "Completed agreements can only be deleted by an admin — press Edit again first to delete it yourself." },
      { status: 409 },
    )
  }

  // Files first (best-effort), then the row; the file rows cascade with it.
  const { data: files } = await admin.from("a2a_agreement_files").select("file_url").eq("agreement_id", id)
  await deleteS3ObjectsByUrl((files ?? []).map((f) => f.file_url as string))
  // Uploads that never got registered still sit in the private transit folder.
  try {
    const { data: leftovers } = await admin.storage.from(A2A_DOCS_BUCKET).list(id, { limit: 1000 })
    const paths = (leftovers ?? []).map((o) => `${id}/${o.name}`)
    if (paths.length > 0) await admin.storage.from(A2A_DOCS_BUCKET).remove(paths)
  } catch {
    /* best-effort — the folder is private */
  }

  const { error } = await admin.from("a2a_agreements").delete().eq("id", id)
  if (error) return NextResponse.json({ error: "Could not delete the agreement. Please try again." }, { status: 500 })

  const label = agreement.party_names || "Untitled A2A agreement"
  await logAuditEvent({
    category: "a2a_agreements",
    event: "deleted",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname, role: profile.role },
    subjectType: "a2a_agreements",
    subjectId: id,
    subjectLabel: label,
    description: `Deleted the ${agreement.status === "submitted" ? "completed" : "draft"} A2A agreement "${label}" and its ${(files ?? []).length} document(s)`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
