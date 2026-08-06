import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Published projects for the Website Builder "Featured Projects" picker,
// already mapped to the template's ProjectCard shape so the editor can drop
// a choice straight into the draft. Service-role client for parity with the
// reels-maker picker routes (projects are publicly readable anyway).

export const runtime = "nodejs"

function compactPrice(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return ""
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${currency} ${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`
  }
  if (value >= 1_000) return `${currency} ${Math.round(value / 1_000)}K`
  return `${currency} ${value.toLocaleString()}`
}

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("projects")
    .select(
      "id, name, location, community, city, launch_price_from, currency, main_image, developers ( name, logo_url ), project_units ( bedrooms ), project_property_types ( property_types ( name ) ), project_images ( url, is_main, rank )",
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }

  const projects = (data ?? []).map((row) => {
    const developer = (Array.isArray(row.developers) ? row.developers[0] : row.developers) as
      | { name: string | null; logo_url: string | null }
      | null

    const images = ((row.project_images ?? []) as { url: string; is_main: boolean | null; rank: number | null }[])
      .slice()
      .sort((a, b) => Number(b.is_main ?? false) - Number(a.is_main ?? false) || (a.rank ?? 0) - (b.rank ?? 0))
    const image = (row.main_image as string | null) ?? images[0]?.url ?? ""

    const beds = ((row.project_units ?? []) as { bedrooms: number | null }[])
      .map((u) => u.bedrooms)
      .filter((b): b is number => b != null)
    const bedRange = beds.length
      ? Math.min(...beds) === Math.max(...beds)
        ? `${Math.min(...beds)} Bed`
        : `${Math.min(...beds)} - ${Math.max(...beds)} Bed`
      : ""
    const typeName = (((row.project_property_types ?? []) as { property_types: { name: string | null } | { name: string | null }[] | null }[])
      .map((t) => (Array.isArray(t.property_types) ? t.property_types[0]?.name : t.property_types?.name))
      .find(Boolean) ?? "") as string
    const units = [bedRange, typeName ? `${typeName}s` : ""].filter(Boolean).join(" ")

    const location = [row.community, row.city].filter(Boolean).join(", ") || ((row.location as string | null) ?? "")
    const currency = ((row.currency as string | null) ?? "AED").trim() || "AED"

    return {
      sourceId: String(row.id),
      image,
      badge: "Off Plan",
      developerName: developer?.name ?? "",
      developerLogo: developer?.logo_url ?? "",
      title: (row.name as string) ?? "",
      location,
      units,
      from: compactPrice(row.launch_price_from as number | null, currency),
    }
  })

  return NextResponse.json({ projects })
}
