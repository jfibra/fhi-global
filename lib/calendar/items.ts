import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { roleToLabel } from "@/lib/app-roles"
import { listEntries, entryTimeLabel } from "@/lib/calendar/entries"
import { UAE_HOLIDAYS } from "@/lib/calendar/holidays"
import { ENTRY_AUDIENCE_LABELS, ENTRY_KIND_LABELS, type CalendarItem, type CalendarLayer } from "@/lib/calendar/types"
import { eventPublicPath } from "@/lib/events/paths"
import { eventSchedule } from "@/lib/events/dates"
import { daySeats } from "@/lib/events/pax"
import { AED, businessDate, fetchAllSales, nameMaps, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import { isLiveProject, isTestRecord } from "@/lib/listing-publish-checks"
import { STUCK_DAYS, isPendingSale } from "@/lib/stuck-deals"

/**
 * The admin Calendar's blocks, one builder per layer (boss via Juliecor,
 * 2026-11-13). Every builder takes a span of Dubai days [from, to]
 * (inclusive, YYYY-MM-DD) and returns CalendarItems; nothing here writes.
 * A builder that fails is reported by name, never hides the other layers.
 */

type Admin = ReturnType<typeof createAdminSupabase>

const DAY_MS = 86400e3
export const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const dubaiDay = (d: Date) => new Date(d.getTime() + 4 * 3600e3).toISOString().slice(0, 10)
/** "13:00" Dubai — 24-hour like every other time on the page. */
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })
const inSpan = (day: string, from: string, to: string) => day >= from && day <= to
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** Every day of the span, first to last. */
function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = shiftDay(d, 1)) out.push(d)
  return out
}

// ─── Events ──────────────────────────────────────────────────────────────────

type EventRow = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  event_days: number | null
  day_times: unknown
  day_pax: unknown
  venue: string | null
  status: string
  agent_id: string | null
  show_on_main: boolean | null
  show_on_website: boolean | null
  owner: { fullname: string | null } | { fullname: string | null }[] | null
}

export async function eventItems(admin: Admin, from: string, to: string): Promise<CalendarItem[]> {
  // An event that started up to 14 days before the span may still be running inside it.
  const { data, error } = await admin
    .from("events")
    .select("id, slug, title, event_date, event_days, day_times, day_pax, venue, status, agent_id, show_on_main, show_on_website, owner:profiles!events_agent_id_fkey(fullname)")
    .is("deleted_at", null)
    .neq("status", "archived")
    .not("event_date", "is", null)
    .gte("event_date", `${shiftDay(from, -14)}T00:00:00+04:00`)
    .lte("event_date", `${to}T23:59:59+04:00`)
    .limit(300)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as EventRow[]
  const out: CalendarItem[] = []
  let counted = 0
  for (const e of rows) {
    const schedule = eventSchedule(e.event_date, e.event_days, e.day_times)
    const days = schedule.filter((d) => inSpan(dubaiDay(d.start), from, to))
    if (!days.length) continue
    // Seats per day — one RPC per event, capped so a wide span stays quick.
    let seats: ReturnType<typeof daySeats> = []
    if (counted < 60) {
      counted++
      const { data: counts } = await admin.rpc("event_day_counts", { p_event_id: e.id })
      seats = daySeats(e.day_pax, e.event_days, (counts ?? []) as Array<{ day: unknown; taken: unknown }>)
    }
    const owner = (Array.isArray(e.owner) ? e.owner[0] : e.owner) as { fullname: string | null } | null
    const company = !e.agent_id
    const onMain = company || e.show_on_main === true
    const published = e.status === "published"
    const placement = company ? "fhiglobal.ae/events" : [onMain ? "fhiglobal.ae/events" : null, e.show_on_website !== false ? "their website" : null].filter(Boolean).join(" and ")
    // Google place strings run on ("ibis Dubai Al Rigga, Al Rigga Rd - Al Muraqqabat - Deira - Dubai - …"): the chip gets the first part, the sheet the whole address.
    const shortVenue = e.venue ? e.venue.split(" - ")[0].slice(0, 60) : null
    for (const d of days) {
      const time = hhmm(d.start)
      const seat = seats.find((s) => s.day === d.day)
      const seatLine = seat ? (seat.limit === null ? `${seat.taken} registered` : `${seat.taken} of ${seat.limit} booked${seat.full ? " · full" : ""}`) : null
      const details: CalendarItem["details"] = [
        { label: "When", value: `${longDay(dubaiDay(d.start))} · ${time}` },
        ...(e.venue ? [{ label: "Venue", value: e.venue }] : []),
        ...(seatLine ? [{ label: "Seats", value: seatLine }] : []),
        { label: "Hosted by", value: company ? "FHI Global" : owner?.fullname ?? "An agent" },
        { label: "Shown on", value: placement || "nowhere yet" },
        { label: "Status", value: published ? "Published" : "Draft" },
        ...(schedule.length > 1 ? [{ label: "Days", value: schedule.map((s) => `Day ${s.day} · ${s.dateLabel} · ${hhmm(s.start)}`).join("\n") }] : []),
      ]
      out.push({
        id: `event:${e.id}:${dubaiDay(d.start)}`,
        layer: "event",
        date: dubaiDay(d.start),
        time,
        timeLabel: time,
        title: schedule.length > 1 ? `${e.title} · Day ${d.day}` : e.title,
        subtitle: [shortVenue, seatLine].filter(Boolean).join(" · ") || (published ? null : "Draft"),
        details,
        links: [
          { label: "Open in Events", dash: "/events" },
          ...(published && onMain ? [{ label: "Public page", url: eventPublicPath({ id: e.id, slug: e.slug }) }] : []),
        ],
        dayOf: schedule.length > 1 ? { day: d.day, of: schedule.length } : null,
      })
    }
  }
  return out
}

