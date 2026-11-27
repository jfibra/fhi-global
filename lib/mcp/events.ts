import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { AuditActor, AuditRequestContext } from "@/lib/audit-log"
import { agentWebsite, placementIssue, type EventScope } from "@/lib/events/access"
import { EVENT_BRANDS, eventBrand } from "@/lib/events/brands"
import { CERTIFICATE_DEFAULTS } from "@/lib/events/certificate"
import { MAX_EVENT_DAYS, dubaiHHMM, dubaiYMD, eventIsPast, eventSchedule, eventWhenLabel, normalizeEventDays } from "@/lib/events/dates"
import { MAX_DAY_PAX, normalizeDayPax } from "@/lib/events/pax"
import { eventPublicPath } from "@/lib/events/paths"
import { sanitizeEventInput } from "@/lib/events/validate"
import { createEvent, updateEvent, type EventWriteMeta } from "@/lib/events/write"
import { EVENT_CARD_TOOL_META, registerEventCard } from "@/lib/mcp/event-card"

/**
 * Claude's event tools (2026-11-27, boss's idea via Juliecor): a person
 * makes an event by talking to Claude. The only tools on FHI's MCP server
 * that write. Registered ONLY on the signed-in endpoint (POST /api/mcp/me),
 * ONLY for a role that runs events in the dashboard, and ONLY when the
 * person ticked the events box on the consent screen (scope fhi:events on
 * the grant). The keyed endpoint (/api/mcp) never gets them: it has no
 * person behind it.
 *
 * Whose events — the dashboard's own two tiers (lib/events/access.ts):
 *   · admin staff (scope "all", buildFhiMcpServer) → COMPANY events. An
 *     agent's own event can be read and copied from, never changed.
 *   · agents and team leaders (scope "own", buildPersonalMcpServer) → ONLY
 *     the events they own: every lookup is pinned to their id, so another
 *     person's event answers "no event matches", as if it did not exist.
 *     They choose where it appears (`where`: fhiglobal.ae/events, their FHI
 *     website, or both — placementIssue is the rule, a website is needed
 *     only to show it there).
 *
 *   fhi_event_create   a draft — from what the person said, or copied from a
 *                      past event (photo, venue + map pin, sign-up fields,
 *                      certificate design, days, seats). Never public.
 *   fhi_event_update   change a draft.
 *   fhi_event_publish  put a complete draft live, or take a live event back
 *                      to draft.
 *   fhi_event_check    read one event with what is still missing (or list
 *                      the drafts and upcoming events).
 *
 * Every save goes through lib/events/write.ts — the functions the dashboard
 * routes call — so the slug, audit row ("… via Claude"), page purges and
 * IndexNow are the same. Rules that are only Claude's live here:
 *   · a new event is ALWAYS a draft; publishing is its own tool and refuses
 *     an event without a date, venue or description (the answer lists what
 *     is missing and how to fix each, so Claude can guide the person);
 *   · a start in the past is refused (a wrong year is the usual slip);
 *   · the same title at the same date and time returns the event that is
 *     already there instead of making a second one;
 *   · CLAUDE_EVENTS_DAILY_LIMIT (20) new events per person per 24 hours;
 *   · nothing is ever deleted; registrations, certificates and emails stay
 *     in the dashboard.
 *   · a map pin is never made from typed text (the Maps rule): it comes only
 *     with a venue reused from an event whose pin was picked in the dashboard.
 *
 * What the person SEES: every tool points at the event card
 * (lib/mcp/event-card.ts), which Claude shows in the chat with the tool's
 * answer — photo, date, venue, seats, Draft / Live, what is missing.
 */

export type EventWriter = {
  /** The signed-in person every write is logged under. */
  actor: AuditActor
  request: Partial<AuditRequestContext>
  /** Where links point: the site in production, this server in dev. */
  origin: string
  /** The person's dashboard base, e.g. "/admin" or "/agent". */
  dashboard: string
  /** "all" = admin staff, acting on company events; "own" = a Website Builder role, only the events they own. */
  scope: EventScope
  /** The owner's Website Builder site, read once per call by run() — never set by the caller. */
  site?: { slug: string; isPublished: boolean } | null
}

/** The profile id an "own" writer is pinned to; null for admin staff. */
const ownerOf = (w: EventWriter) => (w.scope.kind === "own" ? w.scope.agentId : null)

export const EVENT_TOOL_NAMES = ["fhi_event_create", "fhi_event_update", "fhi_event_publish", "fhi_event_check"] as const

const DAILY_LIMIT = Math.max(1, Number(process.env.CLAUDE_EVENTS_DAILY_LIMIT) || 20)

/* ───────────────────────── rows ───────────────────────── */

const ROW =
  "id, slug, agent_id, title, description, brand, image_url, video_url, venue, venue_lat, venue_lng, venue_place_id, status, event_date, event_days, day_times, day_pax, registration_open, registration_fields, certificate, show_on_main, show_on_website, created_at"

type Row = {
  id: string
  slug: string | null
  agent_id: string | null
  title: string
  description: string | null
  brand: string | null
  image_url: string | null
  video_url: string | null
  venue: string | null
  venue_lat: number | null
  venue_lng: number | null
  venue_place_id: string | null
  status: string | null
  event_date: string | null
  event_days: number | null
  day_times: unknown
  day_pax: unknown
  registration_open: boolean | null
  registration_fields: unknown
  certificate: unknown
  show_on_main: boolean | null
  show_on_website: boolean | null
  created_at: string
}

