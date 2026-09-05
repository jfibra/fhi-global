"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, FileText, Globe, Loader2, Monitor, Printer, RotateCcw, Send, Smartphone, Sparkles, Tablet } from "lucide-react"

/**
 * FHI Assistant — the admin one-stop shop for questions about the business.
 * Ask in plain language; the assistant runs the real database queries
 * server-side and answers with exact figures. Admin staff only.
 */

type Card = {
  kind: "agent" | "developer" | "project"
  title: string
  subtitle?: string
  image?: string | null
  rank?: number
}
type TrendPoint = { date: string; visitors: number }
type ShareRow = { label: string; value: number; display?: string; iso?: string | null; icon?: string | null }
type ChartSpec =
  | { kind: "trend"; title: string; points: TrendPoint[] }
  | { kind: "shares"; title: string; rows: ShareRow[] }
type Msg = {
  role: "user" | "assistant"
  content: string
  used?: string[]
  cards?: Card[]
  names?: string[]
  charts?: ChartSpec[]
  typed?: boolean
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Styles the entities inside a reply: names the tools returned get bold
 *  navy, AED amounts get gold — the same hierarchy as the dashboard. Purely
 *  presentational; the matching runs against OUR card titles, not guesses. */
function RichText({ text, names }: { text: string; names: string[] }) {
  const pattern = [...names.map(escapeRe), "AED\\s[\\d,]+(?:\\.\\d+)?"].join("|")
  if (!pattern) return <>{text}</>
  const lower = new Set(names.map((n) => n.toLowerCase()))
  const parts = text.split(new RegExp(`(${pattern})`, "gi"))
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null
        if (/^AED\s[\d,]/.test(p))
          return (
            <span key={i} className="font-semibold text-[#8a6d2a]">
              {p}
            </span>
          )
        if (lower.has(p.toLowerCase()))
          return (
            <span key={i} className="font-semibold text-[#001f3f]">
              {p}
            </span>
          )
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/** Typewriter reveal — types the reply like a live assistant, then reports
 *  done so the cards and sources fade in after the words. */
function TypedText({ text, names, onDone }: { text: string; names: string[]; onDone: () => void }) {
  const [len, setLen] = useState(0)
  const doneRef = useRef(false)
  useEffect(() => {
    doneRef.current = false
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLen(text.length)
      return
    }
    setLen(0)
    const id = window.setInterval(() => {
      setLen((n) => Math.min(n + 3, text.length))
    }, 14)
    return () => window.clearInterval(id)
  }, [text])
  // Completion is reported from an effect, never from inside a state updater —
  // React forbids updating the parent while another component renders.
  useEffect(() => {
    if (len >= text.length && !doneRef.current) {
      doneRef.current = true
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, text])
  return (
    <>
      <RichText text={text.slice(0, len)} names={names} />
      {len < text.length && <span className="inline-block w-[2px] h-[1em] align-middle bg-[#d6b357] animate-pulse" aria-hidden="true" />}
    </>
  )
}

function CardRow({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {cards.map((c) => (
        <div key={`${c.kind}:${c.title}`} className="flex items-center gap-3 border border-[#eceef1] bg-white px-3 py-2.5">
          {c.rank != null && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#d6b357] font-['Outfit'] text-[12px] font-bold text-[#001f3f]">
              {c.rank}
            </span>
          )}
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.image}
              alt={c.title}
              loading="lazy"
              className={
                c.kind === "agent"
                  ? "h-10 w-10 shrink-0 rounded-full object-cover border-2 border-[#d6b357]"
                  : c.kind === "developer"
                    ? "h-10 w-10 shrink-0 object-contain bg-white border border-[#eceef1] p-1"
                    : "h-10 w-14 shrink-0 object-cover"
              }
            />
          ) : (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center bg-[#001f3f] text-sm font-bold text-[#d6b357] ${c.kind === "agent" ? "rounded-full" : ""}`}
            >
              {c.title.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#0d1117]">{c.title}</p>
            {c.subtitle && <p className="truncate text-[11.5px] text-[#6b7280]">{c.subtitle}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Visitors-per-day mini bar chart — one series, navy bars, gold peak.
 *  Detail lives in the hover tooltips; the text answer states the trend. */
function TrendChart({ title, points }: { title: string; points: TrendPoint[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points.map((p) => p.visitors), 1)
  const peak = points.reduce((a, b) => (b.visitors > a.visitors ? b : a))
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-AE", { month: "short", day: "numeric" })
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
        {title} · peak {fmt(peak.date)} ({peak.visitors})
      </p>
      <div className="flex h-16 items-end gap-[3px]">
        {points.map((p) => (
          <div
            key={p.date}
            title={`${fmt(p.date)} — ${p.visitors} visitor${p.visitors === 1 ? "" : "s"}`}
            className={`min-w-[3px] flex-1 ${p === peak ? "bg-[#d6b357]" : "bg-[#001f3f]"}`}
            style={{ height: `${Math.max((p.visitors / max) * 60, 2)}px`, opacity: p.visitors ? 1 : 0.15 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between border-t border-[#e5e8ec] pt-1 text-[10.5px] text-[#9ca3af]">
        <span>{fmt(points[0].date)}</span>
        <span>{fmt(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

/** The little identity mark in front of a share row: country flag, real site
 *  favicon, a device pictogram, or a neutral globe so rows stay aligned. */
function RowIcon({ row }: { row: ShareRow }) {
  if (row.iso)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`https://flagcdn.com/w20/${row.iso}.png`} alt="" className="h-3 w-5 shrink-0 object-cover" />
  if (row.icon)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.icon} alt="" loading="lazy" className="h-4 w-4 shrink-0 object-contain" />
  const l = row.label.toLowerCase()
  if (l === "mobile") return <Smartphone className="h-4 w-4 shrink-0 text-[#001f3f]" />
  if (l === "desktop") return <Monitor className="h-4 w-4 shrink-0 text-[#001f3f]" />
  if (l === "tablet") return <Tablet className="h-4 w-4 shrink-0 text-[#001f3f]" />
  return <Globe className="h-4 w-4 shrink-0 text-[#9ca3af]" />
}

/** Horizontal share bars — the ranked comparison (leaderboards, devices,
 *  sources, countries). One series: navy bars, gold leader. */
function ShareChart({ chart }: { chart: { title: string; rows: ShareRow[] } }) {
  if (chart.rows.length < 2) return null
  const max = Math.max(...chart.rows.map((r) => r.value), 1)
  // Leaderboards (agents/developers) carry no identity marks — only charts
  // where at least one row has a flag, favicon, or device label get the slot.
  const hasIcons = chart.rows.some(
    (r) => r.iso || r.icon || ["mobile", "desktop", "tablet"].includes(r.label.toLowerCase()),
  )
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{chart.title}</p>
      <div className="space-y-1.5">
        {chart.rows.map((r, i) => (
          <div key={r.label} className="flex items-center gap-2">
            {hasIcons && <RowIcon row={r} />}
            <span className="w-[36%] shrink-0 truncate text-[12px] font-semibold text-[#0d1117] capitalize">
              {r.label}
            </span>
            <div className="h-3.5 flex-1 bg-[#f1f3f6]">
              <div
                className={`h-full ${i === 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`}
                style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
              />
            </div>
            <span className="min-w-[60px] shrink-0 text-right text-[11px] tabular-nums text-[#374151]">
              {r.display ?? r.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  "Who are the top agents this year?",
  "How many website visits this week?",
  "Total validated sales value in 2026?",
  "How many projects does each developer have?",
  "What were our most recent sales?",
  "How many registrations does our latest event have?",
]

/** One-tap professional reports — each sends a preset question. */
const REPORT_BUTTONS = [
  { label: "Daily Report", prompt: "Give me the full report for today" },
  { label: "Weekly Report", prompt: "Give me the full report for the last 7 days" },
  { label: "Monthly Report", prompt: "Give me the full report for this month" },
] as const

/** Tool names → human wording for the tiny "checked" line. */
const TOOL_LABELS: Record<string, string> = {
  top_agents: "Top Sales board",
  top_developers: "Top Developers board",
  top_teams: "Team Sales board",
  sales_summary: "sales totals",
  agent_sales: "agent record",
  agent_recruits: "recruits",
  developer_overview: "developer portfolio",
  projects_stats: "project counts",
  platform_counts: "platform KPIs",
  recent_sales: "recent sales",
  events_overview: "events",
  event_attendees: "event registrations",
  new_accounts: "new signups",
  website_traffic: "Google Analytics",
  search_keywords: "Google Search Console",
  activity_feed: "activity feed",
  upcoming_birthdays: "birthday calendar",
}

/** Branded print view — parses the plain-text answer into a real report
 *  layout (title band, sections, ranked rows, insight callout) so "Save as
 *  PDF" produces something you can forward unedited. */
function exportAnswer(content: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // Escape first, then decorate: gold amounts, green/red period deltas.
  const decorate = (s: string) =>
    esc(s)
      .replace(/AED \d{1,3}(?:,\d{3})*(?:\.\d+)?/g, (m) => `<b class="aed">${m}</b>`)
      .replace(/\b(up \d+(?:\.\d+)?%)/gi, '<span class="up">$1</span>')
      .replace(/\b(down \d+(?:\.\d+)?%)/gi, '<span class="down">$1</span>')
      .replace(/\(\+(\d+(?:\.\d+)?%)/g, '(<span class="up">+$1</span>')
      .replace(/\(-(\d+(?:\.\d+)?%)/g, '(<span class="down">-$1</span>')

  // A heading is an ALL-CAPS line ("SALES", "TOP AGENTS"), optionally with a
  // lowercase parenthetical ("FULL REPORT (this week)").
  const isHeading = (l: string) => {
    if (l.startsWith("- ")) return false
    const base = l.replace(/\s*\(.*\)\s*$/, "").trim()
    return base.length >= 3 && base.length <= 40 && /[A-Z]/.test(base) && base === base.toUpperCase()
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim())
  let title = "FHI Assistant Report"
  let period = ""
  let firstHeadingUsed = false
  let inSection = false
  const body: string[] = []
  const closeSection = () => {
    if (inSection) {
      body.push("</div>")
      inSection = false
    }
  }

  for (const line of lines) {
    if (!line) continue
    if (isHeading(line)) {
      // The first heading is the report's own title ("FULL REPORT (today)").
      if (!firstHeadingUsed) {
        firstHeadingUsed = true
        const m = line.match(/^(.*?)\s*\((.*)\)\s*$/)
        title = m ? m[1] : line
        period = m ? m[2] : ""
        continue
      }
      closeSection()
      body.push(`<div class="section"><h2>${decorate(line)}</h2>`)
      inSection = true
      continue
    }
    if (/^insight\s*:/i.test(line)) {
      closeSection()
      body.push(
        `<div class="insight"><span>Insight</span><p>${decorate(line.replace(/^insight\s*:\s*/i, ""))}</p></div>`,
      )
      continue
    }
    if (line.startsWith("- ")) {
      if (!inSection) {
        body.push('<div class="section">')
        inSection = true
      }
      const item = line.slice(2)
      const rank = item.match(/^(\d+)\.\s+(.*)$/)
      const rest = rank ? rank[2] : item
      const split = rest.match(/^(.{2,42}?):\s+(.*)$/)
      body.push(
        `<div class="row">${rank ? `<span class="rank">${rank[1]}</span>` : ""}` +
          (split
            ? `<span class="lbl">${decorate(split[1])}</span><span class="val">${decorate(split[2])}</span>`
            : `<span class="txt">${decorate(rest)}</span>`) +
          `</div>`,
      )
      continue
    }
    closeSection()
    body.push(`<p class="para">${decorate(line)}</p>`)
  }
  closeSection()

  const w = window.open("", "_blank", "width=900,height=700")
  if (!w) return
  const generated = new Date().toLocaleString("en-AE", { dateStyle: "long", timeStyle: "short" })
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — FHI Global</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; background: #ffffff;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { max-width: 820px; margin: 0 auto; padding: 28px 30px 80px; }
  .band { display: flex; justify-content: space-between; align-items: center; background: #001f3f;
          border-bottom: 4px solid #d6b357; padding: 24px 30px; }
  .band .gold { color: #d6b357; font-size: 10.5px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; }
  .band h1 { color: #ffffff; font-size: 23px; letter-spacing: .5px; margin-top: 5px; }
  .band .period { color: #c7d2e0; font-size: 12.5px; margin-top: 5px; text-transform: capitalize; }
  .mark { flex: 0 0 auto; width: 46px; height: 46px; border: 2px solid #d6b357; color: #d6b357;
          display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; }
  .meta { display: flex; gap: 26px; padding: 10px 30px; background: #f6f8fb; border: 1px solid #e8eaed;
          border-top: 0; font-size: 11.5px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  .section { margin-top: 24px; break-inside: avoid; }
  h2 { font-size: 12.5px; letter-spacing: 1.8px; color: #001f3f; text-transform: uppercase;
       padding-bottom: 6px; border-bottom: 2px solid #d6b357; }
  .row { display: flex; gap: 10px; align-items: baseline; padding: 7.5px 2px; border-bottom: 1px solid #eef1f4;
         font-size: 13px; }
  .rank { flex: 0 0 auto; width: 20px; height: 20px; background: #001f3f; color: #d6b357; font-size: 11px;
          font-weight: 700; display: inline-flex; align-items: center; justify-content: center; align-self: center; }
  .lbl { color: #111827; font-weight: 600; }
  .val { margin-left: auto; text-align: right; color: #374151; }
  .txt { color: #374151; }
  .aed { color: #b8913f; font-weight: 700; }
  .up { color: #157347; font-weight: 600; }
  .down { color: #b02a37; font-weight: 600; }
  .insight { margin-top: 26px; border-left: 4px solid #d6b357; background: #fbf7ee; padding: 12px 16px; }
  .insight span { font-size: 10.5px; font-weight: 800; letter-spacing: 1.5px; color: #b8913f; text-transform: uppercase; }
  .insight p { margin-top: 4px; font-size: 13px; line-height: 1.6; color: #1f2937; }
  .para { margin-top: 14px; font-size: 13px; line-height: 1.7; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10.5px; color: #9ca3af;
          padding: 10px; background: #ffffff; border-top: 1px solid #eef1f4; }
  .foot b { color: #b8913f; }
  @page { margin: 12mm; }
</style></head><body>
  <div class="sheet">
    <div class="band">
      <div>
        <p class="gold">FHI Global Property · FHI Assistant</p>
        <h1>${esc(title)}</h1>
        ${period ? `<p class="period">${esc(period)}</p>` : ""}
      </div>
      <div class="mark">F</div>
    </div>
    <div class="meta"><span>Generated: <strong>${esc(generated)}</strong></span><span>Source: live FHI database &amp; Google Analytics</span></div>
    ${body.join("\n")}
  </div>
  <p class="foot">Generated by FHI Assistant · FHI Global Property · <b>fhiglobal.ae</b></p>
</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
}

/** The conversation survives dashboard navigation: it is kept per browser
 *  tab (sessionStorage) and cleared when the tab closes or via "New chat". */
const CHAT_STORAGE_KEY = "fhi-assistant-chat"

export default function FhiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const copyAnswer = async (i: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(i)
      window.setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1500)
    } catch {
      // Clipboard can be blocked — the export path still works.
    }
  }

  // Restore the tab's conversation after navigating away and back. Restored
  // replies never re-run the typewriter. Deferred a tick so the restore never
  // sets state synchronously inside the effect (avoids cascading renders).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(CHAT_STORAGE_KEY)
        if (!raw) return
        const saved = JSON.parse(raw) as Msg[]
        if (Array.isArray(saved) && saved.length) {
          setMessages((cur) => (cur.length ? cur : saved.map((m) => ({ ...m, typed: true }))))
        }
      } catch {
        // Corrupt or blocked storage — start fresh.
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    // Never delete here: on mount this runs with an empty chat BEFORE the
    // deferred restore reads storage — clearing belongs to "New chat" only.
    if (!messages.length) return
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      // Storage full or blocked — the chat still works, it just won't persist.
    }
  }, [messages])

  const newChat = () => {
    setMessages([])
    setError(null)
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY)
    } catch {}
    inputRef.current?.focus()
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  // Follow the typewriter: while a reply is typing, keep the end in view.
  const isTyping = messages.some((m) => m.typed === false)
  useEffect(() => {
    if (!isTyping) return
    const id = window.setInterval(
      () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      400,
    )
    return () => window.clearInterval(id)
  }, [isTyping])

  const ask = async (raw?: string) => {
    const question = (raw ?? input).trim()
    if (!question || busy) return
    setError(null)
    setInput("")
    const next: Msg[] = [...messages, { role: "user", content: question }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch("/api/admin/fhi-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        used?: string[]
        cards?: Card[]
        names?: string[]
        charts?: ChartSpec[]
        error?: string
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? "FHI Assistant couldn't answer — try again.")
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          content: data.reply ?? "",
          used: data.used,
          cards: data.cards,
          names: data.names,
          charts: data.charts,
          typed: false,
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      // Keep the question in the thread so a retry is one click away.
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <span className="flex h-11 w-11 items-center justify-center bg-[#001f3f]">
          <Sparkles className="h-5 w-5 text-[#d6b357]" />
        </span>
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117] leading-tight">FHI Assistant</h1>
          <p className="text-xs text-[#6b7280]">
            Ask anything about FHI&apos;s data — sales, agents, developers, projects, events. Answers come from live queries.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            disabled={busy}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 border border-[#e5e5e5] bg-white px-3 py-2 text-[12px] font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto border border-[#e5e8ec] bg-white p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8 text-[#d6b357] mb-3" />
            <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Your data, answered.</p>
            <p className="mt-1 text-sm text-[#6b7280] max-w-sm">
              Every number comes from the live database — the same figures as your dashboard, in plain language.
            </p>
            <div className="mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="border border-[#e5e5e5] bg-[#f8fafc] px-3.5 py-2 text-[13px] font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] bg-[#001f3f] px-4 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] min-w-0">
                    {/* One answer block: the typed text and its cards live in
                        the same bubble, not as separate stacked pieces. */}
                    <div className="border border-[#e5e8ec] border-l-2 border-l-[#d6b357] bg-[#fafbfc]">
                      <div className="px-4 py-3 text-sm leading-relaxed text-[#1f2937] whitespace-pre-wrap">
                        {m.typed === false ? (
                          <TypedText
                            text={m.content}
                            names={m.names ?? (m.cards ?? []).map((c) => c.title)}
                            onDone={() =>
                              setMessages((ms) => ms.map((x, xi) => (xi === i ? { ...x, typed: true } : x)))
                            }
                          />
                        ) : (
                          <RichText text={m.content} names={m.names ?? (m.cards ?? []).map((c) => c.title)} />
                        )}
                      </div>
                      {m.typed !== false && m.charts && m.charts.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 border-t border-[#eceef1] px-4 py-3 sm:grid-cols-2">
                          {m.charts.map((c, ci) =>
                            c.kind === "trend" ? (
                              <div key={ci} className="sm:col-span-2">
                                <TrendChart title={c.title} points={c.points} />
                              </div>
                            ) : (
                              <ShareChart key={ci} chart={c} />
                            ),
                          )}
                        </div>
                      )}
                      {m.typed !== false && m.cards && m.cards.length > 0 && (
                        <div className="border-t border-[#eceef1] p-2.5">
                          <CardRow cards={m.cards} />
                        </div>
                      )}
                    </div>
                    {m.typed !== false && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {m.used && m.used.length > 0 && (
                          <p className="text-[11px] text-[#9ca3af]">
                            Checked: {m.used.map((u) => TOOL_LABELS[u] ?? u).join(" · ")}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => void copyAnswer(i, m.content)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9ca3af] hover:text-[#001f3f] transition-colors"
                        >
                          {copiedIdx === i ? <Check className="h-3 w-3 text-[#15803d]" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => exportAnswer(m.content)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9ca3af] hover:text-[#001f3f] transition-colors"
                        >
                          <Printer className="h-3 w-3" /> Export PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                <Loader2 className="h-4 w-4 animate-spin text-[#b8913f]" />
                Checking the numbers…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* One-tap reports — the "one command" professional report. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
          <FileText className="h-3.5 w-3.5" /> Reports
        </span>
        {REPORT_BUTTONS.map((r) => (
          <button
            key={r.label}
            type="button"
            disabled={busy}
            onClick={() => void ask(r.prompt)}
            className="border border-[#001f3f]/20 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10 disabled:opacity-50"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      {error && (
        <p role="alert" className="border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          {error}
        </p>
      )}
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask FHI Assistant — e.g. "Who sold the most this month?"'
          disabled={busy}
          className="w-full border border-[#e5e5e5] px-4 py-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none transition-colors disabled:bg-[#f8fafc]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex shrink-0 items-center gap-2 bg-[#001f3f] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00152b] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>
      <p className="mt-2 text-[11px] text-[#9ca3af]">
        Admin only · answers are computed from the live database at the moment you ask.
      </p>
    </div>
  )
}