// ─── Project milestones ──────────────────────────────────────────────────────

type ProjectRow = {
  id: number
  name: string
  slug: string
  status: string | null
  developer_id: string | null
  community: string | null
  location: string | null
  booking_date: string | null
  construction_start_date: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  is_published: boolean | null
  is_active: boolean | null
  deleted_at: string | null
}

const MILESTONES: Array<{ col: keyof ProjectRow; label: string }> = [
  { col: "booking_date", label: "Launch" },
  { col: "construction_start_date", label: "Construction starts" },
  { col: "delivery_date", label: "Handover" },
  { col: "expected_completion_date", label: "Expected completion" },
]

export async function projectItems(admin: Admin, from: string, to: string): Promise<CalendarItem[]> {
  const cols = "id, name, slug, status, developer_id, community, location, booking_date, construction_start_date, expected_completion_date, delivery_date, is_published, is_active, deleted_at"
  const or = MILESTONES.map((m) => `and(${m.col}.gte.${from},${m.col}.lte.${to})`).join(",")
  const { data, error } = await admin.from("projects").select(cols).or(or).limit(500)
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as unknown as ProjectRow[]).filter((p) => isLiveProject(p) && !isTestRecord({ title: p.name }))
  const devIds = [...new Set(rows.map((p) => p.developer_id).filter((x): x is string => !!x))]
  const devs = devIds.length ? await admin.from("developers").select("id, name").in("id", devIds) : { data: [] as { id: string; name: string }[] }
  const devName = new Map((devs.data ?? []).map((d) => [d.id, d.name]))
  const out: CalendarItem[] = []
  for (const p of rows) {
    for (const m of MILESTONES) {
      const day = p[m.col] as string | null
      if (!day || !inSpan(day, from, to)) continue
      // A project with a delivery date already shows "Handover"; its expected completion is then a duplicate.
      if (m.col === "expected_completion_date" && p.delivery_date) continue
      const where = p.community || p.location
      out.push({
        id: `project:${p.id}:${m.col}:${day}`,
        layer: "project",
        date: day,
        title: `${m.label} · ${p.name}`,
        subtitle: [devName.get(p.developer_id ?? ""), where].filter(Boolean).join(" · ") || null,
        details: [
          { label: "Milestone", value: `${m.label} · ${longDay(day)}` },
          ...(p.developer_id && devName.get(p.developer_id) ? [{ label: "Developer", value: devName.get(p.developer_id) as string }] : []),
          ...(where ? [{ label: "Where", value: where }] : []),
          ...(p.status ? [{ label: "Stage", value: p.status.replace(/_/g, " ") }] : []),
          ...(p.booking_date && m.col !== "booking_date" ? [{ label: "Launched", value: shortDay(p.booking_date) }] : []),
          ...(p.delivery_date && m.col !== "delivery_date" ? [{ label: "Handover", value: shortDay(p.delivery_date) }] : []),
          ...(p.expected_completion_date && m.col !== "expected_completion_date" && !p.delivery_date ? [{ label: "Expected completion", value: shortDay(p.expected_completion_date) }] : []),
        ],
        links: [
          { label: "Project page", url: `/projects/${p.slug}` },
          { label: "Open in Projects", dash: "/properties/projects" },
        ],
      })
    }
  }
  return out
}

