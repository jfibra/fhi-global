"use client"

// Top Sales — the company leaderboard, shown on every internal overview so
// agents and members can see who's leading and where they sit.
//
// Ranking comes from /api/sales/top-sellers, which totals via the
// sales_totals_by_agents_period RPC. A sale counts on its reservation date,
// falling back to when it was encoded if there isn't one — so "March" means
// deals reserved in March, not deals typed in during March.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, Crown, Medal, TrendingUp, Trophy } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { roleToLabel } from "@/lib/app-roles"

type Leader = {
  id: string
  name: string | null
  role: string | null
  profileUrl: string | null
  deals: number
  /** Absent unless the viewer may see other agents' revenue — see the API. */
  value?: number
  rank: number
}

type Scope = "month" | "year" | "all"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** Compact money for the board: 4.1M / 940K / 12,500. */
function money(value: number): string {
  const n = Number(value || 0)
  if (n >= 999_500) {
    const m = n / 1_000_000
    return `${m.toFixed(m >= 10 ? 1 : 2)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString("en-US")
}

/** Medal colours for the top three; everyone else gets a plain chip. */
const PODIUM: Record<number, { ring: string; chip: string; Icon: typeof Crown }> = {
  1: { ring: "ring-[#d6b357]", chip: "bg-[#d6b357] text-[#001f3f]", Icon: Crown },
  2: { ring: "ring-[#c0c6cf]", chip: "bg-[#c0c6cf] text-[#0d1117]", Icon: Medal },
  3: { ring: "ring-[#cd8b5c]", chip: "bg-[#cd8b5c] text-white", Icon: Medal },
}

export function TopSalesBoard({
  currentUserId,
  agentHrefBase,
}: {
  currentUserId?: string | null
  /**
   * Sales root for the viewer's role (e.g. "/admin/sales"). When set, each row
   * links to that agent's full sales history. Only passed for super_admin and
   * admin: the drill-in is gated to them, so for anyone else the link would
   * lead to a page that just bounces back.
   */
  agentHrefBase?: string | null
}) {
  const now = new Date()
  const [scope, setScope] = useState<Scope>("month")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loadedKey, setLoadedKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const requestKey = `${scope}|${year}|${month}|${retry}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    if (loadedKey === requestKey) return
    let alive = true
    void (async () => {
      try {
        const qs = new URLSearchParams({ scope, year: String(year), month: String(month) })
        const res = await fetch(`/api/sales/top-sellers?${qs}`, { cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { leaders?: Leader[] }
        if (!alive) return
        setLeaders(body.leaders ?? [])
        setError(null)
      } catch {
        if (!alive) return
        setLeaders([])
        setError("Couldn't load the leaderboard.")
      } finally {
        if (alive) setLoadedKey(requestKey)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadedKey, requestKey, scope, year, month])

  // Five years back is enough to cover the sales history without a huge list.
  const years = useMemo(
    () => Array.from({ length: 5 }, (_, i) => now.getFullYear() - i),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixed at mount
    [],
  )

  const periodLabel =
    scope === "all" ? "All time" : scope === "year" ? `${year}` : `${MONTHS[month - 1]} ${year}`

  const selectCls =
    "rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] focus:border-[#001f3f] focus:outline-none"

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#001f3f]">
          <Trophy className="h-5 w-5 text-[#d6b357]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Top Sales</h2>
          <p className="text-xs text-[#6b7280]">Company leaderboard · {periodLabel}</p>
        </div>
      </div>

      {/* Filter: period shape, then the specific month/year it applies to. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-[#f3f4f6] p-0.5">
          {(["month", "year", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                scope === s ? "bg-[#001f3f] text-white" : "text-[#6b7280] hover:text-[#001f3f]"
              }`}
            >
              {s === "month" ? "Monthly" : s === "year" ? "Yearly" : "All time"}
            </button>
          ))}
        </div>

        {scope === "month" && (
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls} aria-label="Month">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        )}
        {scope !== "all" && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls} aria-label="Year">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f3f4f6]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#92400e]">
            {error}
            <button
              type="button"
              onClick={() => setRetry((r) => r + 1)}
              className="ml-3 rounded-lg bg-[#001f3f] px-3 py-1.5 text-xs font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : leaders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#e5e5e5] px-4 py-8 text-center text-sm text-[#9ca3af]">
            No validated sales for {periodLabel} yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {leaders.map((l) => {
              const podium = PODIUM[l.rank]
              const isMe = Boolean(currentUserId) && l.id === currentUserId
              const href = agentHrefBase ? `${agentHrefBase}?agent=${l.id}` : null
              // A link only where the drill-in is actually reachable; the row
              // stays a plain <li> for everyone else.
              const Row = href ? Link : "div"
              const rowProps = href
                ? { href, title: `View all sales by ${l.name ?? "this agent"}` }
                : {}
              return (
                <li key={l.id}>
                  <Row
                    {...(rowProps as { href: string })}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      isMe ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#f0f2f5] bg-white"
                    } ${href ? "cursor-pointer hover:border-[#001f3f]/30 hover:bg-[#fcfdff]" : ""}`}
                  >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      podium ? podium.chip : "bg-[#f3f4f6] text-[#6b7280]"
                    }`}
                  >
                    {podium ? <podium.Icon className="h-3.5 w-3.5" /> : l.rank}
                  </span>
                  <span className={podium ? `rounded-full ring-2 ${podium.ring}` : undefined}>
                    <UserAvatar name={l.name ?? "Agent"} imageUrl={l.profileUrl} size={36} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-[#0d1117]">{l.name ?? "Unnamed agent"}</span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-[#d6b357] px-1.5 py-0.5 text-[9px] font-bold text-[#001f3f]">
                          YOU
                        </span>
                      )}
                    </span>
                    {/* Deals move to the right-hand column when the value is
                        withheld, so they aren't printed twice. */}
                    <span className="block truncate text-[11px] text-[#9ca3af]">
                      {l.role ? roleToLabel(l.role) : "Agent"}
                      {typeof l.value === "number" && ` · ${l.deals} deal${l.deals === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {typeof l.value === "number" ? (
                      <span className="block font-['Outfit'] text-sm font-bold text-[#0d1117]">
                        {money(l.value)} AED
                      </span>
                    ) : (
                      <span className="block font-['Outfit'] text-sm font-bold text-[#0d1117]">
                        {l.deals}
                        <span className="ml-1 text-[11px] font-semibold text-[#9ca3af]">
                          {l.deals === 1 ? "deal" : "deals"}
                        </span>
                      </span>
                    )}
                  </span>
                  {href && <ChevronRight className="h-4 w-4 shrink-0 text-[#c0c6cf]" />}
                  </Row>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {!loading && !error && leaders.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
          <TrendingUp className="h-3.5 w-3.5" />
          Ranked by total value of validated sales, counted on the reservation date.
        </p>
      )}
    </section>
  )
}
