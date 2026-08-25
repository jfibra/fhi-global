// Card components for the agent-site template: projects, properties,
// and testimonials.

import Link from "next/link"
import { BadgeCheck, Bath, BedDouble, Heart, MapPin, Maximize, Share2 } from "lucide-react"
import { GOLD, GOLD_SOFT, GOLD_TINT, INK, NAVY, type Project, type Property, type Testimonial } from "../_data"
import { DeveloperLogoTile } from "./developer-logo"
import { Stars } from "./ui"

/** Developer-style project card matching the reference mock: square card,
 *  black text-only status chip over the photo, frosted
 *  developer bar along the photo's bottom edge, serif title, location, and
 *  the starting price. */
export function ProjectCard({ project: p }: { project: Project }) {
  // Real projects link to their main-site page (like the /projects cards);
  // placeholder cards stay inert.
  const Wrapper = p.href ? Link : "div"
  const wrapperProps = p.href ? { href: p.href } : {}
  return (
    <Wrapper
      {...(wrapperProps as { href: string })}
      className="group flex h-full flex-col overflow-hidden border border-[#e8e5dc] bg-white shadow-[0_2px_10px_-4px_rgba(13,27,46,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_-16px_rgba(13,27,46,0.32)]"
    >
      {/* Photo */}
      <div className="relative aspect-[5/4] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />

        {/* Status chip */}
        {p.badge && (
          <span className="absolute left-3 top-3 flex h-9 items-center bg-black/85 px-3 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-white">
            {p.badge}
          </span>
        )}

        {/* Developer bar — full width; long names wrap to a second line
            instead of truncating. Its dark scrim is a child clipped to the
            bar's own box (isolate + -z-10), so it never bleeds above the bar
            while the logo tile is still free to float over the top edge. */}
        {(p.developerName || p.developerLogo) && (
          <div className="absolute inset-x-0 bottom-0 isolate flex min-h-11 items-center gap-3 py-1.5 pl-3 pr-5">
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />
            {/* Hairline: brushed-metal sheen — accent glint near the logo,
                fading to nothing toward the right edge. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, var(--wb-gold-a60) 10%, var(--wb-gold-a40) 35%, rgba(255,255,255,0.18) 65%, rgba(255,255,255,0) 100%)" }}
            />
            {p.developerLogo && <DeveloperLogoTile src={p.developerLogo} alt={p.developerName} />}
            <span className="flex min-w-0 items-center gap-2">
              <span className="line-clamp-2 text-[13.5px] font-semibold leading-[1.15] text-white">{p.developerName}</span>
              {p.developerVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-white" strokeWidth={1.75} style={{ fill: GOLD }} />}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pt-5 pb-5">
        <h3 className="truncate font-serif text-[22px] font-bold leading-tight tracking-tight" style={{ color: NAVY }}>{p.title}</h3>
        <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[#6b7280]">
          <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
          <span className="truncate">{p.location}</span>
        </p>

        {/* Starting price + actions (favorite · share) */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#ece9e0] pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a919c]">Starting from</p>
            <p className="mt-1.5 truncate text-[22px] font-bold leading-none tracking-tight" style={{ color: NAVY }}>
              {p.from || "Price on request"}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {[Heart, Share2].map((Icon, i) => (
              <span
                key={i}
                aria-hidden
                className="group/action flex h-11 w-11 cursor-pointer items-center justify-center transition-colors duration-300 hover:bg-[var(--wb-gold)]"
                style={{ backgroundColor: GOLD_TINT }}
              >
                <Icon className="h-[17px] w-[17px] transition-colors duration-300 group-hover/action:text-white" strokeWidth={1.9} style={{ color: GOLD }} />
              </span>
            ))}
          </span>
        </div>
      </div>
    </Wrapper>
  )
}

export function PropertyCard({ property: p }: { property: Property }) {
  return (
    <div className="group border border-[#e8e5dc] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(13,27,46,0.3)]">
      <div>
        <div className="relative h-40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <span className="absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: GOLD_SOFT, color: INK }}>
            {p.badge}
          </span>
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
            <Heart className="h-3.5 w-3.5" style={{ color: GOLD }} />
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="truncate text-[14.5px] font-bold" style={{ color: NAVY }}>{p.title}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
          {p.location}
        </p>
        <div className="mt-3 flex items-center gap-3 border-y border-[#f0ede4] py-2.5 text-[11px] text-[#5b6472]">
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.beds} Bed</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.baths} Bath</span>
          <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.sqft} Sqft</span>
        </div>
        <p className="mt-3 text-[16px] font-bold" style={{ color: NAVY }}>
          {p.price} {p.suffix && <span className="text-[11px] font-semibold text-[#9aa0aa]">{p.suffix}</span>}
        </p>
      </div>
    </div>
  )
}

export function TestimonialCard({ testimonial: t }: { testimonial: Testimonial }) {
  return (
    <div className="h-full border border-[#e8e5dc] bg-white p-6">
      <Stars />
      <p className="mt-4 text-[13px] leading-relaxed text-[#3d4451]">&ldquo;{t.quote}&rdquo;</p>
      <div className="mt-5 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>
          {t.name.charAt(0)}
        </span>
        <span>
          <span className="block text-[13px] font-bold" style={{ color: NAVY }}>{t.name}</span>
          <span className="block text-[11px] text-[#9aa0aa]">{t.where}</span>
        </span>
      </div>
    </div>
  )
}
