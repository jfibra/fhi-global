"use client"

import { Globe } from "lucide-react"

/**
 * Welcome card for Global Partners — agents based outside the UAE recruited
 * by an FHI Dubai agent. Sits above the standard agent overview.
 */
export function GlobalPartnerOverview({ displayName, uplineName }: { displayName: string; uplineName: string | null }) {
  return (
    <div className="rounded-2xl bg-[#001f3f] p-6 sm:p-8 text-white overflow-hidden relative">
      <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-[#d6b357]/10" />
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] flex items-center gap-2">
        <Globe className="w-3.5 h-3.5" /> FHI Global Partner
      </p>
      <h2 className="mt-2 font-['Outfit'] text-2xl sm:text-3xl font-bold">Welcome, {displayName}</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/80 leading-relaxed">
        You are part of FHI Global Property&apos;s international network
        {uplineName ? <>, invited by <span className="font-semibold text-white">{uplineName}</span> in Dubai</> : null}.
        Everything an FHI agent uses is yours — projects, listings, leads, sales and the full marketing toolkit.
      </p>
    </div>
  )
}