// ─── Deals ───────────────────────────────────────────────────────────────────

const countsAsDeal = (s: SaleRow) => !["invalid", "rejected", "cancelled"].includes((s.validation_status ?? "pending").toLowerCase())

export async function dealItems(admin: Admin, from: string, to: string): Promise<CalendarItem[]> {
  const sales = await fetchAllSales(admin)
  const byDay = new Map<string, SaleRow[]>()
  for (const s of sales) {
    if (!countsAsDeal(s)) continue
    const d = businessDate(s)
    if (!inSpan(d, from, to)) continue
    byDay.set(d, [...(byDay.get(d) ?? []), s])
  }
  // Pending deals that reach STUCK_DAYS inside the span, on the day they do.
  const stuck = sales.filter((s) => isPendingSale(s) && countsAsDeal(s)).map((s) => ({ s, day: shiftDay(s.created_at.slice(0, 10), STUCK_DAYS) })).filter((x) => inSpan(x.day, from, to))
  const involved = [...byDay.values()].flat().concat(stuck.map((x) => x.s))
  const names = involved.length ? await nameMaps(admin, involved) : null
  const agentName = (id: string) => names?.agent.get(id)?.name ?? "Unknown agent"
  const projName = (s: SaleRow) => names?.proj.get(Number(s.project_id))?.name ?? "a project"
  const statusWord = (s: SaleRow) => ((s.validation_status ?? "pending") === "validated" ? "validated" : "waiting for validation")
  const out: CalendarItem[] = []
  for (const [day, rows] of byDay) {
    const total = rows.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)
    const validated = rows.filter((s) => s.validation_status === "validated").length
    const lines = rows.slice(0, 12).map((s) => `${projName(s)} · ${saleCredits(s).map((c) => agentName(c.agentId)).join(" + ")} · ${AED(Number(s.contract_price ?? 0))} · ${statusWord(s)}`)
    out.push({
      id: `deal:${day}`,
      layer: "deal",
      date: day,
      title: `${rows.length} deal${rows.length === 1 ? "" : "s"} recorded`,
      subtitle: AED(total),
      details: [
        { label: "Day", value: longDay(day) },
        { label: "Total", value: AED(total) },
        { label: "Validated", value: `${validated} of ${rows.length}` },
        { label: "Deals", value: lines.join("\n") + (rows.length > lines.length ? `\n… and ${rows.length - lines.length} more` : "") },
      ],
      links: [{ label: "Open Sales Reports", dash: "/sales" }],
    })
  }
  for (const { s, day } of stuck) {
    out.push({
      id: `deal-stuck:${s.id}:${day}`,
      layer: "deal",
      date: day,
      title: `Deal waiting ${STUCK_DAYS} days · ${projName(s)}`,
      subtitle: `${saleCredits(s).map((c) => agentName(c.agentId)).join(" + ")} · ${AED(Number(s.contract_price ?? 0))}`,
      details: [
        { label: "Recorded", value: shortDay(s.created_at.slice(0, 10)) },
        ...(s.reservation_date ? [{ label: "Reserved", value: shortDay(s.reservation_date) }] : []),
        { label: "Agent", value: saleCredits(s).map((c) => `${agentName(c.agentId)}${c.share < 100 ? ` (${c.share}%)` : ""}`).join(", ") },
        { label: "Amount", value: AED(Number(s.contract_price ?? 0)) },
        { label: "Status", value: "Still waiting for validation on this day" },
      ],
      links: [{ label: "Open Sales Reports", dash: "/sales" }],
      tone: "warn",
    })
  }
  return out
}

