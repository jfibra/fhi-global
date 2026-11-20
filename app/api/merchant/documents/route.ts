import { NextRequest, NextResponse } from "next/server"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { requireMerchantAccess } from "@/lib/merchant/access"
import { isMerchantDocumentKind } from "@/lib/merchant/rules"
import { checklistFor, loadDocuments, refreshStatus } from "@/lib/merchant/service"
import { MERCHANT_FILE_MAX_BYTES, MERCHANT_FILE_TYPES, merchantFileKey, putMerchantFile } from "@/lib/merchant/storage"

/**
 * POST /api/merchant/documents — one of the four official requirements as a
 * file (multipart: file, kind, merchant? for an agent or admin). A new file
 * of a kind supersedes the older one. The merchant's status follows the
 * checklist afterwards.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Send the file as multipart form data." }, { status: 400 })
  }
  const kind = String(form.get("kind") ?? "")
  const merchantParam = form.get("merchant")
  const access = await requireMerchantAccess(typeof merchantParam === "string" ? merchantParam : null)
  if (!access.ok) return access.response
  const { admin, merchant, who, caller } = access.access
  if (!isMerchantDocumentKind(kind)) return NextResponse.json({ error: "kind must be agreement, trade_licence, emirates_id or bank." }, { status: 400 })

  const file = form.get("file")
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 })
  if (file.size > MERCHANT_FILE_MAX_BYTES) return NextResponse.json({ error: "The file is over 15 MB." }, { status: 413 })
  const originalName = (file as File).name || `${kind}.pdf`
  const ext = originalName.split(".").pop()?.toLowerCase() ?? ""
  const contentType = MERCHANT_FILE_TYPES[ext]
  if (!contentType) return NextResponse.json({ error: "Upload a PDF, JPG, PNG or WebP." }, { status: 400 })

  try {
    const key = merchantFileKey(merchant.id, kind, originalName)
    const url = await putMerchantFile(key, Buffer.from(await file.arrayBuffer()), contentType)
    const { data, error } = await admin
      .from("merchant_documents")
      .insert({ merchant_id: merchant.id, kind, file_name: originalName, file_url: url, file_type: ext.toUpperCase(), uploaded_by: caller.userId, uploaded_role: caller.profile.role })
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    const status = await refreshStatus(admin, merchant.id)
    const docs = (await loadDocuments(admin, [merchant.id])).get(merchant.id) ?? []
    await logAuditEvent({
      category: "merchants",
      event: "merchant_document_uploaded",
      source: "api",
      actor: { id: caller.userId, name: caller.profile.fullname ?? caller.email, role: caller.profile.role },
      subjectType: "merchants",
      subjectId: merchant.id,
      subjectLabel: merchant.business_name,
      description: `${who === "merchant" ? "The merchant" : who === "agent" ? "The signing agent" : "An admin"} uploaded ${kind} (${originalName})`,
      newValues: { document_id: data.id, kind },
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true, status, documents: docs, checklist: checklistFor({ iban_last4: merchant.iban_last4 }, docs) })
  } catch (e) {
    console.error("[merchant-documents]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't upload the file." }, { status: 500 })
  }
}
