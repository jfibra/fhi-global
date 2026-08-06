import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// The shared service-area catalog (migration 036) for the editor's
// choose-or-create area field: picking an existing name reuses its catalog
// row (and photo); a new name inserts one on save.

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await createAdminSupabase()
    .from("service_areas")
    .select("name, photo")
    .order("name")
  if (error) {
    return NextResponse.json({ error: "Failed to load areas" }, { status: 500 })
  }
  return NextResponse.json({ areas: data ?? [] })
}