// ─── Birthdays ───────────────────────────────────────────────────────────────

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export async function birthdayItems(admin: Admin, from: string, to: string): Promise<CalendarItem[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, role, birthday")
    .eq("status", "active")
    .neq("is_deleted", true)
    .not("birthday", "is", null)
    .limit(3000)
  if (error) throw new Error(error.message)
  const years = new Set<number>()
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.add(y)
  // With hundreds of members there are two or three birthdays most days, so a
  // day gets ONE block ("3 birthdays") naming everyone; a lone birthday keeps its name.
  type Person = { name: string; role: string; age: number | null }
  const perDay = new Map<string, Person[]>()
  for (const p of (data ?? []) as Array<{ id: string; fullname: string | null; role: string | null; birthday: string }>) {
    const md = String(p.birthday).slice(5, 10)
    if (!/^\d{2}-\d{2}$/.test(md)) continue
    for (const y of years) {
      // 29 Feb is celebrated on 1 Mar in a common year, like the greeting cron.
      const day = md === "02-29" && !isLeap(y) ? `${y}-03-01` : `${y}-${md}`
      if (!inSpan(day, from, to)) continue
      const age = y - Number(String(p.birthday).slice(0, 4))
      perDay.set(day, [...(perDay.get(day) ?? []), { name: p.fullname?.trim().replace(/\s+/g, " ") || "A member", role: roleToLabel(p.role), age: age > 0 && age < 110 ? age : null }])
    }
  }
  const out: CalendarItem[] = []
  for (const [day, people] of perDay) {
    people.sort((a, b) => a.name.localeCompare(b.name))
    const one = people.length === 1 ? people[0] : null
    out.push({
      id: `birthday:${day}`,
      layer: "birthday",
      date: day,
      title: one ? `Birthday · ${one.name}` : `${people.length} birthdays`,
      subtitle: one ? one.role : people.map((p) => p.name.split(" ")[0]).slice(0, 4).join(", ") + (people.length > 4 ? ` and ${people.length - 4} more` : ""),
      details: [
        { label: one ? "Who" : "Who", value: people.map((p) => `${p.name} · ${p.role}${p.age ? ` · turning ${p.age}` : ""}`).join("\n") },
        { label: "Greeting", value: `The birthday email with the poster goes at 08:30 that morning${one ? "" : ", one to each"}` },
      ],
      links: [{ label: "Open in Account Directory", dash: "/accounts/users" }],
    })
  }
  return out
}

// ─── Owner-document expiries ─────────────────────────────────────────────────

