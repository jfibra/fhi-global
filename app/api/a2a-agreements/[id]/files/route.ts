import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest } from "@/lib/rate-limit"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { deleteS3ObjectsByUrl, moveTransitFileToS3, removeTransitFile } from "@/lib/s3-transit"
import {
  A2A_DOC_LABELS,
  A2A_MAX_FILES_PER_AGREEMENT,
  A2A_MAX_FILES_PER_SLOT,
} from "@/lib/a2a-agreements/shared"
import {
  A2A_DOCS_BUCKET,
  A2A_ROLES,
  A2A_S3_PREFIX,
  FILE_COLUMNS,
  a2aFileUrl,
  isAcceptableA2AFile,
  loadAgreementAccess,
  parseA2ATransitPath,
} from "@/lib/a2a-agreements/server"

/**
 * Documents on the caller's own A2A agreement (migration 082).
 *
 * POST — register a file the browser just uploaded to the private transit
 * bucket: read party / document type / extension from the server-chosen path
 * (never from the body), refuse a path already registered (a reused signed
 * URL), re-check the caps, move the bytes to S3 after checking they really are
 * a JPG / PNG / PDF within the size limit, then insert the row — deleting the
 * S3 object again if the insert fails. Every failure removes the transit copy.
 *
 * DELETE ?party=A|B|C — remove all of one party's documents (Remove Party C on
 * a draft), S3 objects included.
 */
export const runtime = "nodejs"
// Downloads the transit copy and re-uploads it to S3 — allow room for 25 MB.
export const maxDuration = 60

const BodySchema = z.object({
  path: z.string().min(1).max(256),
  fileName: z.string().trim().min(1).max(300),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id } = await params

  if (!allowRequest(`a2a-register:${userId}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many uploads — please try again in a few minutes." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload." }, { status: 400 })
  const { path, fileName } = parsed.data

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  if (!access || !access.isOwner) return NextResponse.json({ error: "Agreement not found." }, { status: 404 })

  const slot = parseA2ATransitPath(path, id)
  if (!slot) return NextResponse.json({ error: "Invalid upload." }, { status: 400 })
  const fail = async (error: string, status: number) => {
    await removeTransitFile(admin, A2A_DOCS_BUCKET, path)
    return NextResponse.json({ error }, { status })
  }

  const fileUrl = a2aFileUrl(path)
  const { data: existing } = await admin
    .from("a2a_agreement_files")
    .select("party, doc_type, file_url")
    .eq("agreement_id", id)
  const rows = existing ?? []
  if (rows.some((r) => r.file_url === fileUrl)) return fail("This file is already attached.", 409)
  if (rows.length >= A2A_MAX_FILES_PER_AGREEMENT) {
    return fail(`An agreement can hold up to ${A2A_MAX_FILES_PER_AGREEMENT} files.`, 409)
  }
  if (rows.filter((r) => r.party === slot.party && r.doc_type === slot.docType).length >= A2A_MAX_FILES_PER_SLOT) {
    return fail(`This box already has ${A2A_MAX_FILES_PER_SLOT} files.`, 409)
  }

  const moved = await moveTransitFileToS3(admin, {
    bucket: A2A_DOCS_BUCKET,
    path,
    keyPrefix: A2A_S3_PREFIX,
    check: (bytes) => isAcceptableA2AFile(bytes, slot.ext),
  })
  if (moved.error === "missing") {
    return NextResponse.json({ error: "The upload didn't arrive — please try again." }, { status: 404 })
  }
  if (moved.error === "rejected") {
    return NextResponse.json({ error: "That file isn't a readable JPG, PNG or PDF under 25 MB." }, { status: 415 })
  }
  if (moved.error) return fail("Couldn't store the file — please try again.", 502)

  const { data: row, error } = await admin
    .from("a2a_agreement_files")
    .insert({
      agreement_id: id,
      party: slot.party,
      doc_type: slot.docType,
      file_name: fileName,
      file_url: moved.url,
      file_type: slot.ext === "pdf" ? "pdf" : "image",
      file_size: moved.size,
      uploaded_by: userId,
    })
    .select(FILE_COLUMNS)
    .single()
  if (error || !row) {
    await deleteS3ObjectsByUrl([moved.url])
    return NextResponse.json(
      { error: error?.code === "23505" ? "This file is already attached." : "Couldn't attach the file — please try again." },
      { status: error?.code === "23505" ? 409 : 500 },
    )
  }

  const docLabel = A2A_DOC_LABELS[slot.docType].label
  const label = access.agreement.party_names || "Untitled A2A agreement"
  await logAuditEvent({
    category: "a2a_agreements",
    event: "document_uploaded",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname, role: profile.role },
    subjectType: "a2a_agreements",
    subjectId: id,
    subjectLabel: label,
    description: `Attached ${docLabel}${slot.party ? ` (Party ${slot.party})` : ""} to the A2A agreement "${label}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ file: row })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id } = await params

  const party = req.nextUrl.searchParams.get("party")
  if (party !== "A" && party !== "B" && party !== "C") {
    return NextResponse.json({ error: "Invalid party." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  if (!access || !access.isOwner) return NextResponse.json({ error: "Agreement not found." }, { status: 404 })
  if (access.agreement.status !== "draft") {
    return NextResponse.json({ error: "Press Edit again before changing the parties." }, { status: 409 })
  }

  const { data: files, error: readErr } = await admin
    .from("a2a_agreement_files")
    .select("id, file_url")
    .eq("agreement_id", id)
    .eq("party", party)
  if (readErr) return NextResponse.json({ error: "Could not remove the documents. Please try again." }, { status: 500 })
  const list = files ?? []
  if (list.length === 0) return NextResponse.json({ removed: 0 })

  const { error } = await admin.from("a2a_agreement_files").delete().eq("agreement_id", id).eq("party", party)
  if (error) return NextResponse.json({ error: "Could not remove the documents. Please try again." }, { status: 500 })
  await deleteS3ObjectsByUrl(list.map((f) => f.file_url as string))

  const label = access.agreement.party_names || "Untitled A2A agreement"
  await logAuditEvent({
    category: "a2a_agreements",
    event: "document_removed",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname, role: profile.role },
    subjectType: "a2a_agreements",
    subjectId: id,
    subjectLabel: label,
    description: `Removed Party ${party}'s ${list.length} document(s) from the A2A agreement "${label}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ removed: list.length })
}
