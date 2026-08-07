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
  title: "About FHI Global | Building Trust, Creating Value",
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

// The band under the hero. Deliberately claims rather than counts: figures
// like "10,000+ happy clients" can't be evidenced, and a live count would
// read as smaller than it is on a young platform.
const HIGHLIGHTS = [
  { icon: Building2, title: "Off-Plan & Ready", desc: "Launches and completed homes across Dubai" },
  { icon: Handshake, title: "Direct From Developers", desc: "Developer pricing, no mark-up" },
  { icon: Users, title: "A Team That Answers", desc: "Consultants who know the UAE market" },
  { icon: MapPin, title: "Dubai, UAE", desc: "On the ground where you're buying" },
]

export default function AboutPage() {
  return (
    <div className="bg-[#fafafa] overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative bg-[#001428] overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          {/* The bright golden-hour skyline, not the dusk shot — no scrim
              setting can lighten a photo that is itself dark. */}
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center animate-kenburns"
          />
          {/* Strong only under the type on the left, then opening fast so the
              skyline reads as a bright photo rather than a dark wash. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/85 via-[#001428]/35 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28 md:pt-20 md:pb-32">
          <p className="animate-hero-item text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-5" style={{ animationDelay: "60ms" }}>
            About FHI Global
          </p>
          <h1 className="animate-hero-item font-['Outfit'] text-4xl md:text-[52px] font-bold leading-[1.08] tracking-tight" style={{ animationDelay: "150ms" }}>
            <span className="block text-white">Building Trust.</span>
            <span className="block text-[#d6b357]">Creating Value.</span>
          </h1>
          <span className="animate-hero-item block w-16 h-[3px] bg-[#d6b357] my-6" style={{ animationDelay: "240ms" }} aria-hidden="true" />
          <p className="animate-hero-item text-white/75 text-[15px] leading-relaxed max-w-md" style={{ animationDelay: "320ms" }}>
            FHI Global Property is Dubai&apos;s premier real estate platform, connecting investors
            with exceptional opportunities and world-class development.
          </p>
          <div className="animate-hero-item" style={{ animationDelay: "400ms" }}>
            <Link
              href="#story"
              className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 transition-all"
            >
              Our Story <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Highlights — overlapping the hero, as in the design ── */}
      <section className="relative z-10 -mt-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
        <div className="bg-white border border-[#e5e8ec] shadow-[0_18px_50px_-24px_rgba(0,20,45,0.35)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#eef0f3]">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="px-6 py-7 text-center">
              <Icon className="w-7 h-7 text-[#d6b357] mx-auto mb-3" strokeWidth={1.5} />
              <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f] leading-tight">{title}</p>
              <p className="text-xs text-[#6b7280] mt-2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        </Reveal>
      </section>

      {/* ── Who we are ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f] mb-3">
            Who We Are
          </p>
          <h2 className="font-['Outfit'] text-3xl md:text-[38px] font-bold tracking-tight text-[#001f3f] leading-tight">
            More Than a <span className="text-[#d6b357]">Real Estate</span> Platform
          </h2>
          <p className="text-[#5f6368] text-[15px] leading-relaxed mt-4">
            We are a team of property experts, market analysts and technology specialists committed
            to making real estate investment in Dubai simple, transparent and rewarding.
          </p>
        </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {VALUES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 90}>
            <div
              className="group h-full bg-white border border-[#e5e8ec] p-7 text-center hover:border-[#d6b357] transition-colors"
            >
              <Icon className="w-9 h-9 text-[#d6b357] mx-auto mb-4" strokeWidth={1.4} />
              <h3 className="font-['Outfit'] text-base font-bold text-[#001f3f]">{title}</h3>
              <p className="text-[13px] text-[#6b7280] leading-relaxed mt-2.5">{desc}</p>
              <span className="block w-8 h-[2px] bg-[#d6b357] mx-auto mt-5" aria-hidden="true" />
            </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Our story ── */}
      <section id="story" className="scroll-mt-24 bg-[#001f3f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <Reveal direction="left">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-4">
              Our Story
            </p>
            <h2 className="font-['Outfit'] text-3xl md:text-[38px] font-bold tracking-tight leading-tight">
              <span className="text-white">A Vision That</span>{" "}
              <span className="text-white">Became a </span>
              <span className="text-[#d6b357]">Mission</span>
            </h2>
            <span className="block w-16 h-[3px] bg-[#d6b357] my-6" aria-hidden="true" />
            <div className="space-y-4 max-w-lg">
              <p className="text-white/75 text-[15px] leading-relaxed">
                FHI Global was founded with a simple vision — to redefine how people discover,
                invest in, and own real estate in Dubai.
              </p>
              <p className="text-white/60 text-[15px] leading-relaxed">
                Through trust, expertise and strong developer partnerships, we have grown into a
                platform serving clients from around the world — pairing on-the-ground knowledge of
                the UAE market with a team that speaks our clients&apos; language, wherever they
                are buying from.
              </p>
              <p className="text-white/60 text-[15px] leading-relaxed">
                We work directly with the developers, so the prices and payment plans you see are
                theirs — no mark-up, and our guidance costs you nothing.
              </p>
            </div>
          </div>
          </Reveal>

          <Reveal direction="right">
          <div>
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/background/home.webp"
                alt="Dubai skyline"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {/* Mission card, tucked under the photo the way the design has it. */}
            <div className="relative -mt-12 mx-4 sm:mx-8 bg-[#07182c] border border-white/10 p-7 sm:p-8">
              <span className="absolute -top-6 left-7 w-12 h-12 rounded-full border-2 border-[#d6b357] bg-[#001f3f] flex items-center justify-center" aria-hidden="true">
                <span className="font-['Outfit'] text-2xl font-bold text-[#d6b357] leading-none pt-1">&ldquo;</span>
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
          </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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

