"use client"

// Team sales on the admin Teams page (2026-10-02): what the selected team sold
// in any span of time — a month, a quarter, a year or a custom range — with
// the change against the span before, the month-by-month picture, the top
// projects, and every member who sold, each opening to their deals. Validated
// sales are the headline, as on every leaderboard; pending and rejected are
// shown beside them. Numbers come from GET /api/admin/teams/[id]/sales
// (lib/team-sales-period.ts).

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2, TrendingUp } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { BarsChart } from "@/features/dashboard/fhi-chat/charts"

type Deal = { sale_id: string; date: string; project: string; developer: string | null; unit: string | null; price: number; share: number; credited: number; status: string; shared: boolean }
type Seller = {
  id: string
  name: string
  role: string | null
  role_in_team: string | null
  subteam: string | null
  profile_url: string | null
  validated_deals: number
  validated_value: number
  pending_deals: number
  pending_value: number
  rejected_deals: number
  deals: Deal[]
}
type Result = {
  team: { id: string; name: string; subteams: number }
  period: { from: string; to: string; days: number }
  members_total: number
  totals: { validated: { deals: number; value: number }; pending: { deals: number; value: number }; rejected: { deals: number; value: number } }
  previous: { validated: { deals: number; value: number } }
  members_who_sold: number
  sellers: Seller[]
  months: Array<{ month: string; deals: number; value: number }>
  by_project: Array<{ project: string; deals: number; value: number }>
}

type Mode = "month" | "quarter" | "year" | "custom"
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const pad = (n: number) => String(n).padStart(2, "0")
const aed = (n: number) => `AED ${Math.round(n || 0).toLocaleString("en-US")}`
function aedShort(n: number): string {
  const v = Math.round(n || 0)
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `AED ${Math.round(v / 1_000)}K`
  return `AED ${v.toLocaleString("en-US")}`
}
const deals = (n: number) => `${n} deal${n === 1 ? "" : "s"}`
const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const addDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function change(cur: number, prev: number): { text: string; tone: "up" | "down" | "flat" } | null {
  if (prev === 0) return cur === 0 ? null : { text: "new", tone: "up" }
  const p = Math.round(((cur - prev) / prev) * 100)
  return { text: `${p >= 0 ? "+" : ""}${p}%`, tone: p > 0 ? "up" : p < 0 ? "down" : "flat" }
}

const STATUS_CHIP: Record<string, string> = {
  validated: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
}

