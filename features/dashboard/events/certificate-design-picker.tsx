"use client"

import { Check } from "lucide-react"
import { CERTIFICATE_DESIGNS, type CertificateDesign } from "@/lib/events/certificate"

/**
 * The four certificate designs as clickable cards. Thumbnails are static
 * renders of the real engine (public/certificates/<design>.jpg, sample name
 * and the FHI brand) so the choice is instant; the live preview with the
 * event's own details is shown by the caller.
 */
export function CertificateDesignPicker({
  value,
  onChange,
  compact = false,
}: {
  value: CertificateDesign
  onChange: (design: CertificateDesign) => void
  /** Smaller cards for the Certificates window's side column. */
  compact?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Certificate design" className={`grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
      {CERTIFICATE_DESIGNS.map((d) => {
        const on = d.key === value
        return (
          <button
            key={d.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(d.key)}
            title={d.blurb}
            className={`group relative overflow-hidden border-2 bg-white text-left transition-all ${
              on ? "border-[#001f3f] shadow-[0_10px_24px_-12px_rgba(0,31,63,0.55)]" : "border-[#e5e5e5] hover:border-[#9ca3af]"
            }`}
          >
            <span className="relative block aspect-[1754/1240] overflow-hidden bg-[#f6f7f9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/certificates/${d.key}.jpg`}
                alt={`${d.name} certificate design`}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              {on && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#001f3f] text-white shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </span>
            <span className={`block px-2.5 ${compact ? "py-1.5" : "py-2"}`}>
              <span className={`block font-['Outfit'] font-bold text-[#001f3f] ${compact ? "text-[12px]" : "text-[13px]"}`}>{d.name}</span>
              {!compact && <span className="mt-0.5 block text-[11px] leading-snug text-[#6b7280]">{d.blurb}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
