// Events — the agent's own published events (migration 057), each linking to
// its registration page on this site. Renders nothing until the agent has
// published one, so a site without events looks exactly as before.

import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin } from "lucide-react"
import { eventPublicPath } from "@/lib/events/paths"
import type { WebsiteEventCard } from "@/lib/events/website-events"
import { BRAND_TO, GOLD, GOLD_GRADIENT, NAVY } from "../../_data"
import { FancyEyebrow } from "../ui"

function dateLabel(iso: string | null) {
  if (!iso) return "Date to be announced"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Date to be announced"
  // Event times are Dubai time (GST), like everywhere else in events.
  return `${d.toLocaleDateString("en-AE", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Dubai" })} · ${d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })} GST`
}

function EventCard({ siteSlug, event, past }: { siteSlug: string; event: WebsiteEventCard; past?: boolean }) {
  const href = eventPublicPath(event, siteSlug)
  return (
    <Link
      href={past ? href : `${href}#register`}
      className="group flex flex-col overflow-hidden border border-[#e8e2d4] bg-white transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(13,27,46,0.35)]"
    >
      <div className="relative h-56 overflow-hidden bg-[#0d1b2e]">
        {event.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" />
            {/* The whole poster, never cropped */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.image_url} alt={event.title} loading="lazy" className="relative h-full w-full object-contain" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-10 w-10" style={{ color: GOLD }} />
          </div>
        )}
        <span className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: GOLD_GRADIENT }} aria-hidden />
        {past && (
          <span className="absolute right-3 top-3 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
            Past event
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] font-semibold" style={{ color: GOLD }}>{dateLabel(event.event_date)}</p>
        <h3 className="mt-1.5 font-serif text-lg font-bold leading-snug" style={{ color: NAVY }}>{event.title}</h3>
        {event.venue && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-[#6b7280]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
            {event.venue}
          </p>
        )}
        <span
          className="mt-5 inline-flex items-center justify-center gap-2 self-start px-5 py-2.5 text-[13px] font-bold transition-transform group-hover:translate-x-0.5"
          style={past ? { border: `1px solid ${NAVY}`, color: NAVY } : { background: GOLD_GRADIENT, color: BRAND_TO }}
        >
          {past ? "View event" : "Register now"}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}

export function EventsSection({
  siteSlug,
  upcoming,
  past,
}: {
  siteSlug: string
  upcoming: WebsiteEventCard[]
  past: WebsiteEventCard[]
}) {
  if (upcoming.length === 0 && past.length === 0) return null
  return (
    <section id="events" className="scroll-mt-[72px] bg-[#f7f5ef]">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <FancyEyebrow>Events</FancyEyebrow>
        <h2 className="mt-4 text-center font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
          {upcoming.length > 0 ? "Upcoming Events" : "Recent Events"}
        </h2>
        {upcoming.length > 0 && (
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-[#6b7280]">
            Join me — register in a minute, seats are limited.
          </p>
        )}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} siteSlug={siteSlug} event={e} />
          ))}
          {past.map((e) => (
            <EventCard key={e.id} siteSlug={siteSlug} event={e} past />
          ))}
        </div>
      </div>
    </section>
  )
}