export function TeamSalesPanel({ teamId, salesBase }: { teamId: string; salesBase: string }) {
  // The clock is read once, when the panel mounts (renders stay pure).
  const [today] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
  })
  const [mode, setMode] = useState<Mode>("year")
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [quarter, setQuarter] = useState(Math.floor((today.month - 1) / 3) + 1)
  const [customFrom, setCustomFrom] = useState(`${today.year}-01-01`)
  const [customTo, setCustomTo] = useState(today.iso)
  const [open, setOpen] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ key: string; data: Result | null; error: string | null } | null>(null)

  // The span asked for, as [from, to) for the API, and how to say it.
  const span = useMemo(() => {
    if (mode === "month") {
      const to = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`
      return { from: `${year}-${pad(month)}-01`, to, label: `${MONTHS[month - 1]} ${year}` }
    }
    if (mode === "quarter") {
      const m0 = (quarter - 1) * 3 + 1
      const to = quarter === 4 ? `${year + 1}-01-01` : `${year}-${pad(m0 + 3)}-01`
      return { from: `${year}-${pad(m0)}-01`, to, label: `Q${quarter} ${year} (${MONTHS[m0 - 1].slice(0, 3)}–${MONTHS[m0 + 1].slice(0, 3)})` }
    }
    if (mode === "year") return { from: `${year}-01-01`, to: `${year + 1}-01-01`, label: String(year) }
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customTo) && customFrom <= customTo
    return ok ? { from: customFrom, to: addDay(customTo, 1), label: `${fmtDay(customFrom)} – ${fmtDay(customTo)}` } : null
  }, [mode, year, month, quarter, customFrom, customTo])

  const key = span ? `${teamId}|${span.from}|${span.to}` : ""
  useEffect(() => {
    if (!span) return
    const ctrl = new AbortController()
    fetch(`/api/admin/teams/${teamId}/sales?from=${span.from}&to=${span.to}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as Result & { error?: string }
        setLoaded({ key, data: res.ok ? json : null, error: res.ok ? null : json.error ?? "Couldn't load the team's sales." })
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoaded({ key, data: null, error: "Couldn't load the team's sales." })
      })
    return () => ctrl.abort()
  }, [key, span, teamId])

  const loading = !!span && loaded?.key !== key
  const data = loaded?.key === key ? loaded.data : null
  const error = loaded?.key === key ? loaded.error : null

  const years = Array.from({ length: 6 }, (_, i) => today.year - i)
  const tabCls = (on: boolean) => `px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${on ? "bg-[#001f3f] text-white" : "text-[#6b7280] hover:text-[#001f3f]"}`
  const selectCls = "rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] focus:border-[#001f3f] focus:outline-none"

  const v = data?.totals.validated
  const ch = data ? change(data.totals.validated.value, data.previous.validated.value) : null
  const tiles = data
    ? [
        { label: "Validated sales", value: aedShort(v!.value), hint: `${deals(v!.deals)}${data.previous.validated.deals || data.previous.validated.value ? ` · before: ${aedShort(data.previous.validated.value)}` : ""}`, ch },
        { label: "Average deal", value: v!.deals ? aedShort(v!.value / v!.deals) : "—", hint: "validated, team share", ch: null },
        { label: "Pending", value: data.totals.pending.deals ? aedShort(data.totals.pending.value) : "0", hint: `${deals(data.totals.pending.deals)} waiting${data.totals.rejected.deals ? ` · ${data.totals.rejected.deals} rejected` : ""}`, ch: null },
        { label: "Members who sold", value: String(data.members_who_sold), hint: `of ${data.members_total.toLocaleString("en-US")}`, ch: null },
      ]
    : []

  const downloadCsv = () => {
    if (!data) return
    const esc = (s: string | number | null) => `"${String(s ?? "").replace(/"/g, '""')}"`
    const rows = [
      ["Member", "Role in team", "Subteam", "Sale date", "Project", "Developer", "Unit", "Contract price (AED)", "Share %", "Credited (AED)", "Status"],
      ...data.sellers.flatMap((s) =>
        s.deals.map((d) => [titleCase(s.name), s.role_in_team ?? "", s.subteam ?? "", d.date, d.project, d.developer ?? "", d.unit ?? "", d.price, d.share, d.credited, d.status]),
      ),
    ]
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${data.team.name.replace(/\s+/g, "-")}-sales-${data.period.from}-to-${addDay(data.period.to, -1)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#f0f2f5]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#001f3f]">
            <TrendingUp className="h-4 w-4 text-[#d6b357]" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0d1117]">Team sales</h3>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              {span ? span.label : "Pick a valid range"}
              {data?.team.subteams ? ` · including ${data.team.subteams} subteam${data.team.subteams === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!data || data.sellers.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-[#001f3f] hover:border-[#d6b357] hover:bg-[#d6b357]/10 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Download CSV
        </button>
      </div>

      <div className="px-6 py-4 space-y-5">
        {/* Period */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#f3f4f6] p-0.5" role="group" aria-label="Period">
            {(["month", "quarter", "year", "custom"] as Mode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={tabCls(mode === m)}>
                {m === "month" ? "Monthly" : m === "quarter" ? "Quarterly" : m === "year" ? "Yearly" : "Custom range"}
              </button>
            ))}
          </div>
          {mode === "month" && (
            <select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
              {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
          )}
          {mode === "quarter" && (
            <select aria-label="Quarter" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={selectCls}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{`Q${q}`}</option>)}
            </select>
          )}
          {mode !== "custom" && (
            <select aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {mode === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
              <input type="date" aria-label="From" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className={selectCls} />
              <span>to</span>
              <input type="date" aria-label="To" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className={selectCls} />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#9ca3af]">
            <Loader2 className="h-4 w-4 animate-spin" /> Adding up the team&apos;s sales…
          </div>
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : data ? (
          <>
            {/* Headline */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.label} className="min-w-0 rounded-xl border border-[#eceef1] bg-[#fafbfc] px-4 py-3">
                  <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{t.label}</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <p className="font-['Outfit'] text-[22px] font-bold leading-tight text-[#001f3f] tabular-nums">{t.value}</p>
                    {t.ch && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${t.ch.tone === "up" ? "bg-[#e8f5ec] text-[#15803d]" : t.ch.tone === "down" ? "bg-[#fdecec] text-[#b91c1c]" : "bg-[#f1f3f6] text-[#6b7280]"}`}
                        title="Against the same length of time just before"
                      >
                        {t.ch.text}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#6b7280]">{t.hint}</p>
                </div>
              ))}
            </div>

            {/* Month by month + top projects */}
            {(data.months.length >= 2 || data.by_project.length > 0) && (
              <div className={`grid grid-cols-1 gap-5 ${data.months.length >= 2 && data.by_project.length > 0 ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}>
                {data.months.length >= 2 ? (
                  <div className="rounded-xl border border-[#eceef1] p-4">
                    <BarsChart
                      title="Validated sales by month"
                      points={data.months.map((m) => ({
                        label: new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", ...(data.months.length > 12 ? { year: "2-digit" } : {}), timeZone: "UTC" }),
                        value: m.value,
                        display: m.value ? aedShort(m.value).replace("AED ", "") : "0",
                      }))}
                    />
                  </div>
                ) : null}
                {data.by_project.length > 0 && (
                  <div className="rounded-xl border border-[#eceef1] p-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">Top projects</p>
                    <ul className="space-y-1.5">
                      {data.by_project.slice(0, 6).map((p, i) => (
                        <li key={p.project} className="flex items-center gap-2 text-[12px]">
                          <span className="min-w-0 flex-1 truncate font-semibold text-[#0d1117]">{p.project}</span>
                          <span className="shrink-0 text-[#6b7280]">{deals(p.deals)}</span>
                          <span className={`w-[84px] shrink-0 text-right font-bold tabular-nums ${i === 0 ? "text-[#b8913f]" : "text-[#001f3f]"}`}>{aedShort(p.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Members who sold */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                Members who sold · {span?.label}
              </p>
              {data.sellers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#e5e7eb] px-4 py-6 text-center text-sm text-[#6b7280]">No sales by this team in {span?.label}.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#eceef1]">
                  <div className="hidden sm:grid grid-cols-[28px_minmax(0,1fr)_90px_120px_70px_90px] gap-3 bg-[#fafbfc] px-4 py-2 text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">
                    <span>#</span><span>Member</span><span className="text-right">Deals</span><span className="text-right">Validated</span><span className="text-right">Of team</span><span className="text-right">Pending</span>
                  </div>
                  <ul className="divide-y divide-[#f0f2f5]">
                    {data.sellers.map((s, i) => {
                      const isOpen = open === s.id
                      const pct = data.totals.validated.value ? Math.round((s.validated_value / data.totals.validated.value) * 100) : 0
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : s.id)}
                            aria-expanded={isOpen}
                            className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] sm:grid-cols-[28px_minmax(0,1fr)_90px_120px_70px_90px] items-center gap-3 px-4 py-2.5 text-left hover:bg-[#fafbfc]"
                          >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 && s.validated_value > 0 ? "bg-[#d6b357] text-[#001f3f]" : "bg-[#f3f4f6] text-[#6b7280]"}`}>{i + 1}</span>
                            <span className="flex min-w-0 items-center gap-2.5">
                              <UserAvatar name={s.name} imageUrl={s.profile_url} size={30} />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-[#0d1117]">{titleCase(s.name)}</span>
                                <span className="block truncate text-[11px] text-[#9ca3af]">{[s.role_in_team, s.subteam].filter(Boolean).join(" · ")}</span>
                              </span>
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />}
                            </span>
                            <span className="hidden sm:block text-right text-sm text-[#374151] tabular-nums">{s.validated_deals}</span>
                            <span className="text-right text-sm font-bold text-[#001f3f] tabular-nums">{aedShort(s.validated_value)}</span>
                            <span className="hidden sm:block text-right text-xs text-[#6b7280] tabular-nums">{pct}%</span>
                            <span className="hidden sm:block text-right text-xs text-[#6b7280] tabular-nums">{s.pending_deals ? `${s.pending_deals} · ${aedShort(s.pending_value)}` : "—"}</span>
                          </button>
                          {isOpen && (
                            <div className="bg-[#fafbfc] px-4 pb-3 pt-1">
                              <ul className="divide-y divide-[#eef0f3] rounded-lg border border-[#eceef1] bg-white">
                                {s.deals.map((d) => (
                                  <li key={`${d.sale_id}-${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
                                    <span className="w-[86px] shrink-0 text-[#6b7280]">{fmtDay(d.date)}</span>
                                    <span className="min-w-0 flex-1 truncate font-semibold text-[#0d1117]">
                                      {d.project}
                                      {d.developer ? <span className="font-normal text-[#9ca3af]"> · {d.developer}</span> : null}
                                      {d.unit ? <span className="font-normal text-[#9ca3af]"> · Unit {d.unit}</span> : null}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-[#374151]">{aed(d.price)}</span>
                                    {d.shared && <span className="shrink-0 rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d2a]">{d.share}% · {aedShort(d.credited)}</span>}
                                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CHIP[d.status] ?? "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]"}`}>{d.status}</span>
                                    <Link href={`${salesBase}/${d.sale_id}`} className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#001f3f] hover:underline">
                                      Open <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
