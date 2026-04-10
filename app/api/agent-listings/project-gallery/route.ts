import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { orderedProjectGalleryUrls } from "@/lib/buy/cached-projects"
import type { BuyRawProject } from "@/lib/buy/cached-projects"

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) {
    return session.response
  }
  if (!isSalesPipelineRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const projectId = Number(req.nextUrl.searchParams.get("projectId"))
  if (!Number.isFinite(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("main_image, project_images ( url, is_main, rank )")
    .eq("id", projectId)
    .eq("is_published", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const urls = orderedProjectGalleryUrls(data as unknown as BuyRawProject)
  return NextResponse.json({ urls })
}
