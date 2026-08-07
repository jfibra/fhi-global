import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import { hasMailerConfig, sendOwnerDocumentsSubmittedEmail } from "@/lib/mailer"
import { getDashboardRouteByRole } from "@/lib/auth"
import { SITE_URL } from "@/lib/seo"
import {
  OWNER_DOCS_BUCKET,
  MAX_FILE_BYTES,
  isPathInToken,
  moveOwnerDocToS3,
  getRequestByToken,
  requestOpenState,
} from "@/lib/owner-documents/server"

/**
 * Public: finalize an owner-document intake. Unauthenticated — the token is the
 * capability. Files were already uploaded to the private owner-documents bucket
 * via signed URLs (see the upload-url route); here we relocate each to S3,
 * write the owner's details + file rows with the service-role client (the table
 * has no anon write path), and email the requesting agent. Zod-validated,
 * honeypot-guarded, per-IP rate-limited.
 */
export const runtime = "nodejs"
// Downloads each transient file from Supabase and re-uploads to S3 — allow room.
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const FileSchema = z.object({
  path: z.string().min(1).max(256),
  docType: z.enum(["title_deed", "emirates_id", "passport", "signed_noc", "other"]),
  fileName: z.string().trim().min(1).max(300),
  fileType: z.enum(["pdf", "image"]),
  fileSize: z.number().int().nonnegative().max(MAX_FILE_BYTES).optional(),
})

const SubmitSchema = z.object({
  ownerName: z.string().trim().min(1, "Please enter your full name.").max(200),
  ownerIdNumber: z.string().trim().min(1, "Please enter your Emirates ID / Passport number.").max(100),
  ownerEmail: z.string().trim().max(320).regex(EMAIL_RE, "Please enter a valid email."),
  ownerMobile: z.string().trim().min(4, "Please enter a valid mobile number.").max(40),
  building: z.string().trim().max(200).optional().default(""),
  unitNumber: z.string().trim().max(100).optional().default(""),
  community: z.string().trim().max(200).optional().default(""),
  titleDeedNumber: z.string().trim().max(100).optional().default(""),
  nocValidUntil: z.string().trim().max(40).optional().default(""),
  files: z.array(FileSchema).min(1, "Please upload at least one document.").max(12),
  website: z.string().optional().default(""), // honeypot — humans leave this empty
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!allowRequest(`ownerdoc-submit:${clientIp(req.headers)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts — please try again later." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check the form and try again."
    return NextResponse.json({ error: first }, { status: 400 })
  }
  const data = parsed.data

  // Bot filled the hidden field — silently accept without storing.
  if (data.website.trim() !== "") return NextResponse.json({ ok: true })

  const admin = createAdminSupabase()
  const request = await getRequestByToken(admin, token)
  const state = requestOpenState(request)
  if (state !== "open" || !request) {
    const status = state === "invalid" ? 404 : 410
    return NextResponse.json({ error: "This document request is no longer open.", state }, { status })
  }

  // Relocate each uploaded file to S3 (or fall back to a long-lived signed URL
  // from the private bucket if the move fails, so nothing is ever lost). Reject
  // any path that isn't scoped to this token's folder.
  const fileRows: Array<{
    request_id: string
    doc_type: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number | null
  }> = []
  for (const f of data.files) {
    if (!isPathInToken(f.path, token)) continue
    let url = await moveOwnerDocToS3(admin, f.path)
    if (!url) {
      const { data: signed } = await admin.storage
        .from(OWNER_DOCS_BUCKET)
        .createSignedUrl(f.path, 60 * 60 * 24 * 365)
      url = signed?.signedUrl ?? null
    }
    if (!url) continue
    fileRows.push({
      request_id: request.id,
      doc_type: f.docType,
      file_name: f.fileName,
      file_url: url,
      file_type: f.fileType,
      file_size: f.fileSize ?? null,
    })
  }

  if (fileRows.length === 0) {
    return NextResponse.json(
      { error: "We couldn't process your uploads. Please try again." },
      { status: 502 },
    )
  }

  const nowIso = new Date().toISOString()
  // Guard the transition on status='pending' so a double-submit can't overwrite.
  const { data: updated, error: updateErr } = await admin
    .from("owner_document_requests")
    .update({
      owner_name: data.ownerName,
      owner_id_number: data.ownerIdNumber,
      owner_email: data.ownerEmail,
      owner_mobile: data.ownerMobile,
      property_building: data.building || null,
      unit_number: data.unitNumber || null,
      community_area: data.community || null,
      title_deed_number: data.titleDeedNumber || null,
      noc_valid_until: DATE_RE.test(data.nocValidUntil) ? data.nocValidUntil : null,
      status: "submitted",
      submitted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()

  if (updateErr) {
    return NextResponse.json({ error: "Could not save your submission. Please try again." }, { status: 500 })
  }
  if (!updated) {
    // Lost the race — already submitted/cancelled between the open-check and now.
    return NextResponse.json({ error: "This document request is no longer open.", state: "submitted" }, { status: 410 })
  }

  const { error: filesErr } = await admin.from("owner_document_files").insert(fileRows)
  if (filesErr) {
    // Details saved but files failed to record — surface so the owner can retry.
    return NextResponse.json({ error: "Your details were saved but the files didn't attach. Please try again." }, { status: 500 })
  }

  const ctx = requestContextFromRequest(req)
  await logAuditEvent({
    category: "owner_documents",
    event: "submitted",
    source: "app",
    subjectType: "owner_document_requests",
    subjectId: request.id,
    subjectLabel: data.ownerName,
    description: `Owner ${data.ownerName} submitted ${fileRows.length} document(s) for an owner-document request`,
    ...ctx,
  })

  // Best-effort: notify the requesting agent. A mail hiccup must never lose the submission.
  if (hasMailerConfig()) {
    try {
      const { data: agent } = await admin
        .from("profiles")
        .select("fullname, role")
        .eq("id", request.agent_id)
        .maybeSingle<{ fullname: string | null; role: string | null }>()
      const authRes = await admin.auth.admin.getUserById(request.agent_id).catch(() => null)
      const to = authRes?.data?.user?.email
      if (to) {
        const propertyLabel =
          [data.building, data.unitNumber, data.community].map((s) => s.trim()).filter(Boolean).join(" · ") || null
        await sendOwnerDocumentsSubmittedEmail({
          to,
          agentName: agent?.fullname ?? null,
          ownerName: data.ownerName,
          propertyLabel,
          fileCount: fileRows.length,
          dashboardUrl: `${SITE_URL}${getDashboardRouteByRole(agent?.role ?? "agent")}/owner-documents`,
        }).catch(() => {})
      }
    } catch (e) {
      console.error("[owner-documents] agent notification failed:", e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true })
}
