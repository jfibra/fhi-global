import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { allowRequest, clientIp } from "@/lib/rate-limit"
import {
  OWNER_DOCS_BUCKET,
  ALLOWED_MIME,
  extForMime,
  isOwnerDocType,
  getRequestByToken,
  requestOpenState,
} from "@/lib/owner-documents/server"

/**
 * Public: mint a one-time Supabase signed upload URL for an owner's document.
 * Unauthenticated by design — the intake token is the capability. The signed
 * URL is scoped to a server-chosen path under the token's folder, so the anon
 * owner can only ever write there; the file is later relocated to S3 by the
 * submit route. Never opens an anon bucket RLS policy.
 */
export const runtime = "nodejs"

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!allowRequest(`ownerdoc-upload:${clientIp(req.headers)}`, 40, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many uploads — please try again later." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const { docType, mime } = (body ?? {}) as { docType?: unknown; mime?: unknown }
  if (!isOwnerDocType(docType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 })
  }
  if (typeof mime !== "string" || !ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "Only JPG, PNG, or PDF files are allowed." }, { status: 415 })
  }
  const ext = extForMime(mime)
  if (!ext) {
    return NextResponse.json({ error: "Only JPG, PNG, or PDF files are allowed." }, { status: 415 })
  }

  const admin = createAdminSupabase()
  const request = await getRequestByToken(admin, token)
  const state = requestOpenState(request)
  if (state !== "open") {
    const status = state === "invalid" ? 404 : 410
    return NextResponse.json({ error: "This document request is no longer open.", state }, { status })
  }

  const path = `${token}/${docType}-${crypto.randomUUID()}.${ext}`
  const { data, error } = await admin.storage.from(OWNER_DOCS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: data.path ?? path })
}
