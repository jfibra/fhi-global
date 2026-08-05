// Card components for the agent-site template: projects, properties,
// and testimonials.

import { Bath, BedDouble, Heart, MapPin, Maximize, QrCode } from "lucide-react"
import { GOLD, GOLD_SOFT, INK, NAVY, type Project, type Property, type Testimonial } from "../_data"
import { Stars } from "./ui"

export function ProjectCard({ project: p }: { project: Project }) {
  return (
    <div className="group border border-[#e8e5dc] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(13,27,46,0.3)]">
      <div className="p-3 pb-0">
        <div className="relative h-40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <span className="absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: GOLD_SOFT, color: INK }}>
            Off Plan
          </span>
          <span className="absolute right-3 top-3 flex h-9 w-14 items-center justify-center bg-white/95 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.developer.url} alt={p.developer.name} className="max-h-full max-w-full object-contain" />
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="truncate text-[14.5px] font-bold" style={{ color: NAVY }}>{p.title}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
          {p.location}
        </p>
        <p className="mt-2 text-[12px] text-[#5b6472]">{p.units}</p>
        <p className="mt-1 text-[12px] font-semibold text-[#5b6472]">
          Starting from <span className="font-bold" style={{ color: NAVY }}>{p.from}</span>
        </p>
        <div className="mt-3 flex gap-2">
          <span className="inline-flex flex-1 cursor-pointer items-center justify-center px-3 py-2 text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>
            View Project
          </span>
          <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-[#d8d3c6]">
            <QrCode className="h-4 w-4" style={{ color: NAVY }} />
          </span>
        </div>
      </div>
    </div>
  )
}

export function PropertyCard({ property: p }: { property: Property }) {
  return (
    <div className="group border border-[#e8e5dc] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(13,27,46,0.3)]">
      <div className="p-3 pb-0">
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
