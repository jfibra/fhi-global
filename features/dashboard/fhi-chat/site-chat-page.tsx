"use client"

/**
 * The website chat's usage (admin, 2026-11-06): what visitors ask the public
 * FHI Assistant on fhiglobal.ae, which chats turned into leads, what it
 * costs against the daily and monthly caps, and what was refused by the
 * brakes — from site_chat_messages (migration 083). Admin staff only.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BarChart3, Loader2, MessageSquareText, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getDashboardRouteByRole } from "@/lib/auth"
import type { SiteChatReport } from "@/lib/site-chat-usage"
import { BarsChart, StatTiles } from "./charts"

const WINDOWS = [7, 30, 90] as const
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`
const when = (iso: string) => new Date(iso).toLocaleString("en-AE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })
const TOOL_WORDS: Record<string, string> = { find_projects: "project search", project_details: "project details", find_listings: "ready homes (buy/rent)", upcoming_events: "events", site_pages: "guides and pages", our_agents: "our agents", faq: "quick answer (no AI)" }
const REASON_WORDS: Record<string, string> = {
  ip_minute: "too many per minute (one visitor)",
  ip_hour: "hourly limit (one visitor)",
  ip_day: "daily limit (one visitor)",
  session: "conversation limit",
  site_hour: "site-wide hourly limit",
  day_cap: "daily budget reached",
  month_cap: "monthly budget reached",
}

async function load(days: number): Promise<SiteChatReport> {
  const res = await fetch(`/api/admin/site-chat-usage?days=${days}`, { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as SiteChatReport & { error?: string }
  if (!res.ok || !json.per_day) throw new Error(json.error ?? `Request failed (${res.status}).`)
  return json
}

export default function SiteChatUsagePage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const base = getDashboardRouteByRole(role)
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30)
  const [report, setReport] = useState<SiteChatReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<string | null>(null)
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (report?.messages ?? []).filter((m) => (!session || m.session === session) && (!q || m.question.toLowerCase().includes(q) || (m.answer ?? "").toLowerCase().includes(q)))
  }, [report, session, query])
  const conversation = session ? report?.conversations.find((c) => c.session === session) ?? null : null

  if (!allowed) return null
  const monthPct = report ? Math.min(100, Math.round((100 * report.month.spend_usd) / Math.max(report.cap_usd, 0.01))) : 0
  const dayPct = report ? Math.min(100, Math.round((100 * report.today.spend_usd) / Math.max(report.day_cap_usd, 0.01))) : 0
  const windowQuestions = report ? report.per_day.reduce((a, d) => a + d.questions, 0) : 0
  const windowCost = report ? report.per_day.reduce((a, d) => a + d.cost_usd, 0) : 0
  const windowLeads = report ? report.per_day.reduce((a, d) => a + d.leads, 0) : 0
  const windowBlocked = report ? report.per_day.reduce((a, d) => a + d.blocked, 0) : 0
  const convCount = report ? report.conversations.length : 0
  const convWithLead = report ? report.conversations.filter((c) => c.lead).length : 0
  const bar = (pct: number) => (pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-400" : "bg-[#001f3f]")

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`${base}/fhi-chat`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f]">
            <ArrowLeft className="h-3.5 w-3.5" /> FHI Assistant
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <MessageSquareText className="h-6 w-6 text-[#001f3f]" /> Website chat
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            What visitors ask the FHI Assistant on fhiglobal.ae, which chats left their number, and what it costs. It only knows what the website shows; a lead it collects lands in Emails like any Inquire Now lead.
          </p>
          <Link href={`${base}/fhi-chat/usage`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#001f3f] underline decoration-[#d6b357] underline-offset-2">
            <BarChart3 className="h-3.5 w-3.5" /> Agents&apos; assistant usage
          </Link>
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
          {/* Budget */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">This month</p>
              <p className="mt-1 font-['Outfit'] text-3xl font-bold text-[#0d1117]">
                {usd(report.month.spend_usd)} <span className="text-base font-semibold text-[#6b7280]">of {usd(report.cap_usd)} budget</span>
              </p>
              <p className="mt-1 text-sm text-[#6b7280]">
                {report.month.questions.toLocaleString("en-AE")} question{report.month.questions === 1 ? "" : "s"} · {report.month.conversations} conversation{report.month.conversations === 1 ? "" : "s"} · {report.month.leads} lead{report.month.leads === 1 ? "" : "s"} · {report.month.blocked} refused
              </p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1f3f6]"><div className={`h-full rounded-full ${bar(monthPct)}`} style={{ width: `${monthPct}%` }} /></div>
              <p className="mt-1.5 text-[11px] text-[#9ca3af]">{monthPct}% used · resets on the 1st (Dubai time) · SITE_CHAT_MONTHLY_CAP_USD</p>
            </div>
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Today</p>
              <p className="mt-1 font-['Outfit'] text-3xl font-bold text-[#0d1117]">
                {usd(report.today.spend_usd)} <span className="text-base font-semibold text-[#6b7280]">of {usd(report.day_cap_usd)} a day</span>
              </p>
              <p className="mt-1 text-sm text-[#6b7280]">
                {report.today.questions} question{report.today.questions === 1 ? "" : "s"} · {report.today.leads} lead{report.today.leads === 1 ? "" : "s"} · {report.today.blocked} refused
              </p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1f3f6]"><div className={`h-full rounded-full ${bar(dayPct)}`} style={{ width: `${dayPct}%` }} /></div>
              <p className="mt-1.5 text-[11px] text-[#9ca3af]">{dayPct}% used · when a cap is reached the chat pauses and points visitors to WhatsApp · SITE_CHAT_DAILY_CAP_USD</p>
            </div>
          </div>

          <StatTiles
            stats={[
              { label: `Conversations, last ${report.window.days} days`, value: String(convCount), tone: "neutral" },
              { label: "Questions", value: windowQuestions.toLocaleString("en-AE"), tone: "neutral" },
              { label: "Leads from the chat", value: String(windowLeads), tone: windowLeads ? "up" : "neutral", hint: convCount ? `${convWithLead} of ${convCount} conversations left a number` : null },
              { label: "Average per question", value: windowQuestions ? usd(windowCost / windowQuestions) : "–", tone: "neutral", hint: `${usd(windowCost)} in total` },
            ]}
          />

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-[#e8eaed] bg-white p-5">
              <BarsChart title={`Questions per day (last ${report.window.days} days, by day of month)`} points={report.per_day.map((d) => ({ label: String(Number(d.day.slice(8))), value: d.questions, display: String(d.questions) }))} />
            </div>
            <div className="space-y-5">
              <Ranked title="What they ask about" rows={report.top_tools.map((t) => ({ name: TOOL_WORDS[t.tool] ?? t.tool.replace(/_/g, " "), count: t.count }))} empty="Nothing yet." />
              <Ranked title="Pages they ask from" rows={report.top_pages.map((p) => ({ name: p.page, count: p.count }))} empty="Nothing yet." />
            </div>
          </div>

          <div className="grid items-start gap-5 md:grid-cols-2">
            <Ranked title="Where they are (Cloudflare country)" rows={report.top_countries.map((c) => ({ name: c.country, count: c.count }))} empty="No country data yet." />
            <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]"><ShieldCheck className="h-3.5 w-3.5" /> Refused by the brakes, last {report.window.days} days</p>
              {windowBlocked === 0 ? (
                <p className="mt-3 text-sm text-[#9ca3af]">Nothing refused — no one hit a limit.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {report.blocked_by_reason.map((r) => (
                    <li key={r.reason} className="flex items-center justify-between gap-3"><span className="text-[#1f2937]">{REASON_WORDS[r.reason] ?? r.reason}</span><span className="tabular-nums text-[#6b7280]">{r.count}</span></li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-[#9ca3af]">
                Limits: {report.limits.ip_per_hour} an hour and {report.limits.ip_per_day} a day per visitor, {report.limits.per_session} per conversation, {report.limits.site_per_hour} an hour site-wide, plus the daily and monthly budgets. A refused visitor is pointed to WhatsApp.
              </p>
            </div>
          </div>

          {/* Conversations */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">Conversations, last {report.window.days} days</p>
            {report.conversations.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">No one has chatted yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
                      <th className="py-2 pr-3">Started</th><th className="py-2 pr-3">First question</th><th className="py-2 pr-3">Messages</th><th className="py-2 pr-3">Page</th><th className="py-2 pr-3">Country</th><th className="py-2 pr-3">Lead</th><th className="py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f2f5]">
                    {report.conversations.slice(0, 150).map((c) => (
                      <tr key={c.session} className={`cursor-pointer hover:bg-[#fafbfc] ${session === c.session ? "bg-[#d6b357]/10" : ""}`} onClick={() => setSession((cur) => (cur === c.session ? null : c.session))}>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-[#6b7280]">{when(c.started)}</td>
                        <td className="max-w-[320px] truncate py-2.5 pr-3 text-[#111827]">{c.first_question}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{c.messages}{c.failed ? <span className="ml-1 text-[11px] text-rose-600">({c.failed} failed)</span> : null}</td>
                        <td className="max-w-[180px] truncate py-2.5 pr-3 text-[#6b7280]">{c.page ?? "–"}</td>
                        <td className="py-2.5 pr-3 text-[#6b7280]">{c.country ?? "–"}</td>
                        <td className="py-2.5 pr-3">{c.lead ? <Link href={`${base}/leads/${c.lead.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-semibold text-[#001f3f] underline decoration-[#d6b357] underline-offset-2"><UserRound className="h-3.5 w-3.5" /> {c.lead.name}</Link> : <span className="text-[#9ca3af]">–</span>}</td>
                        <td className="py-2.5 tabular-nums">{usd(c.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* The messages */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">
                {conversation ? `Conversation · ${when(conversation.started)}` : "Messages"}
                {session && <button type="button" onClick={() => setSession(null)} className="ml-2 text-[11px] font-semibold normal-case tracking-normal text-[#001f3f] underline">show all</button>}
              </p>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions or answers…" className="w-full rounded-xl border border-[#e5e5e5] py-2 pl-9 pr-3 text-sm focus:border-[#001f3f] focus:outline-none" />
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="mt-3 text-sm text-[#9ca3af]">No messages match.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#f0f2f5]">
                {(session ? [...shown].reverse() : shown).slice(0, 150).map((m, i) => (
                  <li key={`${m.at}-${i}`} className="py-3">
                    <p className="text-sm font-semibold text-[#111827]">{m.question}</p>
                    {m.blocked ? (
                      <p className="mt-1 text-[12px] font-semibold text-amber-700">Refused: {REASON_WORDS[m.blocked] ?? m.blocked}</p>
                    ) : m.answer ? (
                      <details className="mt-1 group">
                        <summary className="cursor-pointer select-none text-[12px] font-semibold text-[#001f3f]">Answer</summary>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151]">{m.answer}</p>
                      </details>
                    ) : null}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[#6b7280]">
                      <span>{when(m.at)}</span>
                      {m.page && <span>{m.page}</span>}
                      <span>{m.tools.length ? m.tools.map((t) => TOOL_WORDS[t] ?? t).join(", ") : "no lookup"}</span>
                      <span>{usd(m.cost_usd)}</span>
                      {!m.ok && !m.blocked && <span className="font-semibold text-rose-600">failed{m.error ? `: ${m.error}` : ""}</span>}
                      {!session && <button type="button" onClick={() => setSession(m.session)} className="font-semibold text-[#001f3f] underline">whole conversation</button>}
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

function Ranked({ title, rows, empty }: { title: string; rows: Array<{ name: string; count: number }>; empty: string }) {
  const max = rows[0]?.count ?? 0
  return (
    <div className="min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#9ca3af]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.name} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-semibold text-[#1f2937]">{r.name}</span>
                <span className="tabular-nums text-[#6b7280]">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f3f6]"><div className="h-full rounded-full bg-[#d6b357]" style={{ width: `${Math.round((100 * r.count) / Math.max(max, 1))}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