/** What a tool answers when it cannot go on: plain data for Claude to read out, never a stack. */
class Problem extends Error {
  constructor(readonly payload: Record<string, unknown>) {
    super("problem")
  }
}

const reply = (payload: unknown, isError = false) => ({ content: [{ type: "text" as const, text: JSON.stringify(payload) }], isError })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
/** A literal for ILIKE: the pattern characters lose their meaning. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
const pinOf = (r: Row) => (r.venue_lat != null && r.venue_lng != null ? { lat: r.venue_lat, lng: r.venue_lng, placeId: r.venue_place_id } : null)
const statusOf = (r: Row) => r.status ?? "draft"

const editUrl = (r: Row, w: EventWriter) => `${w.origin}${w.dashboard}/events?event=${r.id}`
/**
 * Where the event's page is: /events/<slug> for a company event and for an
 * agent's event listed on fhiglobal.ae; an agent's website-only event lives
 * on their site (lib/events/paths.ts — the same choice the dashboard makes).
 */
function publicUrl(r: Row, w: EventWriter): string {
  const main = `/events/${r.slug ?? r.id}`
  if (!r.agent_id || r.show_on_main === true) return `${w.origin}${main}`
  const site = r.agent_id === ownerOf(w) ? w.site : null
  return `${w.origin}${eventPublicPath(r, r.show_on_website !== false && site?.isPublished ? site.slug : null)}`
}

/** For an agent's event: where it is listed, in words. */
function appearsOn(r: Row): string | null {
  if (!r.agent_id) return null
  const main = r.show_on_main === true
  const site = r.show_on_website !== false
  return main && site ? "fhiglobal.ae/events and your FHI website" : main ? "fhiglobal.ae/events" : site ? "your FHI website" : "nowhere yet"
}

/**
 * Events a reference points at: an id, a slug or page link, or words from
 * the title (all of them must appear). Newest date first, so "the last
 * orientation" is the first row.
 */
