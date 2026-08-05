// Hero — headline over the banner photo (no overlay), the frosted broker
// card at the lower right, and the glass stat strip along the bottom.

import { Landmark, Mail, MessageCircle, Phone, Play } from "lucide-react"
import { AGENT, GOLD, HERO_STATS, IMG, INK, NAVY } from "../../_data"
import { Eyebrow } from "../ui"

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden" style={{ backgroundColor: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG.hero} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex min-h-[520px] items-center gap-8 py-16">
          {/* Left: headline */}
          <div className="max-w-xl">
            <Eyebrow>Your trusted real estate partner in Dubai</Eyebrow>
            <h1 className="mt-4 font-serif text-4xl leading-[1.14] font-bold tracking-tight sm:text-[54px] sm:leading-[1.1]" style={{ color: NAVY }}>
              Guiding You to
              <br />
              the <span style={{ color: GOLD }}>Right Move.</span>
            </h1>
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-[#3d4451]">
              Personalized real estate solutions with integrity, market expertise, and a commitment to your success.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#projects" className="inline-flex items-center px-6 py-3 text-[13px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                Explore Projects
              </a>
              <a href="#about" className="inline-flex items-center gap-2 border px-6 py-3 text-[13px] font-bold" style={{ borderColor: NAVY, color: NAVY }}>
                <Play className="h-3.5 w-3.5" />Featured Video
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Broker card — frosted glass, floating at the hero's lower right */}
      <div className="absolute bottom-14 right-[max(2.5rem,calc((100vw-1400px)/2+2rem))] hidden w-72 lg:block">
        <div
          className="rounded-xl border border-white/15 p-6 shadow-2xl backdrop-blur-md"
          style={{ backgroundColor: "rgba(10,22,40,0.72)" }}
        >
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-white">{AGENT.name}</p>
          <p className="mt-1 text-xs text-white/70">International Property Endorser</p>
          <div className="mt-3.5 space-y-2">
            <a
              href={`https://wa.me/${AGENT.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" style={{ color: GOLD }} /> {AGENT.phone}
            </a>
            <a href={`tel:${AGENT.phone}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
              <Phone className="h-3.5 w-3.5" style={{ color: GOLD }} /> {AGENT.phone}
            </a>
            <a href={`mailto:${AGENT.email}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
              <Mail className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <span className="truncate">{AGENT.email}</span>
            </a>
          </div>
          <div className="mt-4 h-px w-full bg-white/15" />
          <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
            <Landmark className="h-4 w-4" /> RERA BRN: {AGENT.brn}
          </p>
          <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
            <Landmark className="h-4 w-4" /> RERA ORN: {AGENT.orn}
          </p>
        </div>
      </div>

      {/* Stat strip — ONE dark-glass band that RESPECTS the page's left
          padding (its left edge lines up with the headline/buttons) and is
          only as wide as the stats; photo stays visible below. */}
      <div className="relative mx-auto mb-12 max-w-[1400px] px-5 sm:px-8">
        <div
          className="inline-flex max-w-full flex-wrap items-center gap-x-10 gap-y-4 border-y border-white/10 py-4 pl-5 pr-10 backdrop-blur-md"
          style={{ backgroundColor: "rgba(6,12,22,0.3)" }}
        >
          {HERO_STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: GOLD }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: `${GOLD}80`, color: GOLD }}>
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                </span>
              </span>
              <span>
                <span className="block whitespace-nowrap text-[19px] font-bold leading-tight text-white">{value}</span>
                <span className="block whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/60">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
