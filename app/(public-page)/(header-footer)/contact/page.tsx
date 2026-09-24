import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList, realEstateAgentOfficeSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { InView } from "@/components/public/in-view"
import { MagneticLink } from "@/components/public/magnetic-link"
import { ParallaxPhoto } from "@/components/public/parallax-photo"
import { ContactStudio } from "./contact-studio"
import { DubaiNow } from "./dubai-now"

export const metadata: Metadata = createPageMetadata({
  title: "Contact Us — Get in Touch",
  description:
    "Contact FHI Global's team in Dubai. Reach out for developer partnerships, agent onboarding, or any real estate inquiry.",
  openGraphDescription: "Reach out to FHI Global's Dubai team for any real estate inquiry.",
  pathname: "/contact",
  keywords: ["Contact FHI Global", "Dubai real estate support", "developer partnerships Dubai"],
})

const OFFICE = {
  city: "Dubai",
  address: "Office 98, 3rd Floor, Rigga Business Center (Ibis Hotel Building), Al Rigga, Deira, Dubai, UAE",
  phone: "+971 56 742 8288",
  phoneHref: "tel:+971567428288",
  whatsapp: "https://wa.me/971567428288",
  email: "info@fhiglobal.ae",
  hours: "Sunday to Thursday, 9:00 AM to 6:00 PM",
  mapsHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Rigga Business Center, Al Rigga, Deira, Dubai")}`,
}

const GALLERY_BASE =
  "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/FHI_GLOBAL/gallery/fhi-global-dubai-event/web"
const HERO_PHOTO = { url: `${GALLERY_BASE}/c7c6af0d-dsc03609-edit.jpg`, alt: "FHI Global leadership at the Dubai Fountain, Downtown Dubai" }

/** The three ways to reach the same team, fastest first. */
const CHANNELS = [
  { icon: MessageCircle, label: "WhatsApp", value: OFFICE.phone, note: "Fastest reply, in your language", href: OFFICE.whatsapp, external: true },
  { icon: Phone, label: "Call", value: OFFICE.phone, note: OFFICE.hours, href: OFFICE.phoneHref, external: false },
  { icon: Mail, label: "Email", value: OFFICE.email, note: "Answered within one business day", href: `mailto:${OFFICE.email}`, external: false },
]

/** What happens after the form. Every line restates a promise this page makes. */
const NEXT = [
  { title: "We read it the same day", body: "Your message lands with the Dubai team, not a ticket queue." },
  { title: "A consultant replies within one business day", body: "By email, or by WhatsApp if you left a number. A person, not an autoresponder." },
  { title: "You get real options, not a brochure", body: "Projects that fit your budget and timeline, with developer pricing and payment plans." },
]

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

