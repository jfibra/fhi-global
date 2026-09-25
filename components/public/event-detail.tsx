import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Award, CalendarDays, ChevronRight, Clock, MapPin, Ticket } from "lucide-react"
import { eventBrand } from "@/lib/events/brands"
import { isEventRegistrationOpen } from "@/lib/events/registration"
import { parseRegistrationFields } from "@/lib/events/fields"
import { parseCertificateSettings } from "@/lib/events/certificate"
import { EventRegisterForm } from "@/components/public/event-register-form"
import { EventPageQr } from "@/components/public/event-page-qr"
import { EventHeroQr } from "@/components/public/event-hero-qr"
import { EventShare } from "@/components/public/event-share"

/** The public columns an event page needs. */
export type PublicEvent = {
  id: string
  slug: string | null
  title: string
  description: string | null
  brand: string | null
  image_url: string | null
  event_date: string | null
  venue: string | null
  registration_open: boolean | null
  registration_fields: unknown
  certificate: unknown
}

/**
 * The public event page body — poster hero, details, the registration card
 * (#register is the QR landing anchor) and the certificate banner. Shared by
 * the company page (/events/<slug>) and an agent's own event on their website
 * (/website/<site>/events/<slug>, migration 057), which differ only in where
 * "back", the breadcrumb and "more events" point and which URL is shared.
 */
export function EventDetail({
  event,
  sharePath,
  back,
  breadcrumbs,
  moreEventsHref,
}: {
  event: PublicEvent
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
  // Self-service is always on; the banner appears from the event day onward so
  // an upcoming event is not advertising certificates before anyone attended.
  const eventStarted = !event.event_date || new Date(event.event_date).getTime() - 12 * 3600_000 <= Date.now()
  const certificatesOpen = eventStarted && parseCertificateSettings(event.certificate).selfService !== "off"
  const d = event.event_date ? new Date(event.event_date) : null
  // Event times are Dubai time (GST) — force the zone; this renders on the
  // server, whose clock is usually UTC.
  const dateLabel =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dubai" })
      : "Date to be announced"
  const timeLabel =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) + " (GST)"
      : null

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
              <EventShare
                slug={event.slug ?? event.id}
                path={sharePath}
                title={event.title}
                subtitle={[dateLabel, event.venue].filter(Boolean).join(" · ")}
              />
            </div>

            {event.description?.trim() && (
              <p className="text-[#374151] leading-relaxed whitespace-pre-wrap">{event.description.trim()}</p>
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

        {/* Self-service certificates — shown once the team switches it on after the event */}
        {certificatesOpen && (
          <Link
            href={`/events/${event.slug ?? event.id}/certificate`}
            className="mt-8 flex flex-col sm:flex-row items-center gap-4 bg-[#001f3f] border-b-4 border-[#d6b357] px-6 py-5 text-white hover:bg-[#00305f] transition-colors"
          >
            <span className="w-12 h-12 bg-[#d6b357]/20 border border-[#d6b357]/40 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-[#d6b357]" />
            </span>
            <span className="flex-1 text-center sm:text-left">
              <span className="block font-['Outfit'] text-lg font-bold leading-tight">Attended? Get your Certificate of Attendance</span>
              <span className="block text-sm text-white/70 mt-0.5">Enter your details and download your personalised certificate as a PDF.</span>
            </span>
            <span className="inline-flex items-center px-5 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold shrink-0">Get my certificate</span>
          </Link>
        )}
      </div>
    </>
  )
}
