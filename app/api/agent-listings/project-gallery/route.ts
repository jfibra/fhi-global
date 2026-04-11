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
    .select(
      "description, about_project, currency, launch_price_from, launch_price_to, main_image, project_images ( url, is_main, rank ), project_units ( unit_type )",
    )
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

  const row = data as unknown as BuyRawProject & {
    description?: string | null
    about_project?: string | null
    currency?: string | null
    launch_price_from?: number | string | null
    launch_price_to?: number | string | null
  }

  const urls = orderedProjectGalleryUrls(row as BuyRawProject)
  const rawUnits = row.project_units ?? []
  const unitTypes = Array.from(
    new Set(
      rawUnits
        .map((u) => (typeof u.unit_type === "string" ? u.unit_type.trim() : ""))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

  const num = (v: unknown): number | null => {
    if (v == null) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }

  const projectDescription =
    typeof row.description === "string" && row.description.trim() ? row.description.trim() : null
  const projectAbout =
    typeof row.about_project === "string" && row.about_project.trim() ? row.about_project.trim() : null

  return NextResponse.json({
    urls,
    unitTypes: unitTypes,
    currency: (row.currency ?? "AED").trim() || "AED",
    launchPriceFrom: num(row.launch_price_from),
    launchPriceTo: num(row.launch_price_to),
    projectDescription,
    projectAbout,
  })
}