async function findEvents(ref: string, w: EventWriter, companyOnly = false): Promise<Row[]> {
  const admin = createAdminSupabase()
  const owner = ownerOf(w)
  let q = ref.trim()
  if (!q) return []
  // A pasted link: the last path segment is the slug (or the id in ?event=).
  if (/^https?:\/\//i.test(q)) {
    try {
      const u = new URL(q)
      q = u.searchParams.get("event") ?? u.pathname.split("/").filter(Boolean).pop() ?? q
    } catch {
      /* keep the text */
    }
  }
  if (UUID_RE.test(q)) {
    let byId = admin.from("events").select(ROW).eq("id", q).is("deleted_at", null)
    if (owner) byId = byId.eq("agent_id", owner)
    else if (companyOnly) byId = byId.is("agent_id", null)
    const { data, error } = await byId.maybeSingle<Row>()
    if (error) throw new Error(error.message)
    return data ? [data] : []
  }
  if (/^[a-z0-9-]+$/.test(q)) {
    let bySlug = admin.from("events").select(ROW).eq("slug", q).is("deleted_at", null)
    if (owner) bySlug = bySlug.eq("agent_id", owner)
    else if (companyOnly) bySlug = bySlug.is("agent_id", null)
    const { data } = await bySlug.maybeSingle<Row>()
    if (data) return [data]
  }
  let query = admin.from("events").select(ROW).is("deleted_at", null)
  // An "own" writer sees only their events — here, so no tool can reach another person's by any reference.
  if (owner) query = query.eq("agent_id", owner)
  else if (companyOnly) query = query.is("agent_id", null)
  for (const word of q.split(/\s+/).filter(Boolean).slice(0, 8)) query = query.ilike("title", `%${literal(word)}%`)
  const { data, error } = await query.order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

const brief = (r: Row) => ({
  id: r.id,
  title: r.title,
  status: statusOf(r),
  when: eventWhenLabel(r.event_date, r.event_days, "short") ?? "no date yet",
  host: r.agent_id ? "an agent's own event" : "company event",
})

const listHint = (w: EventWriter) => (ownerOf(w) ? "Call fhi_event_check with no event to list your events, then use the id." : "Call fhi_event_check with no event to list the drafts and upcoming events, then use the id.")

/** The event to copy something FROM — the most recent match; the others are named so Claude can say which it took. */
async function source(ref: string, what: string, w: EventWriter): Promise<{ row: Row; others: ReturnType<typeof brief>[] }> {
  const found = await findEvents(ref, w)
  if (!found.length) {
    throw new Problem({
      saved: false,
      problem: ownerOf(w) ? `None of your events matches "${ref}" to take the ${what} from.` : `No event matches "${ref}" to take the ${what} from.`,
      do: ownerOf(w) ? "Only your own events can be copied from. Ask the person which of their events they mean, or call fhi_event_check with no event to list them." : "Ask the person which event they mean, or call fhi_events (status all) to look for it.",
    })
  }
  return { row: found[0], others: found.slice(1, 4).map(brief) }
}

/** The ONE event a write acts on, unambiguous: a company event for admin staff, one of their own for an owner. */
async function target(ref: string, w: EventWriter): Promise<Row> {
  // Admin staff write company events only, so the reference is looked up among those first: an agent's
  // event with the same words in its title must not make it ambiguous. Only when no company event
  // matches is the wider search made, to say "that one is an agent's own event".
  let found = await findEvents(ref, w, !ownerOf(w))
  if (!found.length && !ownerOf(w)) found = await findEvents(ref, w)
  if (!found.length) {
    throw new Problem({ saved: false, problem: ownerOf(w) ? `None of your events matches "${ref}".` : `No event matches "${ref}".`, do: listHint(w) })
  }
  const exact = found.filter((r) => r.title.trim().toLowerCase() === ref.trim().toLowerCase())
  const row = found.length === 1 ? found[0] : exact.length === 1 ? exact[0] : null
  if (!row) {
    throw new Problem({ saved: false, problem: `"${ref}" matches ${found.length} events.`, which: found.map(brief), do: "Ask the person which one, then call again with its id." })
  }
  if (!ownerOf(w) && row.agent_id) {
    throw new Problem({
      saved: false,
      problem: `"${row.title}" is an agent's own event. From Claude only company events are created or changed.`,
      do: `It is managed in the dashboard: ${editUrl(row, w)}`,
    })
  }
  return row
}

/* ───────────────────────── what is missing ───────────────────────── */

type Missing = { what: string; needed_to_publish: boolean; how_to_fix: string }

/** What an event still lacks, each with how to fix it — the list Claude reads out to guide the person. */
function missingOf(r: Row, w: EventWriter): Missing[] {
  const out: Missing[] = []
  if (!r.event_date) {
    out.push({ what: "Date and start time", needed_to_publish: true, how_to_fix: "Ask the person for the date and the start time, then call fhi_event_update." })
  } else if (eventIsPast(r.event_date, r.event_days, Date.now(), r.day_times)) {
    out.push({ what: "The date is already past", needed_to_publish: true, how_to_fix: "Ask the person for the new date, then call fhi_event_update." })
  }
  if (!r.venue?.trim()) {
    out.push({ what: "Venue", needed_to_publish: true, how_to_fix: "Ask where it is held (fhi_event_update venue), or which past event was at the same place (venue_from reuses its venue and map pin)." })
  }
  if (!r.description?.trim()) {
    out.push({ what: "Description", needed_to_publish: true, how_to_fix: "Offer to write it from a few notes, show it to the person, then save it with fhi_event_update." })
  }
  if (!r.image_url) {
    out.push({ what: "Cover photo", needed_to_publish: false, how_to_fix: `A new photo is uploaded in the dashboard: ${editUrl(r, w)} — or reuse a past event's photo with photo_from.` })
  }
  if (r.venue?.trim() && !pinOf(r)) {
    out.push({ what: "Map pin for the venue", needed_to_publish: false, how_to_fix: `Pick the venue from the suggestions in the dashboard: ${editUrl(r, w)} — or reuse a past event's venue with venue_from.` })
  }
  return out
}

/** One event as Claude should describe it: what is saved, where to open it, what is missing. */
function describe(r: Row, w: EventWriter) {
  const days = normalizeEventDays(r.event_days)
  const status = statusOf(r)
  // A live event is already published: only what would improve its page is still worth saying.
  const missing = missingOf(r, w).filter((m) => status !== "published" || !m.needed_to_publish)
  const past = eventIsPast(r.event_date, r.event_days, Date.now(), r.day_times)
  const seats = normalizeDayPax(r.day_pax, days)
  return {
    id: r.id,
    title: r.title,
    status,
    is_public: status === "published",
    ...(past ? { is_past: true } : {}),
    when: eventWhenLabel(r.event_date, r.event_days, "long") ?? "no date yet",
    ...(days > 1 ? { schedule: eventSchedule(r.event_date, days, r.day_times).map((d) => `Day ${d.day}: ${d.dateLabel}, ${d.time}`) } : {}),
    time_zone: "Dubai time (GST)",
    seats_per_day: seats.some((v) => v !== null) ? seats.map((v) => v ?? "no limit") : "no limit",
    venue: r.venue ?? null,
    has_map_pin: Boolean(pinOf(r)),
    has_cover_photo: Boolean(r.image_url),
    cover_photo: r.image_url ?? null,
    description: r.description ?? null,
    brand: eventBrand(r.brand).name,
    registration_open: r.registration_open !== false,
    ...(appearsOn(r) ? { appears_on: appearsOn(r) } : {}),
    open_in_dashboard: editUrl(r, w),
    public_page: status === "published" ? publicUrl(r, w) : `${publicUrl(r, w)} (works once it is published)`,
    ready_to_publish: status !== "published" && !missing.some((m) => m.needed_to_publish),
    missing,
  }
}

async function rowById(id: string): Promise<Row> {
  const { data, error } = await createAdminSupabase().from("events").select(ROW).eq("id", id).is("deleted_at", null).maybeSingle<Row>()
  if (error || !data) throw new Error(error?.message ?? "The event could not be read back")
  return data
}

/* ───────────────────────── dates ───────────────────────── */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** The instant of a Dubai date + time (GST, UTC+4, no DST) — refusing a date that does not exist and a start already past. */
function startOf(day: string, time: string): string {
  const probe = new Date(`${day}T00:00:00Z`)
  if (!DAY_RE.test(day) || Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== day) {
    throw new Problem({ saved: false, problem: `"${day}" is not a real date.`, do: "Ask the person for the date again. Send it as YYYY-MM-DD." })
  }
  if (!TIME_RE.test(time)) {
    throw new Problem({ saved: false, problem: `"${time}" is not a time.`, do: "Send the start as 24-hour HH:MM in Dubai time, e.g. 15:00 for 3 pm." })
  }
  const at = new Date(`${day}T${time}:00+04:00`)
  if (at.getTime() < Date.now()) {
    throw new Problem({
      saved: false,
      problem: `${day} ${time} (Dubai time) is already past. Today in Dubai is ${dubaiYMD(new Date())}.`,
      do: "Check the date and the YEAR with the person. Nothing was saved.",
    })
  }
  return at.toISOString()
}

/* ───────────────────────── the tools' inputs ───────────────────────── */

const DAY = z.string().regex(DAY_RE, "YYYY-MM-DD")
const TIME = z.string().regex(TIME_RE, "24-hour HH:MM")
const REF = z.string().min(1).max(300)

const FIELDS = {
  title: z.string().min(1).max(160).optional().describe("The event's name as it should read on the website"),
  date: DAY.optional().describe("The first day, YYYY-MM-DD, as a Dubai date. Work out the full date including the YEAR; if the person did not make it clear, ask — never guess."),
  start_time: TIME.optional().describe("When day 1 starts, Dubai time, 24-hour HH:MM (3 pm = 15:00)"),
  days: z.number().int().min(1).max(MAX_EVENT_DAYS).optional().describe("How many consecutive days it runs (1 when not said)"),
  day_times: z.array(TIME.nullable()).max(MAX_EVENT_DAYS).optional().describe("Only for a multi-day event whose days start at different times: the start of each day, day 1 first; null = same as day 1"),
  seats: z.number().int().min(1).max(MAX_DAY_PAX).optional().describe("Seats per day: the same limit on every day. Leave out for no limit."),
  seats_per_day: z.array(z.number().int().min(1).max(MAX_DAY_PAX).nullable()).max(MAX_EVENT_DAYS).optional().describe("Seats day by day (day 1 first) when the days differ; null = no limit that day. [null] removes the limit of a one-day event."),
  venue: z.string().max(300).optional().describe("Where it is held: the venue's name and area, as the person said it"),
  description: z.string().max(5000).optional().describe("The public description, plain text in short paragraphs. Write it yourself from the person's notes when they ask, and show it to them."),
  brand: z.enum(EVENT_BRANDS.map((b) => b.key) as [string, ...string[]]).optional().describe(`Whose event it is: ${EVENT_BRANDS.map((b) => `${b.key} = ${b.name}`).join("; ")}. fhiglobal when not said.`),
  video_url: z.string().max(1000).optional().describe("A video LINK (YouTube, Facebook, Google Drive, .mp4). An empty string removes it."),
  registration_open: z.boolean().optional().describe("Whether people can sign up on the page (true when not said)"),
  venue_from: REF.optional().describe("Reuse the venue AND its map pin from another event: its id, or words from its title (the most recent match is taken)"),
  photo_from: REF.optional().describe("Reuse the cover photo of another event: its id, or words from its title (the most recent match is taken)"),
}

type FieldArgs = {
  where?: "fhiglobal" | "website" | "both"
  title?: string
  date?: string
  start_time?: string
  days?: number
  day_times?: (string | null)[]
  seats?: number
  seats_per_day?: (number | null)[]
  venue?: string
  description?: string
  brand?: string
  video_url?: string
  registration_open?: boolean
  venue_from?: string
  photo_from?: string
}

const WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const CHANGES = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
const READS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const FIELD_WORDS: Record<string, string> = {
  title: "title",
  description: "description",
  brand: "brand",
  image_url: "cover photo",
  venue: "venue",
  status: "status",
  event_date: "date and start time",
  event_days: "number of days",
  day_times: "start time per day",
  day_pax: "seats",
  registration_open: "registration open or closed",
  video_url: "video link",
  venue_lat: "map pin",
  venue_lng: "map pin",
  venue_place_id: "map pin",
}

/* ───────────────────────── create ───────────────────────── */

async function create(a: FieldArgs & { copy_from?: string }, w: EventWriter) {
  const admin = createAdminSupabase()
  const meta: EventWriteMeta = { actor: w.actor, source: "claude", request: w.request }
  const notes: string[] = []

  const copy = a.copy_from ? await source(a.copy_from, "details", w) : null
  const venueSrc = a.venue_from ? await source(a.venue_from, "venue", w) : null
  const photoSrc = a.photo_from ? await source(a.photo_from, "cover photo", w) : null
  const from = copy?.row ?? null

  // An owner's event has to appear somewhere: fhiglobal.ae/events, their website, or both (the dashboard's rule and default).
  const ownerId = ownerOf(w)
  const site = ownerId ? (w.site ?? null) : null
  let placement: { show_on_main?: boolean; show_on_website?: boolean } = {}
  if (ownerId) {
    const onMain = a.where ? a.where !== "website" : from ? from.show_on_main === true || !site : true
    const onWebsite = a.where ? a.where !== "fhiglobal" : from ? from.show_on_website !== false && Boolean(site) : Boolean(site)
    const issue = placementIssue(onMain, onWebsite, Boolean(site))
    if (issue) throw new Problem({ saved: false, problem: issue.error, do: "Tell the person, and ask where the event should appear. Nothing was saved." })
    placement = { show_on_main: onMain, show_on_website: onWebsite }
  }

  const title = (a.title ?? from?.title ?? "").trim()
  const time = a.start_time ?? (from?.event_date ? dubaiHHMM(new Date(from.event_date)) : undefined)
  const need: Missing[] = []
  if (!title) need.push({ what: "Title", needed_to_publish: true, how_to_fix: "Ask the person what the event is called." })
  if (!a.date) need.push({ what: "Date", needed_to_publish: true, how_to_fix: "Ask the person which date, and make sure of the year." })
  if (!time) need.push({ what: "Start time", needed_to_publish: true, how_to_fix: "Ask the person what time it starts (Dubai time)." })
  if (need.length || !a.date || !time) {
    throw new Problem({ saved: false, problem: "Nothing was saved yet: the event needs a title, a date and a start time.", missing: need, do: "Ask the person for what is missing in one short question, then call fhi_event_create again with everything." })
  }
  const eventDate = startOf(a.date, time)

  const days = normalizeEventDays(a.days ?? from?.event_days ?? 1)
  const sameLength = from ? normalizeEventDays(from.event_days) === days : false
  const dayTimes = a.day_times ?? (sameLength ? from?.day_times : null) ?? []
  const dayPax = a.seats_per_day ?? (a.seats !== undefined ? Array.from({ length: days }, () => a.seats) : sameLength ? from?.day_pax : null) ?? []

  // The venue's text and its pin travel together: a typed venue never gets a pin.
  let venue = (a.venue ?? "").trim()
  let pin: ReturnType<typeof pinOf> = null
  if (venueSrc) {
    venue = venueSrc.row.venue?.trim() || venue
    pin = venueSrc.row.venue?.trim() ? pinOf(venueSrc.row) : null
    if (!venueSrc.row.venue?.trim()) notes.push(`"${venueSrc.row.title}" has no venue saved, so none was reused.`)
    else if (!pin) notes.push(`"${venueSrc.row.title}" has no map pin, so only the venue's name was reused.`)
  } else if (from && (!venue || venue.toLowerCase() === (from.venue ?? "").trim().toLowerCase())) {
    venue = from.venue?.trim() ?? ""
    pin = pinOf(from)
  }

  let image = from?.image_url ?? ""
  if (photoSrc) {
    if (photoSrc.row.image_url) image = photoSrc.row.image_url
    else notes.push(`"${photoSrc.row.title}" has no cover photo, so none was reused.`)
  }

  const input = sanitizeEventInput({
    title,
    description: a.description ?? from?.description ?? "",
    brand: a.brand ?? from?.brand ?? "fhiglobal",
    image_url: image,
    venue,
    status: "draft",
    event_date: eventDate,
    event_days: days,
    day_times: dayTimes,
    day_pax: dayPax,
    registration_open: a.registration_open ?? true,
    // A copy keeps the past event's sign-up form and certificate; a new one starts like the dashboard's form.
    registration_fields: from?.registration_fields ?? [],
    certificate: from?.certificate ?? { ...CERTIFICATE_DEFAULTS },
    ...(a.video_url !== undefined ? { video_url: a.video_url } : {}),
    venue_lat: pin?.lat ?? null,
    venue_lng: pin?.lng ?? null,
    venue_place_id: pin?.placeId ?? null,
    ...placement,
  })
  if (a.video_url && !input.video_url) notes.push("The video link is not one the website can play, so it was left out.")

  // The same title at the same moment is the same event: answer with it instead of making a second one.
  let twins = admin.from("events").select(ROW).is("deleted_at", null).eq("event_date", eventDate).ilike("title", literal(input.title))
  twins = ownerId ? twins.eq("agent_id", ownerId) : twins.is("agent_id", null)
  const { data: twin } = await twins.limit(1).maybeSingle<Row>()
  if (twin) {
    return { saved: false, already_existed: true, say: "An event with this title at this date and time is already there, so no second one was made. Tell the person, and show what it still needs.", event: describe(twin, w) }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countErr } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("category", "events")
    .eq("event", "created")
    .eq("source", "claude")
    .eq("actor_id", w.actor.id)
    .gte("created_at", since)
  if (countErr) throw new Error(countErr.message)
  if ((count ?? 0) >= DAILY_LIMIT) {
    throw new Problem({ saved: false, problem: `${DAILY_LIMIT} events were already created from Claude in the last 24 hours, which is the limit.`, do: "Create this one in the dashboard, or try again tomorrow." })
  }

  const made = await createEvent(admin, { input, ownerId, site, meta })
  if (!made.ok) throw new Error(made.error)
  const row = await rowById(made.id)
  return {
    saved: true,
    say: "Saved as a DRAFT: it is not public yet. Tell the person what was saved and what is still missing, and offer to fill what you can. Publish only when they ask.",
    ...(copy ? { copied_from: brief(copy.row), ...(copy.others.length ? { other_matches_not_used: copy.others } : {}) } : {}),
    ...(notes.length ? { notes } : {}),
    event: describe(row, w),
  }
}

/* ───────────────────────── update ───────────────────────── */

async function update(a: FieldArgs & { event: string }, w: EventWriter) {
  const admin = createAdminSupabase()
  const row = await target(a.event, w)
  if (statusOf(row) !== "draft") {
    throw new Problem({
      saved: false,
      problem: `"${row.title}" is ${statusOf(row) === "published" ? "live on the website" : statusOf(row)}. From Claude only a draft is changed.`,
      do: `Either take it back to draft first (fhi_event_publish with action "unpublish"), change it, then publish again — tell the person the page is hidden meanwhile — or change it in the dashboard: ${editUrl(row, w)}`,
    })
  }
  const notes: string[] = []
  const venueSrc = a.venue_from ? await source(a.venue_from, "venue", w) : null
  const photoSrc = a.photo_from ? await source(a.photo_from, "cover photo", w) : null

  const given = (["title", "date", "start_time", "days", "day_times", "seats", "seats_per_day", "venue", "description", "brand", "video_url", "registration_open", "venue_from", "photo_from", "where"] as const).filter((k) => a[k] !== undefined)
  if (!given.length) throw new Problem({ saved: false, problem: "No change was given.", do: "Send the fields to change." })

  // The dashboard's whole payload, from the saved row, with the changes on top.
  const body: Record<string, unknown> = {
    title: a.title?.trim() || row.title,
    description: a.description !== undefined ? a.description : (row.description ?? ""),
    brand: a.brand ?? row.brand ?? "fhiglobal",
    image_url: row.image_url ?? "",
    venue: row.venue ?? "",
    status: statusOf(row),
    event_date: row.event_date ?? "",
    registration_open: a.registration_open ?? row.registration_open !== false,
  }

  if (a.date !== undefined || a.start_time !== undefined) {
    const day = a.date ?? (row.event_date ? dubaiYMD(new Date(row.event_date)) : undefined)
    const time = a.start_time ?? (row.event_date ? dubaiHHMM(new Date(row.event_date)) : undefined)
    if (!day || !time) {
      throw new Problem({ saved: false, problem: "This event has no date yet, so it needs both the date and the start time.", do: "Ask the person for the one that is missing." })
    }
    body.event_date = startOf(day, time)
  }

  // Days, per-day times and seats are saved together so they stay the same length.
  const days = normalizeEventDays(a.days ?? row.event_days ?? 1)
  body.event_days = days
  body.day_times = a.day_times ?? row.day_times ?? []
  body.day_pax = a.seats_per_day ?? (a.seats !== undefined ? Array.from({ length: days }, () => a.seats) : (row.day_pax ?? []))
  // More days, and every day so far had the same seat limit: the new days get it too
  // (in the dashboard a new day starts with no limit, which is not what "make it two days" means).
  if (a.seats === undefined && a.seats_per_day === undefined) {
    const before = normalizeDayPax(row.day_pax, row.event_days)
    if (days > before.length && before[0] !== null && before.every((v) => v === before[0])) {
      body.day_pax = Array.from({ length: days }, () => before[0])
      notes.push(`The added day${days - before.length > 1 ? "s" : ""} got the same ${before[0]} seats as the other${before.length > 1 ? "s" : ""}.`)
    }
  }

  if (venueSrc) {
    if (!venueSrc.row.venue?.trim()) throw new Problem({ saved: false, problem: `"${venueSrc.row.title}" has no venue saved.`, do: "Ask the person for the venue, or another event to take it from." })
    const pin = pinOf(venueSrc.row)
    body.venue = venueSrc.row.venue
    body.venue_lat = pin?.lat ?? null
    body.venue_lng = pin?.lng ?? null
    body.venue_place_id = pin?.placeId ?? null
    if (!pin) notes.push(`"${venueSrc.row.title}" has no map pin, so only the venue's name was reused.`)
  } else if (a.venue !== undefined) {
    const next = a.venue.trim()
    body.venue = next
    // A different venue makes the old pin wrong: it goes, and comes back only from a picked place.
    if (next.toLowerCase() !== (row.venue ?? "").trim().toLowerCase() && pinOf(row)) {
      body.venue_lat = null
      body.venue_lng = null
      body.venue_place_id = null
      notes.push("The venue changed, so its old map pin was removed.")
    }
  }

  if (photoSrc) {
    if (!photoSrc.row.image_url) throw new Problem({ saved: false, problem: `"${photoSrc.row.title}" has no cover photo.`, do: "Ask the person for another event to take the photo from, or upload one in the dashboard." })
    body.image_url = photoSrc.row.image_url
  }
  if (a.video_url !== undefined) body.video_url = a.video_url
  if (a.where && ownerOf(w)) {
    body.show_on_main = a.where !== "website"
    body.show_on_website = a.where !== "fhiglobal"
  }

  const input = sanitizeEventInput(body)
  if (a.video_url && !input.video_url) notes.push("The video link is not one the website can play, so it was left out.")

  const saved = await updateEvent(admin, { id: row.id, input, scope: w.scope, meta: { actor: w.actor, source: "claude", request: w.request } })
  if (!saved.ok) {
    // A placement the rule refuses (no website to show it on) is the person's to fix, so it is said as it is.
    if (saved.code) throw new Problem({ saved: false, problem: saved.error, do: "Tell the person. Nothing was changed." })
    throw new Error(saved.error)
  }
  const changed = [...new Set(saved.changedKeys.map((k) => FIELD_WORDS[k] ?? k))]
  return {
    saved: true,
    changed: changed.length ? changed : "nothing: the event already had these values",
    say: "Still a draft. Tell the person what changed and what is still missing.",
    ...(notes.length ? { notes } : {}),
    event: describe(await rowById(row.id), w),
  }
}

/* ───────────────────────── publish / unpublish ───────────────────────── */

async function publish(a: { event: string; action: "publish" | "unpublish" }, w: EventWriter) {
  const admin = createAdminSupabase()
  const row = await target(a.event, w)
  const status = statusOf(row)
  const going = a.action === "publish" ? "published" : "draft"

  if (a.action === "publish") {
    if (status === "published") return { saved: false, say: "It is already live.", event: describe(row, w) }
    const missing = missingOf(row, w)
    if (missing.some((m) => m.needed_to_publish)) {
      throw new Problem({
        saved: false,
        published: false,
        problem: `"${row.title}" cannot go live yet.`,
        missing,
        do: "Tell the person what is missing. Fill what you can with fhi_event_update (offer to write the description), then publish again.",
      })
    }
  } else if (status !== "published") {
    return { saved: false, say: `It is not live (it is ${status}), so there is nothing to take down.`, event: describe(row, w) }
  }

  // The dashboard's publish switch: the saved row with the other status.
  const input = sanitizeEventInput({
    title: row.title,
    description: row.description ?? "",
    brand: row.brand ?? "fhiglobal",
    image_url: row.image_url ?? "",
    event_date: row.event_date ?? "",
    venue: row.venue ?? "",
    status: going,
    registration_open: row.registration_open !== false,
  })
  const saved = await updateEvent(admin, { id: row.id, input, scope: w.scope, meta: { actor: w.actor, source: "claude", request: w.request } })
  if (!saved.ok) throw new Error(saved.error)
  const after = await rowById(row.id)

  if (a.action === "publish") {
    const reminders = missingOf(after, w).filter((m) => !m.needed_to_publish)
    return {
      saved: true,
      published: true,
      say: `It is LIVE: ${publicUrl(after, w)}. Give the person the link${reminders.length ? " and mention what would make the page better" : ""}.`,
      ...(reminders.length ? { reminders } : {}),
      event: describe(after, w),
    }
  }
  const { count } = await admin.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", row.id)
  return {
    saved: true,
    published: false,
    say: `Back to draft: the page is no longer public.${count ? ` ${count} ${count === 1 ? "person has" : "people have"} already registered; their registrations are kept.` : ""}`,
    event: describe(after, w),
  }
}

/* ───────────────────────── check / list ───────────────────────── */

async function check(a: { event?: string }, w: EventWriter) {
  if (a.event?.trim()) {
    const found = await findEvents(a.event, w)
    if (!found.length) throw new Problem({ problem: ownerOf(w) ? `None of your events matches "${a.event}".` : `No event matches "${a.event}".`, do: listHint(w) })
    if (found.length > 1 && !found.some((r) => r.title.trim().toLowerCase() === a.event?.trim().toLowerCase())) {
      return { matches: found.length, which: found.map(brief), say: "Several events match. Ask the person which one, or use an id." }
    }
    const row = found.find((r) => r.title.trim().toLowerCase() === a.event?.trim().toLowerCase()) ?? found[0]
    return { event: describe(row, w), ...(row.agent_id && !ownerOf(w) ? { note: "This is an agent's own event: it can be read here, and is changed only in the dashboard." } : {}) }
  }
  const owner = ownerOf(w)
  let mine = createAdminSupabase().from("events").select(ROW).is("deleted_at", null)
  mine = owner ? mine.eq("agent_id", owner) : mine.is("agent_id", null)
  const { data, error } = await mine.order("created_at", { ascending: false }).limit(200)
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as Row[]).filter((r) => statusOf(r) === "draft" || (statusOf(r) === "published" && !eventIsPast(r.event_date, r.event_days, Date.now(), r.day_times)))
  const at = (r: Row) => (r.event_date ? new Date(r.event_date).getTime() : 0)
  const line = (r: Row) => {
    const missing = missingOf(r, w)
    return { ...brief(r), ready_to_publish: statusOf(r) === "draft" && !missing.some((m) => m.needed_to_publish), missing: missing.map((m) => m.what) }
  }
  return {
    drafts: rows.filter((r) => statusOf(r) === "draft").sort((x, y) => at(x) - at(y)).slice(0, 25).map(line),
    upcoming_live: rows.filter((r) => statusOf(r) === "published").sort((x, y) => at(x) - at(y)).slice(0, 25).map(line),
    say: owner ? "Your own events only. Past ones: fhi_my_events." : "Company events only. Past events: fhi_events with when past.",
  }
}

