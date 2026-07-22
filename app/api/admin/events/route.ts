import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sanitizeEventInput } from "@/lib/events/validate"

/** All events (any status) with registration counts — admin only. */
export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("events")
    .select("id, slug, title, description, brand, image_url, event_date, venue, status, created_at, view_count, qr_scan_count, event_registrations(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 })
  }

  const events = (data ?? []).map((e) => {
    const counts = e.event_registrations as unknown as { count: number }[] | null
    return {
      id: e.id as string,
      slug: (e.slug as string | null) ?? null,
      title: e.title as string,
      description: (e.description as string | null) ?? null,
      brand: (e.brand as string) ?? "fhiglobal",
      imageUrl: (e.image_url as string | null) ?? null,
      eventDate: (e.event_date as string | null) ?? null,
      venue: (e.venue as string | null) ?? null,
      status: (e.status as string) ?? "draft",
      createdAt: e.created_at as string,
      registrationCount: counts?.[0]?.count ?? 0,
      viewCount: (e.view_count as number | null) ?? 0,
      qrScanCount: (e.qr_scan_count as number | null) ?? 0,
    }
  })

  return NextResponse.json({ events })
}

// URL slug from the title ("FHI Global Summit 2026" -> "fhi-global-summit-2026").
// Generated once at creation and kept stable afterwards so shared links and
// printed QR codes never break when the title is edited.
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Create an event — admin only. */
export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const input = sanitizeEventInput(body)
  if (!input.title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const base = slugify(input.title)
  let slug: string | null = base || null

  let result = await admin
    .from("events")
    .insert({ ...input, slug, created_by: session.context.userId })
    .select("id")
    .single()

  // Slug taken by another event — retry once with a short suffix.
  if (result.error?.code === "23505" && slug) {
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    result = await admin
      .from("events")
      .insert({ ...input, slug, created_by: session.context.userId })
      .select("id")
      .single()
  }

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }

  return NextResponse.json({ id: result.data.id })
}
