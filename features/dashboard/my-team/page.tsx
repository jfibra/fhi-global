"use client"

/**
 * My Team (boss via Juliecor, 2026-10-14): everything about the signed-in
 * recruiter's network in one place — everyone in their genealogy, KPIs for a
 * period, who sold and who hasn't, every deal with filters, charts, and CSV
 * exports. The API (app/api/my-team) returns the whole network and every
 * credited sale once; every filter here is instant.
 *
 * Design ("not a generic one"): a navy masthead branded with the leader's
 * photo and their team's logo, KPI tiles that each carry a small picture
 * (level mix, % sold, joins sparkline), a podium of the top sellers, a
 * conversion card (who is selling, level by level), a month chart that shows
 * every month — empty ones too — with the months outside the period faded,
 * a ranked project list, and tables that turn into cards on a phone.
 */

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Award, BarChart3, Building2, Download, Hourglass, RefreshCw, Search, Target, TrendingUp, Trophy, UserPlus, Users } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ROLES_ADMIN_STAFF, invitableRolesFor, roleInList, roleToLabel } from "@/lib/app-roles"
import { STATUS_COLORS } from "@/lib/user-service"
import type { MyTeamResponse, TeamMember, TeamSale } from "@/app/api/my-team/route"

type Period = "month" | "last_month" | "quarter" | "year" | "all" | "custom"
type SaleStatus = "validated" | "pending" | "rejected" | "all"
type SoldFilter = "all" | "sold" | "not_sold"
type MonthPoint = { key: string; value: number; deals: number; inPeriod: boolean }

const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—")
const iso = (d: Date) => d.toISOString().slice(0, 10)
const ymAdd = (ym: string, n: number) => { const [y, m] = ym.split("-").map(Number); return iso(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7) }
const ymRange = (from: string, to: string) => { const out: string[] = []; for (let k = from; k <= to && out.length < 120; k = ymAdd(k, 1)) out.push(k); return out }
const ymName = (ym: string, opts: Intl.DateTimeFormatOptions) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { ...opts, timeZone: "UTC" })
const pctText = (f: number) => `${f > 0 && f < 0.1 ? (f * 100).toFixed(1) : Math.round(f * 100)}%`
const PERIODS: Array<[Period, string]> = [["month", "This month"], ["last_month", "Last month"], ["quarter", "Quarter"], ["year", "This year"], ["all", "All time"], ["custom", "Custom"]]
const LEVEL_COLORS = ["#001f3f", "#d6b357", "#6f8db3", "#b8913f", "#8aa4c2", "#5c6b7a"]

function periodBounds(p: Period, custom: { from: string; to: string }): { from: string | null; to: string | null; label: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  if (p === "month") return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))), label: now.toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" }) }
  if (p === "last_month") { const d = new Date(Date.UTC(y, m - 1, 1)); return { from: iso(d), to: iso(new Date(Date.UTC(y, m, 1))), label: d.toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" }) } }
  if (p === "quarter") { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(Date.UTC(y, q, 1))), to: iso(new Date(Date.UTC(y, q + 3, 1))), label: `Q${q / 3 + 1} ${y}` } }
  if (p === "year") return { from: `${y}-01-01`, to: `${y + 1}-01-01`, label: String(y) }
  if (p === "custom") return { from: custom.from || null, to: custom.to ? iso(new Date(Date.parse(`${custom.to}T00:00:00Z`) + 86400e3)) : null, label: `${custom.from ? fmtDate(custom.from) : "…"} – ${custom.to ? fmtDate(custom.to) : "…"}` }
  return { from: null, to: null, label: "All time" }
}
const inRange = (d: string, from: string | null, to: string | null) => (!from || d >= from) && (!to || d < to)

