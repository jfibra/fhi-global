import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, MapPin, Phone, Ticket } from "lucide-react"
import { WhatsAppLogo } from "@/components/brand-icons"
import type { EventHost } from "@/lib/events/host"
import { ProjectLocationMap } from "@/components/public/project-location-map"
import { eventBrand } from "@/lib/events/brands"
import { isEventRegistrationOpen } from "@/lib/events/registration"
import { eventDateRangeLabel, eventLengthLabel, eventSchedule, eventStartTime, hasCustomDayTimes } from "@/lib/events/dates"
import { parseRegistrationFields } from "@/lib/events/fields"
import { EventRegisterForm } from "@/components/public/event-register-form"
import { EventPageQr } from "@/components/public/event-page-qr"
import { EventHeroQr } from "@/components/public/event-hero-qr"
import { EventShare } from "@/components/public/event-share"
import { EventVideo } from "@/components/public/event-video"
import { isPlayableVideoUrl } from "@/lib/video-embed"

/** The host's round photo, or their initial on navy when there's none. */
function HostPhoto({ host, size }: { host: EventHost; size: number }) {
  return host.photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- S3 portraits and Google avatars, already sized small
    <img src={host.photo} alt={host.name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] font-bold text-[#d6b357]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {host.name.charAt(0).toUpperCase()}
    </span>
  )
}

/** The public columns an event page needs. */
export type PublicEvent = {
  id: string
  slug: string | null
  title: string
  description: string | null
  brand: string | null
  image_url: string | null
  /** Optional video LINK (lib/video-embed.ts) — played on click, never uploaded. */
  video_url?: string | null
  event_date: string | null
  /** Consecutive days (migration 071); 1 or missing for a one-day event. */
  event_days?: number | null
  /** Per-day start times (072), day 1 first. */
  day_times?: unknown
  venue: string | null
  /** The venue's exact spot (migration 068); null when it was typed, not picked. */
  venue_lat?: number | null
  venue_lng?: number | null
  registration_open: boolean | null
  registration_fields: unknown
  certificate: unknown
}

/**
 * The public event page body — poster hero, details and the registration card
 * (#register is the QR landing anchor). No certificate banner: the public page
 * shouldn't invite anyone to claim one — attendees get to the certificate page
 * from the venue QR poster in the dashboard's certificate section. Shared by
 * the company page (/events/<slug>) and an agent's own event on their website
 * (/website/<site>/events/<slug>, migration 057), which differ only in where
 * "back", the breadcrumb and "more events" point and which URL is shared —
 * and an agent's event on the company page names its host (074).
 */
