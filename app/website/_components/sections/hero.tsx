// Hero — headline over the banner photo (no overlay), the frosted broker
// card at the lower right (inline below the copy on mobile), and the glass
// stat strip along the bottom.

import { Building2, FileText, Mail, Phone, Play, ShieldCheck } from "lucide-react"
import { GOLD, HERO_STAT_ICON_FALLBACK, INK, NAVY, SAMPLE_DATA, STAT_ICONS, type WebsiteData } from "../../_data"

/** WhatsApp brand glyph — lucide has no brand icon for it. */
function WhatsAppIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

/** The frosted broker contact card — rendered absolutely on desktop and
 *  inline under the headline on mobile. */
function BrokerCard({ agent }: { agent: WebsiteData["agent"] }) {
  return (
    <div
      className="border border-white/15 p-6 shadow-2xl backdrop-blur-md"
      style={{ backgroundColor: "rgba(10,22,40,0.72)" }}
    >
      <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-white">{agent.name}</p>
      <p className="mt-1 text-xs text-white/70">{agent.title}</p>
      <div className="mt-3.5 space-y-2">
        <a
          href={`https://wa.me/${agent.whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white"
        >
          <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} /> {agent.whatsapp}
        </a>
        <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
          <Phone className="h-3.5 w-3.5" style={{ color: GOLD }} /> {agent.phone}
        </a>
        <a href={`mailto:${agent.email}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
          <Mail className="h-3.5 w-3.5" style={{ color: GOLD }} />
          <span className="truncate">{agent.email}</span>
        </a>
      </div>
      <div className="mt-4 h-px w-full bg-white/15" />
      <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
        <ShieldCheck className="h-4 w-4" /> RERA BRN: {agent.brn}
      </p>
      <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
        <FileText className="h-4 w-4" /> RERA ORN: {agent.orn}
      </p>
    </div>
  )
}

export function HeroSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  const { agent, hero } = data
  // Left-side dark wash (0–100) so the headline stays readable on bright
  // photos; at 0 the banner renders with no overlay at all.
  const overlay = Math.min(100, Math.max(0, hero.overlay ?? 0)) / 100
  return (
    <section id="home" className="relative overflow-hidden" style={{ backgroundColor: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hero.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center" />
      {overlay > 0 && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, rgba(0,0,0,${overlay}) 0%, rgba(0,0,0,${overlay * 0.55}) 38%, rgba(0,0,0,0) 68%)`,
          }}
        />
      )}
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex min-h-[420px] items-center gap-8 py-12 lg:min-h-[520px] lg:py-16">
          {/* Left: headline */}
          <div className="w-full max-w-xl">
            <h1 className="font-serif text-[34px] leading-[1.14] font-bold tracking-tight sm:text-[54px] sm:leading-[1.1]" style={{ color: hero.headlineColor || NAVY }}>
              <span className="whitespace-pre-line">{hero.headline}</span>{" "}
              <span style={{ color: hero.headlineAccentColor || GOLD }}>{hero.headlineAccent}</span>
            </h1>
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed" style={{ color: hero.descriptionColor || "#3d4451" }}>
              {hero.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#projects" className="inline-flex items-center gap-2 px-6 py-3 text-[13px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                <Building2 className="h-3.5 w-3.5" />Explore Projects
              </a>
              <a
                href="#about"
                className="inline-flex items-center gap-2 border border-white/25 px-6 py-3 text-[13px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/10"
                style={{ backgroundColor: "rgba(6,12,22,0.3)" }}
              >
                <Play className="h-3.5 w-3.5" />Featured Video
              </a>
            </div>

            {/* Broker card — inline on mobile/tablet, absolute on desktop */}
            <div className="mt-8 w-full max-w-sm lg:hidden">
              <BrokerCard agent={agent} />
            </div>
          </div>
        </div>
      </div>

      {/* Broker card — frosted glass, floating at the hero's lower right */}
      <div className="absolute bottom-14 right-[max(2.5rem,calc((100vw-1400px)/2+2rem))] hidden w-72 lg:block">
        <BrokerCard agent={agent} />
      </div>

      {/* Stat strip — ONE dark-glass band that RESPECTS the page's left
          padding (its left edge lines up with the headline/buttons) and is
          only as wide as the stats; photo stays visible below. */}
      <div className="relative mx-auto mb-12 max-w-[1400px] px-5 sm:px-8">
        <div
          className="inline-flex max-w-full flex-wrap items-center gap-x-6 gap-y-4 border-y border-white/10 px-4 py-4 backdrop-blur-md sm:gap-x-10 sm:pl-5 sm:pr-10"
          style={{ backgroundColor: "rgba(6,12,22,0.3)" }}
        >
          {hero.stats.map(({ icon, value, label }, i) => {
            const Icon = STAT_ICONS[icon ?? HERO_STAT_ICON_FALLBACK[i % HERO_STAT_ICON_FALLBACK.length]]
            return (
              <div key={`${label}-${i}`} className="flex items-center gap-3">
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
            )
          })}
        </div>
      </div>
    </section>
  )
}
