"use client"

import Link from "next/link"
import { CreditCard, LifeBuoy, TrendingUp, ArrowRight, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

type Props = {
  displayName: string
  businessCardHref: string
  intro: string
}

export function SecretaryLikeOverview({ displayName, businessCardHref, intro }: Props) {
  const base = getDashboardRouteByRole(useAuth().role)
  const cards = [
    {
      href: `${base}/sales`,
      title: "Sales reports",
      desc: "View deals, validation status, and attach documents when a sale is under review or marked invalid.",
      icon: TrendingUp,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: `${base}/support`,
      title: "Support tickets",
      desc: "Log requests for IT, operations, or admin follow-up.",
      icon: LifeBuoy,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
    {
      href: businessCardHref,
      title: "Business card",
      desc: "Update the details shown on your public-facing card.",
      icon: CreditCard,
      accent: "from-[#001f3f] to-[#003d7a]",
    },
  ] as const

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] mb-1">Overview</p>
        <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">Welcome, {displayName}</h2>
        <p className="text-sm text-[#6b7280] mt-2 max-w-2xl leading-relaxed">{intro}</p>
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