export function EventDetail({
  event,
  sharePath,
  back,
  breadcrumbs,
  moreEventsHref,
  mapsKey,
  host = null,
}: {
  event: PublicEvent
  /** Google Maps browser key; the venue map shows only with it and a pinned venue. */
  mapsKey?: string
  /** The agent running it, on fhiglobal.ae — a "Hosted by" line and box (lib/events/host.ts). */
  host?: EventHost | null
  /** Page this event lives at — what the share button hands out. */
  sharePath: string
  back: { href: string; label: string }
  /** Trail before the event title, e.g. Home › Events. */
  breadcrumbs: Array<{ href: string; label: string }>
  /** Where "See upcoming events" goes once registration has closed. */
  moreEventsHref: string
}) {
  const brand = eventBrand(event.brand ?? "fhiglobal")
  const registrationOpen = isEventRegistrationOpen(event)
  // Event times are Dubai time (GST) — lib/events/dates forces the zone; this
  // renders on the server, whose clock is usually UTC. A multi-day event shows
  // its whole span ("Friday 10 – Sunday 12 October 2026").
  const dateLabel = eventDateRangeLabel(event.event_date, event.event_days, "long") ?? "Date to be announced"
  const startTime = eventStartTime(event.event_date)
  const length = eventLengthLabel(event.event_days)
  const timeLabel = startTime ? `${length ? "From " : ""}${startTime} (GST)${length ? ` · ${length}` : ""}` : null
  // Days that start at different times get their own line each (072).
  const schedule = hasCustomDayTimes(event.event_date, event.event_days, event.day_times) ? eventSchedule(event.event_date, event.event_days, event.day_times) : []

  return (
    <>
      {/* ── Hero — the WHOLE poster shown (contained) over a blurred backdrop ── */}
      <div className="relative">
        <div className="relative h-[360px] sm:h-[480px] lg:h-[560px] bg-[#001428] overflow-hidden">
          {event.image_url ? (
            <>
              {/* Blurred fill so the bars beside a poster feel intentional */}
              <Image
                src={event.image_url}
                alt=""
                fill
                sizes="100vw"
                className="object-cover blur-2xl scale-110 opacity-50"
                aria-hidden="true"
              />
              {/* The actual poster — never cropped */}
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                priority
                sizes="100vw"
                className="object-contain"
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-[#001f3f]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#001428]/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#d6b357]" />
        </div>
        <Link
          href={back.href}
          className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 bg-white/95 px-4 py-2 text-sm font-bold text-[#0f2940] hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {back.label}
        </Link>
        {/* Presented-by plaque — big, gold-ringed, unmistakable */}
        <span
          className="absolute bottom-5 left-4 sm:left-8 z-10 flex items-center gap-3 px-4 py-3 border-2 border-[#d6b357]"
          style={{ backgroundColor: brand.logoIsWhite ? "rgba(0,31,63,0.96)" : "rgba(255,255,255,0.97)" }}
        >
          <Image src={brand.logo} alt={brand.name} width={144} height={48} className="h-10 sm:h-12 w-auto object-contain" />
          <span className="flex flex-col leading-tight">
            <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${brand.logoIsWhite ? "text-[#d6b357]" : "text-[#8a6d2a]"}`}>
              Presented by
            </span>
            <span className={`text-sm font-bold ${brand.logoIsWhite ? "text-white" : "text-[#0f2940]"}`}>
              {brand.name}
            </span>
          </span>
        </span>
        {/* Big venue-screen QR on the hero (desktop only) — only while open */}
        {registrationOpen && <EventHeroQr />}
      </div>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-[#6b7280] mb-5">
          {breadcrumbs.map((b) => (
            <span key={b.href + b.label} className="inline-flex items-center gap-1">
              <Link href={b.href} className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
                {b.label}
              </Link>
              <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
            </span>
          ))}
          <span className="text-[#d6b357] font-semibold truncate max-w-[60vw]">{event.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          {/* ── Event details ── */}
          <div className="bg-white border border-[#e5e8ec] p-6 sm:p-8 min-w-0">
            <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#001f3f] leading-tight mb-3">
              {event.title}
            </h1>
            <span className="block w-16 h-[3px] bg-[#d6b357] mb-6" aria-hidden="true" />

            {/* Whose event it is, straight away — the full box is further down. */}
            {host && (
              <a href="#host" className="-mt-2 mb-6 inline-flex items-center gap-2.5 text-sm text-[#4b5563] transition-colors hover:text-[#001f3f]">
                <HostPhoto host={host} size={30} />
                <span>
                  Hosted by <strong className="font-bold text-[#0f2940]">{host.name}</strong>
                </span>
              </a>
            )}

            {/* Date / time / venue chips */}
            <div className="flex flex-wrap gap-3 mb-7">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#001f3f] text-white text-sm font-semibold">
                <CalendarDays className="w-4 h-4 text-[#d6b357]" /> {dateLabel}
              </span>
              {timeLabel && (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e5e8ec] text-[#0f2940] text-sm font-semibold">
                  <Clock className="w-4 h-4 text-[#d6b357]" /> {timeLabel}
                </span>
              )}
              {event.venue && (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e5e8ec] text-[#0f2940] text-sm font-semibold">
                  <MapPin className="w-4 h-4 text-[#d6b357]" /> {event.venue}
                </span>
              )}
              {schedule.length > 0 && (
                <div className="w-full border border-[#e5e8ec] bg-[#fafbfc]">
                  <p className="border-b border-[#e5e8ec] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Schedule (GST)</p>
                  <ul className="divide-y divide-[#eef0f3]">
                    {schedule.map((d) => (
                      <li key={d.day} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                        <span className="w-14 shrink-0 font-bold text-[#001f3f]">Day {d.day}</span>
                        <span className="min-w-0 flex-1 text-[#4b5563]">{d.dateLabel}</span>
                        <span className="shrink-0 font-semibold text-[#0f2940]">{d.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <EventShare
                slug={event.slug ?? event.id}
                path={sharePath}
                title={event.title}
                subtitle={[dateLabel, event.venue].filter(Boolean).join(" · ")}
              />
            </div>

            {event.video_url && isPlayableVideoUrl(event.video_url) && (
              <EventVideo url={event.video_url} title={`${event.title} — video`} poster={event.image_url} />
            )}

            {event.description?.trim() && (
              <p className="text-[#374151] leading-relaxed whitespace-pre-wrap">{event.description.trim()}</p>
            )}

            {/* Where it is — only for a venue picked from the place suggestions,
                so the pin is the real spot, never a guess from "Manila". */}
            {mapsKey && typeof event.venue_lat === "number" && typeof event.venue_lng === "number" && (
              <section className="mt-8">
                <h2 className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b8913f]">
                  <MapPin className="w-4 h-4" /> Where it is
                </h2>
                <ProjectLocationMap apiKey={mapsKey} projectName={event.venue ?? event.title} address={event.venue ?? ""} lat={event.venue_lat} lng={event.venue_lng} />
              </section>
            )}

            {/* The agent behind it: credit and a direct line, so the lead stays theirs
                while the visitor stays on fhiglobal.ae. */}
            {host && (
              <section id="host" className="mt-8 scroll-mt-24 border border-[#e5e8ec] bg-[#fafbfc] p-5 sm:p-6">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b8913f]">Hosted by</h2>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <HostPhoto host={host} size={64} />
                    <div className="min-w-0">
                      <p className="font-['Outfit'] text-lg font-bold leading-tight text-[#001f3f]">{host.name}</p>
                      <p className="mt-0.5 text-sm text-[#6b7280]">FHI Global advisor</p>
                    </div>
                  </div>
                  {(host.whatsapp || host.phone || host.websiteHref) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {host.whatsapp && (
                        <a
                          href={`https://wa.me/${host.whatsapp}?text=${encodeURIComponent(`Hi ${host.first}, I saw your event "${event.title}" on fhiglobal.ae.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
                        >
                          <WhatsAppLogo className="h-4 w-4" /> WhatsApp {host.first}
                        </a>
                      )}
                      {host.phone && (
                        <a
                          href={`tel:+${host.phone}`}
                          className="inline-flex items-center gap-2 border border-[#e5e8ec] bg-white px-4 py-2.5 text-sm font-bold text-[#0f2940] transition-colors hover:border-[#001f3f]"
                        >
                          <Phone className="h-4 w-4" /> Call
                        </a>
                      )}
                      {host.websiteHref && (
                        <Link
                          href={host.websiteHref}
                          className="inline-flex items-center gap-1.5 px-1 py-2.5 text-sm font-bold text-[#0f2940] transition-colors hover:text-[#b8913f]"
                        >
                          Visit {host.first}&apos;s website <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            <p className="mt-7 pt-6 border-t border-[#f0f0f0] text-sm text-[#6b7280]">
              Presented by <span className="font-bold text-[#0f2940]">{brand.name}</span>
            </p>
          </div>

          {/* ── Registration card (sticky) — #register is the QR landing anchor ── */}
          <aside
            id="register"
            className="scroll-mt-24 lg:sticky lg:top-24 bg-white border border-[#e5e8ec] overflow-hidden"
          >
            <div className="bg-[#001f3f] px-5 py-4 flex items-center gap-3">
              <span className="w-10 h-10 bg-[#d6b357]/20 border border-[#d6b357]/40 flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5 text-[#d6b357]" />
              </span>
              <div>
                <p className="text-white text-base font-bold leading-tight">Registration</p>
              </div>
            </div>
            {registrationOpen ? (
              <div className="p-5">
                <EventRegisterForm
                  eventId={event.id}
                  eventTitle={event.title}
                  fields={parseRegistrationFields(event.registration_fields)}
                />
                <EventPageQr />
              </div>
            ) : (
              <div className="p-6 text-center">
                <span className="mx-auto w-14 h-14 bg-[#faf7ee] border border-[#e7d9a8] flex items-center justify-center mb-4">
                  <Ticket className="w-6 h-6 text-[#9ca3af]" />
                </span>
                <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] mb-1.5">Registration closed</p>
                <p className="text-sm text-[#6b7280] leading-relaxed mb-5">
                  This event is no longer accepting registrations. Follow our upcoming events — new
                  showcases and investor nights are announced regularly.
                </p>
                <Link
                  href={moreEventsHref}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
                >
                  See upcoming events
                </Link>
              </div>
            )}
          </aside>
        </div>

      </div>
    </>
  )
}
