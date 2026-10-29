import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest } from "@/lib/rate-limit"
import {
  A2A_DOC_TYPES,
  A2A_MAX_FILES_PER_AGREEMENT,
  A2A_MAX_FILES_PER_SLOT,
} from "@/lib/a2a-agreements/shared"
import {
  A2A_DOCS_BUCKET,
  A2A_ROLES,
  a2aTransitPath,
  extForMime,
  loadAgreementAccess,
} from "@/lib/a2a-agreements/server"

/**
 * Mint a one-time Supabase signed upload URL for one document on the caller's
 * own A2A agreement. The server picks the path in the PRIVATE a2a-documents
 * bucket (`<agreementId>/<party>-<docType>-<uuid>.<ext>`), so the browser can
 * only ever write there; the files route then moves it to S3. Any status: a
 * submitted agreement still takes documents that arrive late.
 */
export const runtime = "nodejs"

const BodySchema = z.object({
  party: z.enum(["A", "B", "C"]).nullable(),
  docType: z.enum(A2A_DOC_TYPES),
  mime: z.string().max(100),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id } = await params

  if (!allowRequest(`a2a-upload:${userId}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many uploads — please try again in a few minutes." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid document." }, { status: 400 })
  const { party, docType, mime } = parsed.data
  if ((docType === "signed_copy") !== (party === null)) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 })
  }
  const ext = extForMime(mime)
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG or PDF files are allowed." }, { status: 415 })

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  if (!access || !access.isOwner) return NextResponse.json({ error: "Agreement not found." }, { status: 404 })

  // Caps are checked again when the file is registered (several picks at once
  // all pass here); this just stops an upload that can't fit from starting.
  const { data: existing } = await admin
    .from("a2a_agreement_files")
    .select("party, doc_type")
    .eq("agreement_id", id)
  const rows = existing ?? []
  if (rows.length >= A2A_MAX_FILES_PER_AGREEMENT) {
    return NextResponse.json({ error: `An agreement can hold up to ${A2A_MAX_FILES_PER_AGREEMENT} files.` }, { status: 409 })
  }
  if (rows.filter((r) => r.party === party && r.doc_type === docType).length >= A2A_MAX_FILES_PER_SLOT) {
    return NextResponse.json({ error: `This box already has ${A2A_MAX_FILES_PER_SLOT} files.` }, { status: 409 })
  }

  const path = a2aTransitPath(id, party, docType, ext)
  const { data, error } = await admin.storage.from(A2A_DOCS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 })
  }
  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: data.path ?? path })
}
