import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireActiveSession, type GuardResult } from "@/lib/auth-guard"
import { canManageDeveloperContent, isDeveloperRole } from "@/lib/app-roles"

type Project = { id: number; developer_id: string | null }

type GuardManageResult =
  | { ok: false; response: NextResponse }
  | { ok: true; context: GuardResult; project: Project }

/**
 * Verify the caller may manage a project's sub-resources: admin/editor/super-admin
 * for any project, or a developer for a project owned by their linked company
 * (profiles.metadata.developer_id === projects.developer_id). Uses the passed
 * service-role client so the project lookup isn't gated by table RLS.
 */
export async function guardProjectManage(admin: SupabaseClient, projectId: number): Promise<GuardManageResult> {
  const session = await requireActiveSession()
  if (!session.ok) return { ok: false, response: session.response }

  const { data: project } = await admin
    .from("projects")
    .select("id, developer_id")
    .eq("id", projectId)
    .maybeSingle<Project>()
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found." }, { status: 404 }) }
  }

  const role = session.context.profile.role
  const meta = session.context.profile.metadata ?? {}
  const callerDeveloperId = typeof meta.developer_id === "string" ? meta.developer_id : null
  const allowed =
    canManageDeveloperContent(role) ||
    (isDeveloperRole(role) && !!callerDeveloperId && project.developer_id === callerDeveloperId)

  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true, context: session.context, project }
}
