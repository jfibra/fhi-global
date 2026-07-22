import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { eventBrand } from "@/lib/events/brands"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ArrowRight, CalendarDays, MapPin, Star } from "lucide-react"

export const revalidate = 120

export const metadata: Metadata = createPageMetadata({
  title: "Events | FHI Global",
  description:
    "Property showcases, investor nights, and community events by FHI Global and partner brands across the UAE and the Philippines. Register your seat.",
  pathname: "/events",
  keywords: ["FHI Global events", "Dubai property event", "real estate investor night UAE"],
})

function dateParts(iso: string | null): { day: string; month: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // Event times are Dubai time (GST) — force the zone; this renders on the
  // server, whose clock is usually UTC.
  return {
    day: d.toLocaleDateString("en-AE", { day: "2-digit", timeZone: "Asia/Dubai" }),
    month: d.toLocaleDateString("en-AE", { month: "short", timeZone: "Asia/Dubai" }),
    time:
      d.toLocaleDateString("en-AE", { weekday: "short", timeZone: "Asia/Dubai" }) +
      " · " +
      d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }) +
      " GST",
  }
}

export default async function EventsPage() {
  const supabase = createPublicSupabaseClient()
  const { data: events } = await supabase
    .from("events")
    .select("id, slug, title, description, brand, image_url, event_date, venue")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false })

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <TopBar />
      <Header />

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/background/home.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/85 via-[#001f3f]/55 to-[#001f3f]/25" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/30 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/25 rounded-full text-xs font-medium text-white/90 mb-5 backdrop-blur-sm">
            <CalendarDays className="w-3.5 h-3.5 text-[#d6b357]" />
            Meet us in person
          </div>
          <h1
            className="font-['Outfit'] text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-4 tracking-tight"
            style={{ textShadow: "0 2px 24px rgba(0,10,30,0.6)" }}
          >
            Upcoming{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
              Events
            </span>
          </h1>
          <span className="block w-14 h-1 rounded-full bg-[#d6b357] mb-5" aria-hidden="true" />
          <p
            className="text-white/90 text-lg max-w-lg leading-relaxed"
            style={{ textShadow: "0 1px 10px rgba(0,10,30,0.7)" }}
          >
            Property showcases, investor nights, and community gatherings from FHI Global and our
            partner brands. Reserve your seat — registration takes a minute.
          </p>
        </div>
      </section>

      {/* ── Events grid ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-20">
        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((e) => {
              const brand = eventBrand(e.brand)
              const dp = dateParts(e.event_date)
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.slug ?? e.id}`}
                  className="group relative bg-white rounded-2xl border border-[#e8eaed] overflow-hidden shadow-[0_10px_36px_-14px_rgba(0,20,40,0.25)] hover:shadow-[0_20px_56px_-16px_rgba(0,20,40,0.4)] hover:-translate-y-1.5 transition-all duration-300"
                >
                  <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-[#d6b357]/30 z-10" aria-hidden="true" />
                  <div className="relative h-52 bg-[#eef1f5]">
                    {e.image_url ? (
                      <Image
                        src={e.image_url}
                        alt={e.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-[1.04] transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                        <CalendarDays className="w-10 h-10" />
                      </div>
                    )}
                    {/* Date block */}
                    {dp && (
                      <div className="absolute top-3 left-3 rounded-xl overflow-hidden shadow-md text-center w-14">
                        <div className="bg-[#001f3f] text-[#d6b357] text-[10px] font-bold uppercase tracking-wider py-1">
                          {dp.month}
                        </div>
                        <div className="bg-white text-[#0f2940] font-['Outfit'] text-xl font-bold py-1">{dp.day}</div>
                      </div>
                    )}
                    {/* Brand chip */}
                    <span
                      className="absolute bottom-3 left-3 rounded-lg px-2 py-1.5 flex items-center shadow"
                      style={{ backgroundColor: brand.logoIsWhite ? "#001f3f" : "rgba(255,255,255,0.95)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={brand.logo} alt={brand.name} className="h-5 w-auto object-contain" />
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117] leading-snug line-clamp-2 mb-2">
                      {e.title}
                    </h2>
                    {dp && <p className="text-xs text-[#6b7280] mb-1">{dp.time}</p>}
                    {e.venue && (
                      <p className="text-xs text-[#6b7280] truncate inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#d6b357] shrink-0" /> {e.venue}
                      </p>
                    )}
                    <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
                      <span className="text-sm font-bold text-[#001f3f] group-hover:text-[#b8913f] transition-colors">
                        Register now
                      </span>
                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d6b357] to-[#b8913f] flex items-center justify-center shadow-sm">
                        <ArrowRight className="w-4 h-4 text-[#001f3f] group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-[#e8eaed] bg-white p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-5">
              <Star className="w-7 h-7 text-[#d6b357]" />
            </div>
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">No upcoming events yet</h2>
            <p className="text-sm text-[#6b7280] max-w-sm mx-auto leading-relaxed">
              New showcases and investor nights are announced here — check back soon or follow us on
              social media.
            </p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