/* ───────────────────────── registration ───────────────────────── */

/**
 * What the server tells Claude about these tools. For admin staff it is the
 * whole instruction text (lib/mcp/server.ts); for an agent or team leader
 * `eventToolNotes` is appended to the personal server's own (lib/mcp/personal.ts).
 */
export function eventToolInstructions(w: EventWriter): string {
  return [
    `You are connected to FHI Global, a Dubai real-estate company, as ${w.actor.name ?? "an admin"} (admin staff). Besides reading, you can create, change and publish COMPANY EVENTS with fhi_event_create, fhi_event_update, fhi_event_publish and fhi_event_check.`,
    ...eventToolRules(w),
  ].join(" ")
}

/** The same rules for a person who runs their OWN events (agents, team leaders). */
export function eventToolNotes(w: EventWriter): string {
  return [
    "You can also create, change and publish this person's OWN events with fhi_event_create, fhi_event_update, fhi_event_publish and fhi_event_check. They reach only the events this person owns; nothing else here writes to FHI.",
    "An own event appears on fhiglobal.ae/events, on the person's FHI website, or both (`where`). When they did not say, it goes on both if they have a website and on fhiglobal.ae otherwise: tell them where it will appear.",
    ...eventToolRules(w),
  ].join(" ")
}

function eventToolRules(w: EventWriter): string[] {
  return [
    `All event times are Dubai time (GST, UTC+4). Today in Dubai is ${dubaiYMD(new Date())}. Work out every date in full, including the year; when the person did not make the date or the time clear, ask instead of guessing.`,
    "Before you create an event, tell the person the title, date, time and venue you are about to save. When they paste a message or a poster, read the details from it and confirm them the same way.",
    "A new event is always a draft and is not public. After every save the tool lists what is still missing and how to fix each item: tell the person, and offer to fill what you can (write the description yourself from their notes). When they say an event is like a past one, use copy_from so the photo, the venue with its map pin, the sign-up fields and the certificate design come along.",
    ownerOf(w)
      ? "Publish only when the person asks for it. Nothing can be deleted from here. Registrations, certificates and emails are handled in the FHI dashboard: give the open_in_dashboard link."
      : "Publish only when the person asks for it. Nothing can be deleted from here. Agents' own events, registrations, certificates and emails are handled in the FHI dashboard: give the open_in_dashboard link.",
    "Each event tool also shows the person a card in the chat with the event's photo, date, venue, seats, status, what is missing and an Open in dashboard button. Do not repeat the card field by field: say in a sentence or two what happened and what the next step is.",
  ]
}

