import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteByAgent, saveSite } from "@/lib/website-builder-service"
import type { WebsiteData } from "@/app/website/_data"

// The agent's own Website Builder site: GET loads it (WebsiteData shape,
// featured items re-resolved from live projects/listings), PUT saves the whole
// draft across the website_builder tables. The slug follows the hero headline:
// changing the title re-mints the slug on save (old links stop resolving).

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const site = await loadSiteByAgent(createAdminSupabase(), session.context.userId)
    if (!site) return NextResponse.json({ exists: false })
    return NextResponse.json({ exists: true, slug: site.slug, data: site.data })
  } catch {
    return NextResponse.json({ error: "Failed to load site" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let data: WebsiteData
  try {
    data = (await req.json()) as WebsiteData
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
  if (!data || typeof data !== "object" || !data.hero || !data.about || !data.agent) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    const saved = await saveSite(createAdminSupabase(), session.context.userId, data)
    return NextResponse.json({ slug: saved.slug })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save site"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
