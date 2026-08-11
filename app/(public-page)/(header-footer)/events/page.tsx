import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { eventBrand } from "@/lib/events/brands"
import { isEventRegistrationOpen } from "@/lib/events/registration"
import { CalendarDays, ChevronRight, Clock, MapPin, Star } from "lucide-react"

export const revalidate = 120

export const metadata: Metadata = createPageMetadata({
  title: "Events",
  description:
    "Property showcases, investor nights, and community events by FHI Global and partner brands across the UAE and the Philippines. Register your seat.",
  pathname: "/events",
  keywords: ["FHI Global events", "Dubai property event", "real estate investor night UAE"],
})

type EventRow = {
  id: string | number
  slug: string | null
  title: string
  description: string | null
  brand: string | null
  image_url: string | null
  event_date: string | null
  venue: string | null
  registration_open: boolean | null
}

function dateParts(
  iso: string | null,
): { day: string; month: string; year: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // Event times are Dubai time (GST) — force the zone; this renders on the
  // server, whose clock is usually UTC.
  return {
    day: d.toLocaleDateString("en-AE", { day: "2-digit", timeZone: "Asia/Dubai" }),
    month: d.toLocaleDateString("en-AE", { month: "short", timeZone: "Asia/Dubai" }),
    year: d.toLocaleDateString("en-AE", { year: "numeric", timeZone: "Asia/Dubai" }),
    time: d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) + " GST",
  }
}

/**
 * Split by date rather than listing everything oldest-first, which buried the
 * next event under ones that already happened. Undated events count as
 * upcoming ("date to be announced") and sort last. Lives outside the component
 * because it reads the clock, and a component render must stay pure.
 */
function splitByDate(all: EventRow[]): { upcoming: EventRow[]; past: EventRow[] } {
  const now = Date.now()
  const stamp = (e: EventRow) => (e.event_date ? new Date(e.event_date).getTime() : NaN)
  return {
    upcoming: all
      .filter((e) => !e.event_date || stamp(e) >= now)
      .sort((a, b) => (stamp(a) || Infinity) - (stamp(b) || Infinity)),
    past: all.filter((e) => e.event_date && stamp(e) < now).sort((a, b) => stamp(b) - stamp(a)),
  }
}