function downloadCsv(name: string, head: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob([[head, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function Avatar({ name, photo, size = "h-9 w-9", ring = "" }: { name: string; photo: string | null; size?: string; ring?: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className={`${size} shrink-0 rounded-full object-cover ${ring}`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] font-['Outfit'] text-sm font-bold text-white ${ring}`}>{name.charAt(0).toUpperCase()}</span>
  )
}
function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>{status}</span>
}
const Level = ({ n }: { n: number }) => <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#001f3f]/5 px-1 text-[10.5px] font-bold text-[#001f3f]">L{n}</span>
const Select = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[13px] font-semibold text-[#111827] focus:border-[#001f3f] focus:outline-none">
    {children}
  </select>
)
const Card = ({ className = "", children }: { className?: string; children: React.ReactNode }) => <div className={`min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5 sm:p-6 ${className}`}>{children}</div>
function CardTitle({ icon: Icon, children, aside }: { icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7280]"><Icon className="h-3.5 w-3.5 text-[#b8913f]" /> {children}</h2>
      {aside && <span className="text-[11px] font-semibold text-[#9ca3af]">{aside}</span>}
    </div>
  )
}

/** Validated value per month — every month in the window is drawn, empty ones
 *  too, so the shape is honest; months outside the selected period are faded
 *  context. The best month inside the period is gold. */
function MonthChart({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = 10 ** Math.floor(Math.log10(max))
  const top = [1, 2, 2.5, 5, 10].map((f) => f * step).find((v) => v >= max) ?? max
  const peak = points.reduce((best, p, i) => (p.inPeriod && p.value > (best < 0 ? 0 : points[best].value) ? i : best), -1)
  const labelsOnPhone = points.length <= 7
  return (
    <div className="mt-6 flex flex-1 flex-col">
      <div className="relative min-h-[190px] flex-1 pl-10">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className={`absolute left-10 right-0 border-t ${f ? "border-dashed border-[#eef0f3]" : "border-[#e5e8ec]"}`} style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-10 -top-2 w-8 text-right text-[10px] tabular-nums text-[#9ca3af]">{f ? short(top * f) : "0"}</span>
          </div>
        ))}
        <div className="absolute bottom-0 left-10 right-0 top-0 flex items-end gap-1.5 sm:gap-2.5">
          {points.map((p, i) => {
            const h = (p.value / top) * 100
            return (
              <div key={p.key} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                {p.value > 0 && (
                  <span className={`mb-1 text-[10px] font-bold tabular-nums ${labelsOnPhone ? "" : "hidden sm:block"} ${i === peak ? "text-[#b8913f]" : p.inPeriod ? "text-[#374151]" : "text-[#c5ccd6]"}`}>{short(p.value)}</span>
                )}
                <div
                  className={`w-full max-w-[40px] rounded-t-md transition-[filter] group-hover:brightness-110 ${i === peak ? "bg-gradient-to-t from-[#b8913f] to-[#e3c98a]" : p.inPeriod ? "bg-gradient-to-t from-[#001f3f] to-[#1d4a7a]" : "bg-[#001f3f]/15"}`}
                  style={{ height: p.value > 0 ? `${Math.max(h, 1.5)}%` : "2px", opacity: p.value > 0 ? 1 : 0.35 }}
                />
                <div className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg bg-[#0d1117] px-2.5 py-1.5 text-center text-[11px] text-white shadow-lg group-hover:block" style={{ bottom: `calc(${Math.min(h, 100)}% + 22px)` }}>
                  <p className="font-semibold">{ymName(p.key, { month: "long", year: "numeric" })}</p>
                  <p className="tabular-nums text-[#f0d89b]">{AED(p.value)}</p>
                  <p className="text-white/60">{p.deals} deal{p.deals === 1 ? "" : "s"}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="ml-10 mt-2 flex gap-1.5 sm:gap-2.5">
        {points.map((p, i) => (
          <span key={p.key} className={`min-w-0 flex-1 text-center text-[10.5px] leading-tight ${p.inPeriod ? "font-semibold text-[#374151]" : "text-[#b0b7c3]"}`}>
            {ymName(p.key, { month: "short" })}
            {(i === 0 || p.key.endsWith("-01")) && <span className="block text-[9.5px] font-normal text-[#9ca3af]">{p.key.slice(0, 4)}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Sold share of the members who could sell, as a gold arc. */
function Ring({ frac }: { frac: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0 -rotate-90 lg:h-36 lg:w-36" aria-hidden="true">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#eef0f3" strokeWidth="12" />
      <circle cx="64" cy="64" r={r} fill="none" stroke="url(#mt-gold)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(frac * c, frac > 0 ? 4 : 0)} ${c}`} />
      <defs>
        <linearGradient id="mt-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3c98a" /><stop offset="1" stopColor="#b8913f" /></linearGradient>
      </defs>
    </svg>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyTeamPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(invitableRolesFor(role).length > 0 || roleInList(role, ROLES_ADMIN_STAFF))
  const [data, setData] = useState<MyTeamResponse | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [period, setPeriod] = useState<Period>("year")
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [status, setStatus] = useState<SaleStatus>("validated")
  const [level, setLevel] = useState("all")
  const [project, setProject] = useState("all")
  const [developer, setDeveloper] = useState("all")
  const [sold, setSold] = useState<SoldFilter>("all")
  const [memberStatus, setMemberStatus] = useState("all")
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<"members" | "sales">("members")
  const [memberSort, setMemberSort] = useState("value")
  const [showAll, setShowAll] = useState(false)

  const refresh = () => {
    setBusy(true)
    fetch("/api/my-team", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as MyTeamResponse & { error?: string }
        if (!res.ok || !json.members) throw new Error(json.error ?? `Request failed (${res.status}).`)
        setData(json)
        setLoadedAt(new Date())
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your team."))
      .finally(() => setBusy(false))
  }
  useEffect(() => {
    const id = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(id)
  }, [])

  const bounds = periodBounds(period, custom)
  const q = query.trim().toLowerCase()
  const levelOk = (l: number) => level === "all" || (level === "3+" ? l >= 3 : l === Number(level))

  const periodSales = useMemo(() => (data?.sales ?? []).filter((s) => inRange(s.date, bounds.from, bounds.to)), [data, bounds.from, bounds.to])
  const sales = useMemo(
    () =>
      periodSales.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          s.credits.some((c) => levelOk(c.level)) &&
          (project === "all" || s.project === project) &&
          (developer === "all" || (s.developer ?? "") === developer) &&
          (!q || s.project.toLowerCase().includes(q) || (s.developer ?? "").toLowerCase().includes(q) || s.credits.some((c) => c.name.toLowerCase().includes(q)) || (s.unit ?? "").toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodSales, status, level, project, developer, q],
  )
  const memberPeriod = useMemo(() => {
    const m = new Map<string, { validated: number; value: number; pending: number; pendingValue: number; rejected: number; last: string | null }>()
    for (const s of periodSales) for (const c of s.credits) {
      const t = m.get(c.memberId) ?? { validated: 0, value: 0, pending: 0, pendingValue: 0, rejected: 0, last: null }
      if (s.status === "validated") { t.validated++; t.value += c.value; if (!t.last || s.date > t.last) t.last = s.date }
      else if (s.status === "rejected") t.rejected++
      else { t.pending++; t.pendingValue += c.value }
      m.set(c.memberId, t)
    }
    return m
  }, [periodSales])
  const empty = { validated: 0, value: 0, pending: 0, pendingValue: 0, rejected: 0, last: null as string | null }
  const members = useMemo(() => {
    const rows = (data?.members ?? [])
      .map((n) => ({ n, p: memberPeriod.get(n.id) ?? empty }))
      .filter(({ n, p }) => levelOk(n.level) && (memberStatus === "all" || n.status === memberStatus) && (sold === "all" || (sold === "sold" ? p.validated > 0 : p.validated === 0)) && (!q || n.name.toLowerCase().includes(q)))
    const key = (r: (typeof rows)[number]) => memberSort === "value" ? r.p.value : memberSort === "deals" ? r.p.validated : memberSort === "pending" ? r.p.pending : memberSort === "recruits" ? r.n.network : memberSort === "joined" ? Date.parse(r.n.joinedAt ?? "0") : 0
    return rows.sort((a, b) => key(b) - key(a) || a.n.name.localeCompare(b.n.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, memberPeriod, level, memberStatus, sold, q, memberSort])

  const kpi = useMemo(() => {
    const all = (data?.members ?? []).filter((n) => levelOk(n.level))
    const seller = (n: TeamMember) => (memberPeriod.get(n.id)?.validated ?? 0) > 0
    const inPeriod = periodSales.filter((s) => s.credits.some((c) => levelOk(c.level)))
    const value = (st: string) => inPeriod.filter((s) => s.status === st).reduce((a, s) => a + s.credits.reduce((x, c) => x + c.value, 0), 0)
    const ranked = all.map((n) => ({ n, p: memberPeriod.get(n.id) ?? empty })).filter((r) => r.p.validated > 0).sort((a, b) => b.p.value - a.p.value || b.p.validated - a.p.validated)
    const byLevel = new Map<number, { members: number; active: number; sold: number; value: number }>()
    for (const n of all) {
      const t = byLevel.get(n.level) ?? { members: 0, active: 0, sold: 0, value: 0 }
      t.members++
      if (n.status === "active") t.active++
      const p = memberPeriod.get(n.id)
      if (p?.validated) { t.sold++; t.value += p.value }
      byLevel.set(n.level, t)
    }
    const nowYm = iso(new Date()).slice(0, 7)
    const joins = ymRange(ymAdd(nowYm, -5), nowYm).map((k) => ({ key: k, count: all.filter((n) => n.joinedAt?.startsWith(k)).length }))
    return {
      members: all.length, active: all.filter((n) => n.status === "active").length, pending: all.filter((n) => n.status === "pending").length,
      sold: all.filter(seller).length, notSold: all.filter((n) => !seller(n) && n.status === "active").length,
      validated: inPeriod.filter((s) => s.status === "validated").length, validatedValue: value("validated"),
      pendingDeals: inPeriod.filter((s) => s.status === "pending").length, pendingValue: value("pending"), rejected: inPeriod.filter((s) => s.status === "rejected").length,
      joiners: all.filter((n) => n.joinedAt && inRange(n.joinedAt.slice(0, 10), bounds.from, bounds.to)).length,
      ranked,
      byLevel: [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([lv, t]) => ({ level: lv, ...t })),
      joins,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, periodSales, memberPeriod, level, bounds.from, bounds.to])

  const projects = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.project))].sort(), [data])
  const developers = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.developer).filter((d): d is string => Boolean(d)))].sort(), [data])
  const charts = useMemo(() => {
    const sum = (s: TeamSale) => s.credits.reduce((a, c) => a + c.value, 0)
    // Month window: ends at the period's last month (never in the future),
    // reaches back to the period start, at least 6 months, at most 12.
    const byMonth = new Map<string, { value: number; deals: number }>()
    for (const s of data?.sales ?? []) {
      if (s.status !== "validated") continue
      const t = byMonth.get(s.date.slice(0, 7)) ?? { value: 0, deals: 0 }
      t.value += sum(s)
      t.deals++
      byMonth.set(s.date.slice(0, 7), t)
    }
    const nowYm = iso(new Date()).slice(0, 7)
    const lastYm = bounds.to ? iso(new Date(Date.parse(`${bounds.to}T00:00:00Z`) - 86400e3)).slice(0, 7) : nowYm
    const endYm = lastYm < nowYm ? lastYm : nowYm
    const startYm = bounds.from ? bounds.from.slice(0, 7) : ([...byMonth.keys()].sort()[0] ?? endYm)
    let from = startYm < ymAdd(endYm, -5) ? startYm : ymAdd(endYm, -5)
    const clipped = from < ymAdd(endYm, -11)
    if (clipped) from = ymAdd(endYm, -11)
    const months: MonthPoint[] = ymRange(from, endYm).map((k) => ({ key: k, value: byMonth.get(k)?.value ?? 0, deals: byMonth.get(k)?.deals ?? 0, inPeriod: k >= startYm && k <= lastYm }))

    const byProject = new Map<string, { name: string; developer: string | null; value: number; deals: number }>()
    for (const s of periodSales) {
      if (s.status !== "validated") continue
      const t = byProject.get(s.project) ?? { name: s.project, developer: s.developer, value: 0, deals: 0 }
      t.value += sum(s)
      t.deals++
      byProject.set(s.project, t)
    }
    const projectRows = [...byProject.values()].sort((a, b) => b.value - a.value)
    return { months, clipped, hasFaded: months.some((m) => !m.inPeriod), projects: projectRows.slice(0, 7), projectCount: projectRows.length, projectTotal: projectRows.reduce((a, r) => a + r.value, 0) }
  }, [data, periodSales, bounds.from, bounds.to])

  if (!allowed) return null

  const exportMembers = () => downloadCsv("my-team-members", ["Name", "Level", "Role", "Status", "Joined", "Direct recruits", "Network", "Validated deals", "Validated value (AED)", "Pending deals", "Pending value (AED)", "Rejected", "Last sale"], members.map(({ n, p }) => [n.name, n.level, roleToLabel(n.role), n.status, n.joinedAt?.slice(0, 10) ?? "", n.direct, n.network, p.validated, Math.round(p.value), p.pending, Math.round(p.pendingValue), p.rejected, p.last ?? ""]))
  const exportSales = () => downloadCsv("my-team-sales", ["Date", "Status", "Member", "Level", "Share %", "Credited (AED)", "Project", "Developer", "Unit", "Contract price (AED)", "Shared with"], sales.flatMap((s) => s.credits.map((c) => [s.date, s.status, c.name, c.level, c.share, c.value, s.project, s.developer ?? "", s.unit ?? "", s.price, [...s.credits.filter((x) => x.memberId !== c.memberId).map((x) => x.name), ...s.outside].join("; ")])))

  const levels = (data?.perLevel ?? []).map((_, i) => i + 1)
  const shown = showAll ? members : members.slice(0, 50)
  const maxValue = Math.max(1, ...members.map((r) => r.p.value))
  const podium = kpi.ranked.slice(0, 3)
  const couldSell = kpi.sold + kpi.notSold
  const soldFrac = couldSell ? kpi.sold / couldSell : 0
  const levelTotal = (data?.perLevel ?? []).reduce((a, n) => a + n, 0)
  const joinMax = Math.max(1, ...kpi.joins.map((j) => j.count))
  const photoOf = new Map((data?.members ?? []).map((m) => [m.id, m.photo]))
  const PLINTH = [
    { h: "h-20", bg: "bg-gradient-to-b from-[#e8cf86] to-[#c9a449]", ring: "ring-[3px] ring-[#d6b357]", size: "h-20 w-20", num: "text-white" },
    { h: "h-14", bg: "bg-gradient-to-b from-[#e3e8ee] to-[#b9c2cf]", ring: "ring-[3px] ring-[#c5ccd6]", size: "h-14 w-14 sm:h-16 sm:w-16", num: "text-[#5c6b7a]" },
    { h: "h-10", bg: "bg-gradient-to-b from-[#e8c4a0] to-[#b98250]", ring: "ring-[3px] ring-[#d9b48f]", size: "h-14 w-14 sm:h-16 sm:w-16", num: "text-white" },
  ]

  return (
    <div className="w-full space-y-6">
      {/* ── Masthead: the leader, their team brand, the headline numbers ── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#001f3f] text-white shadow-[0_24px_60px_-30px_rgba(0,31,63,0.7)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(214,179,87,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(111,141,179,0.25),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#d6b357]/25" />
          <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full border border-[#d6b357]/15" />
        </div>
        <button type="button" onClick={refresh} disabled={busy || data === null} aria-label="Refresh" className="absolute right-4 top-4 z-10 rounded-full border border-white/20 p-2 text-white/80 disabled:opacity-50 sm:hidden">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        </button>
        <div className="relative flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            {data ? (
              <div className="relative shrink-0">
                <Avatar name={data.root.name} photo={data.root.photo} size="h-[72px] w-[72px] sm:h-24 sm:w-24" ring="ring-[3px] ring-[#d6b357] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" />
                {data.team?.logo && (
                  <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#001f3f] bg-white shadow sm:h-10 sm:w-10" title={data.team.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.team.logo} alt={data.team.name} className="h-full w-full object-contain p-1" />
                  </span>
                )}
              </div>
            ) : (
              <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-white/10 sm:h-24 sm:w-24" />
            )}
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.28em] text-[#f0d89b]">
                <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" /> My Team
              </p>
              <h1 className="mt-1.5 font-['Outfit'] text-[24px] font-bold leading-tight sm:text-[32px]">{data?.root.name ?? "Loading…"}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/70">
                <span>{data ? roleToLabel(data.root.role) : ""}</span>
                {data?.team && (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b357]/40 bg-[#d6b357]/10 px-2.5 py-0.5 text-[12px] font-semibold text-[#f0d89b]">{data.team.name}{data.team.roleInTeam ? ` · ${data.team.roleInTeam}` : ""}</span>
                  </>
                )}
                {data && (
                  <>
                    <span className="hidden text-white/30 sm:inline">·</span>
                    <span>{data.members.length.toLocaleString("en-AE")} in your network · {data.perLevel.length} level{data.perLevel.length === 1 ? "" : "s"}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {[
              { v: data ? `AED ${short(kpi.validatedValue)}` : "–", l: `Validated · ${bounds.label}`, gold: true },
              { v: data ? String(kpi.validated) : "–", l: "Deals" },
              { v: data ? `${kpi.sold}` : "–", l: `of ${couldSell.toLocaleString("en-AE")} sold` },
            ].map((s) => (
              <div key={s.l} className={s.gold ? "col-span-2 sm:col-span-1" : ""}>
                <dd className={`whitespace-nowrap font-['Outfit'] font-bold leading-none tracking-tight ${s.gold ? "text-[34px] text-[#f0d89b] sm:text-[32px]" : "text-[26px] text-white sm:text-[32px]"}`}>{s.v}</dd>
                <dt className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{s.l}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-3 py-2.5 sm:px-8 sm:py-3">
          <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center" role="tablist" aria-label="Period">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${period === k ? "bg-[#d6b357] text-[#001f3f]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{label}</button>
            ))}
          </div>
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            {loadedAt && <span className="hidden text-[11px] text-white/45 md:inline">Updated {loadedAt.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}</span>}
            <button type="button" onClick={refresh} disabled={busy || data === null} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:border-[#d6b357] hover:text-[#f0d89b] disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
        {period === "custom" && (
          <div className="relative flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/25 px-5 py-2.5 sm:px-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">From</span>
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] font-semibold text-white [color-scheme:dark]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">to</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] font-semibold text-white [color-scheme:dark]" />
          </div>
        )}
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !data ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading your team">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-[#e8eaed] bg-white p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-[#eef0f3]" />
                <div className="mt-4 h-7 w-16 animate-pulse rounded bg-[#eef0f3]" />
                <div className="mt-4 h-1.5 w-full animate-pulse rounded bg-[#eef0f3]" />
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="h-80 animate-pulse rounded-2xl border border-[#e8eaed] bg-white lg:col-span-3" />
            <div className="h-80 animate-pulse rounded-2xl border border-[#e8eaed] bg-white lg:col-span-2" />
          </div>
        </div>
      ) : data.members.length === 0 ? (
        <div className="rounded-2xl border border-[#e8eaed] bg-white py-12 text-center">
          <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Nobody has joined through your link yet.</p>
          <p className="mt-1 text-sm text-[#6b7280]">Share your invite link from the Invite page — your team builds from there.</p>
        </div>
      ) : (
        <>
          {/* ── KPI tiles, each with its own small picture ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-4">
              <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Team <Users className="h-4 w-4 text-[#001f3f]/40" /></p>
              <p className="mt-2 font-['Outfit'] text-[30px] font-bold leading-none text-[#0d1117]">{kpi.members.toLocaleString("en-AE")}</p>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#eef0f3]" title="Members by level">
                {(data.perLevel ?? []).map((n, i) => <span key={i} style={{ width: `${(100 * n) / Math.max(1, levelTotal)}%`, backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />)}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-[#6b7280]">
                {(data.perLevel ?? []).slice(0, 4).map((n, i) => <span key={i} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />L{i + 1} {n}</span>)}
              </p>
              <p className="mt-1 text-[11px] text-[#9ca3af]">{kpi.active} active · {kpi.pending} waiting</p>
            </div>
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-4">
              <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Sold <TrendingUp className="h-4 w-4 text-emerald-600/60" /></p>
              <p className="mt-2 font-['Outfit'] text-[30px] font-bold leading-none text-[#0d1117]">{kpi.sold}<span className="ml-1.5 text-[14px] font-semibold text-[#6b7280]">of {couldSell.toLocaleString("en-AE")}</span></p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(soldFrac * 100, kpi.sold ? 2 : 0)}%` }} /></div>
              <p className="mt-2 text-[11px] text-[#6b7280]"><b className="text-emerald-700">{pctText(soldFrac)}</b> · {kpi.notSold.toLocaleString("en-AE")} not sold yet</p>
            </div>
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-4">
              <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Validated <Award className="h-4 w-4 text-[#b8913f]/70" /></p>
              <p className="mt-2 font-['Outfit'] text-[30px] font-bold leading-none text-[#0d1117]">{kpi.validated}<span className="ml-1.5 text-[14px] font-semibold text-[#6b7280]">deal{kpi.validated === 1 ? "" : "s"}</span></p>
              <p className="mt-3 font-['Outfit'] text-[15px] font-bold text-[#b8913f]">AED {short(kpi.validatedValue)}</p>
              <p className="mt-0.5 text-[11px] text-[#9ca3af]">{kpi.rejected ? `${kpi.rejected} rejected` : "none rejected"}</p>
            </div>
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-4">
              <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Pending <Hourglass className="h-4 w-4 text-amber-600/60" /></p>
              <p className="mt-2 font-['Outfit'] text-[30px] font-bold leading-none text-[#0d1117]">{kpi.pendingDeals}<span className="ml-1.5 text-[14px] font-semibold text-[#6b7280]">deal{kpi.pendingDeals === 1 ? "" : "s"}</span></p>
              <p className={`mt-3 font-['Outfit'] text-[15px] font-bold ${kpi.pendingDeals ? "text-amber-700" : "text-[#c5ccd6]"}`}>{kpi.pendingDeals ? `AED ${short(kpi.pendingValue)}` : "AED 0"}</p>
              <p className="mt-0.5 text-[11px] text-[#9ca3af]">waiting for validation</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-[#e8eaed] bg-white p-4 lg:col-span-1">
              <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]"><span>Joined <span className="font-semibold normal-case tracking-normal text-[#9ca3af]">· {bounds.label}</span></span> <UserPlus className="h-4 w-4 text-[#6f8db3]" /></p>
              <p className="mt-2 font-['Outfit'] text-[30px] font-bold leading-none text-[#0d1117]">{kpi.joiners.toLocaleString("en-AE")}</p>
              <div className="mt-3 flex h-8 items-end gap-1" title="Joined per month, last 6 months">
                {kpi.joins.map((j, i) => (
                  <div key={j.key} className={`flex-1 rounded-sm ${i === kpi.joins.length - 1 ? "bg-[#6f8db3]" : "bg-[#6f8db3]/35"}`} style={{ height: `${Math.max((j.count / joinMax) * 30, j.count ? 3 : 1)}px` }} title={`${ymName(j.key, { month: "long" })}: ${j.count}`} />
                ))}
              </div>
              <p className="mt-1 flex justify-between text-[10px] text-[#9ca3af]"><span>{ymName(kpi.joins[0].key, { month: "short" })}</span><span>last 6 months</span><span>{ymName(kpi.joins[kpi.joins.length - 1].key, { month: "short" })}</span></p>
            </div>
          </div>

          {/* ── Podium + conversion ── */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardTitle icon={Trophy} aside={bounds.label}>Top sellers</CardTitle>
              {podium.length === 0 ? (
                <p className="mt-6 text-sm text-[#9ca3af]">No validated sales in this period yet.</p>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
                    {[1, 0, 2].map((rank) => {
                      const r = podium[rank]
                      if (!r) return <div key={rank} />
                      const s = PLINTH[rank]
                      return (
                        <div key={r.n.id} className="flex min-w-0 flex-col items-center text-center">
                          <Avatar name={r.n.name} photo={r.n.photo} size={s.size} ring={`${s.ring} ring-offset-2 ring-offset-white`} />
                          <p className="mt-3 line-clamp-2 min-h-[2.5em] text-[12.5px] font-bold leading-tight text-[#0d1117] sm:text-[13px]">{r.n.name}</p>
                          <p className="mt-0.5 whitespace-nowrap font-['Outfit'] text-[13px] font-bold text-[#001f3f] sm:text-[15px]"><span className="sm:hidden">AED {short(r.p.value)}</span><span className="hidden sm:inline">{AED(r.p.value)}</span></p>
                          <p className="text-[11px] text-[#6b7280]">{r.p.validated} deal{r.p.validated === 1 ? "" : "s"} · L{r.n.level}</p>
                          <div className={`relative mt-3 flex w-full items-start justify-center rounded-t-xl ${s.h} ${s.bg} shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`}>
                            <span className={`mt-1.5 font-['Outfit'] text-[22px] font-bold leading-none ${s.num} [text-shadow:0_1px_0_rgba(255,255,255,0.35)]`}>{rank + 1}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {kpi.ranked.length > 3 && (
                    <ol className="divide-y divide-[#f0f2f5] border-t border-[#e5e8ec]">
                      {kpi.ranked.slice(3, 8).map((r, i) => (
                        <li key={r.n.id} className="flex items-center gap-3 py-2.5 text-sm">
                          <span className="w-5 text-right font-['Outfit'] text-[13px] font-bold text-[#c5ccd6]">{i + 4}</span>
                          <Avatar name={r.n.name} photo={r.n.photo} size="h-8 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5"><span className="truncate font-semibold text-[#111827]">{r.n.name}</span><Level n={r.n.level} /></span>
                            <span className="text-[11px] text-[#9ca3af]">{r.p.validated} deal{r.p.validated === 1 ? "" : "s"}</span>
                          </span>
                          <span className="whitespace-nowrap font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{AED(r.p.value)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </Card>
            <Card className="flex flex-col lg:col-span-2">
              <CardTitle icon={Target} aside={bounds.label}>Who is selling</CardTitle>
              <div className="mt-5 flex flex-1 items-center gap-5">
                <div className="relative">
                  <Ring frac={soldFrac} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-['Outfit'] text-[26px] font-bold leading-none text-[#0d1117]">{pctText(soldFrac)}</span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">have sold</span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2 text-[13px]">
                  <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#d6b357]" /><span className="flex-1 text-[#374151]">Sold</span><b className="tabular-nums text-[#0d1117]">{kpi.sold}</b></li>
                  <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#dfe3e8]" /><span className="flex-1 text-[#374151]">Not sold yet</span><b className="tabular-nums text-[#0d1117]">{kpi.notSold.toLocaleString("en-AE")}</b></li>
                  <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border border-amber-400 bg-amber-50" /><span className="flex-1 text-[#374151]">Awaiting approval</span><b className="tabular-nums text-[#0d1117]">{kpi.pending}</b></li>
                </ul>
              </div>
              <div className="mt-6 space-y-3.5 border-t border-[#eef0f3] pt-5">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">By level</p>
                {kpi.byLevel.map((l) => {
                  const base = Math.max(1, l.active)
                  return (
                    <div key={l.level}>
                      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="font-semibold text-[#111827]">Level {l.level}{l.level === 1 ? <span className="font-normal text-[#9ca3af]"> · direct</span> : null}</span>
                        <span className="tabular-nums text-[#6b7280]"><b className="text-[#0d1117]">{l.sold}</b> of {l.active} active{l.value ? <span className="ml-2 font-['Outfit'] font-bold text-[#001f3f]">AED {short(l.value)}</span> : null}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-gradient-to-r from-[#b8913f] to-[#e3c98a]" style={{ width: `${Math.min(100, Math.max((100 * l.sold) / base, l.sold ? 2 : 0))}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* ── Trend + projects ── */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="flex flex-col lg:col-span-3">
              <CardTitle icon={BarChart3} aside={charts.hasFaded ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#001f3f]" /> in period <span className="ml-1 h-2 w-2 rounded-sm bg-[#001f3f]/15" /> outside</span> : bounds.label}>Validated sales by month</CardTitle>
              {charts.months.some((m) => m.value > 0) ? <MonthChart points={charts.months} /> : <p className="mt-6 text-sm text-[#9ca3af]">No validated sales in these months yet.</p>}
              {charts.clipped && <p className="mt-3 text-[11px] text-[#9ca3af]">Showing the last 12 months — pick a period to look further back.</p>}
            </Card>
            <Card className="lg:col-span-2">
              <CardTitle icon={Building2} aside={charts.projectCount ? `${charts.projectCount} project${charts.projectCount === 1 ? "" : "s"}` : bounds.label}>Where the team sells</CardTitle>
              {charts.projects.length === 0 ? (
                <p className="mt-6 text-sm text-[#9ca3af]">No validated sales in this period yet.</p>
              ) : (
                <ol className="mt-5 space-y-3.5">
                  {charts.projects.map((r, i) => (
                    <li key={r.name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[13px] font-semibold text-[#111827]"><span className="mr-2 font-['Outfit'] text-[#c5ccd6]">{i + 1}</span>{r.name}{r.developer && <span className="ml-1.5 text-[11px] font-normal text-[#9ca3af]">{r.developer}</span>}</p>
                        <p className="shrink-0 font-['Outfit'] text-[13px] font-bold tabular-nums text-[#001f3f]">AED {short(r.value)}</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${i === 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`} style={{ width: `${Math.max((100 * r.value) / Math.max(1, charts.projects[0].value), 2)}%` }} /></div>
                        <span className="w-[86px] shrink-0 text-right text-[11px] tabular-nums text-[#9ca3af]">{r.deals} deal{r.deals === 1 ? "" : "s"} · {pctText(r.value / Math.max(1, charts.projectTotal))}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {charts.projectCount > charts.projects.length && <p className="mt-4 text-[11px] text-[#9ca3af]">+ {charts.projectCount - charts.projects.length} more in the Sales tab.</p>}
            </Card>
          </div>

          {/* ── Members / Sales ── */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#eef0f3] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5" role="tablist">
                  {([["members", `Members · ${members.length}`], ["sales", `Sales · ${sales.length}`]] as const).map(([k, label]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${tab === k ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f1f3f6]"}`}>{label}</button>
                  ))}
                </div>
                {tab === "members" ? (
                  <>
                    <div className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5">
                      {([["all", "Everyone"], ["sold", "Sold"], ["not_sold", "Not sold yet"]] as const).map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setSold(k)} className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${sold === k ? "bg-emerald-600 text-white" : "text-[#374151] hover:bg-[#f1f3f6]"}`}>{label}</button>
                      ))}
                    </div>
                    <Select value={memberStatus} onChange={setMemberStatus}><option value="all">Any status</option><option value="active">Active</option><option value="pending">Waiting for approval</option><option value="inactive">Inactive</option></Select>
                    <Select value={memberSort} onChange={setMemberSort}><option value="value">Sort: value</option><option value="deals">Sort: deals</option><option value="pending">Sort: pending</option><option value="recruits">Sort: network size</option><option value="joined">Sort: newest</option></Select>
                  </>
                ) : (
                  <>
                    <Select value={status} onChange={(v) => setStatus(v as SaleStatus)}><option value="validated">Validated</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="all">All statuses</option></Select>
                    <Select value={project} onChange={setProject}><option value="all">All projects</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
                    <Select value={developer} onChange={setDeveloper}><option value="all">All developers</option>{developers.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
                  </>
                )}
                <Select value={level} onChange={setLevel}><option value="all">All levels</option>{levels.slice(0, 2).map((l) => <option key={l} value={String(l)}>Level {l}{l === 1 ? " (direct)" : ""}</option>)}{levels.length >= 3 && <option value="3+">Level 3 and deeper</option>}</Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative min-w-0 flex-1 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, project, unit…" className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none lg:w-56" />
                </span>
                <button type="button" onClick={tab === "members" ? exportMembers : exportSales} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#001f3f] px-3 text-xs font-bold text-white transition-colors hover:bg-[#00356b]">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            {tab === "members" ? (
              members.length === 0 ? (
                <p className="px-5 py-10 text-sm text-[#9ca3af]">Nobody matches these filters.</p>
              ) : (
                <>
                  {/* Phone: cards */}
                  <ul className="divide-y divide-[#f0f2f5] md:hidden">
                    {shown.map(({ n, p }) => (
                      <li key={n.id} className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={n.name} photo={n.photo} size="h-10 w-10" ring={p.validated ? "ring-2 ring-[#d6b357]" : ""} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-sm font-bold text-[#111827]"><span className="truncate">{n.name}</span><Level n={n.level} /></p>
                            <p className="text-[11px] text-[#6b7280]">{roleToLabel(n.role)} · joined {fmtDate(n.joinedAt)}</p>
                          </div>
                          <StatusChip status={n.status} />
                        </div>
                        {(p.validated > 0 || p.pending > 0) && (
                          <div className="mt-2.5 pl-[52px]">
                            {p.value > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#d6b357]" style={{ width: `${Math.max(3, (100 * p.value) / maxValue)}%` }} /></div>
                                <span className="font-['Outfit'] text-[13px] font-bold tabular-nums text-[#001f3f]">{AED(p.value)}</span>
                              </div>
                            )}
                            <p className="mt-1 text-[11px] text-[#6b7280]">
                              {p.validated > 0 && <><b className="text-emerald-700">{p.validated} deal{p.validated === 1 ? "" : "s"}</b> · last {fmtDate(p.last)}</>}
                              {p.pending > 0 && <span className="text-amber-700">{p.validated > 0 ? " · " : ""}{p.pending} pending</span>}
                            </p>
                          </div>
                        )}
                        {n.direct > 0 && <p className="mt-1 pl-[52px] text-[11px] text-[#9ca3af]">{n.direct} direct recruit{n.direct === 1 ? "" : "s"}{n.network > n.direct ? ` · ${n.network} in network` : ""}</p>}
                      </li>
                    ))}
                  </ul>
                  {/* Desktop: table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="bg-[#fafbfc] text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                          <th className="px-5 py-2.5">Member</th><th className="px-3 py-2.5">Joined</th><th className="px-3 py-2.5 text-right">Recruits</th><th className="px-3 py-2.5 text-right">Deals</th><th className="px-3 py-2.5">Validated value</th><th className="px-3 py-2.5 text-right">Pending</th><th className="px-5 py-2.5">Last sale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f2f5]">
                        {shown.map(({ n, p }) => (
                          <tr key={n.id} className="transition-colors hover:bg-[#fafbfc]">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={n.name} photo={n.photo} ring={p.validated ? "ring-2 ring-[#d6b357]" : ""} />
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#111827]"><span className="truncate">{n.name}</span><Level n={n.level} /><StatusChip status={n.status} /></p>
                                  <p className="text-[11px] text-[#6b7280]">{roleToLabel(n.role)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-[#6b7280]">{fmtDate(n.joinedAt)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{n.direct ? <>{n.direct}{n.network > n.direct ? <span className="text-[#9ca3af]"> / {n.network}</span> : null}</> : <span className="text-[#c5ccd6]">—</span>}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{p.validated ? <span className="font-bold text-emerald-700">{p.validated}</span> : <span className="text-[#c5ccd6]">—</span>}</td>
                            <td className="px-3 py-3">
                              {p.value ? (
                                <div className="min-w-[160px]">
                                  <p className="font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{AED(p.value)}</p>
                                  <div className="mt-1 h-1.5 w-full rounded-full bg-[#eef0f3]"><div className="h-full rounded-full bg-[#d6b357]" style={{ width: `${Math.max(3, (100 * p.value) / maxValue)}%` }} /></div>
                                </div>
                              ) : <span className="text-[#c5ccd6]">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">{p.pending ? <span className="font-semibold text-amber-700">{p.pending} · {AED(p.pendingValue)}</span> : <span className="text-[#c5ccd6]">—</span>}</td>
                            <td className="whitespace-nowrap px-5 py-3 text-[#6b7280]">{fmtDate(p.last)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {members.length > 50 && !showAll && (
                    <div className="border-t border-[#eef0f3] p-4">
                      <button type="button" onClick={() => setShowAll(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-bold text-[#374151] hover:border-[#d6b357]"><UserPlus className="h-3.5 w-3.5" /> Show all {members.length}</button>
                    </div>
                  )}
                </>
              )
            ) : sales.length === 0 ? (
              <p className="px-5 py-10 text-sm text-[#9ca3af]">No sales match these filters.</p>
            ) : (
              <>
                {/* Phone: cards */}
                <ul className="divide-y divide-[#f0f2f5] md:hidden">
                  {sales.map((s) => (
                    <li key={s.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-[#9ca3af]">{fmtDate(s.date)}</p>
                          <p className="font-semibold text-[#111827]">{s.project}</p>
                          <p className="text-[11px] text-[#6b7280]">{[s.developer, s.unit].filter(Boolean).join(" · ")}</p>
                        </div>
                        <StatusChip status={s.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.credits.map((c) => (
                          <span key={c.memberId} className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f6f9] py-0.5 pl-0.5 pr-2 text-[12px] font-semibold text-[#111827]">
                            <Avatar name={c.name} photo={photoOf.get(c.memberId) ?? null} size="h-5 w-5" /> {c.name} <span className="text-[10.5px] font-bold text-[#001f3f]/60">L{c.level}</span>{s.credits.length + s.outside.length > 1 && <span className="text-[10.5px] font-normal text-[#9ca3af]">{c.share}%</span>}
                          </span>
                        ))}
                      </div>
                      {s.outside.length > 0 && <p className="mt-1 text-[11px] text-[#9ca3af]">shared with {s.outside.join(", ")}{s.outside.some((n) => n !== "you") ? " — outside your team" : ""}</p>}
                      <div className="mt-2 flex items-baseline justify-between text-[12px]">
                        <span className="text-[#6b7280]">Contract {AED(s.price)}</span>
                        <span className="font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{AED(s.credits.reduce((a, c) => a + c.value, 0))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {/* Desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="bg-[#fafbfc] text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                        <th className="px-5 py-2.5">Date</th><th className="px-3 py-2.5">Member</th><th className="px-3 py-2.5">Project</th><th className="px-3 py-2.5">Unit</th><th className="px-3 py-2.5 text-right">Contract price</th><th className="px-3 py-2.5 text-right">Credited to team</th><th className="px-5 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f5]">
                      {sales.map((s) => (
                        <tr key={s.id} className="transition-colors hover:bg-[#fafbfc]">
                          <td className="whitespace-nowrap px-5 py-3 text-[#6b7280]">{fmtDate(s.date)}</td>
                          <td className="px-3 py-3">
                            {s.credits.map((c) => (
                              <p key={c.memberId} className="flex items-center gap-2 py-0.5">
                                <Avatar name={c.name} photo={photoOf.get(c.memberId) ?? null} size="h-6 w-6" />
                                <span className="font-semibold text-[#111827]">{c.name}</span> <Level n={c.level} />{s.credits.length + s.outside.length > 1 && <span className="text-[11px] text-[#9ca3af]">{c.share}%</span>}
                              </p>
                            ))}
                            {s.outside.length > 0 && <p className="text-[11px] text-[#9ca3af]">shared with {s.outside.join(", ")}{s.outside.some((n) => n !== "you") ? " — outside your team" : ""}</p>}
                          </td>
                          <td className="px-3 py-3"><p className="font-semibold text-[#111827]">{s.project}</p>{s.developer && <p className="text-[11px] text-[#6b7280]">{s.developer}</p>}</td>
                          <td className="px-3 py-3 text-[#6b7280]">{s.unit ?? "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{AED(s.price)}</td>
                          <td className="px-3 py-3 text-right font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{AED(s.credits.reduce((a, c) => a + c.value, 0))}</td>
                          <td className="px-5 py-3"><StatusChip status={s.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
