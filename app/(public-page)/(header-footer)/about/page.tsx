import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight, Award, BarChart3, Building2, Handshake, Headphones,
  Lightbulb, MapPin, ShieldCheck, Users,
} from "lucide-react"
import { createPageMetadata } from "@/lib/seo"
import { Reveal } from "@/components/public/reveal"

export const revalidate = 600

export const metadata: Metadata = createPageMetadata({
  title: "About Us — Building Trust, Creating Value",
  description:
    "FHI Global Property connects investors with Dubai's leading developers — who we are, how we work, and why buyers across the world trust us with UAE real estate.",
  pathname: "/about",
  keywords: ["About FHI Global", "Dubai real estate company", "FHI Global Property"],
})

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Integrity First",
    desc: "We believe in transparency, honesty, and doing what's right for our clients.",
  },
  {
    icon: Award,
    title: "Excellence Always",
    desc: "We go beyond expectations to deliver exceptional experiences.",
  },
  {
    icon: Lightbulb,
    title: "Innovation Driven",
    desc: "We leverage technology and data to bring smarter real estate solutions.",
  },
  {
    icon: Users,
    title: "Client Focused",
    desc: "Your goals are our priority. We grow when you succeed.",
  },
]

const CTA_POINTS = [
  { icon: Headphones, title: "Expert Guidance", desc: "Get advice from our experienced property consultants." },
  { icon: BarChart3, title: "Market Insights", desc: "Access the latest market data and investment trends." },
  { icon: Handshake, title: "Trusted Partnerships", desc: "Work with Dubai's most reputable developers." },
  { icon: ShieldCheck, title: "Secure Transactions", desc: "We ensure a smooth, safe, and transparent process." },
]

// The band under the masthead. Deliberately claims rather than counts: figures
// like "10,000+ happy clients" can't be evidenced, and a live count would
// read as smaller than it is on a young platform.
const HIGHLIGHTS = [
  { icon: Building2, title: "Off-Plan & Ready", desc: "Launches and completed homes across Dubai" },
  { icon: Handshake, title: "Direct From Developers", desc: "Developer pricing, no mark-up" },
  { icon: Users, title: "A Team That Answers", desc: "Consultants who know the UAE market" },
  { icon: MapPin, title: "Dubai, UAE", desc: "On the ground where you're buying" },
]

// Real photos from our own gallery (the FHI Dubai Global event album) — the
// actual team and leadership, not stock imagery. Same S3 host as the /gallery
// page, already allowed in next.config images.
const GALLERY_BASE =
  "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com/FHI_GLOBAL/gallery/fhi-global-dubai-event/web"
const PHOTOS = {
  team: {
    url: `${GALLERY_BASE}/0ec466a7-dsc04617.jpg`,
    alt: "The FHI Global team on a Dubai rooftop",
  },
  leaders: {
    url: `${GALLERY_BASE}/c7c6af0d-dsc03609-edit.jpg`,
    alt: "FHI Global leadership at the Dubai Fountain, Downtown Dubai",
    caption: "Our leadership in Downtown Dubai",
  },
  siteVisit: {
    url: `${GALLERY_BASE}/3f72486c-dsc04660.jpg`,
    alt: "The FHI Global team visiting a developer construction site in Dubai",
    caption: "On site with our developer partners",
  },
  moments: [
    {
      url: `${GALLERY_BASE}/cd7c1545-dsc04635.jpg`,
      alt: "The FHI Global team celebrating together on a Dubai rooftop",
    },
    {
      url: `${GALLERY_BASE}/3b70b14a-dsc04669-edit.jpg`,
      alt: "Reviewing a new project scale model at a developer showroom",
    },
    {
      url: `${GALLERY_BASE}/95e383bc-mw501247-edit.jpg`,
      alt: "Studying a masterplan model at a developer sales gallery",
    },
  ],
}

/** Diamond node pinned to the story rail — mobile left, desktop center. */
function RailNode() {
  return (
    <span
      className="absolute left-4 top-14 lg:left-1/2 lg:top-1/2 w-3 h-3 rotate-45 bg-[#d6b357] -translate-x-1/2 lg:-translate-y-1/2"
      aria-hidden="true"
    />
  )
}

