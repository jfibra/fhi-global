"use client"

import { ChevronDown, MapPin, MessageCircle } from "lucide-react"
import { isoFlagEmoji } from "@/lib/nationalities"
import { COUNTRIES, countryByIso } from "@/lib/countries"

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

/**
 * "Where are you based?" — the country a Global Partner lives in now and their
 * WhatsApp (lib/partner-signup.ts). Used by the partner invite's first step and
 * by the dashboard pop-up for partners who joined before it existed. The
 * parent owns the values (and whether the code follows the country).
 */
export function PartnerLocationFields({
  idPrefix,
  country,
  onCountry,
  waIso,
  onWaIso,
  waNumber,
  onWaNumber,
}: {
  idPrefix: string
  /** A COUNTRIES name, or "" until one is picked. */
  country: string
  onCountry: (name: string) => void
  /** ISO of the WhatsApp calling code's country (+1 is shared, so the ISO is kept). */
  waIso: string
  onWaIso: (iso: string) => void
  waNumber: string
  onWaNumber: (value: string) => void
}) {
  const waCountry = countryByIso(waIso)
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-country`} className="mb-1.5 block text-xs font-semibold text-[#374151]">Country you live in</label>
        <div className="relative">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <select
            id={`${idPrefix}-country`}
            value={country}
            onChange={(e) => onCountry(e.target.value)}
            className={`${inputCls} appearance-none pl-10 pr-9 ${country ? "" : "text-[#9ca3af]"}`}
          >
            <option value="" disabled>Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.name} className="text-[#111827]">{isoFlagEmoji(c.iso)} {c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-whatsapp`} className="mb-1.5 block text-xs font-semibold text-[#374151]">WhatsApp number</label>
        <div className="flex items-stretch gap-2">
          {/* The code: a native picker under a "🇵🇭 +63" face — easy to use on a phone. */}
          <div className="relative w-[104px] shrink-0">
            <select
              aria-label="WhatsApp country code"
              value={waIso}
              onChange={(e) => onWaIso(e.target.value)}
              className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            >
              <option value="" disabled>Code</option>
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso}>{c.name} ({c.dial})</option>
              ))}
            </select>
            <span className="flex h-full items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] pl-3 pr-7 text-sm tabular-nums text-[#111827] transition-all peer-focus-visible:border-[#001f3f] peer-focus-visible:bg-white peer-focus-visible:ring-4 peer-focus-visible:ring-[#001f3f]/6" aria-hidden>
              {waCountry ? <>{isoFlagEmoji(waCountry.iso)} {waCountry.dial}</> : <span className="text-[#9ca3af]">Code</span>}
            </span>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
          </div>
          <div className="relative min-w-0 flex-1">
            <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              id={`${idPrefix}-whatsapp`}
              type="tel"
              inputMode="tel"
              value={waNumber}
              onChange={(e) => onWaNumber(e.target.value)}
              placeholder="917 123 4567"
              autoComplete="tel-national"
              maxLength={24}
              className={`${inputCls} pl-10`}
            />
          </div>
        </div>
      </div>
    </>
  )
}
