import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { eventBrand } from "@/lib/events/brands"
import { EventRegisterForm } from "@/components/public/event-register-form"
import { EventPageQr } from "@/components/public/event-page-qr"
import { EventHeroQr } from "@/components/public/event-hero-qr"
import { EventViewPing } from "@/components/public/event-view-ping"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArrowLeft, CalendarDays, ChevronRight, Clock, MapPin, Ticket } from "lucide-react"

export const revalidate = 120

type Props = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function fetchEvent(id: string) {
  if (!UUID_RE.test(id)) return null
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("events")
    .select("id, title, description, brand, image_url, event_date, venue")
    .eq("id", id)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()
  return data ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEvent(id)
  if (!event) return { title: "Event | FHI Global" }
  return createPageMetadata({
    title: `${event.title} | FHI Global Events`,
    description: event.description?.trim().slice(0, 155) || `Register for ${event.title} — an FHI Global event.`,
    imageUrl: event.image_url,
    pathname: `/events/${event.id}`,
    keywords: [event.title, "FHI Global event", "Dubai real estate event"],
  })
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const event = await fetchEvent(id)
  if (!event) notFound()

  const brand = eventBrand(event.brand)
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
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <EventViewPing eventId={event.id} />
      <TopBar />
      <Header />

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
            <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f] to-[#002a52]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#001428]/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
        </div>
        <Link
          href="/events"
          className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-[#0f2940] shadow-md hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Events
        </Link>
        {/* Presented-by plaque — big, gold-ringed, unmistakable */}
        <span
          className="absolute bottom-5 left-4 sm:left-8 z-10 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_16px_44px_-12px_rgba(0,10,25,0.6)] ring-2 ring-[#d6b357]"
          style={{ backgroundColor: brand.logoIsWhite ? "rgba(0,31,63,0.96)" : "rgba(255,255,255,0.97)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt={brand.name} className="h-10 sm:h-12 w-auto object-contain" />
          <span className="flex flex-col leading-tight">
            <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${brand.logoIsWhite ? "text-[#d6b357]" : "text-[#8a6d2a]"}`}>
              Presented by
            </span>
            <span className={`text-sm font-bold ${brand.logoIsWhite ? "text-white" : "text-[#0f2940]"}`}>
              {brand.name}
            </span>
          </span>
        </span>
        {/* Big venue-screen QR on the hero (desktop only) */}
        <EventHeroQr />
      </div>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-[#6b7280] mb-5">
          <Link href="/" className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
            Home
          </Link>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
          <Link href="/events" className="text-[#0f2940] hover:text-[#d6b357] transition-colors">
            Events
          </Link>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
          <span className="text-[#d6b357] font-semibold truncate max-w-[60vw]">{event.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          {/* ── Event details ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-sm p-6 sm:p-8 min-w-0">
            <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0f2940] leading-tight mb-3">
              {event.title}
            </h1>
            <span className="block w-14 h-1 rounded-full bg-[#d6b357] mb-6" aria-hidden="true" />

            {/* Date / time / venue chips */}
            <div className="flex flex-wrap gap-3 mb-7">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold">
                <CalendarDays className="w-4 h-4 text-[#d6b357]" /> {dateLabel}
              </span>
              {timeLabel && (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001f3f]/5 border border-[#001f3f]/10 text-[#0f2940] text-sm font-semibold">
                  <Clock className="w-4 h-4 text-[#d6b357]" /> {timeLabel}
                </span>
              )}
              {event.venue && (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#001f3f]/5 border border-[#001f3f]/10 text-[#0f2940] text-sm font-semibold">
                  <MapPin className="w-4 h-4 text-[#d6b357]" /> {event.venue}
                </span>
              )}
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
            className="scroll-mt-24 lg:sticky lg:top-24 bg-white rounded-2xl border border-[#e8eaed] shadow-[0_16px_44px_-16px_rgba(0,20,40,0.18)] overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#001f3f] to-[#002a52] px-5 py-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#d6b357]/20 border border-[#d6b357]/40 flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5 text-[#d6b357]" />
              </span>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Reserve your seat</p>
                <p className="text-[#d6b357] text-[11px] font-bold uppercase tracking-wider">Free registration</p>
              </div>
            </div>
            <div className="p-5">
              <EventRegisterForm eventId={event.id} eventTitle={event.title} />
              <EventPageQr />
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