export default function ContactPage() {
  return (
    <div className="ct wf relative bg-[#fafafa] font-sans overflow-x-clip">
      <noscript>
        <style>{`.ct [class*="wf-"], .ct .wf-word > span, .ct [class*="pp-"], .ct .ct-step, .ct .ct-channel { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
      {/* The Dubai office as a RealEstateAgent entity — the same facts printed
          below, made machine-readable. */}
      <JsonLd
        schema={[
          realEstateAgentOfficeSchema({ city: OFFICE.city, address: OFFICE.address, phone: OFFICE.phone, email: OFFICE.email }),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Contact" }]),
        ]}
      />

      {/* ── Opening — the team, one sentence, and the three ways to reach them ── */}
      <section className="pp-hero relative overflow-hidden bg-[#06182e] text-white">
        <InView className="relative" threshold={0.05} rootMargin="0px">
          <div className="absolute inset-0" aria-hidden="true">
            <div className="pp-hero-img absolute inset-0">
              <Image src={HERO_PHOTO.url} alt={HERO_PHOTO.alt} fill priority sizes="100vw" className="object-cover object-[60%_35%]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/70 to-[#06182e]/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/30 to-transparent" />
          </div>

          <div className="relative mx-auto flex min-h-[78vh] max-w-[1440px] flex-col justify-end px-4 pb-12 pt-[20vh] sm:px-6 lg:min-h-[84vh] lg:px-8 lg:pb-16">
            <div className="mb-6 flex items-center gap-3">
              <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              <span className="wf-fade text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]" style={{ ["--d" as string]: "250ms" }}>
                FHI Global · Contact
              </span>
            </div>
            <h1 className="max-w-4xl font-['Outfit'] text-[42px] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[60px] lg:text-[72px]">
              <span className="block"><Words text="Talk to a person" start={0} /></span>
              <span className="block"><Words text="in Dubai." start={4} className="wf-gold" /></span>
            </h1>
            <p className="wf-fade mt-6 max-w-xl text-[16px] leading-relaxed text-white/80 sm:text-[18px]" style={{ ["--d" as string]: "800ms" }}>
              One consultant replies within one business day, with real options rather than a brochure. Wherever you are buying from.
            </p>
            <p className="wf-fade mt-5 text-[13px] font-semibold text-white/75" style={{ ["--d" as string]: "950ms" }}>
              <DubaiNow />
            </p>

            {/* Three channels */}
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CHANNELS.map(({ icon: Icon, label, value, note, href, external }, i) => (
                <MagneticLink
                  key={label}
                  href={href}
                  className="ct-channel wf-fade group relative flex items-center gap-4 border border-white/15 bg-[#06182e]/55 p-5 backdrop-blur-md transition-colors hover:border-[#d6b357]/70 hover:bg-[#06182e]/75"
                  style={{ ["--d" as string]: `${1100 + i * 130}ms` }}
                  strength={0.12}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border border-[#d6b357]/60 bg-[#d6b357]/10 transition-colors group-hover:bg-[#d6b357]/20" aria-hidden="true" />
                    <Icon className="relative h-5 w-5 text-[#d6b357]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">{label}</span>
                    <span className="block truncate font-['Outfit'] text-[17px] font-bold leading-tight text-white">{value}</span>
                    <span className="block truncate text-[12px] text-white/60">{note}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#d6b357]" aria-hidden="true" />
                </MagneticLink>
              ))}
            </div>
          </div>
        </InView>
      </section>

      {/* ── The form — a navy rail with the brief, the form on white ── */}
      <InView as="section" id="message" className="relative scroll-mt-24" threshold={0.1}>
        <div className="mx-auto max-w-[1440px] lg:grid lg:grid-cols-12">
          <aside className="relative overflow-hidden bg-[#001f3f] px-4 py-14 text-white sm:px-6 lg:col-span-5 lg:px-12 lg:py-20">
            <div className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0))]" aria-hidden="true" />
            <div className="relative lg:sticky lg:top-28">
              <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
                <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
                Write to us
              </p>
              <h2 className="mt-4 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight sm:text-[42px]">
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 0 }}>Tell</span></span>
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 1 }}>us</span></span>
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 2 }}>what</span></span>
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 3 }}>you</span></span>
                <span className="block">
                  {["are", "looking", "for."].map((w, i) => (
                    <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 4 + i }} className="wf-gold">{w}</span></span>
                  ))}
                </span>
              </h2>
              <p className="wf-fade mt-5 max-w-md text-[15.5px] leading-relaxed text-white/75" style={{ ["--d" as string]: "600ms" }}>
                Three short steps. The more you tell us about budget, timeline and where you are buying from, the better the first reply.
              </p>

              <ol className="mt-10 space-y-6 border-t border-white/15 pt-8">
                {NEXT.map((n, i) => (
                  <li key={n.title} className="wf-fade flex gap-4" style={{ ["--d" as string]: `${750 + i * 140}ms` }}>
                    <span className="font-['Outfit'] text-[13px] font-bold tabular-nums text-[#d6b357]">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-['Outfit'] text-[17px] font-bold leading-snug text-white">{n.title}</span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-white/65">{n.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="bg-white px-4 py-12 sm:px-8 lg:col-span-7 lg:px-14 lg:py-20">
            <ContactStudio />
          </div>
        </div>
      </InView>

      {/* ── The office — come and see us ── */}
      <InView as="section" className="pp-section relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28" threshold={0.15}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              Visit us
            </p>
            <h2 className="mt-4 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight text-[#0d1117] sm:text-[42px]">
              Deira, Dubai. <span className="text-[#b8913f]">The door is open.</span>
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-[1.8] text-[#374151]">
              We are a Dubai office, not a call centre. If you are in the city, come in. The same team answers the phone and the email.
            </p>
            <dl className="mt-8 space-y-5">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><MapPin className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Office</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-[#0d1117]">{OFFICE.address}</dd>
                  <Link href={OFFICE.mapsHref} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0d1117] transition-colors hover:text-[#b8913f]">
                    Open in Google Maps <ArrowUpRight className="h-3.5 w-3.5 text-[#d6b357]" />
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10"><Phone className="h-5 w-5 text-[#b8913f]" /></span>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Hours</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-[#0d1117]">{OFFICE.hours}</dd>
                  <dd className="mt-1 text-[13px] text-[#6b7280]">Gulf Standard Time, UTC+4. WhatsApp reaches us outside these hours too.</dd>
                </div>
              </div>
            </dl>
          </div>
          <div className="lg:col-span-7">
            <div className="relative">
              <div className="absolute -bottom-4 -right-4 top-10 w-2/3 border border-[#d6b357]" aria-hidden="true" />
              <ParallaxPhoto className="fp-img relative aspect-[16/10] w-full overflow-hidden shadow-[0_18px_44px_-20px_rgba(0,20,40,0.35)] ring-1 ring-[#e8eaed]" strength={0.1}>
                <div className="fp-zoom relative h-full w-full">
                  <Image src="/background/dubai.webp" alt="Dubai skyline at golden hour" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
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
    </div>
  )
}
