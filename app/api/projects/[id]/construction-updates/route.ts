import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { guardProjectManage } from "@/lib/project-access"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

const SELECT = "id, project_id, title, file_url, file_type, created_at"

// GET — list a project's construction updates (studio view; service-role so a
// developer sees their own unpublished project's updates too).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const { data, error } = await admin
    .from("construction_updates")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updates: data ?? [] })
}

// POST — add a construction update (the file is already uploaded to S3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId)) return NextResponse.json({ error: "Invalid project." }, { status: 400 })

  const admin = createAdminSupabase()
  const guard = await guardProjectManage(admin, projectId)
  if (!guard.ok) return guard.response

  const body = (await req.json()) as { title?: string; file_url?: string; file_type?: string }
  const title = String(body.title ?? "").trim()
  const fileUrl = String(body.file_url ?? "").trim()
  const fileType = String(body.file_type ?? "").trim()
  if (!title || !fileUrl) return NextResponse.json({ error: "Title and file are required." }, { status: 400 })
  if (fileType !== "pdf" && fileType !== "image") return NextResponse.json({ error: "Invalid file type." }, { status: 400 })

  const { data, error } = await admin
    .from("construction_updates")
    .insert({ project_id: projectId, title, file_url: fileUrl, file_type: fileType, uploaded_by: guard.context.userId })
    .select(SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "projects",
    event: "created",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "construction_updates",
    subjectId: String(data.id),
    subjectLabel: title,
    description: `Added construction update "${title}" to project #${projectId}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ update: data }, { status: 201 })
}
