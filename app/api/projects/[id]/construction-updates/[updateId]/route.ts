import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { guardProjectManage } from "@/lib/project-access"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

const STORAGE_BUCKET = "construction-updates"

// Pull the in-bucket object path out of a public storage URL, e.g.
// ".../object/public/construction-updates/dev/proj/123-abc.pdf" → "dev/proj/123-abc.pdf".
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${STORAGE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  try {
    return decodeURIComponent(url.slice(i + marker.length))
  } catch {
    return url.slice(i + marker.length)
  }
}

// DELETE — remove one construction update from a project (row + stored file).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; updateId: string }> }) {
  const { id, updateId } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const { data: existing } = await admin
    .from("construction_updates")
    .select("id, title, file_url")
    .eq("id", updateId)
    .eq("project_id", projectId)
    .maybeSingle<{ id: string; title: string; file_url: string }>()
  if (!existing) return NextResponse.json({ error: "Construction update not found." }, { status: 404 })

  const { error } = await admin.from("construction_updates").delete().eq("id", updateId).eq("project_id", projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort: also remove the stored file so the bucket doesn't accumulate
  // orphans. Never fail the delete on a storage hiccup (the row is already gone).
  const path = storagePathFromUrl(existing.file_url)
  if (path) {
    try {
      await admin.storage.from(STORAGE_BUCKET).remove([path])
    } catch {
      /* orphaned file is harmless; ignore */
    }
  }

  await logAuditEvent({
    category: "projects",
    event: "deleted",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "construction_updates",
    subjectId: updateId,
    subjectLabel: existing.title,
    description: `Removed construction update "${existing.title}" from project #${projectId}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