type ToolResult = ReturnType<typeof reply>

/** Runs a tool body; a Problem becomes its payload, anything else a plain apology (and a server log). */
async function run(name: string, w: EventWriter, body: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const owner = ownerOf(w)
    if (owner && w.site === undefined) w.site = await agentWebsite(createAdminSupabase(), owner)
    return reply(await body())
  } catch (e) {
    if (e instanceof Problem) return reply(e.payload, true)
    console.error(`[mcp/events] ${name}`, e instanceof Error ? e.message : e)
    return reply({ saved: false, problem: "FHI could not finish this just now. Nothing was changed unless an earlier step said so. Try once more, or use the dashboard." }, true)
  }
}

export function registerEventTools(server: McpServer, w: EventWriter): void {
  // The card Claude shows with each answer; every tool below points at it.
  registerEventCard(server)
  const own = Boolean(ownerOf(w))
  // Whose event, in the words the tool descriptions use.
  const an = own ? "one of the person's OWN events" : "a COMPANY event"
  const sources = own ? "one of the person's own past events" : "a past event"
  // Only an owner chooses where the event appears; a company event is always on fhiglobal.ae/events.
  const fields = own
    ? {
        ...FIELDS,
        where: z
          .enum(["fhiglobal", "website", "both"])
          .optional()
          .describe("Where it appears: fhiglobal = fhiglobal.ae/events, website = the person's own FHI website (they need one), both. When not said: both if they have a website, else fhiglobal."),
      }
    : FIELDS
  server.registerTool(
    "fhi_event_create",
    {
      title: "FHI · create an event (draft)",
      description: `Create ${an} as a DRAFT (never public). Needs a title, a date and a start time: when one is missing nothing is saved and the answer says what to ask. With copy_from, everything ${sources} had comes along (description, brand, cover photo, venue with its map pin, sign-up fields, certificate design, days, seats and start time) and the fields you send replace it — the date is always new. Answers with the saved event, the dashboard link, and what is still missing with how to fix each item.`,
      inputSchema: z.object({
        ...fields,
        copy_from: REF.optional().describe(`Make it like ${sources}: its id, or words from its title (the most recent match is taken and named in the answer)`),
      }),
      annotations: WRITES,
      _meta: EVENT_CARD_TOOL_META,
    },
    async (args) => run("create", w, () => create(args as FieldArgs & { copy_from?: string }, w)),
  )
  server.registerTool(
    "fhi_event_update",
    {
      title: "FHI · change a draft event",
      description: `Change ${an} that is still a DRAFT: send only the fields that change. A live event is refused (take it back to draft first, or use the dashboard). Changing the venue's text removes its old map pin; venue_from brings a venue with its pin. Answers with what changed and what is still missing.`,
      inputSchema: z.object({ event: REF.describe("The event: its id (best), or its exact title / words from it"), ...fields }),
      annotations: CHANGES,
      _meta: EVENT_CARD_TOOL_META,
    },
    async (args) => run("update", w, () => update(args as FieldArgs & { event: string }, w)),
  )
  server.registerTool(
    "fhi_event_publish",
    {
      title: "FHI · publish or unpublish an event",
      description: `action "publish" puts a draft of ${an} LIVE ${own ? "where it was set to appear (fhiglobal.ae/events, their FHI website, or both)" : "on fhiglobal.ae/events"} — only when the person asked for it. It is refused, with the list of what is missing, unless the event has an upcoming date, a venue and a description. action "unpublish" takes a live event back to draft: the page is hidden, registrations are kept.`,
      inputSchema: z.object({
        event: REF.describe("The event: its id (best), or its exact title / words from it"),
        action: z.enum(["publish", "unpublish"]),
      }),
      annotations: CHANGES,
      _meta: EVENT_CARD_TOOL_META,
    },
    async (args) => run("publish", w, () => publish(args as { event: string; action: "publish" | "unpublish" }, w)),
  )
  server.registerTool(
    "fhi_event_check",
    {
      title: "FHI · check an event",
      description: own
        ? "Read one of the person's own events as the dashboard has it — any status, drafts included — with what it still needs before it can go live. Without `event`: their drafts and upcoming live events."
        : "Read one event as the dashboard has it — any status, drafts included — with what it still needs before it can go live. Without `event`: the company's drafts and upcoming live events.",
      inputSchema: z.object({ event: REF.optional().describe("An id, a page link, or words from the title. Leave out to list drafts and upcoming events.") }),
      annotations: READS,
      _meta: EVENT_CARD_TOOL_META,
    },
    async (args) => run("check", w, () => check(args as { event?: string }, w)),
  )
}