/** Chapter header — gold numeral, kicker, navy title. */
function ChapterHead({ num, kicker, title }: { num: string; kicker: string; title: string }) {
  return (
    <div>
      <p className="font-['Outfit'] text-5xl font-bold text-[#d6b357]/35 leading-none">{num}</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">{kicker}</p>
      <h3 className="mt-2 font-['Outfit'] text-2xl md:text-[30px] font-bold text-[#001f3f] leading-tight">
        {title}
      </h3>
      <span className="block w-12 h-[3px] bg-[#d6b357] mt-4" aria-hidden="true" />
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className="bg-[#fafafa] overflow-x-hidden">
      {/* ── Masthead — cinematic: the whole company full-bleed behind the
             words, under a left-weighted navy scrim. The story pages below
             stay light; this is the emotional open. ── */}
      <section className="relative bg-[#001428] overflow-hidden">
        <Image
          src={PHOTOS.team.url}
          alt={PHOTOS.team.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_55%]"
        />
        {/* Photo scrim — heavy under the type, open right so the team reads. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#001428]/95 via-[#001428]/65 to-[#001428]/10"
          aria-hidden="true"
        />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:min-h-[520px] flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
              FHI Global · Our Story
            </span>
          </div>
          <h1
            className="font-['Outfit'] text-4xl md:text-[58px] font-bold leading-[1.05] tracking-tight"
            style={{ textShadow: "0 2px 24px rgba(0,10,30,0.55)" }}
          >
            <span className="block text-white">Building Trust.</span>
            <span className="block text-[#d6b357]">Creating Value.</span>
          </h1>
          <p
            className="mt-5 text-[15.5px] leading-relaxed text-white/85 max-w-xl"
            style={{ textShadow: "0 1px 12px rgba(0,10,30,0.6)" }}
          >
            From a simple vision to one of Dubai&apos;s most connected property platforms — this is
            who we are, how we work, and why buyers across the world trust us with UAE real estate.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#story"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all"
            >
              Read Our Story <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/35 text-white text-sm font-bold hover:border-[#d6b357] hover:text-[#d6b357] transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights band — anchors the hero into the page. */}
      <div className="relative bg-[#001f3f] border-b border-[#d6b357]/25">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-x-10 gap-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full border-2 border-[#d6b357]/60 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#d6b357]" />
              </div>
              <div>
                <p className="font-['Outfit'] text-sm font-bold text-white leading-tight">{title}</p>
                <p className="text-[10px] text-white/60">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The story — four chapters on a gold rail. ── */}
      <section id="story" className="scroll-mt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f] mb-3">
              The FHI Story
            </p>
            <h2 className="font-['Outfit'] text-3xl md:text-[38px] font-bold tracking-tight text-[#001f3f] leading-tight">
              From a vision to a <span className="text-[#d6b357]">skyline</span>
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          {/* The rail — left on mobile, center on desktop. */}
          <span
            className="absolute left-4 lg:left-1/2 top-4 bottom-4 w-px bg-[#d6b357]/35 -translate-x-1/2"
            aria-hidden="true"
          />

          {/* 01 · The Vision — text left, photo right. */}
          <div className="relative pl-12 lg:pl-0 py-10 lg:py-14 lg:grid lg:grid-cols-2 lg:gap-20 items-center">
            <RailNode />
            <Reveal direction="left">
              <div className="lg:pr-8">
                <ChapterHead num="01" kicker="The Vision" title="It started with a question." />
                <p className="mt-5 text-[19px] leading-[1.85] text-[#4b5563] max-w-lg">
                  Why does buying property in Dubai feel complicated from abroad? FHI Global was
                  founded to answer it — with a simple vision: to redefine how people discover,
                  invest in, and own real estate in Dubai. No noise, no pressure. Just honest
                  guidance and real inventory.
                </p>
              </div>
            </Reveal>
            <Reveal direction="right">
              <div className="mt-8 lg:mt-0">
                <div className="relative aspect-[4/3] overflow-hidden ring-1 ring-[#e8eaed]">
                  <Image
                    src={PHOTOS.leaders.url}
                    alt={PHOTOS.leaders.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
                  <span className="w-5 h-px bg-[#d6b357]" aria-hidden="true" /> {PHOTOS.leaders.caption}
                </p>
              </div>
            </Reveal>
          </div>

          {/* 02 · What We Believe — values left, text right. */}
          <div className="relative pl-12 lg:pl-0 py-10 lg:py-14 lg:grid lg:grid-cols-2 lg:gap-20 items-center">
            <RailNode />
            <Reveal direction="right">
              <div className="lg:order-2 lg:pl-8">
                <ChapterHead num="02" kicker="What We Believe" title="Values that do the work." />
                <p className="mt-5 text-[19px] leading-[1.85] text-[#4b5563] max-w-lg">
                  We are property experts, market analysts and technology specialists — but four
                  principles carry every deal we touch. They are why a first conversation so often
                  becomes a long relationship.
                </p>
              </div>
            </Reveal>
            <Reveal direction="left">
              <div className="lg:order-1 mt-8 lg:mt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VALUES.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-white border border-[#e5e8ec] p-5 hover:border-[#d6b357] transition-colors">
                    <Icon className="w-7 h-7 text-[#d6b357] mb-3" strokeWidth={1.4} />
                    <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{title}</p>
                    <p className="text-[12.5px] text-[#6b7280] leading-relaxed mt-1.5">{desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* 03 · The Partnerships — text left, photo right. */}
          <div className="relative pl-12 lg:pl-0 py-10 lg:py-14 lg:grid lg:grid-cols-2 lg:gap-20 items-center">
            <RailNode />
            <Reveal direction="left">
              <div className="lg:pr-8">
                <ChapterHead num="03" kicker="The Partnerships" title="Straight from the source." />
                <p className="mt-5 text-[19px] leading-[1.85] text-[#4b5563] max-w-lg">
                  We work directly with Dubai&apos;s most accomplished developers, so the prices and
                  payment plans you see are theirs — no mark-up, and our guidance costs you
                  nothing. Every partner we bring you is vetted and RERA-registered.
                </p>
                <Link
                  href="/developers"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#b8913f] transition-colors"
                >
                  Meet Our Developer Partners <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
            <Reveal direction="right">
              <div className="mt-8 lg:mt-0">
                <div className="relative aspect-[4/3] overflow-hidden ring-1 ring-[#e8eaed]">
                  <Image
                    src={PHOTOS.siteVisit.url}
                    alt={PHOTOS.siteVisit.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
                  <span className="w-5 h-px bg-[#d6b357]" aria-hidden="true" /> {PHOTOS.siteVisit.caption}
                </p>
              </div>
            </Reveal>
          </div>

          {/* 04 · The Promise — mission card left, text right. */}
          <div className="relative pl-12 lg:pl-0 py-10 lg:py-14 lg:grid lg:grid-cols-2 lg:gap-20 items-center">
            <RailNode />
            <Reveal direction="right">
              <div className="lg:order-2 lg:pl-8">
                <ChapterHead num="04" kicker="The Promise" title="Together, we build futures." />
                <p className="mt-5 text-[19px] leading-[1.85] text-[#4b5563] max-w-lg">
                  Every client, every developer, every home — the story ends the same way it
                  started: with trust. Wherever you&apos;re buying from, our team in Dubai is on
                  the ground, speaking your language, until the keys are in your hand.
                </p>
              </div>
            </Reveal>
            <Reveal direction="left">
              <div className="lg:order-1 relative mt-10 lg:mt-0 bg-[#001f3f] p-8">
                <span
                  className="absolute -top-5 left-7 w-11 h-11 border-2 border-[#d6b357] bg-[#001f3f] flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="font-['Outfit'] text-2xl font-bold text-[#d6b357] leading-none pt-1.5">&ldquo;</span>
                </span>
                <p className="text-white text-[15px] sm:text-base leading-relaxed pt-3">
                  Our mission is to empower people to make confident real estate decisions by
                  providing expert guidance, market insights, and exceptional service.
                </p>
                <span className="block w-10 h-[2px] bg-[#d6b357] mt-5 mb-3" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
                  FHI Global Property
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Moments — real frames from the gallery, routing into it. ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Reveal>
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f] mb-2">
                Moments
              </p>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#001f3f] leading-tight">
                The people behind the platform
              </h2>
            </div>
            <Link
              href="/gallery"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#b8913f] transition-colors"
            >
              Visit Our Gallery <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PHOTOS.moments.map((m) => (
              <Link key={m.url} href="/gallery" className="group relative aspect-[4/3] overflow-hidden ring-1 ring-[#e8eaed]">
                <Image
                  src={m.url}
                  alt={m.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </Link>
            ))}
          </div>
          <Link
            href="/gallery"
            className="sm:hidden mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f]"
          >
            Visit Our Gallery <ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Reveal>
        <div className="bg-[#001f3f] p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-4">
              Ready to Invest?
            </p>
            <h2 className="font-['Outfit'] text-3xl md:text-[36px] font-bold leading-tight tracking-tight">
              <span className="block text-white">Let&apos;s Build Your</span>
              <span className="block text-white">
                Real Estate <span className="text-[#d6b357]">Success</span>
              </span>
            </h2>
            <p className="text-white/65 text-[15px] leading-relaxed mt-5 max-w-sm">
              Partner with us today and discover the best property opportunities in Dubai.
            </p>
            <Link
              href="/contact"
              className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all"
            >
              Get in Touch <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
            {CTA_POINTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <Icon className="w-7 h-7 text-[#d6b357] shrink-0" strokeWidth={1.4} />
                <div className="min-w-0">
                  <h3 className="font-['Outfit'] text-[15px] font-bold text-white leading-tight">{title}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed mt-1.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      </section>
    </div>
  )
}