export async function documentItems(admin: Admin, from: string, to: string): Promise<CalendarItem[]> {
  const cols = "id, agent_id, label, status, owner_name, property_building, unit_number, community_area, noc_valid_until, expires_at, submitted_at"
  const [noc, links] = await Promise.all([
    admin.from("owner_document_requests").select(cols).is("deleted_at", null).gte("noc_valid_until", from).lte("noc_valid_until", to).limit(500),
    admin.from("owner_document_requests").select(cols).is("deleted_at", null).eq("status", "pending").gte("expires_at", `${from}T00:00:00+04:00`).lte("expires_at", `${to}T23:59:59+04:00`).limit(500),
  ])
  if (noc.error) throw new Error(noc.error.message)
  if (links.error) throw new Error(links.error.message)
  type Row = { id: string; agent_id: string; label: string | null; status: string; owner_name: string | null; property_building: string | null; unit_number: string | null; community_area: string | null; noc_valid_until: string | null; expires_at: string; submitted_at: string | null }
  const rows = [...((noc.data ?? []) as Row[]), ...((links.data ?? []) as Row[])]
  const agentIds = [...new Set(rows.map((r) => r.agent_id))]
  const agents = agentIds.length ? await admin.from("profiles").select("id, fullname").in("id", agentIds) : { data: [] as { id: string; fullname: string | null }[] }
  const agentName = new Map((agents.data ?? []).map((a) => [a.id, a.fullname ?? "An agent"]))
  const property = (r: Row) => [r.property_building, r.unit_number ? `unit ${r.unit_number}` : null].filter(Boolean).join(", ") || r.label || `${agentName.get(r.agent_id) ?? "an agent"}'s request`
  const out: CalendarItem[] = []
  for (const r of (noc.data ?? []) as Row[]) {
    if (!r.noc_valid_until) continue
    out.push({
      id: `document:noc:${r.id}`,
      layer: "document",
      date: r.noc_valid_until,
      title: `NOC expires · ${property(r)}`,
      subtitle: [r.owner_name, agentName.get(r.agent_id)].filter(Boolean).join(" · ") || null,
      details: [
        { label: "Property", value: [property(r), r.community_area].filter(Boolean).join(", ") },
        ...(r.owner_name ? [{ label: "Owner", value: r.owner_name }] : []),
        { label: "Agent", value: agentName.get(r.agent_id) ?? "An agent" },
        { label: "NOC valid until", value: longDay(r.noc_valid_until) },
        ...(r.submitted_at ? [{ label: "Submitted", value: shortDay(r.submitted_at.slice(0, 10)) }] : []),
      ],
      links: [{ label: "Open Owner Documents", dash: "/owner-documents" }],
    })
  }
  for (const r of (links.data ?? []) as Row[]) {
    const day = dubaiDay(new Date(r.expires_at))
    out.push({
      id: `document:link:${r.id}`,
      layer: "document",
      date: day,
      title: `Document link expires · ${r.label || property(r)}`,
      subtitle: `${agentName.get(r.agent_id) ?? "An agent"} · owner has not submitted`,
      details: [
        { label: "Request", value: r.label || property(r) },
        { label: "Agent", value: agentName.get(r.agent_id) ?? "An agent" },
        { label: "Expires", value: longDay(day) },
        { label: "Status", value: "Waiting for the owner to fill it in" },
      ],
      links: [{ label: "Open Owner Documents", dash: "/owner-documents" }],
    })
  }
  return out
}

// ─── Company entries (migration 090) ─────────────────────────────────────────

export async function entryItems(admin: Admin, from: string, to: string): Promise<{ items: CalendarItem[]; available: boolean }> {
  const { entries, available } = await listEntries(admin, from, to)
  const items: CalendarItem[] = []
  for (const e of entries) {
    const span = eachDay(e.starts_on, e.ends_on)
    const audience = e.audience === "team" ? `${ENTRY_AUDIENCE_LABELS.team}${e.team_name ? ` · ${e.team_name}` : ""}` : ENTRY_AUDIENCE_LABELS[e.audience]
    span.forEach((day, i) => {
      if (!inSpan(day, from, to)) return
      items.push({
        id: `entry:${e.id}:${day}`,
        layer: "entry",
        date: day,
        time: e.all_day ? null : e.start_time,
        timeLabel: entryTimeLabel(e),
        title: span.length > 1 ? `${e.title} · Day ${i + 1}` : e.title,
        subtitle: [ENTRY_KIND_LABELS[e.kind], e.place].filter(Boolean).join(" · ") || null,
        details: [
          { label: "When", value: span.length > 1 ? `${shortDay(e.starts_on)} to ${shortDay(e.ends_on)} · ${entryTimeLabel(e)}` : `${longDay(day)} · ${entryTimeLabel(e)}` },
          { label: "Kind", value: ENTRY_KIND_LABELS[e.kind] },
          ...(e.place ? [{ label: "Place", value: e.place }] : []),
          { label: "For", value: audience },
          { label: "Morning email", value: e.notify_morning ? (e.notified_on ? `Sent on ${shortDay(e.notified_on)}` : "Goes at 09:00 on the first day") : "Off" },
          ...(e.notes ? [{ label: "Notes", value: e.notes }] : []),
          ...(e.created_by_name ? [{ label: "Added by", value: e.created_by_name }] : []),
        ],
        links: e.link ? [{ label: "Open link", url: e.link }] : [],
        dayOf: span.length > 1 ? { day: i + 1, of: span.length } : null,
        entry: e,
      })
    })
  }
  return { items, available }
}

// ─── UAE holidays (static) ───────────────────────────────────────────────────

