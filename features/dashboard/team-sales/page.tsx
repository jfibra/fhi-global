"use client"

// Team Sales — a team leader / unit manager's production dashboard: the whole
// team's sales for a chosen year or month, a member leaderboard ranked by
// production, the leader's own numbers, and a monthly trend.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  TrendingUp, Users, Trophy, Search, ChevronDown, CalendarDays, UserRound, Loader2,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { roleInList } from "@/lib/app-roles"
import { UserAvatar } from "@/components/user-avatar"
import { ROLE_COLORS, ROLE_OPTIONS } from "@/lib/user-service"
import type { TeamSalesOverview } from "@/lib/team-sales"

const ROLES_ALLOWED = ["team_leader", "unit_manager", "admin", "super_admin"] as const

// Chart palette — validated with the dataviz six-checks script against a white
// surface (CVD ΔE ≥ 22, contrast ≥ 3:1). Brand navy/gold are out of the passing
// band for chart marks, so these are the nearest passing steps of each hue.
const MARK_MINE = "#b08a38"
const MARK_TEAM = "#33619b"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/* ── helpers ─────────────────────────────────────────────────────────────── */

const money = (v: number) =>
  `AED ${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`

function moneyShort(v: number): string {
  const n = Number(v || 0)
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`
  return `AED ${n.toLocaleString("en-US")}`
}

const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

function roleLabel(role: string | null): string {
  const key = (role ?? "member").toLowerCase()
  return ROLE_OPTIONS.find((o) => o.value === key)?.label ?? titleCase(key.replace(/_/g, " "))
}

function roleChip(role: string | null): string {
  const c = ROLE_COLORS[(role ?? "member").toLowerCase().trim()] ?? ROLE_COLORS.member
  return `${c.bg} ${c.text} ${c.border}`
}

/* ── filter dropdown (simple absolute menu — no blur ancestors here) ─────── */

function PeriodSelect<T extends number>({
  value, options, onChange, ariaLabel, icon,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border bg-white text-sm text-[#374151] transition-all ${
          open ? "border-[#001f3f] ring-4 ring-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/40"
        }`}
      >
        {icon}
        <span className="whitespace-nowrap font-semibold">{current?.label ?? ""}</span>
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-2 left-0 min-w-full w-max max-h-72 overflow-y-auto bg-white rounded-2xl border border-[#f0f0f0] shadow-2xl py-1.5"
        >
          {options.map((o) => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full px-4 py-2 text-sm text-left transition-colors whitespace-nowrap ${
                  selected ? "bg-[#001f3f]/6 text-[#001f3f] font-semibold" : "text-[#374151] hover:bg-[#f8fafc]"
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── stat tile ───────────────────────────────────────────────────────────── */

function StatTile({ icon, label, value, hint, tone = "navy" }: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  tone?: "navy" | "gold" | "emerald"
}) {
  const tones: Record<string, string> = {
    navy: "bg-[#001f3f]/8 text-[#001f3f]",
    gold: "bg-[#d6b357]/18 text-[#8a6a10]",
    emerald: "bg-emerald-50 text-emerald-600",
  }
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 [&_svg]:w-4 [&_svg]:h-4 ${tones[tone]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">{label}</p>
      <p className="text-xl font-bold text-[#0d1117] font-['Outfit'] mt-0.5 tabular-nums truncate" title={value}>{value}</p>
      {hint && <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{hint}</p>}
    </div>
  )
}

/* ── monthly trend chart ─────────────────────────────────────────────────── */
// Stacked bars: "My sales" (gold, at the baseline) + "Team members" (blue, on
// top) — the full bar is the team's total, so nothing is double counted.
// Marks follow the dataviz spec: thin bars, rounded data-end, 2px surface gap
// between segments, recessive gridlines, legend + per-month hover tooltip.

const CHART_H = 190

function TrendChart({ data, monthFilter, hasTeam, groupLabel = "Team members" }: {
  data: TeamSalesOverview["trend"]
  monthFilter: number | null
  /** Without a team/recruit group the blue series would just relabel the
   *  caller's own sales — render a single gold series instead. */
  hasTeam: boolean
  /** Legend name for the blue series ("Team members" or "My recruits"). */
  groupLabel?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => (hasTeam ? d.teamValue : d.myValue)))
  const hovered = hover !== null && hover < data.length ? data[hover] : null

  const legend = hasTeam
    ? [{ c: MARK_MINE, l: "My sales" }, { c: MARK_TEAM, l: groupLabel }]
    : [{ c: MARK_MINE, l: "My sales" }]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[430px]">
      {/* legend (single series names itself; two series always get one) */}
      <div className="flex items-center gap-4 mb-3">
        {legend.map((s) => (
          <span key={s.l} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6b7280]">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: s.c }} />
            {s.l}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* recessive gridlines (behind the marks) */}
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: CHART_H }} aria-hidden>
          {[1, 0.5].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-black/[0.06]" style={{ top: CHART_H * (1 - f) }} />
          ))}
        </div>

        {/* bars */}
        <div className="flex items-end gap-1.5 sm:gap-2.5 border-b border-black/[0.10]" style={{ height: CHART_H }}>
          {data.map((d, i) => {
            const otherValue = hasTeam ? Math.max(0, d.teamValue - d.myValue) : 0
            // Non-zero values always get at least 2px so a small month never
            // renders as an empty column.
            const px = (v: number) => (v <= 0 ? 0 : Math.max(2, Math.round((v / max) * (CHART_H - 8))))
            const myH = px(d.myValue)
            const otherH = px(otherValue)
            const total = hasTeam ? d.teamValue : d.myValue
            const dimmed = monthFilter !== null && monthFilter !== d.month
            return (
              <button
                key={d.month}
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={hasTeam
                  ? `${MONTHS[i]}: team ${money(d.teamValue)} from ${d.teamDeals} deals, mine ${money(d.myValue)}`
                  : `${MONTHS[i]}: my sales ${money(d.myValue)} from ${d.myDeals} deals`}
                className="relative flex-1 flex flex-col items-center justify-end h-full focus:outline-none group"
              >
                <div className={`w-full max-w-[26px] flex flex-col justify-end transition-opacity ${dimmed ? "opacity-30" : ""}`}>
                  {otherH > 0 && (
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{ height: otherH, backgroundColor: MARK_TEAM, marginBottom: myH > 0 ? 2 : 0 }}
                    />
                  )}
                  {myH > 0 && (
                    <div
                      className={`w-full ${otherH > 0 ? "" : "rounded-t-[4px]"}`}
                      style={{ height: myH, backgroundColor: MARK_MINE }}
                    />
                  )}
                  {total === 0 && <div className="w-full h-[2px] bg-black/[0.08] rounded-full" />}
                </div>
                {/* hover hit feedback */}
                <div className={`absolute inset-x-0 top-0 bottom-0 rounded-lg transition-colors ${hover === i ? "bg-[#001f3f]/4" : ""}`} aria-hidden />
              </button>
            )
          })}
        </div>

        {/* scale labels — after the bars so they stay readable over them */}
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: CHART_H }} aria-hidden>
          {[1, 0.5].map((f) => (
            <span
              key={f}
              className="absolute right-0 -translate-y-1/2 text-[9px] text-[#9ca3af] bg-white/85 rounded px-1 tabular-nums"
              style={{ top: CHART_H * (1 - f) }}
            >
              {moneyShort(max * f)}
            </span>
          ))}
        </div>

        {/* x labels */}
        <div className="flex gap-1.5 sm:gap-2.5 mt-1.5">
          {data.map((d, i) => (
            <span key={d.month} className={`flex-1 text-center text-[10px] tabular-nums ${monthFilter === d.month ? "font-bold text-[#001f3f]" : "text-[#9ca3af]"}`}>
              {MONTHS[i]}
            </span>
          ))}
        </div>

        {/* tooltip — anchored above the plot, clamped so Jan/Dec never clip */}
        {hovered && (
          <div
            className="absolute z-10 pointer-events-none bg-[#0d1117] text-white rounded-xl px-3.5 py-2.5 shadow-xl"
            style={{
              bottom: CHART_H - 4,
              left: `clamp(110px, ${((hover! + 0.5) / data.length) * 100}%, calc(100% - 110px))`,
              transform: "translateX(-50%)",
            }}
            role="status"
          >
            <p className="text-[11px] font-bold mb-1">{MONTHS[hover!]}</p>
            <div className="space-y-0.5 text-[11px] whitespace-nowrap">
              {hasTeam && (
                <p className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: MARK_TEAM }} />
                  Team {money(hovered.teamValue)} · {hovered.teamDeals} {hovered.teamDeals === 1 ? "deal" : "deals"}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: MARK_MINE }} />
                Mine {money(hovered.myValue)} · {hovered.myDeals} {hovered.myDeals === 1 ? "deal" : "deals"}
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

