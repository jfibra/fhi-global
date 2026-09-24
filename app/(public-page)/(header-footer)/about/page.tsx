import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { countByEmirate } from "@/lib/emirates"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"
import { ScrollLines } from "@/components/public/scroll-lines"
import { ParallaxPhoto } from "@/components/public/parallax-photo"

export const revalidate = 600

export const metadata: Metadata = createPageMetadata({
  title: "About Us — Building Trust, Creating Value",
  description:
    "FHI Global Property connects investors with Dubai's leading developers — who we are, how we work, and why buyers across the world trust us with UAE real estate.",
  pathname: "/about",
  keywords: ["About FHI Global", "Dubai real estate company", "FHI Global Property"],
})

// Real photos from our own gallery (the FHI Dubai Global event album) — the
// actual team and leadership, not stock imagery. Same S3 host as the /gallery
// page, already allowed in next.config images.
const GALLERY_BASE =
  "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/FHI_GLOBAL/gallery/fhi-global-dubai-event/web"
const ALBUM_ID = "21d46277-db66-409b-8cce-32b159ab6214"
const PHOTOS = {
  team: { url: `${GALLERY_BASE}/0ec466a7-dsc04617.jpg`, alt: "The FHI Global team on a Dubai rooftop" },
  leaders: { url: `${GALLERY_BASE}/c7c6af0d-dsc03609-edit.jpg`, alt: "FHI Global leadership at the Dubai Fountain, Downtown Dubai" },
  siteVisit: { url: `${GALLERY_BASE}/3f72486c-dsc04660.jpg`, alt: "The FHI Global team visiting a developer construction site in Dubai" },
  celebrate: { url: `${GALLERY_BASE}/cd7c1545-dsc04635.jpg`, alt: "The FHI Global team celebrating together on a Dubai rooftop" },
  model: { url: `${GALLERY_BASE}/3b70b14a-dsc04669-edit.jpg`, alt: "Reviewing a new project scale model at a developer showroom" },
  masterplan: { url: `${GALLERY_BASE}/95e383bc-mw501247-edit.jpg`, alt: "Studying a masterplan model at a developer sales gallery" },
}
const STRIP = [PHOTOS.celebrate, PHOTOS.model, PHOTOS.leaders, PHOTOS.masterplan, PHOTOS.siteVisit, PHOTOS.team]

const OFFICE = {
  address: "Office 98, 3rd Floor, Rigga Business Center (Ibis Hotel Building), Al Rigga, Deira, Dubai, UAE",
  phone: "+971 56 742 8288",
  email: "info@fhiglobal.ae",
}

/** The buying journey, in the order it happens. Each step names only what the
 *  site already does or what Dubai's rules already provide. */
const JOURNEY = [
  { title: "Discover", body: "Browse real inventory. Every project carries its price, payment plan and handover date where the developer has published them." },
  { title: "Shortlist", body: "Talk to one consultant who knows the projects, and get straight answers on location, plan and timing." },
  { title: "Reserve", body: "Booking deposit and developer paperwork, handled with you. Remotely, if you are not in Dubai." },
  { title: "Pay", body: "Off-plan instalments follow construction milestones into RERA-regulated escrow, released only as work is certified." },
  { title: "Handover", body: "Keys in hand, and we are still one message away." },
]

function Chapter({ numeral, kicker, title, light = false }: { numeral: string; kicker: string; title: React.ReactNode; light?: boolean }) {
  return (
    <div>
      <p className={`wf-fade inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] ${light ? "text-[#d6b357]" : "text-[#b8913f]"}`}>
        <span className="font-['Outfit'] text-[13px] tracking-normal">{numeral}</span>
        <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" />
        {kicker}
      </p>
      <h2 className={`mt-4 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight sm:text-[44px] ${light ? "text-white" : "text-[#0d1117]"}`}>
        {title}
      </h2>
    </div>
  )
}

function Words({ text, start, className }: { text: string; start: number; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={`${w}-${i}`} className="wf-word mr-[0.24em]">
          <span style={{ ["--i" as string]: start + i }} className={className}>{w}</span>
        </span>
      ))}
    </>
  )
}

