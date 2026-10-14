"use client"

/**
 * My Team (boss via Juliecor, 2026-10-14): everything about the signed-in
 * recruiter's network in one place — everyone in their genealogy, KPIs for a
 * period, who sold and who hasn't, every deal with filters, charts, and CSV
 * exports. The API (app/api/my-team) returns the whole network and every
 * credited sale once; every filter here is instant.
 *
 * Design (same day, "not a generic one"): a navy masthead branded with the
 * leader's photo and their team's logo, the headline figures in the band, a
 * podium of the top sellers, period pills, and tables with avatars, level
 * chips and value bars — the dashboard's navy / gold vocabulary.
 */

import { useEffect, useMemo, useState } from "react"
import { Award, Download, Loader2, RefreshCw, Search, TrendingUp, UserPlus, Users } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ROLES_ADMIN_STAFF, invitableRolesFor, roleInList, roleToLabel } from "@/lib/app-roles"
import { STATUS_COLORS } from "@/lib/user-service"
import { BarsChart, PieChart } from "@/features/dashboard/fhi-chat/charts"
import type { MyTeamResponse, TeamMember, TeamSale } from "@/app/api/my-team/route"

type Period = "month" | "last_month" | "quarter" | "year" | "all" | "custom"
type SaleStatus = "validated" | "pending" | "rejected" | "all"
type SoldFilter = "all" | "sold" | "not_sold"

const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—")
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const iso = (d: Date) => d.toISOString().slice(0, 10)
const PERIODS: Array<[Period, string]> = [["month", "This month"], ["last_month", "Last month"], ["quarter", "Quarter"], ["year", "This year"], ["all", "All time"], ["custom", "Custom"]]

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
const Select = ({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string }) => (
  <label className="flex flex-col gap-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[13px] font-semibold normal-case tracking-normal text-[#111827] focus:border-[#001f3f] focus:outline-none">
      {children}
    </select>
  </label>
)

