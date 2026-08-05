import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { guardProjectManage } from "@/lib/project-access"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

// DELETE — remove one construction update from a project.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; updateId: string }> }) {
  const { id, updateId } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const { data: existing } = await admin
    .from("construction_updates")
    .select("id, title")
    .eq("id", updateId)
    .eq("project_id", projectId)
    .maybeSingle<{ id: string; title: string }>()
  if (!existing) return NextResponse.json({ error: "Construction update not found." }, { status: 404 })

  const { error } = await admin.from("construction_updates").delete().eq("id", updateId).eq("project_id", projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