/* ── main ────────────────────────────────────────────────────────────────── */

export default function TeamSalesPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(roleInList(role, ROLES_ALLOWED))

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number>(0) // 0 = whole year
  const [data, setData] = useState<TeamSalesOverview | null>(null)
  const [loadedKey, setLoadedKey] = useState("")
  const [failed, setFailed] = useState(false)

  const [sortBy, setSortBy] = useState<"value" | "deals">("value")
  const [search, setSearch] = useState("")

  const requestKey = `${year}|${month}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    if (!allowed || loadedKey === requestKey) return
    let alive = true
    void (async () => {
      try {
        const qs = new URLSearchParams({ year: String(year) })
        if (month) qs.set("month", String(month))
        const res = await fetch(`/api/team/sales-overview?${qs}`, { cache: "no-store" })
        const d = res.ok ? ((await res.json()) as TeamSalesOverview) : null
        if (!alive) return
        setData(d)
        setFailed(!d)
      } catch {
        if (!alive) return
        setData(null)
        setFailed(true)
      } finally {
        if (alive) setLoadedKey(requestKey)
      }
    })()
    return () => { alive = false }
  }, [allowed, loadedKey, requestKey, year, month])

  const leaderboard = useMemo(() => {
    const rows = [...(data?.members ?? [])]
    rows.sort((a, b) => (sortBy === "value" ? b.value - a.value || b.deals - a.deals : b.deals - a.deals || b.value - a.value))
    const q = search.trim().toLowerCase()
    return q ? rows.filter((m) => (m.fullname ?? "").toLowerCase().includes(q)) : rows
  }, [data, sortBy, search])

  // Ranks are computed on the full sorted list (search narrows the view, not
  // the ranking).
  const rankById = useMemo(() => {
    const rows = [...(data?.members ?? [])]
    rows.sort((a, b) => (sortBy === "value" ? b.value - a.value || b.deals - a.deals : b.deals - a.deals || b.value - a.value))
    return new Map(rows.map((m, i) => [m.id, i + 1]))
  }, [data, sortBy])

  if (!allowed) return null

  const topPerformer = data?.members[0]
  const periodLabel = month ? `${MONTHS[month - 1]} ${year}` : `${year}`
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  // With no formal team the group is the leader's recruit network — every
  // label follows so the numbers are never attributed to a team that doesn't
  // exist in team_memberships.
  const scope = data?.scope ?? "none"
  const hasGroup = scope !== "none"
  const groupNoun = scope === "recruits" ? "recruits" : "members"
  const groupTitle = scope === "recruits" ? "My recruit network" : data?.teamName ?? null

  return (
    <div className="max-w-[1200px] space-y-5">
      {/* heading + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#d6b357]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">Team Sales</h1>
            <p className="text-sm text-[#9ca3af]">
              {groupTitle ? `${groupTitle} · ` : ""}production for {periodLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <PeriodSelect
            ariaLabel="Year"
            icon={<CalendarDays className="w-4 h-4 text-[#9ca3af]" />}
            value={year}
            options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
            onChange={(y) => setYear(y)}
          />
          <PeriodSelect
            ariaLabel="Month"
            value={month}
            options={[{ value: 0, label: "Whole year" }, ...MONTHS.map((m, i) => ({ value: i + 1, label: m }))]}
            onChange={(m) => setMonth(m)}
          />
        </div>
      </div>

      {failed && !loading ? (
        <div className="rounded-2xl border border-black/[0.08] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#9ca3af]">Couldn&apos;t load team sales.</p>
          <button
            type="button"
            onClick={() => setLoadedKey("")}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#001f3f] hover:bg-[#002b57] text-white text-sm font-semibold transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* stat tiles */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[104px] rounded-2xl bg-white border border-black/[0.08] animate-pulse" />)
            ) : (
              <>
                <StatTile
                  icon={<Users />}
                  label={scope === "recruits" ? "Group sales" : "Team sales"}
                  value={hasGroup ? money(data!.teamTotals.value) : "—"}
                  hint={hasGroup ? `${data!.teamTotals.deals} deals · ${data!.membersTotal} ${groupNoun}` : "No team or recruits yet"}
                  tone="navy"
                />
                <StatTile icon={<UserRound />} label="My sales" value={money(data?.personal.value ?? 0)} hint={`${data?.personal.deals ?? 0} ${data?.personal.deals === 1 ? "deal" : "deals"}`} tone="gold" />
                <StatTile
                  icon={<Trophy />}
                  label="Top performer"
                  value={topPerformer && topPerformer.value > 0 ? titleCase(topPerformer.fullname ?? "—") : "—"}
                  hint={topPerformer && topPerformer.value > 0 ? `${moneyShort(topPerformer.value)} · ${topPerformer.deals} deals` : "No sales in this period"}
                  tone="gold"
                />
                <StatTile
                  icon={<TrendingUp />}
                  label="Avg per member"
                  value={data && data.membersTotal > 0 ? moneyShort(data.teamTotals.value / data.membersTotal) : "—"}
                  hint="Contract value"
                  tone="emerald"
                />
              </>
            )}
          </div>

          {/* trend */}
          <div className="rounded-2xl border border-black/[0.08] bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-['Outfit'] text-sm font-bold text-[#0d1117]">Monthly trend · {year}</h2>
              {month > 0 && <span className="text-[11px] text-[#9ca3af]">Highlighting {MONTHS[month - 1]}</span>}
            </div>
            {loading ? (
              <div className="h-[220px] rounded-xl bg-[#f6f8fb] animate-pulse" />
            ) : (data?.trend.every((t) => (hasGroup ? t.teamValue : t.myValue) === 0) ?? true) ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-[#9ca3af]">
                No sales recorded in {year} yet.
              </div>
            ) : (
              <TrendChart
                data={data!.trend}
                monthFilter={month || null}
                hasTeam={hasGroup}
                groupLabel={scope === "recruits" ? "My recruits" : "Team members"}
              />
            )}
          </div>

          {/* leaderboard */}
          <div className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#f0f2f5]">
              <h2 className="font-['Outfit'] text-sm font-bold text-[#0d1117]">
                {scope === "recruits" ? "Recruit leaderboard" : "Member leaderboard"}
                <span className="ml-2 text-xs font-semibold text-[#9ca3af]">({data?.membersTotal ?? 0})</span>
                {(data?.membersTotal ?? 0) > (data?.members.length ?? 0) && (
                  <span className="ml-2 text-[10px] font-semibold text-[#c0821e]">showing top {data?.members.length}</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search member…"
                    className="h-9 w-44 pl-8 pr-3 rounded-xl border border-[#eceff3] bg-[#f8fafc] text-xs text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
                  />
                </div>
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#f3f4f6]" role="group" aria-label="Rank by">
                  {([{ id: "value" as const, label: "By value" }, { id: "deals" as const, label: "By deals" }]).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id)}
                      aria-pressed={sortBy === s.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        sortBy === s.id ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#f6f8fb] animate-pulse" />)}
              </div>
            ) : !hasGroup ? (
              <p className="px-5 py-14 text-center text-sm text-[#9ca3af]">
                No team or recruits yet — invite agents with your referral link (Invite page), or ask an
                admin to add you to a team, and they&apos;ll appear here.
              </p>
            ) : leaderboard.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-[#9ca3af]">No member matches “{search}”.</p>
            ) : (
              <div>
                {leaderboard.map((m) => {
                  const rank = rankById.get(m.id) ?? 0
                  const groupValue = data?.teamTotals.value ?? 0
                  const share = groupValue > 0 ? m.value / groupValue : 0
                  const medal =
                    rank === 1 ? "bg-[#d6b357] text-[#001f3f]" :
                    rank === 2 ? "bg-[#d7dce3] text-[#374151]" :
                    rank === 3 ? "bg-[#e6cdb0] text-[#6b4c1e]" :
                    "bg-[#f3f4f6] text-[#9ca3af]"
                  return (
                    <div key={m.id} className={`flex items-center gap-3 px-5 py-3 border-b border-[#f6f7f9] last:border-0 ${m.isSelf ? "bg-[#fffdf3]" : ""}`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black tabular-nums shrink-0 ${medal}`}>
                        {rank}
                      </span>
                      <UserAvatar name={titleCase(m.fullname ?? "Unnamed")} imageUrl={m.profileUrl} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#0d1117] truncate">
                          {titleCase(m.fullname ?? "Unnamed")}
                          {m.isSelf && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide bg-[#d6b357]/20 text-[#8a6a10] rounded-full px-1.5 py-0.5">You</span>}
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden max-w-[260px]">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, backgroundColor: MARK_TEAM }} />
                        </div>
                      </div>
                      <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${roleChip(m.role)}`}>
                        {roleLabel(m.role)}
                      </span>
                      <div className="shrink-0 text-right w-24">
                        <p className="text-[13px] font-bold text-[#0d1117] tabular-nums">{m.value > 0 ? moneyShort(m.value) : "—"}</p>
                        <p className="text-[10px] text-[#9ca3af]">{m.deals} {m.deals === 1 ? "deal" : "deals"} · {Math.round(share * 100)}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
      {loading && !failed && !data && (
        <div className="flex items-center justify-center gap-2 text-xs text-[#9ca3af]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading team sales…
        </div>
      )}
    </div>
  )
}
