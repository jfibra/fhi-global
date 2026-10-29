import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { deleteS3ObjectsByUrl } from "@/lib/s3-transit"
import { A2A_DOC_LABELS, isA2ADocType } from "@/lib/a2a-agreements/shared"
import { A2A_ROLES, UUID_RE, loadAgreementAccess } from "@/lib/a2a-agreements/server"

/**
 * Remove one document from the caller's own A2A agreement, in any status (a
 * wrong file on a submitted agreement can still be swapped). The row is matched
 * on BOTH its id and the agreement's, so a file id from another agreement
 * can't be reached through this one.
 */
export const runtime = "nodejs"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const guard = await requireRole(A2A_ROLES)
  if (!guard.ok) return guard.response
  const { userId, profile } = guard.context
  const { id, fileId } = await params
  if (!UUID_RE.test(fileId)) return NextResponse.json({ error: "Document not found." }, { status: 404 })

  const admin = createAdminSupabase()
  const access = await loadAgreementAccess(admin, id, userId, profile.role)
  if (!access || !access.isOwner) return NextResponse.json({ error: "Agreement not found." }, { status: 404 })

  const { data: file } = await admin
    .from("a2a_agreement_files")
    .select("id, party, doc_type, file_url")
    .eq("id", fileId)
    .eq("agreement_id", id)
    .maybeSingle<{ id: string; party: string | null; doc_type: string; file_url: string }>()
  if (!file) return NextResponse.json({ error: "Document not found." }, { status: 404 })

  const { error } = await admin.from("a2a_agreement_files").delete().eq("id", fileId).eq("agreement_id", id)
  if (error) return NextResponse.json({ error: "Could not remove the document. Please try again." }, { status: 500 })
  await deleteS3ObjectsByUrl([file.file_url])

  const docLabel = isA2ADocType(file.doc_type) ? A2A_DOC_LABELS[file.doc_type].label : "a document"
  const label = access.agreement.party_names || "Untitled A2A agreement"
  await logAuditEvent({
    category: "a2a_agreements",
    event: "document_removed",
    source: "dashboard",
    actor: { id: userId, name: profile.fullname, role: profile.role },
    subjectType: "a2a_agreements",
    subjectId: id,
    subjectLabel: label,
    description: `Removed ${docLabel}${file.party ? ` (Party ${file.party})` : ""} from the A2A agreement "${label}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