export default async function AboutPage() {
  const supabase = createPublicSupabaseClient()
  const admin = createAdminSupabase()
  const [{ data: rows }, { count: eventCount }, { count: photoCount }, { count: agentCount }] = await Promise.all([
    supabase.from("projects").select("city, developer_id").eq("is_active", true).eq("is_published", true).is("deleted_at", null).limit(4000),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("gallery_photos").select("id", { count: "exact", head: true }).eq("album_id", ALBUM_ID),
    admin.from("profiles").select("id", { count: "exact", head: true }).in("role", ["agent", "team_leader"]).eq("status", "active"),
  ])
  const projects = (rows ?? []) as { city: string | null; developer_id: string | null }[]
  const projectCount = projects.length
  const developerCount = new Set(projects.map((p) => p.developer_id).filter(Boolean)).size
  const emirateCount = Object.keys(countByEmirate(projects)).length

  const numbers = [
    { value: projectCount, label: "Live projects", note: "published on this site right now", href: "/projects" },
    { value: developerCount, label: "Developers", note: "with projects selling through us", href: "/developers" },
    { value: emirateCount, label: "Emirates", note: "where those projects stand", href: "/projects" },
    { value: agentCount ?? 0, label: "Agents and team leaders", note: "active, with a page each", href: "/agents" },
    { value: eventCount ?? 0, label: "Investor events", note: "hosted in Dubai, with more coming", href: "/events" },
  ].filter((n) => n.value > 0)

  return (
    <div className="ab wf relative bg-[#fafafa] overflow-x-clip">
      <noscript>
        <style>{`.ab [class*="wf-"], .ab .wf-word > span, .ab [class*="pp-"], .ab .sl-line { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>

      {/* ── Opening — the whole team, full-bleed, under the first sentence ── */}
      <section className="pp-hero relative overflow-hidden bg-[#06182e] text-white">
        <InView className="relative" threshold={0.05} rootMargin="0px">
          <div className="absolute inset-0" aria-hidden="true">
            <div className="pp-hero-img absolute inset-0">
              <Image src={PHOTOS.team.url} alt={PHOTOS.team.alt} fill priority sizes="100vw" className="object-cover object-[70%_50%]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/65 to-[#06182e]/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/25 to-transparent" />
          </div>

          <div className="relative mx-auto flex min-h-[78vh] max-w-[1440px] flex-col justify-end px-4 pb-14 pt-[22vh] sm:px-6 lg:min-h-[86vh] lg:px-8 lg:pb-20">
            <div className="mb-6 flex items-center gap-3">
              <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              <span className="wf-fade text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]" style={{ ["--d" as string]: "250ms" }}>
                FHI Global · Our story
              </span>
            </div>
            <h1 className="max-w-5xl font-['Outfit'] text-[42px] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[60px] lg:text-[76px]">
              <span className="block font-light"><Words text="We came to Dubai" start={0} /></span>
              <span className="block"><Words text="to make buying here simple," start={4} /></span>
              <span className="block"><Words text="from anywhere." start={9} className="wf-gold" /></span>
            </h1>
            <p className="wf-fade mt-7 max-w-xl text-[16px] leading-relaxed text-white/80 sm:text-[18px]" style={{ ["--d" as string]: "1100ms" }}>
              Who we are, how we work, and the numbers you can check for yourself.
            </p>
            <div className="wf-fade mt-9 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "1250ms" }}>
              <MagneticLink href="#story" className="group inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]">
                Read the story
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-y-0.5 group-hover:rotate-90" />
              </MagneticLink>
              <MagneticLink href="/contact" className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-white/10">
                Talk to us
              </MagneticLink>
            </div>
          </div>
        </InView>
      </section>

      {/* ── Chapter I — the manifesto, lit line by line as you read ── */}
      <section id="story" className="relative scroll-mt-24 overflow-hidden bg-[#06182e] py-28 text-white lg:py-40">
        <div className="pointer-events-none absolute -left-40 top-1/3 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.14),rgba(214,179,87,0))]" aria-hidden="true" />
        <InView className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8" threshold={0.1}>
          <Chapter numeral="I" kicker="Why we exist" title="A leap of faith is not a plan." light />
          <ScrollLines
            className="mt-14 space-y-8 font-['Outfit'] text-[26px] font-bold leading-[1.28] tracking-tight sm:text-[36px] lg:text-[44px]"
            lines={[
              { text: "Buying property in Dubai from another country should not feel like a leap of faith." },
              { text: "So we put the price, the payment plan and the handover date on every project,", gold: "before you ask." },
              { text: "We work directly with the developers, so what you pay is", gold: "what they charge." },
              { text: "One consultant stays with you from the first search to the day you hold the keys." },
              { text: "And we are here, in Dubai, on the ground,", gold: "in your language." },
            ]}
          />
        </InView>
      </section>

      {/* ── Chapter II — the numbers, counted live ── */}
      <InView as="section" className="pp-section relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32" threshold={0.15}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Chapter numeral="II" kicker="What is on the table" title={<>Numbers you can <span className="text-[#b8913f]">check.</span></>} />
          <p className="max-w-sm text-[15px] leading-relaxed text-[#6b7280]">
            Counted from what is published on this site as the page is built. When they change, this page changes.
          </p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {numbers.map((n, i) => (
            <Link key={n.label} href={n.href} className="group relative block border-t border-[#e5e8ec] pt-6">
              <span className="wf-line absolute left-0 top-0 h-[3px] w-14 bg-[#d6b357]" style={{ ["--d" as string]: `${200 + i * 120}ms` }} aria-hidden="true" />
              <p className="font-['Outfit'] text-[64px] font-bold leading-none tracking-tight text-[#0d1117] sm:text-[76px]">
                <CountUp value={n.value} delay={300 + i * 150} duration={1500} />
              </p>
              <p className="mt-3 font-['Outfit'] text-[19px] font-bold text-[#0d1117] transition-colors group-hover:text-[#b8913f]">{n.label}</p>
              <p className="mt-1 text-[14px] text-[#6b7280]">{n.note}</p>
              <ArrowUpRight className="absolute right-0 top-6 h-5 w-5 text-[#d6b357] opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
            </Link>
          ))}
          <div className="relative block border-t border-[#e5e8ec] pt-6">
            <span className="wf-line absolute left-0 top-0 h-[3px] w-14 bg-[#d6b357]" style={{ ["--d" as string]: `${200 + numbers.length * 120}ms` }} aria-hidden="true" />
            <p className="font-['Outfit'] text-[64px] font-bold leading-none tracking-tight text-[#b8913f] sm:text-[76px]">0</p>
            <p className="mt-3 font-['Outfit'] text-[19px] font-bold text-[#0d1117]">Fees charged to buyers</p>
            <p className="mt-1 text-[14px] text-[#6b7280]">the developer pays our commission, never you</p>
          </div>
        </div>
      </InView>

      {/* ── Chapter III — the journey, as a timeline that fills ── */}
      <section className="relative overflow-hidden bg-white py-24 lg:py-32">
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/background/home.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/97 via-white/92 to-white/97" />
        </div>
        <InView className="pp-section relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" threshold={0.15}>
          <Chapter numeral="III" kicker="How it works with us" title={<>Five steps, <span className="text-[#b8913f]">one consultant.</span></>} />
          <div className="pp-plan mt-16">
            <div className="relative">
              <div className="absolute left-0 right-0 top-[7px] hidden h-[2px] bg-[#e5e8ec] lg:block" aria-hidden="true">
                <span className="pp-plan-fill block h-full bg-[#d6b357]" />
              </div>
              <ol className="relative grid gap-10 lg:grid-cols-5 lg:gap-6">
                {JOURNEY.map((s, i) => (
                  <li key={s.title} className="pp-plan-step relative pl-8 lg:pl-0" style={{ ["--d" as string]: `${400 + i * 260}ms` }}>
                    <span className="absolute left-0 top-[7px] hidden h-[calc(100%+2.5rem)] w-px bg-[#e5e8ec] last:hidden lg:hidden" aria-hidden="true" />
                    <span className="pp-plan-node absolute left-0 top-0 block h-4 w-4 rounded-full border-2 border-[#d6b357] bg-white lg:relative" aria-hidden="true">
                      <span className="absolute inset-[3px] rounded-full bg-[#d6b357]" />
                    </span>
                    <p className="mt-0 font-['Outfit'] text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f] lg:mt-5">Step {i + 1}</p>
                    <p className="mt-1 font-['Outfit'] text-[24px] font-bold leading-tight text-[#0d1117]">{s.title}</p>
                    <p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-[#4b5563]">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </InView>
      </section>

      {/* ── Chapter IV — the people, a strip that drifts ── */}
      <section className="relative overflow-hidden bg-[#06182e] py-24 text-white lg:py-32">
        <InView className="relative" threshold={0.15}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <Chapter numeral="IV" kicker="Who you will meet" title={<>Real people, <span className="text-[#e3c06c]">real photographs.</span></>} light />
              <p className="wf-fade max-w-sm text-[15px] leading-relaxed text-white/70" style={{ ["--d" as string]: "500ms" }}>
                Every frame here is ours, from FHI Dubai Global in July 2026. No stock imagery anywhere on this page.
              </p>
            </div>
          </div>

          <div className="ab-strip relative mt-14 w-full overflow-hidden">
            <div className="ab-track flex gap-4">
              {[...STRIP, ...STRIP].map((p, i) => (
                <Link
                  key={`${p.url}-${i}`}
                  href="/gallery"
                  className="ab-frame group relative block h-[240px] w-[340px] shrink-0 overflow-hidden border border-white/10 sm:h-[300px] sm:w-[440px]"
                  style={{ ["--i" as string]: Math.min(i, STRIP.length) }}
                  {...(i >= STRIP.length ? { "aria-hidden": true, tabIndex: -1 } : {})}
                >
                  <Image src={p.url} alt={i >= STRIP.length ? "" : p.alt} fill sizes="440px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06182e]/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <blockquote className="wf-fade relative border-l-2 border-[#d6b357] pl-6 lg:col-span-7" style={{ ["--d" as string]: "700ms" }}>
              <p className="font-['Outfit'] text-[22px] font-bold leading-snug text-white sm:text-[28px]">
                Our mission is to empower people to make confident real estate decisions by providing expert guidance, market insights, and exceptional service.
              </p>
              <footer className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">FHI Global Property</footer>
            </blockquote>
            <div className="wf-fade flex flex-col gap-3 lg:col-span-5 lg:items-end" style={{ ["--d" as string]: "850ms" }}>
              <Link href="/agents" className="group inline-flex items-center gap-2 border border-white/25 px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:border-[#d6b357] hover:text-[#f0d89b]">
                Meet the {agentCount && agentCount > 0 ? `${agentCount} ` : ""}agents
                <ArrowUpRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/gallery" className="group inline-flex items-center gap-2 text-[14px] font-bold text-white/70 transition-colors hover:text-[#f0d89b]">
                {photoCount && photoCount > 0 ? `${photoCount.toLocaleString("en-US")} photos in the gallery` : "Visit the gallery"}
                <ArrowRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </InView>
      </section>

      {/* ── Chapter V — on the ground in Dubai ── */}
      <InView as="section" className="pp-section relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32" threshold={0.15}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <Chapter numeral="V" kicker="Where to find us" title={<>Deira, Dubai. <span className="text-[#b8913f]">Come and see us.</span></>} />
            <p className="mt-6 max-w-lg text-[16px] leading-[1.8] text-[#374151]">
              We are a Dubai office, not a call centre. If you are in the city, drop in. If you are not, the same team answers the phone and the email below.
            </p>
            <dl className="mt-8 space-y-5">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><MapPin className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Office</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-[#0d1117]">{OFFICE.address}</dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Rigga Business Center, Al Rigga, Deira, Dubai")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0d1117] transition-colors hover:text-[#b8913f]"
                  >
                    Open in Google Maps <ArrowUpRight className="h-3.5 w-3.5 text-[#d6b357]" />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><Phone className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Phone and WhatsApp</dt>
                  <dd className="mt-1"><a href={`tel:${OFFICE.phone.replace(/\s+/g, "")}`} className="text-[15px] font-semibold text-[#0d1117] hover:text-[#b8913f]">{OFFICE.phone}</a></dd>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><Mail className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Email</dt>
                  <dd className="mt-1"><a href={`mailto:${OFFICE.email}`} className="text-[15px] font-semibold text-[#0d1117] hover:text-[#b8913f]">{OFFICE.email}</a></dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-6">
            <div className="relative">
              <div className="absolute -bottom-4 -right-4 top-10 w-2/3 border border-[#d6b357]" aria-hidden="true" />
              <ParallaxPhoto className="fp-img relative aspect-[4/3] w-full overflow-hidden shadow-[0_18px_44px_-20px_rgba(0,20,40,0.35)] ring-1 ring-[#e8eaed]" strength={0.1}>
                <div className="fp-zoom relative h-full w-full">
                  <Image src="/background/dubai.webp" alt="Dubai skyline at golden hour" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                </div>
              </ParallaxPhoto>
              <div className="wf-fade absolute bottom-4 left-4 flex items-center gap-2 bg-white/92 px-3 py-2 text-[12px] font-bold text-[#0d1117] shadow-sm backdrop-blur-sm" style={{ ["--d" as string]: "900ms" }}>
                <MapPin className="h-3.5 w-3.5 text-[#b8913f]" aria-hidden="true" />
                Al Rigga, Deira · Dubai
              </div>
            </div>
          </div>
        </div>
      </InView>

      {/* ── Closing ── */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="pointer-events-none absolute -right-32 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0))]" aria-hidden="true" />
        <InView className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:px-8 lg:py-24" threshold={0.3}>
          <div className="flex-1">
            <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              Ready when you are
            </p>
            <h2 className="mt-4 font-['Outfit'] text-[36px] font-bold leading-[1.06] tracking-tight sm:text-[48px]">
              <Words text="Start with a conversation," start={0} />
              <span className="block"><Words text="not a commitment." start={4} className="wf-gold" /></span>
            </h2>
            <p className="wf-fade mt-5 max-w-xl text-[16px] leading-relaxed text-white/75" style={{ ["--d" as string]: "800ms" }}>
              Tell us what you are looking for and where you are buying from. A consultant replies with real options, not a brochure.
            </p>
          </div>
          <div className="wf-fade flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "950ms" }}>
            <MagneticLink href="/contact" className="inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]">
              Talk to a consultant <ArrowUpRight className="h-4 w-4" />
            </MagneticLink>
            <MagneticLink href="/projects" className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white transition-colors hover:border-white/70 hover:bg-white/10">
              Browse projects
            </MagneticLink>
          </div>
        </InView>
      </section>
    </div>
  )
}