export default async function EventsPage() {
  const supabase = createPublicSupabaseClient()
  const { data: events } = await supabase
    .from("events")
    .select("id, slug, title, description, brand, image_url, event_date, venue, registration_open")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false })

  const { upcoming, past } = splitByDate((events ?? []) as EventRow[])

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative bg-[#f7f5f1] border-b border-[#ebe7e0] overflow-hidden">
        {/* Skyline sits on the right and fades out under the headline, so the
            type stays on flat colour and never needs a shadow to be readable. */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[62%]" aria-hidden="true">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 62vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f7f5f1] via-[#f7f5f1]/85 to-[#f7f5f1]/45 lg:via-[#f7f5f1]/55 lg:to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-5">
              <CalendarDays className="w-4 h-4" />
              Meet us in person
            </p>
            {/* Not "Upcoming" — this page also carries events that have been
                and gone, and the heading shouldn't claim otherwise. */}
            <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold uppercase leading-[0.95] tracking-tight">
              <span className="block text-[#001f3f]">FHI Global</span>
              <span className="block text-[#d6b357]">Events</span>
            </h1>
            <span className="block w-16 h-[3px] bg-[#d6b357] my-5" aria-hidden="true" />
            <p className="text-[#5f6368] text-[15px] leading-relaxed max-w-md">
              Property showcases, investor nights, and community gatherings from FHI Global and our
              partner brands. Reserve your seat — registration takes a minute.
            </p>
          </div>
        </div>
      </section>

      {/* ── Events ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="border border-[#e5e8ec] bg-white p-16 text-center">
            <div className="w-14 h-14 bg-[#faf7ee] border border-[#e7d9a8] flex items-center justify-center mx-auto mb-5">
              <Star className="w-6 h-6 text-[#d6b357]" />
            </div>
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">No events yet</h2>
            <p className="text-sm text-[#6b7280] max-w-sm mx-auto leading-relaxed">
              New showcases and investor nights are announced here — check back soon or follow us on
              social media.
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <SectionHeading>Upcoming events</SectionHeading>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </>
            )}

            {past.length > 0 && (
              <>
                <SectionHeading className={upcoming.length > 0 ? "mt-14" : undefined}>
                  Past events
                </SectionHeading>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {past.map((e) => (
                    <EventCard key={e.id} event={e} past />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

    </div>
  )
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-6 ${className ?? ""}`}>
      <h2 className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.16em] text-[#001f3f]">
        {children}
      </h2>
      <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5" aria-hidden="true" />
    </div>
  )
}

/**
 * One event in the list. Past events look exactly like upcoming ones — the
 * section heading already says which is which, and dimming them made the
 * page look dead. `past` only suppresses the "Register now" call to action.
 */
function EventCard({ event: e, past = false }: { event: EventRow; past?: boolean }) {
  const brand = eventBrand(e.brand)
  const dp = dateParts(e.event_date)
  return (
    <Link
      href={`/events/${e.slug ?? e.id}`}
      className="group flex bg-white border border-[#e5e8ec] overflow-hidden hover:border-[#d6b357] transition-colors duration-200"
    >
      {/* Poster — fixed share of the card so every row lines up regardless of
          how long the titles and addresses run. Posters are wide, so the
          column is kept wide too and the crop anchors to the top, where event
          artwork puts its title. */}
      <div className="relative w-[42%] sm:w-[45%] shrink-0 bg-[#eef1f5]">
        {e.image_url ? (
          <Image
            src={e.image_url}
            alt={e.title}
            fill
            sizes="(max-width: 1024px) 45vw, 23vw"
            className="object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#b8bfc9]">
            <CalendarDays className="w-9 h-9" />
          </div>
        )}
        {dp && (
          <div className="absolute top-0 left-0 text-center w-[54px]">
            <div className="bg-[#d6b357] text-[#1a1408] text-[10px] font-bold uppercase tracking-[0.12em] py-1">
              {dp.month}
            </div>
            <div className="bg-white pt-1 pb-1.5">
              <span className="block font-['Outfit'] text-2xl font-bold leading-none text-[#001f3f]">
                {dp.day}
              </span>
              <span className="block text-[10px] font-semibold text-[#9ca3af] mt-0.5">{dp.year}</span>
            </div>
          </div>
        )}
        {/* Partner brands share this page — the logo says whose event it is. */}
        <span
          className="absolute bottom-0 left-0 px-2 py-1.5 flex items-center"
          style={{ backgroundColor: brand.logoIsWhite ? "#001f3f" : "rgba(255,255,255,0.95)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src={brand.logo} alt={brand.name} width={48} height={16} className="h-4 w-auto object-contain" />
        </span>
      </div>

      <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col">
        <h3 className="font-['Outfit'] text-[15px] sm:text-base font-bold uppercase leading-snug tracking-tight text-[#001f3f] line-clamp-3">
          {e.title}
        </h3>
        <span className="block w-10 h-[2px] bg-[#d6b357] my-3.5" aria-hidden="true" />

        <div className="space-y-2.5">
          {dp && (
            <p className="flex items-start gap-2.5 text-xs text-[#5f6368]">
              <Clock className="w-4 h-4 text-[#d6b357] shrink-0 mt-px" />
              <span className="font-medium">{dp.time}</span>
            </p>
          )}
          {e.venue && (
            <p className="flex items-start gap-2.5 text-xs text-[#5f6368]">
              <MapPin className="w-4 h-4 text-[#d6b357] shrink-0 mt-px" />
              <span className="line-clamp-3 leading-relaxed">{e.venue}</span>
            </p>
          )}
        </div>

        <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#001f3f] group-hover:text-[#b8913f] transition-colors">
          {!past && isEventRegistrationOpen(e) ? "Register now" : "View details"}
          <ChevronRight className="w-4 h-4 text-[#d6b357] group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  )
}
