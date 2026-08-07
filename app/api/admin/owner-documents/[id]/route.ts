import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { deleteOwnerDocFilesFromS3 } from "@/lib/owner-documents/server"

/**
 * Admin-only: hard-delete an owner-document request (and, via ON DELETE CASCADE,
 * its file rows) plus best-effort removal of the uploaded files from S3. For
 * test cleanup / removing stale requests. Service-role; authorized by real role.
 */
export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 })

  const admin = createAdminSupabase()

  const { data: request } = await admin
    .from("owner_document_requests")
    .select("id, label, owner_name")
    .eq("id", id)
    .maybeSingle<{ id: string; label: string | null; owner_name: string | null }>()
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 })

  // Remove the uploaded files from S3 first (best-effort), then the rows.
  const { data: files } = await admin
    .from("owner_document_files")
    .select("file_url")
    .eq("request_id", id)
  await deleteOwnerDocFilesFromS3((files ?? []).map((f) => f.file_url as string))

  const { error } = await admin.from("owner_document_requests").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "owner_documents",
    event: "deleted",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "owner_document_requests",
    subjectId: id,
    subjectLabel: request.label || request.owner_name || id,
    description: `Deleted owner-document request "${request.label || request.owner_name || id}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
