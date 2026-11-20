"use client"

import { ChevronDown, MessageCircle, Store, UserRound } from "lucide-react"
import { isoFlagEmoji } from "@/lib/nationalities"
import { COUNTRIES, countryByIso } from "@/lib/countries"
import { MERCHANT_CATEGORIES } from "@/lib/merchant/rules"

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

/**
 * The merchant sign-up's first step (lib/merchant-signup.ts): the business,
 * the kind of business, the person who signs for it and their WhatsApp. The
 * parent owns the values.
 */
export function MerchantBusinessFields({
  idPrefix,
  businessName,
  onBusinessName,
  category,
  onCategory,
  contactName,
  onContactName,
  waIso,
  onWaIso,
  waNumber,
  onWaNumber,
}: {
  idPrefix: string
  businessName: string
  onBusinessName: (v: string) => void
  category: string
  onCategory: (v: string) => void
  contactName: string
  onContactName: (v: string) => void
  waIso: string
  onWaIso: (iso: string) => void
  waNumber: string
  onWaNumber: (v: string) => void
}) {
  const waCountry = countryByIso(waIso)
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-business`} className="mb-1.5 block text-xs font-semibold text-[#374151]">Business name</label>
        <div className="relative">
          <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input id={`${idPrefix}-business`} type="text" value={businessName} onChange={(e) => onBusinessName(e.target.value)} placeholder="Bayt Al Noor Restaurant" autoComplete="organization" className={`${inputCls} pl-10`} />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-category`} className="mb-1.5 block text-xs font-semibold text-[#374151]">Kind of business</label>
        <div className="relative">
          <select id={`${idPrefix}-category`} value={category} onChange={(e) => onCategory(e.target.value)} className={`${inputCls} appearance-none pr-9 ${category ? "" : "text-[#9ca3af]"}`}>
            <option value="" disabled>Choose one</option>
            {MERCHANT_CATEGORIES.map((c) => (
              <option key={c} value={c} className="text-[#111827]">{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-contact`} className="mb-1.5 block text-xs font-semibold text-[#374151]">Your name (the person who signs for the business)</label>
        <div className="relative">
          <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input id={`${idPrefix}-contact`} type="text" value={contactName} onChange={(e) => onContactName(e.target.value)} placeholder="Khalid Al Mansoori" autoComplete="name" className={`${inputCls} pl-10`} />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-wa`} className="mb-1.5 block text-xs font-semibold text-[#374151]">WhatsApp number</label>
        <div className="flex gap-2">
          <div className="relative w-[140px] shrink-0">
            <select id={`${idPrefix}-wa-code`} aria-label="WhatsApp country code" value={waIso} onChange={(e) => onWaIso(e.target.value)} className={`${inputCls} appearance-none pr-8 ${waIso ? "" : "text-[#9ca3af]"}`}>
              <option value="" disabled>Code</option>
              {COUNTRIES.map((c) => (
                <option key={c.iso} value={c.iso} className="text-[#111827]">{isoFlagEmoji(c.iso)} {c.dial}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input id={`${idPrefix}-wa`} type="tel" inputMode="tel" value={waNumber} onChange={(e) => onWaNumber(e.target.value)} placeholder={waCountry ? "50 000 0000" : "Number"} autoComplete="tel-national" className={`${inputCls} pl-10`} />
          </div>
        </div>
      </div>
    </>
  )
}
