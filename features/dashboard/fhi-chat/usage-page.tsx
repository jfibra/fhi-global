"use client"

/**
 * Agents' FHI Assistant usage (admin, phase 3, 2026-10-09): this month's
 * spend against the cap, questions per day, who asks how much, the tools
 * they lean on and the questions themselves — from assistant_usage
 * (migration 079). Admin staff only.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw, Search, Sparkles } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole, roleToLabel } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import type { AssistantUsageReport } from "@/lib/assistant-usage"
import { BarsChart, StatTiles } from "./charts"

const WINDOWS = [7, 30, 90] as const
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`
const when = (iso: string) => new Date(iso).toLocaleString("en-AE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })
const TOOL_WORDS: Record<string, string> = { my_sales: "own sales", top_sales_board: "Top Sales board", find_projects: "project search", project_details: "project details", news_overview: "news", my_leads: "own leads", my_listings: "own listings", my_website: "own website", my_reviews: "own reviews", my_recruits: "own recruits", my_team: "team" }

async function load(days: number): Promise<AssistantUsageReport> {
  const res = await fetch(`/api/admin/assistant-usage?days=${days}`, { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as AssistantUsageReport & { error?: string }
  if (!res.ok || !json.per_day) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return json
}

export default function AssistantUsagePage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30)
  const [report, setReport] = useState<AssistantUsageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [person, setPerson] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  // Deferred a tick so the effect never sets state synchronously.
  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(() => {
      setBusy(true)
      load(days)
        .then((r) => {
          if (!cancelled) { setReport(r); setError(null) }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the usage.")
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [days])

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (report?.recent ?? []).filter((r) => (!person || r.userId === person) && (!q || r.question.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)))
  }, [report, person, query])

  if (!allowed) return null
  const pct = report ? Math.min(100, Math.round((100 * report.month.spend_usd) / Math.max(report.cap_usd, 0.01))) : 0

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`${base}/fhi-chat`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f]">
            <ArrowLeft className="h-3.5 w-3.5" /> FHI Assistant
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Sparkles className="h-6 w-6 text-[#001f3f]" /> Agents&apos; assistant usage
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            What agents and team leaders ask their FHI Assistant and what it costs. Agents get 20 questions a day, team leaders 40; the agent assistant pauses when the monthly budget is used up.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {WINDOWS.map((w) => (
            <button key={w} type="button" onClick={() => setDays(w)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${days === w ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}>
              Last {w} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setBusy(true); load(days).then((r) => { setReport(r); setError(null) }).catch(() => setError("Couldn't load the usage.")).finally(() => setBusy(false)) }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !report ? (
        <p className="flex items-center gap-2 py-8 text-sm text-[#9ca3af]"><Loader2 className="h-4 w-4 animate-spin" /> Loading usage…</p>
      ) : (
        <>
          {/* This month against the cap */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">This month</p>
                <p className="mt-1 font-['Outfit'] text-3xl font-bold text-[#0d1117]">
                  {usd(report.month.spend_usd)} <span className="text-base font-semibold text-[#6b7280]">of {usd(report.cap_usd)} budget</span>
                </p>
              </div>
              <p className="text-sm text-[#6b7280]">
                {report.month.questions.toLocaleString("en-AE")} question{report.month.questions === 1 ? "" : "s"} · {report.month.people} {report.month.people === 1 ? "person" : "people"} · {report.today.questions} today
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1f3f6]">
              <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-400" : "bg-[#001f3f]"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-[#9ca3af]">{pct}% of the budget used · resets on the 1st (Dubai time) · change it with ASSISTANT_MONTHLY_CAP_USD</p>
          </div>

          <StatTiles
            stats={[
              { label: `Questions, last ${report.window.days} days`, value: report.per_day.reduce((a, d) => a + d.questions, 0).toLocaleString("en-AE"), tone: "neutral" },
              { label: "Cost, same window", value: usd(report.per_day.reduce((a, d) => a + d.cost_usd, 0)), tone: "neutral" },
              { label: "People using it", value: String(report.per_person.length), tone: "neutral" },
              { label: "Average per question", value: report.per_day.reduce((a, d) => a + d.questions, 0) ? usd(report.per_day.reduce((a, d) => a + d.cost_usd, 0) / report.per_day.reduce((a, d) => a + d.questions, 0)) : "–", tone: "neutral" },
            ]}
          />

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-[#e8eaed] bg-white p-5">
              <BarsChart title={`Questions per day (last ${report.window.days} days, by day of month)`} points={report.per_day.map((d) => ({ label: String(Number(d.day.slice(8))), value: d.questions, display: String(d.questions) }))} />
            </div>
            <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">What they ask about</p>
              {report.top_tools.length === 0 ? (
                <p className="mt-3 text-sm text-[#9ca3af]">Nothing yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {report.top_tools.slice(0, 8).map((t) => {
                    const max = report.top_tools[0].count
                    return (
                      <li key={t.tool} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[#1f2937]">{TOOL_WORDS[t.tool] ?? t.tool.replace(/_/g, " ")}</span>
                          <span className="tabular-nums text-[#6b7280]">{t.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f3f6]"><div className="h-full rounded-full bg-[#d6b357]" style={{ width: `${Math.round((100 * t.count) / max)}%` }} /></div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Per person */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Per person, last {report.window.days} days</p>
            {report.per_person.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">Nobody has asked anything yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                      <th className="py-2 pr-3">Person</th><th className="py-2 pr-3">Questions</th><th className="py-2 pr-3">Today</th><th className="py-2 pr-3">Cost</th><th className="py-2 pr-3">Tokens</th><th className="py-2 pr-3">Failed</th><th className="py-2">Last asked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f2f5]">
                    {report.per_person.map((p) => (
                      <tr key={p.userId} className={`cursor-pointer hover:bg-[#fafbfc] ${person === p.userId ? "bg-[#d6b357]/10" : ""}`} onClick={() => setPerson((cur) => (cur === p.userId ? null : p.userId))}>
                        <td className="py-2.5 pr-3">
                          <span className="font-semibold text-[#111827]">{p.name}</span>
                          <span className="ml-2 text-[11px] text-[#9ca3af]">{roleToLabel(p.role)}</span>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">{p.questions}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{p.today}{p.limit !== null ? <span className="text-[#9ca3af]"> / {p.limit}</span> : null}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{usd(p.cost_usd)}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{p.tokens.toLocaleString("en-AE")}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{p.failed || "–"}</td>
                        <td className="py-2.5 text-[#6b7280]">{when(p.last_asked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* The questions */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">
                Questions{person ? ` · ${report.per_person.find((p) => p.userId === person)?.name ?? ""}` : ""}
                {person && <button type="button" onClick={() => setPerson(null)} className="ml-2 text-[11px] font-semibold normal-case tracking-normal text-[#001f3f] underline">show everyone</button>}
              </p>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions or names…" className="w-full rounded-xl border border-[#e5e5e5] py-2 pl-9 pr-3 text-sm focus:border-[#001f3f] focus:outline-none" />
              </div>
            </div>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">No questions match.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#f0f2f5]">
                {recent.slice(0, 100).map((r, i) => (
                  <li key={`${r.at}-${i}`} className="py-2.5">
                    <p className="text-sm text-[#111827]">{r.question}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[#6b7280]">
                      <span className="font-semibold text-[#374151]">{r.name}</span>
                      <span>{when(r.at)}</span>
                      <span>{r.tools.length ? r.tools.map((t) => TOOL_WORDS[t] ?? t).join(", ") : "no lookup"}</span>
                      <span>{usd(r.cost_usd)}</span>
                      {!r.ok && <span className="font-semibold text-rose-600">failed{r.error ? `: ${r.error}` : ""}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
