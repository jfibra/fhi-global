"use client"

// The leader's team, first thing on their overview (2026-10-02, for Michelle
// Q. Guinto's CMG Properties): the team's name and size, this month's and this
// year's team sales, the leader's own share, and the top sellers — with a link
// to the full Team Sales page. Same numbers as that page: it reads
// GET /api/team/sales-overview (the caller's active team, or their recruits
// when they have no formal team). Renders nothing when they have neither.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Users } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import type { TeamSalesOverview } from "@/lib/team-sales"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function moneyShort(v: number): string {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`
  return `AED ${n.toLocaleString("en-US")}`
}

const deals = (n: number) => `${n} deal${n === 1 ? "" : "s"}`
const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

export function TeamOverviewCard({ teamSalesHref }: { teamSalesHref: string }) {
  // The clock is read once, when the card mounts (renders stay pure).
  const [{ year, month }] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [data, setData] = useState<TeamSalesOverview | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/team/sales-overview?year=${year}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        setData((await res.json()) as TeamSalesOverview)
        setState("ready")
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState("error")
      })
    return () => ctrl.abort()
  }, [year])

  if (state === "error") return null
  if (state === "ready" && (!data || data.scope === "none")) return null

  const thisMonth = data?.trend.find((t) => t.month === month)
  const sellers = (data?.members ?? []).filter((m) => m.deals > 0).slice(0, 3)
  const soldCount = (data?.members ?? []).filter((m) => m.deals > 0).length
  const title = data?.scope === "team" ? data.teamName ?? "Your team" : "Your recruits"

  const tiles = data
    ? [
        { label: `Team · ${MONTHS[month - 1]}`, value: moneyShort(thisMonth?.teamValue ?? 0), hint: deals(thisMonth?.teamDeals ?? 0) },
        { label: `Team · ${year}`, value: moneyShort(data.teamTotals.value), hint: deals(data.teamTotals.deals) },
        { label: `Your own · ${year}`, value: moneyShort(data.personal.value), hint: deals(data.personal.deals) },
        { label: "Members who sold", value: `${soldCount}`, hint: `of ${data.membersTotal.toLocaleString("en-US")} in ${year}` },
      ]
    : []

  return (
    <section className="rounded-2xl border border-[#d6b357]/40 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#001f3f]">
          <Users className="h-5 w-5 text-[#d6b357]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{data ? title : "Your team"}</h2>
          <p className="text-xs text-[#6b7280]">
            {data
              ? `${data.scope === "team" ? "Your team" : "People who joined through your link"} · ${data.membersTotal.toLocaleString("en-US")} ${data.membersTotal === 1 ? "person" : "people"} · sales recorded by the team`
              : "Loading your team…"}
          </p>
        </div>
        <Link
          href={teamSalesHref}
          className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-3 py-2 text-xs font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10"
        >
          Open Team Sales <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {state === "loading" ? (
        <div className="mt-5 flex items-center justify-center gap-2 py-8 text-sm text-[#9ca3af]">
          <Loader2 className="h-4 w-4 animate-spin" /> Adding up your team&apos;s sales…
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="min-w-0 rounded-xl border border-[#eceef1] bg-[#fafbfc] px-4 py-3">
                <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{t.label}</p>
                <p className="mt-1 font-['Outfit'] text-[22px] font-bold leading-tight text-[#001f3f] tabular-nums">{t.value}</p>
                <p className="mt-0.5 truncate text-[11px] text-[#6b7280]">{t.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Top sellers in {year}</p>
            {sellers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-4 text-sm text-[#6b7280]">No validated team sales in {year} yet.</p>
            ) : (
              <ul className="divide-y divide-[#f0f2f5] rounded-xl border border-[#eceef1]">
                {sellers.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-[#d6b357] text-[#001f3f]" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{i + 1}</span>
                    <UserAvatar name={m.fullname ?? "Member"} imageUrl={m.profileUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[#0d1117]">{m.fullname ? titleCase(m.fullname) : "Member"}</span>
                        {m.isSelf && <span className="shrink-0 rounded-full bg-[#d6b357] px-1.5 py-0.5 text-[9px] font-bold text-[#001f3f]">YOU</span>}
                      </span>
                      <span className="block text-xs text-[#6b7280]">{deals(m.deals)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[#001f3f]">{moneyShort(m.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
