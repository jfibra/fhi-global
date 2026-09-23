"use client"

import Link from "next/link"
import { ArrowRight, Globe, LifeBuoy, TrendingUp, User } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

/**
 * Welcome card for Global Partners — agents based outside the UAE recruited
 * by an FHI Dubai agent. Their dashboard is rankings-only, so this card
 * explains what they are looking at and where the two remaining pages are.
 */
export function GlobalPartnerOverview({ displayName, uplineName }: { displayName: string; uplineName: string | null }) {
  const base = getDashboardRouteByRole(useAuth().role)
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#001f3f] p-6 sm:p-8 text-white overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-[#d6b357]/10" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] flex items-center gap-2">
          <Globe className="w-3.5 h-3.5" /> FHI Global Partner
        </p>
        <h2 className="mt-2 font-['Outfit'] text-2xl sm:text-3xl font-bold">Welcome, {displayName}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/80 leading-relaxed">
          You are part of FHI Global Property&apos;s international network
          {uplineName ? <>, invited by <span className="font-semibold text-white">{uplineName}</span></> : null}.
          Above are the live company rankings — the top-selling consultants and the developers their sales were written
          against — updated as sales are validated in Dubai.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: `${base}`, title: "Rankings", desc: "Top Sales and Top Developers, this month and all time.", icon: TrendingUp },
          { href: `${base}/profile`, title: "Profile", desc: "Keep your name, country and contact details current.", icon: User },
          { href: `${base}/support`, title: "Support", desc: "Questions about the partnership? Open a ticket.", icon: LifeBuoy },
        ].map((c) => (
          <Link key={c.title} href={c.href} className="group rounded-2xl border border-[#e8eaed] bg-white p-5 hover:border-[#001f3f] transition-colors">
            <c.icon className="w-5 h-5 text-[#b8913f]" />
            <p className="mt-3 font-['Outfit'] font-bold text-[#0d1117] flex items-center gap-1.5">
              {c.title} <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
