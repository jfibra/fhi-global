"use client"

/**
 * My Team (boss via Juliecor, 2026-10-14): everything about the signed-in
 * recruiter's network in one place — everyone in their genealogy, KPIs for a
 * period, who sold and who hasn't, every deal with filters, charts, and CSV
 * exports. The API (app/api/my-team) returns the whole network and every
 * credited sale once; every filter here is instant.
 */

import { useEffect, useMemo, useState } from "react"
import { Download, Filter, Loader2, RefreshCw, Search, TrendingUp, UserPlus, Users } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ROLES_ADMIN_STAFF, invitableRolesFor, roleInList, roleToLabel } from "@/lib/app-roles"
import { STATUS_COLORS } from "@/lib/user-service"
import { BarsChart, PieChart, StatTiles } from "@/features/dashboard/fhi-chat/charts"
import type { MyTeamResponse, TeamMember, TeamSale } from "@/app/api/my-team/route"

type Period = "month" | "last_month" | "quarter" | "year" | "all" | "custom"
type SaleStatus = "validated" | "pending" | "rejected" | "all"
type SoldFilter = "all" | "sold" | "not_sold"

const AED = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—")
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const iso = (d: Date) => d.toISOString().slice(0, 10)

function periodBounds(p: Period, custom: { from: string; to: string }): { from: string | null; to: string | null; label: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  if (p === "month") return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))), label: "This month" }
  if (p === "last_month") return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 1))), label: "Last month" }
  if (p === "quarter") { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(Date.UTC(y, q, 1))), to: iso(new Date(Date.UTC(y, q + 3, 1))), label: "This quarter" } }
  if (p === "year") return { from: `${y}-01-01`, to: `${y + 1}-01-01`, label: "This year" }
  if (p === "custom") return { from: custom.from || null, to: custom.to ? iso(new Date(Date.parse(`${custom.to}T00:00:00Z`) + 86400e3)) : null, label: `${custom.from || "…"} → ${custom.to || "…"}` }
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

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-xs font-bold text-white">{name.charAt(0).toUpperCase()}</span>
  )
}
function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold capitalize ${c.bg} ${c.text} ${c.border}`}>{status}</span>
}
const Select = ({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string }) => (
  <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2 text-[13px] font-semibold normal-case tracking-normal text-[#111827] focus:border-[#001f3f] focus:outline-none">
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

  // Sales in the period (all statuses), then the status/level/project/developer filters.
  const periodSales = useMemo(() => (data?.sales ?? []).filter((s) => inRange(s.date, bounds.from, bounds.to)), [data, bounds.from, bounds.to])
  const sales = useMemo(
    () =>
      periodSales.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (level === "all" || s.credits.some((c) => (level === "3+" ? c.level >= 3 : c.level === Number(level)))) &&
          (project === "all" || s.project === project) &&
          (developer === "all" || (s.developer ?? "") === developer) &&
          (!q || s.project.toLowerCase().includes(q) || (s.developer ?? "").toLowerCase().includes(q) || s.credits.some((c) => c.name.toLowerCase().includes(q)) || (s.unit ?? "").toLowerCase().includes(q)),
      ),
    [periodSales, status, level, project, developer, q],
  )

  // Per-member figures for the PERIOD (the API's figures are all-time).
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
  const members = useMemo(() => {
    const rows = (data?.members ?? [])
      .map((n) => ({ n, p: memberPeriod.get(n.id) ?? { validated: 0, value: 0, pending: 0, pendingValue: 0, rejected: 0, last: null } }))
      .filter(({ n, p }) =>
        (level === "all" || (level === "3+" ? n.level >= 3 : n.level === Number(level))) &&
        (memberStatus === "all" || n.status === memberStatus) &&
        (sold === "all" || (sold === "sold" ? p.validated > 0 : p.validated === 0)) &&
        (!q || n.name.toLowerCase().includes(q)),
      )
    const key = (r: (typeof rows)[number]) => memberSort === "value" ? r.p.value : memberSort === "deals" ? r.p.validated : memberSort === "pending" ? r.p.pending : memberSort === "recruits" ? r.n.network : memberSort === "joined" ? Date.parse(r.n.joinedAt ?? "0") : 0
    return rows.sort((a, b) => key(b) - key(a) || a.n.name.localeCompare(b.n.name))
  }, [data, memberPeriod, level, memberStatus, sold, q, memberSort])

  // KPIs for the period over the whole network (filters on level narrow them too).
  const kpi = useMemo(() => {
    const all = (data?.members ?? []).filter((n) => level === "all" || (level === "3+" ? n.level >= 3 : n.level === Number(level)))
    const seller = (n: TeamMember) => (memberPeriod.get(n.id)?.validated ?? 0) > 0
    const inPeriod = periodSales.filter((s) => level === "all" || s.credits.some((c) => (level === "3+" ? c.level >= 3 : c.level === Number(level))))
    const value = (st: string) => inPeriod.filter((s) => s.status === st).reduce((a, s) => a + s.credits.reduce((x, c) => x + c.value, 0), 0)
    const joiners = all.filter((n) => n.joinedAt && inRange(n.joinedAt.slice(0, 10), bounds.from, bounds.to))
    const top = [...all].sort((a, b) => (memberPeriod.get(b.id)?.value ?? 0) - (memberPeriod.get(a.id)?.value ?? 0))[0]
    return {
      members: all.length, active: all.filter((n) => n.status === "active").length, pending: all.filter((n) => n.status === "pending").length,
      sold: all.filter(seller).length, notSold: all.filter((n) => !seller(n) && n.status === "active").length,
      validated: inPeriod.filter((s) => s.status === "validated").length, validatedValue: value("validated"),
      pendingDeals: inPeriod.filter((s) => s.status === "pending").length, pendingValue: value("pending"), rejected: inPeriod.filter((s) => s.status === "rejected").length,
      joiners: joiners.length, top: top && (memberPeriod.get(top.id)?.value ?? 0) > 0 ? { name: top.name, value: memberPeriod.get(top.id)!.value } : null,
    }
  }, [data, periodSales, memberPeriod, level, bounds.from, bounds.to])

  const projects = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.project))].sort(), [data])
  const developers = useMemo(() => [...new Set((data?.sales ?? []).map((s) => s.developer).filter((d): d is string => Boolean(d)))].sort(), [data])

  const charts = useMemo(() => {
    const v = periodSales.filter((s) => s.status === "validated")
    const byMonth = new Map<string, number>()
    for (const s of v) byMonth.set(s.date.slice(0, 7), (byMonth.get(s.date.slice(0, 7)) ?? 0) + s.credits.reduce((a, c) => a + c.value, 0))
    const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    const byProject = new Map<string, number>()
    for (const s of v) byProject.set(s.project, (byProject.get(s.project) ?? 0) + s.credits.reduce((a, c) => a + c.value, 0))
    const byLevel = new Map<string, number>()
    for (const s of v) for (const c of s.credits) byLevel.set(`Level ${c.level}`, (byLevel.get(`Level ${c.level}`) ?? 0) + c.value)
    return {
      months: months.map(([m, val]) => ({ label: monthLabel(m), value: val, display: val ? `${(val / 1e6).toFixed(2)}M` : "0" })),
      projects: [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, display: AED(value) })),
      levels: [...byLevel.entries()].sort().map(([label, value]) => ({ label, value, display: AED(value) })),
      soldSplit: [{ label: "Sold", value: kpi.sold }, { label: "Not sold yet", value: kpi.notSold }, { label: "Waiting for approval", value: kpi.pending }].filter((r) => r.value > 0),
    }
  }, [periodSales, kpi])

  if (!allowed) return null

  const exportMembers = () => downloadCsv("my-team-members", ["Name", "Level", "Role", "Status", "Joined", "Direct recruits", "Network", "Validated deals", "Validated value (AED)", "Pending deals", "Pending value (AED)", "Rejected", "Last sale"], members.map(({ n, p }) => [n.name, n.level, roleToLabel(n.role), n.status, n.joinedAt?.slice(0, 10) ?? "", n.direct, n.network, p.validated, Math.round(p.value), p.pending, Math.round(p.pendingValue), p.rejected, p.last ?? ""]))
  const exportSales = () => downloadCsv("my-team-sales", ["Date", "Status", "Member", "Level", "Share %", "Credited (AED)", "Project", "Developer", "Unit", "Contract price (AED)", "Shared with"], sales.flatMap((s) => s.credits.map((c) => [s.date, s.status, c.name, c.level, c.share, c.value, s.project, s.developer ?? "", s.unit ?? "", s.price, [...s.credits.filter((x) => x.memberId !== c.memberId).map((x) => x.name), ...s.outside].join("; ")])))

  const levels = (data?.perLevel ?? []).map((_, i) => i + 1)
  const shown = showAll ? members : members.slice(0, 50)

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Users className="h-6 w-6 text-[#001f3f]" /> My Team
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            Everyone in your genealogy, all levels — their sales, who has sold and who hasn&apos;t, every deal. Validated sales are the headline, as on the boards; a shared deal credits each member their share.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={busy || data === null} className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#e8eaed] bg-white p-4 sm:p-5">
        <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]"><Filter className="h-3.5 w-3.5" /> Filters</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select label="Period" value={period} onChange={(v) => setPeriod(v as Period)}>
            <option value="month">This month</option><option value="last_month">Last month</option><option value="quarter">This quarter</option><option value="year">This year</option><option value="all">All time</option><option value="custom">Custom dates</option>
          </Select>
          <Select label="Sale status" value={status} onChange={(v) => setStatus(v as SaleStatus)}>
            <option value="validated">Validated</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="all">All statuses</option>
          </Select>
          <Select label="Level" value={level} onChange={setLevel}>
            <option value="all">All levels</option>{levels.map((l) => (l >= 3 && l === levels[levels.length - 1] && levels.length > 3 ? null : <option key={l} value={String(l)}>Level {l}{l === 1 ? " (direct)" : ""}</option>))}{levels.length >= 3 && <option value="3+">Level 3 and deeper</option>}
          </Select>
          <Select label="Project" value={project} onChange={setProject}>
            <option value="all">All projects</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select label="Developer" value={developer} onChange={setDeveloper}>
            <option value="all">All developers</option>{developers.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
            Search
            <span className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, project, unit…" className="w-full rounded-lg border border-[#e5e7eb] py-2 pl-8 pr-2 text-[13px] font-semibold normal-case tracking-normal text-[#111827] placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none" />
            </span>
          </label>
        </div>
        {period === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">From<input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-lg border border-[#e5e7eb] px-2.5 py-2 text-[13px] font-semibold text-[#111827]" /></label>
            <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">To<input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-lg border border-[#e5e7eb] px-2.5 py-2 text-[13px] font-semibold text-[#111827]" /></label>
          </div>
        )}
      </div>

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
          {/* KPIs */}
          <StatTiles
            stats={[
              { label: `Team (${bounds.label})`, value: String(kpi.members), hint: `${kpi.active} active · ${kpi.pending} waiting for approval`, tone: "neutral" },
              { label: "Sold", value: String(kpi.sold), hint: `${kpi.notSold} active member${kpi.notSold === 1 ? "" : "s"} not sold yet`, tone: kpi.sold ? "up" : "neutral" },
              { label: "Validated deals", value: String(kpi.validated), hint: kpi.rejected ? `${kpi.rejected} rejected` : undefined, tone: "neutral" },
              { label: "Validated value", value: AED(kpi.validatedValue), hint: kpi.top ? `Top: ${kpi.top.name} · ${AED(kpi.top.value)}` : undefined, tone: "neutral" },
              { label: "Waiting for validation", value: String(kpi.pendingDeals), hint: kpi.pendingDeals ? AED(kpi.pendingValue) : "nothing waiting", tone: "neutral" },
              { label: "Joined in period", value: String(kpi.joiners), tone: "neutral" },
            ]}
          />

          {/* Charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
              {charts.months.length > 1 ? <BarsChart title="Validated sales by month (AED)" points={charts.months} /> : <p className="text-sm text-[#9ca3af]">Validated sales by month appears once there are sales in two months.</p>}
            </div>
            <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
              {charts.soldSplit.length > 1 ? <PieChart title="Who has sold" rows={charts.soldSplit} /> : <p className="text-sm text-[#9ca3af]">The sold / not-sold split appears once someone has sold.</p>}
            </div>
            {charts.projects.length > 0 && (
              <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
                <BarsChart title="Validated value by project" points={charts.projects} />
              </div>
            )}
            {charts.levels.length > 1 && (
              <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
                <PieChart title="Validated value by level" rows={charts.levels} />
              </div>
            )}
          </div>

          {/* Members / Sales */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                {([["members", `Members (${members.length})`], ["sales", `Sales (${sales.length})`]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${tab === k ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}>{label}</button>
                ))}
                {tab === "members" && (
                  <>
                    <span className="mx-1 h-5 w-px bg-[#e5e7eb]" />
                    {([["all", "Everyone"], ["sold", "Sold"], ["not_sold", "Not sold yet"]] as const).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setSold(k)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${sold === k ? "border-emerald-600 bg-emerald-600 text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}>{label}</button>
                    ))}
                    <Select label="" value={memberStatus} onChange={setMemberStatus}><option value="all">Any status</option><option value="active">Active</option><option value="pending">Waiting for approval</option><option value="inactive">Inactive</option></Select>
                    <Select label="" value={memberSort} onChange={setMemberSort}><option value="value">Sort: value</option><option value="deals">Sort: deals</option><option value="pending">Sort: pending</option><option value="recruits">Sort: network size</option><option value="joined">Sort: newest</option></Select>
                  </>
                )}
              </div>
              <button type="button" onClick={tab === "members" ? exportMembers : exportSales} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]">
                <Download className="h-3.5 w-3.5" /> Export {tab} (CSV)
              </button>
            </div>

            {tab === "members" ? (
              members.length === 0 ? (
                <p className="py-8 text-sm text-[#9ca3af]">Nobody matches these filters.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                        <th className="py-2 pr-3">Member</th><th className="py-2 pr-3">Level</th><th className="py-2 pr-3">Joined</th><th className="py-2 pr-3 text-right">Recruits</th><th className="py-2 pr-3 text-right">Validated</th><th className="py-2 pr-3 text-right">Value</th><th className="py-2 pr-3 text-right">Pending</th><th className="py-2">Last sale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f5]">
                      {shown.map(({ n, p }) => (
                        <tr key={n.id} className="hover:bg-[#fafbfc]">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={n.name} photo={n.photo} />
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]"><span className="truncate">{n.name}</span><StatusChip status={n.status} /></p>
                                <p className="text-[11px] text-[#6b7280]">{roleToLabel(n.role)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">L{n.level}</td>
                          <td className="py-2.5 pr-3 text-[#6b7280]">{fmtDate(n.joinedAt)}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{n.direct}{n.network > n.direct ? <span className="text-[#9ca3af]"> / {n.network}</span> : null}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{p.validated ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><TrendingUp className="h-3 w-3" /> {p.validated}</span> : <span className="text-[#c5ccd6]">—</span>}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">{p.value ? AED(p.value) : <span className="text-[#c5ccd6]">—</span>}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{p.pending ? <span className="font-semibold text-amber-700">{p.pending} · {AED(p.pendingValue)}</span> : <span className="text-[#c5ccd6]">—</span>}</td>
                          <td className="py-2.5 text-[#6b7280]">{fmtDate(p.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {members.length > 50 && !showAll && (
                    <button type="button" onClick={() => setShowAll(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-xs font-bold text-[#374151] hover:border-[#d6b357]"><UserPlus className="h-3.5 w-3.5" /> Show all {members.length}</button>
                  )}
                </div>
              )
            ) : sales.length === 0 ? (
              <p className="py-8 text-sm text-[#9ca3af]">No sales match these filters.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                      <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Member</th><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3 text-right">Contract price</th><th className="py-2 pr-3 text-right">Credited to team</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f2f5]">
                    {sales.map((s: TeamSale) => (
                      <tr key={s.id} className="hover:bg-[#fafbfc]">
                        <td className="py-2.5 pr-3 whitespace-nowrap text-[#6b7280]">{fmtDate(s.date)}</td>
                        <td className="py-2.5 pr-3">
                          {s.credits.map((c) => <p key={c.memberId} className="font-semibold text-[#111827]">{c.name} <span className="text-[11px] font-normal text-[#9ca3af]">L{c.level}{s.credits.length + s.outside.length > 1 ? ` · ${c.share}%` : ""}</span></p>)}
                          {s.outside.length > 0 && <p className="text-[11px] text-[#9ca3af]">shared with {s.outside.join(", ")}{s.outside.some((n) => n !== "you") ? " — outside your team" : ""}</p>}
                        </td>
                        <td className="py-2.5 pr-3"><p className="font-semibold text-[#111827]">{s.project}</p>{s.developer && <p className="text-[11px] text-[#6b7280]">{s.developer}</p>}</td>
                        <td className="py-2.5 pr-3 text-[#6b7280]">{s.unit ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{AED(s.price)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">{AED(s.credits.reduce((a, c) => a + c.value, 0))}</td>
                        <td className="py-2.5"><StatusChip status={s.status} /></td>
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
