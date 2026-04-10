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
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: "/buy",
      title: "Buy listings",
      desc: "Public sale listings published by the sales team.",
      icon: Building2,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: "/rent",
      title: "Rent listings",
      desc: "Public rental listings published by the sales team.",
      icon: KeyRound,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: "/dashboard/support",
      title: "Support",
      desc: "Open tickets and get help from the team.",
      icon: LifeBuoy,
      accent: "from-[#001f3f] to-[#003d7a]",
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
        <KpiCard
          label="Listings"
          value={stat(totalListings)}
          detail="Total active"
          accentClass="bg-[#001f3f]"
          textClass="text-[#001f3f]"
        />
        <KpiCard
          label="Published"
          value={stat(publishedListings)}
          detail="Live on your account"
          accentClass="bg-[#001f3f]"
          textClass="text-[#001f3f]"
        />
        <KpiCard
          label="Drafts"
          value={stat(draftListings)}
          detail="Finish when ready"
          accentClass="bg-[#001f3f]"
          textClass="text-[#001f3f]"
        />
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#374151] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#001f3f]" />
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

function KpiCard({
  label,
  value,
  detail,
  accentClass,
  textClass,
}: {
  label: string
  value: string
  detail?: string
  accentClass: string
  textClass: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-[#e8eaed] p-5 hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.06)] transition-all duration-300">
      <div className={`absolute top-4 bottom-4 left-0 w-1.5 rounded-r ${accentClass}`} />
      <div className="pl-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#374151]">{label}</p>
        <p className={`font-['Outfit'] text-[40px] leading-tight font-bold ${textClass} mt-1 tracking-tight`}>
          {value}
        </p>
        {detail && <p className="text-[13px] text-[#6b7280]">{detail}</p>}
      </div>
    </div>
  )
}
