import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { publishedSiteSlugs } from "@/lib/events/access"
import { eventIsPast, eventSchedule, normalizeEventDays } from "@/lib/events/dates"
import { daySeats } from "@/lib/events/pax"
import { eventPublicPath } from "@/lib/events/paths"
import { ISO_DAY, UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { SITE_URL } from "@/lib/seo"

/**
 * GET /api/external/events — company events and agents' events, with dates,
 * venue, host, where they are shown and how many registered. Keyed. Read-only.
 *
 *   ?when=upcoming|past|all     default upcoming (an event is past once its LAST day has started)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   by the first day
 *   ?status=published|draft|all      default published
 *   ?host=company|agents|all         default all
 *   ?agent=<profile id>              one agent's events
 *   ?q=<words>  ?id=<id>  ?slug=<slug>
 *   ?include=days                    per-day seats (limit, taken, left) — one lookup per event, so 50 events at most
 *   ?page=1&limit=50                 limit ≤ 100; upcoming soonest first, past latest first
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = {
  id: string
  slug: string | null
  title: string
  description: string | null
  brand: string | null
  image_url: string | null
  event_date: string | null
  event_days: number | null
  day_times: unknown
  day_pax: unknown
  venue: string | null
  venue_lat: number | null
  venue_lng: number | null
  status: string
  registration_open: boolean | null
  agent_id: string | null
  show_on_main: boolean | null
  show_on_website: boolean | null
  view_count: number | null
  qr_scan_count: number | null
  created_at: string
  updated_at: string | null
  owner: { fullname: string | null } | { fullname: string | null }[] | null
  event_registrations: { count: number }[] | null
}

const site = SITE_URL.replace(/\/$/, "")
const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * 3600e3).toISOString().slice(0, 10)
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from: rangeFrom, to: rangeTo } = pageParams(q)
  const when = (q.get("when") ?? "upcoming").toLowerCase()
  const status = (q.get("status") ?? "published").toLowerCase()
  const host = (q.get("host") ?? "all").toLowerCase()
  const agent = (q.get("agent") ?? "").trim()
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const oneId = (q.get("id") ?? "").trim()
  const oneSlug = (q.get("slug") ?? "").trim()
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  const includeDays = (q.get("include") ?? "").split(",").map((s) => s.trim()).includes("days")
  if (!["upcoming", "past", "all"].includes(when)) return NextResponse.json({ error: "when must be upcoming, past or all." }, { status: 400 })
  if (!["published", "draft", "all"].includes(status)) return NextResponse.json({ error: "status must be published, draft or all." }, { status: 400 })
  if (!["company", "agents", "all"].includes(host)) return NextResponse.json({ error: "host must be company, agents or all." }, { status: 400 })
  if ((agent && !UUID_RE.test(agent)) || (oneId && !UUID_RE.test(oneId))) return NextResponse.json({ error: "agent and id must be ids." }, { status: 400 })
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) return NextResponse.json({ error: "from and to must be YYYY-MM-DD." }, { status: 400 })

  let query = admin
    .from("events")
    .select("id, slug, title, description, brand, image_url, event_date, event_days, day_times, day_pax, venue, venue_lat, venue_lng, status, registration_open, agent_id, show_on_main, show_on_website, view_count, qr_scan_count, created_at, updated_at, owner:profiles!events_agent_id_fkey(fullname), event_registrations(count)")
    .is("deleted_at", null)
    .neq("status", "archived")
    .limit(2000)
  if (status !== "all") query = query.eq("status", status)
  if (oneId) query = query.eq("id", oneId)
  if (oneSlug) query = query.eq("slug", oneSlug)
  if (agent) query = query.eq("agent_id", agent)
  if (host === "company") query = query.is("agent_id", null)
  if (host === "agents") query = query.not("agent_id", "is", null)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  let rows = (data ?? []) as unknown as Row[]
  rows = rows.filter((e) => {
    const past = eventIsPast(e.event_date, e.event_days, now, e.day_times)
    if (when === "upcoming" && (past || !e.event_date)) return false
    if (when === "past" && !past) return false
    const first = e.event_date ? dubaiDay(new Date(e.event_date)) : null
    if (from && (!first || first < from)) return false
    if (to && (!first || first > to)) return false
    if (words && !words.split(/\s+/).every((w) => e.title.toLowerCase().includes(w))) return false
    return true
  })
  rows.sort((a, b) => {
    const ad = a.event_date ?? "", bd = b.event_date ?? ""
    return when === "past" ? bd.localeCompare(ad) : ad.localeCompare(bd)
  })
  const total = rows.length
  const pageRows = rows.slice(rangeFrom, rangeTo + 1)

  const siteByAgent = await publishedSiteSlugs(admin, pageRows.map((e) => e.agent_id ?? ""))
  const seatsById = new Map<string, ReturnType<typeof daySeats>>()
  if (includeDays) {
    for (const e of pageRows.slice(0, 50)) {
      const { data: counts } = await admin.rpc("event_day_counts", { p_event_id: e.id })
      seatsById.set(e.id, daySeats(e.day_pax, e.event_days, (counts ?? []) as Array<{ day: unknown; taken: unknown }>))
    }
  }

  const dataOut = pageRows.map((e) => {
    const owner = (Array.isArray(e.owner) ? e.owner[0] : e.owner) ?? null
    const company = !e.agent_id
    const onMain = company || e.show_on_main === true
    const onWebsite = !company && e.show_on_website !== false
    const siteSlug = e.agent_id ? siteByAgent.get(e.agent_id) ?? null : null
    const schedule = eventSchedule(e.event_date, e.event_days, e.day_times)
    const registered = Number(e.event_registrations?.[0]?.count ?? 0)
    const seats = seatsById.get(e.id)
    return {
      id: e.id,
      title: e.title,
      slug: e.slug,
      url: onMain ? `${site}${eventPublicPath({ id: e.id, slug: e.slug })}` : siteSlug ? `${site}${eventPublicPath({ id: e.id, slug: e.slug }, siteSlug)}` : null,
      status: e.status,
      registration_open: e.registration_open !== false,
      when: {
        start: e.event_date,
        first_day: schedule[0] ? dubaiDay(schedule[0].start) : null,
        last_day: schedule.length ? dubaiDay(schedule[schedule.length - 1].start) : null,
        days: normalizeEventDays(e.event_days),
        schedule: schedule.map((d) => ({ day: d.day, date: dubaiDay(d.start), time: hhmm(d.start), start: d.start.toISOString() })),
        past: eventIsPast(e.event_date, e.event_days, now, e.day_times),
      },
      venue: { name: e.venue, latitude: e.venue_lat, longitude: e.venue_lng },
      host: company ? { type: "company", name: "FHI Global" } : { type: "agent", id: e.agent_id, name: owner?.fullname ?? null },
      shown_on: { fhiglobal: onMain, website: onWebsite, website_slug: siteSlug },
      registrations: { total: registered, ...(seats ? { per_day: seats.map((s) => ({ day: s.day, limit: s.limit, taken: s.taken, left: s.left, full: s.full })) } : {}) },
      engagement: { views: e.view_count ?? 0, qr_scans: e.qr_scan_count ?? 0 },
      brand: e.brand,
      image: e.image_url,
      description: e.description ? e.description.slice(0, 600) : null,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }
  })

  return NextResponse.json(
    { success: true, data: dataOut, meta: { total, page, limit, filters: { when, status, host, agent: agent || null, from: from || null, to: to || null, q: words || null, include: includeDays ? "days" : null } } },
    { headers: { "cache-control": "no-store" } },
  )
}