export default function MyTeamPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(invitableRolesFor(role).length > 0 || roleInList(role, ROLES_ADMIN_STAFF))
  const [data, setData] = useState<MyTeamResponse | null>(null)
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
    return {
      members: all.length, active: all.filter((n) => n.status === "active").length, pending: all.filter((n) => n.status === "pending").length,
      sold: all.filter(seller).length, notSold: all.filter((n) => !seller(n) && n.status === "active").length,
      validated: inPeriod.filter((s) => s.status === "validated").length, validatedValue: value("validated"),
      pendingDeals: inPeriod.filter((s) => s.status === "pending").length, pendingValue: value("pending"), rejected: inPeriod.filter((s) => s.status === "rejected").length,
      joiners: all.filter((n) => n.joinedAt && inRange(n.joinedAt.slice(0, 10), bounds.from, bounds.to)).length,
      ranked,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, periodSales, memberPeriod, level, bounds.from, bounds.to])

  const projects = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.project))].sort(), [data])
  const developers = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.developer).filter((d): d is string => Boolean(d)))].sort(), [data])
  const charts = useMemo(() => {
    const v = periodSales.filter((s) => s.status === "validated")
    const sum = (s: TeamSale) => s.credits.reduce((a, c) => a + c.value, 0)
    const by = <K,>(key: (s: TeamSale) => K) => { const m = new Map<K, number>(); for (const s of v) m.set(key(s), (m.get(key(s)) ?? 0) + sum(s)); return m }
    const months = [...by((s) => s.date.slice(0, 7)).entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    const byLevel = new Map<string, number>()
    for (const s of v) for (const c of s.credits) byLevel.set(`Level ${c.level}`, (byLevel.get(`Level ${c.level}`) ?? 0) + c.value)
    return {
      months: months.map(([m, val]) => ({ label: monthLabel(m), value: val, display: val ? `${(val / 1e6).toFixed(2)}M` : "0" })),
      projects: [...by((s) => s.project).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, display: AED(value) })),
      levels: [...byLevel.entries()].sort().map(([label, value]) => ({ label, value, display: AED(value) })),
      soldSplit: [{ label: "Sold", value: kpi.sold }, { label: "Not sold yet", value: kpi.notSold }, { label: "Waiting for approval", value: kpi.pending }].filter((r) => r.value > 0),
    }
  }, [periodSales, kpi])

  if (!allowed) return null

  const exportMembers = () => downloadCsv("my-team-members", ["Name", "Level", "Role", "Status", "Joined", "Direct recruits", "Network", "Validated deals", "Validated value (AED)", "Pending deals", "Pending value (AED)", "Rejected", "Last sale"], members.map(({ n, p }) => [n.name, n.level, roleToLabel(n.role), n.status, n.joinedAt?.slice(0, 10) ?? "", n.direct, n.network, p.validated, Math.round(p.value), p.pending, Math.round(p.pendingValue), p.rejected, p.last ?? ""]))
  const exportSales = () => downloadCsv("my-team-sales", ["Date", "Status", "Member", "Level", "Share %", "Credited (AED)", "Project", "Developer", "Unit", "Contract price (AED)", "Shared with"], sales.flatMap((s) => s.credits.map((c) => [s.date, s.status, c.name, c.level, c.share, c.value, s.project, s.developer ?? "", s.unit ?? "", s.price, [...s.credits.filter((x) => x.memberId !== c.memberId).map((x) => x.name), ...s.outside].join("; ")])))

  const levels = (data?.perLevel ?? []).map((_, i) => i + 1)
  const shown = showAll ? members : members.slice(0, 50)
  const maxValue = Math.max(1, ...members.map((r) => r.p.value))
  const podium = kpi.ranked.slice(0, 3)
  const medal = ["bg-gradient-to-br from-[#f3dc8f] to-[#c9a449] text-[#3d2f00]", "bg-gradient-to-br from-[#e9edf2] to-[#b9c2cf] text-[#1f2937]", "bg-gradient-to-br from-[#e6b98a] to-[#b7783f] text-[#3b2410]"]

  return (
    <div className="w-full space-y-6">
      {/* ── Masthead: the leader, their team brand, the headline numbers ── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#001f3f] text-white shadow-[0_24px_60px_-30px_rgba(0,31,63,0.7)]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(214,179,87,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(111,141,179,0.25),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#d6b357]/25" />
          <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full border border-[#d6b357]/15" />
        </div>
        <div className="relative flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            {data ? (
              <div className="relative shrink-0">
                <Avatar name={data.root.name} photo={data.root.photo} size="h-20 w-20 sm:h-24 sm:w-24" ring="ring-[3px] ring-[#d6b357] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]" />
                {data.team?.logo && (
                  <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#001f3f] bg-white shadow" title={data.team.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.team.logo} alt={data.team.name} className="h-full w-full object-contain p-1" />
                  </span>
                )}
              </div>
            ) : (
              <div className="h-24 w-24 animate-pulse rounded-full bg-white/10" />
            )}
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.28em] text-[#f0d89b]">
                <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" /> My Team
              </p>
              <h1 className="mt-1.5 font-['Outfit'] text-[26px] font-bold leading-tight sm:text-[32px]">{data?.root.name ?? "Loading…"}</h1>
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
          <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {[
              { v: data ? `AED ${short(kpi.validatedValue)}` : "–", l: "Validated", gold: true },
              { v: data ? String(kpi.validated) : "–", l: "Deals" },
              { v: data ? `${kpi.sold}` : "–", l: `of ${kpi.members} sold` },
            ].map((s) => (
              <div key={s.l}>
                <dd className={`font-['Outfit'] text-[22px] font-bold leading-none tracking-tight sm:text-[32px] ${s.gold ? "text-[#f0d89b]" : "text-white"}`}>{s.v}</dd>
                <dt className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{s.l}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-5 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Period">
            {PERIODS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => setPeriod(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${period === k ? "bg-[#d6b357] text-[#001f3f]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{label}</button>
            ))}
            {period === "custom" && (
              <span className="ml-2 inline-flex items-center gap-2">
                <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] font-semibold text-white [color-scheme:dark]" />
                <span className="text-white/50">→</span>
                <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] font-semibold text-white [color-scheme:dark]" />
              </span>
            )}
          </div>
          <button type="button" onClick={refresh} disabled={busy || data === null} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:border-[#d6b357] hover:text-[#f0d89b] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !data ? (
        <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your team…</p>
      ) : data.members.length === 0 ? (
        <div className="rounded-2xl border border-[#e8eaed] bg-white py-12 text-center">
          <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Nobody has joined through your link yet.</p>
          <p className="mt-1 text-sm text-[#6b7280]">Share your invite link from the Invite page — your team builds from there.</p>
        </div>
      ) : (
        <>
          {/* ── KPI tiles ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { icon: Users, label: "Team", value: kpi.members, hint: `${kpi.active} active · ${kpi.pending} waiting`, tone: "text-[#001f3f] bg-[#001f3f]/5 border-[#001f3f]/15" },
              { icon: TrendingUp, label: "Sold", value: kpi.sold, hint: `${kpi.notSold} active not sold yet`, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
              { icon: Award, label: "Validated deals", value: kpi.validated, hint: kpi.rejected ? `${kpi.rejected} rejected` : "all validated", tone: "text-[#8a6d2b] bg-[#d6b357]/15 border-[#d6b357]/40" },
              { icon: Loader2, label: "Waiting for validation", value: kpi.pendingDeals, hint: kpi.pendingDeals ? AED(kpi.pendingValue) : "nothing waiting", tone: "text-amber-700 bg-amber-50 border-amber-200" },
              { icon: UserPlus, label: "Joined in period", value: kpi.joiners, hint: bounds.label, tone: "text-[#6f8db3] bg-[#6f8db3]/10 border-[#6f8db3]/30" },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border border-[#e8eaed] bg-white px-4 py-4">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${t.tone}`}><t.icon className="h-4 w-4" /></span>
                <p className="mt-3 font-['Outfit'] text-[28px] font-bold leading-none text-[#0d1117]">{t.value.toLocaleString("en-AE")}</p>
                <p className="mt-1.5 text-xs font-semibold text-[#6b7280]">{t.label}</p>
                <p className="mt-0.5 text-[11px] text-[#9ca3af]">{t.hint}</p>
              </div>
            ))}
          </div>

          {/* ── Podium + charts ── */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]"><Award className="h-3.5 w-3.5 text-[#b8913f]" /> Top sellers · {bounds.label}</p>
              {podium.length === 0 ? (
                <p className="mt-4 text-sm text-[#9ca3af]">No validated sales in this period yet.</p>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-3 items-end gap-3">
                    {[podium[1], podium[0], podium[2]].map((r, slot) => {
                      if (!r) return <div key={slot} />
                      const rank = slot === 1 ? 0 : slot === 0 ? 1 : 2
                      const tall = rank === 0
                      return (
                        <div key={r.n.id} className="flex flex-col items-center text-center">
                          <Avatar name={r.n.name} photo={r.n.photo} size={tall ? "h-20 w-20" : "h-14 w-14"} ring={rank === 0 ? "ring-[3px] ring-[#d6b357]" : "ring-2 ring-[#e5e8ec]"} />
                          <span className={`-mt-3 flex h-7 w-7 items-center justify-center rounded-full font-['Outfit'] text-[12px] font-bold shadow ${medal[rank]}`}>{rank + 1}</span>
                          <p className="mt-2 line-clamp-2 text-[12.5px] font-bold leading-tight text-[#0d1117]">{r.n.name}</p>
                          <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{AED(r.p.value)}</p>
                          <p className="text-[11px] text-[#6b7280]">{r.p.validated} deal{r.p.validated === 1 ? "" : "s"} · L{r.n.level}</p>
                          <div className={`mt-3 w-full rounded-t-lg ${rank === 0 ? "h-16 bg-[#d6b357]" : rank === 1 ? "h-11 bg-[#c5ccd6]" : "h-8 bg-[#d9b48f]"}`} />
                        </div>
                      )
                    })}
                  </div>
                  {kpi.ranked.length > 3 && (
                    <ol className="mt-4 divide-y divide-[#f0f2f5] border-t border-[#eef0f3]">
                      {kpi.ranked.slice(3, 8).map((r, i) => (
                        <li key={r.n.id} className="flex items-center gap-3 py-2 text-sm">
                          <span className="w-5 text-right font-['Outfit'] text-[13px] font-bold text-[#9ca3af]">{i + 4}</span>
                          <Avatar name={r.n.name} photo={r.n.photo} size="h-7 w-7" />
                          <span className="min-w-0 flex-1 truncate font-semibold text-[#111827]">{r.n.name} <Level n={r.n.level} /></span>
                          <span className="font-['Outfit'] font-bold tabular-nums text-[#001f3f]">{AED(r.p.value)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
            <div className="grid gap-5">
              <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
                {charts.months.length > 1 ? <BarsChart title="Validated sales by month" points={charts.months} /> : <><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">Validated sales by month</p><p className="mt-3 text-sm text-[#9ca3af]">Appears once there are sales in two months of the period.</p></>}
              </div>
              <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
                {charts.soldSplit.length > 1 ? <PieChart title="Who has sold" rows={charts.soldSplit} /> : <><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">Who has sold</p><p className="mt-3 text-sm text-[#9ca3af]">Appears once someone has sold.</p></>}
              </div>
            </div>
          </div>
          {(charts.projects.length > 0 || charts.levels.length > 1) && (
            <div className={`grid gap-5 ${charts.projects.length > 0 && charts.levels.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {charts.projects.length > 0 && <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5"><BarsChart title="Validated value by project" points={charts.projects} /></div>}
              {charts.levels.length > 1 && <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5"><PieChart title="Validated value by level" rows={charts.levels} /></div>}
            </div>
          )}

          {/* ── Members / Sales ── */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#eef0f3] p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-end gap-2">
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
                <span className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, project, unit…" className="h-9 w-56 rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none" />
                </span>
                <button type="button" onClick={tab === "members" ? exportMembers : exportSales} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#001f3f] px-3 text-xs font-bold text-white transition-colors hover:bg-[#00356b]">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            {tab === "members" ? (
              members.length === 0 ? (
                <p className="px-5 py-10 text-sm text-[#9ca3af]">Nobody matches these filters.</p>
              ) : (
                <div className="overflow-x-auto">
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
                          <td className="px-3 py-3 whitespace-nowrap text-[#6b7280]">{fmtDate(n.joinedAt)}</td>
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
                          <td className="px-5 py-3 whitespace-nowrap text-[#6b7280]">{fmtDate(p.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {members.length > 50 && !showAll && (
                    <div className="border-t border-[#eef0f3] p-4">
                      <button type="button" onClick={() => setShowAll(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-bold text-[#374151] hover:border-[#d6b357]"><UserPlus className="h-3.5 w-3.5" /> Show all {members.length}</button>
                    </div>
                  )}
                </div>
              )
            ) : sales.length === 0 ? (
              <p className="px-5 py-10 text-sm text-[#9ca3af]">No sales match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-[#fafbfc] text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                      <th className="px-5 py-2.5">Date</th><th className="px-3 py-2.5">Member</th><th className="px-3 py-2.5">Project</th><th className="px-3 py-2.5">Unit</th><th className="px-3 py-2.5 text-right">Contract price</th><th className="px-3 py-2.5 text-right">Credited to team</th><th className="px-5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f2f5]">
                    {sales.map((s: TeamSale) => (
                      <tr key={s.id} className="transition-colors hover:bg-[#fafbfc]">
                        <td className="px-5 py-3 whitespace-nowrap text-[#6b7280]">{fmtDate(s.date)}</td>
                        <td className="px-3 py-3">
                          {s.credits.map((c) => {
                            const m = data.members.find((x) => x.id === c.memberId)
                            return (
                              <p key={c.memberId} className="flex items-center gap-2 py-0.5">
                                <Avatar name={c.name} photo={m?.photo ?? null} size="h-6 w-6" />
                                <span className="font-semibold text-[#111827]">{c.name}</span> <Level n={c.level} />{s.credits.length + s.outside.length > 1 && <span className="text-[11px] text-[#9ca3af]">{c.share}%</span>}
                              </p>
                            )
                          })}
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