export function holidayItems(from: string, to: string): CalendarItem[] {
  const out: CalendarItem[] = []
  for (const h of UAE_HOLIDAYS) {
    for (let i = 0; i < h.days; i++) {
      const day = shiftDay(h.date, i)
      if (!inSpan(day, from, to)) continue
      out.push({
        id: `holiday:${h.date}:${day}`,
        layer: "holiday",
        date: day,
        title: h.name,
        subtitle: h.expected ? "Expected · follows the moon sighting" : "Public holiday",
        details: [
          { label: "Holiday", value: h.days > 1 ? `${h.name} · ${h.days} days from ${shortDay(h.date)}` : `${h.name} · ${longDay(day)}` },
          { label: "Certainty", value: h.expected ? "Expected date; the government confirms it after the moon sighting" : "Fixed date" },
        ],
        links: [],
        dayOf: h.days > 1 ? { day: i + 1, of: h.days } : null,
      })
    }
  }
  return out
}

// ─── Automatic emails (from vercel.json's schedules, Dubai time) ─────────────

export function automaticItems(from: string, to: string): CalendarItem[] {
  const out: CalendarItem[] = []
  for (const day of eachDay(from, to)) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
    out.push({
      id: `automatic:daily:${day}`,
      layer: "automatic",
      date: day,
      time: "08:00",
      title: "Daily emails",
      subtitle: "08:00 boss report · 08:30 birthdays · 09:00 reminders",
      details: [
        { label: "08:00", value: "Daily report to the boss (daily-report cron)" },
        { label: "08:30", value: "Birthday greetings to members with a birthday today" },
        { label: "09:00", value: "FHI Assistant reminders due today, and the morning note for calendar entries" },
      ],
      links: [],
    })
    if (dow === 1) {
      out.push({
        id: `automatic:weekly:${day}`,
        layer: "automatic",
        date: day,
        time: "09:00",
        title: "Weekly report · Coaching note",
        subtitle: "09:00 to the boss · 09:00 to active agents and team leaders",
        details: [
          { label: "09:00", value: "Weekly report to the boss (weekly-report cron)" },
          { label: "09:00", value: "FHI Assistant's weekly coaching note to agents and team leaders active in the last 90 days" },
        ],
        links: [{ label: "Assistant usage", dash: "/fhi-chat/usage" }],
      })
    }
    if (day.endsWith("-01")) {
      out.push({
        id: `automatic:monthly:${day}`,
        layer: "automatic",
        date: day,
        time: "09:30",
        title: "Monthly report to the boss",
        subtitle: "09:30",
        details: [{ label: "09:30", value: "Monthly report to the boss (monthly-report cron)" }],
        links: [],
      })
    }
  }
  return out
}

// ─── All together ────────────────────────────────────────────────────────────

export type CalendarFeed = {
  from: string
  to: string
  items: CalendarItem[]
  /** Layers whose builder failed, with why — the page shows a note, the rest still draws. */
  failed: Array<{ layer: CalendarLayer; error: string }>
  /** False until migration 090 is applied: the page then hides Add entry and says so. */
  entriesAvailable: boolean
}

export async function buildCalendarFeed(admin: Admin, from: string, to: string): Promise<CalendarFeed> {
  const jobs: Array<[CalendarLayer, Promise<CalendarItem[]>]> = [
    ["event", eventItems(admin, from, to)],
    ["project", projectItems(admin, from, to)],
    ["deal", dealItems(admin, from, to)],
    ["birthday", birthdayItems(admin, from, to)],
    ["document", documentItems(admin, from, to)],
  ]
  const entries = entryItems(admin, from, to)
  const settled = await Promise.allSettled(jobs.map(([, p]) => p))
  const items: CalendarItem[] = []
  const failed: CalendarFeed["failed"] = []
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value)
    else failed.push({ layer: jobs[i][0], error: r.reason instanceof Error ? r.reason.message : String(r.reason) })
  })
  let entriesAvailable = false
  try {
    const e = await entries
    items.push(...e.items)
    entriesAvailable = e.available
  } catch (e) {
    failed.push({ layer: "entry", error: e instanceof Error ? e.message : String(e) })
  }
  items.push(...holidayItems(from, to), ...automaticItems(from, to))
  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title))
  return { from, to, items, failed, entriesAvailable }
}
