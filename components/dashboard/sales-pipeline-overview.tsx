"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ClipboardList,
  TrendingUp,
  Building2,
  KeyRound,
  LifeBuoy,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Props = {
  displayName: string
  userId: string | undefined
}

export function SalesPipelineOverview({ displayName, userId }: Props) {
  const [totalListings, setTotalListings] = useState<number | null>(null)
  const [publishedListings, setPublishedListings] = useState<number | null>(null)
  const [draftListings, setDraftListings] = useState<number | null>(null)

  const loadStats = useCallback(async () => {
    if (!userId) {
      setTotalListings(0)
      setPublishedListings(0)
      setDraftListings(0)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase
      .from("agent_listings")
      .select("status")
      .eq("agent_id", userId)
      .is("deleted_at", null)

    if (error || !data) {
      setTotalListings(null)
      setPublishedListings(null)
      setDraftListings(null)
      return
    }
    setTotalListings(data.length)
    setPublishedListings(data.filter((r) => r.status === "published").length)
    setDraftListings(data.filter((r) => r.status === "draft").length)
  }, [userId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const stat = (v: number | null) => (v === null ? "—" : String(v))

  const cards: Array<{
    href: string
    title: string
    desc: string
    icon: typeof ClipboardList
    accent: string
  }> = [
    {
      href: "/dashboard/listings",
      title: "My listings",
      desc: "Create and manage sale or rent listings (agents, team leaders, and unit managers).",
      icon: ClipboardList,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: "/dashboard/sales",
      title: "Sales reports",
      desc: "Track sales, commissions, and validation workflow.",
      icon: TrendingUp,
      accent: "from-emerald-700 to-emerald-500",
    },
    {
      href: "/buy",
      title: "Buy listings",
      desc: "Public sale listings published by the sales team.",
      icon: Building2,
      accent: "from-amber-700 to-[#d6b357]",
    },
    {
      href: "/rent",
      title: "Rent listings",
      desc: "Public rental listings published by the sales team.",
      icon: KeyRound,
      accent: "from-sky-700 to-sky-500",
    },
    {
      href: "/dashboard/support",
      title: "Support",
      desc: "Open tickets and get help from the team.",
      icon: LifeBuoy,
      accent: "from-rose-700 to-rose-500",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Welcome, {displayName}</h2>
        <p className="text-sm text-[#6b7280] mt-2 max-w-2xl leading-relaxed">
          Developers publish projects; you create <strong className="text-[#374151]">listings</strong>, run{" "}
          <strong className="text-[#374151]">sales</strong>, and use Buy/Rent tools to match clients with the right
          property.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Listings</p>
          <p className="mt-1 text-3xl font-bold text-[#001f3f] font-['Outfit']">{stat(totalListings)}</p>
          <p className="text-xs text-[#6b7280] mt-1">Total active</p>
        </div>
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Published</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700 font-['Outfit']">{stat(publishedListings)}</p>
          <p className="text-xs text-[#6b7280] mt-1">Live on your account</p>
        </div>
        <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Drafts</p>
          <p className="mt-1 text-3xl font-bold text-amber-700 font-['Outfit']">{stat(draftListings)}</p>
          <p className="text-xs text-[#6b7280] mt-1">Finish when ready</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#374151] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#d6b357]" />
          Quick links
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm hover:border-[#001f3f]/25 hover:shadow-md transition-all"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-3 shadow-inner`}
              >
                <c.icon className="w-5 h-5 text-white" />
              </div>
              <p className="font-['Outfit'] font-bold text-[#0d1117] group-hover:text-[#001f3f] transition-colors">
                {c.title}
              </p>
              <p className="text-xs text-[#6b7280] mt-1.5 leading-relaxed flex-1">{c.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#001f3f]">
                Open
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
