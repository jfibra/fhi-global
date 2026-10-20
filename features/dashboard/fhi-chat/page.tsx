"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, BarChart3, Check, Copy, Download, Globe, Loader2, Monitor, PanelLeft, Printer, RefreshCw, Smartphone, Sparkles, Square, SquarePen, Tablet, Trash2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { BarsChart, PieChart, StatTiles, type ChartSpec, type ShareRow, type StatSpec, type TrendPoint } from "./charts"
import {
  DESIGNS as CARD_DESIGNS,
  DISP_H,
  DISP_W,
  EXPORT_H,
  EXPORT_W,
  isDesignId,
  renderCard,
  type CardData,
  type DesignId,
} from "@/features/business-card/card-render"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import PdfReportMenu from "./pdf-report-menu"
import AnswerBody from "./answer-body"
import ReportCard, { reportSummaryText, type ChatReport } from "./report-card"
import type { ReportPeriodKey } from "@/lib/company-report/data"

/**
 * FHI Assistant — the admin one-stop shop for questions about the business.
 * Ask in plain language; the assistant runs the real database queries
 * server-side and answers with exact figures. Admin staff only.
 */

type Card = {
  kind: "agent" | "developer" | "project" | "poster" | "event"
  title: string
  subtitle?: string
  image?: string | null
  rank?: number
  href?: string | null
  facts?: string[]
}
type PrintCardSpec = {
  member: { name: string; phoneDial: string; phoneLocal: string; email: string; avatarUrl: string | null; initials: string }
  designs: string[]
}
type Msg = {
  role: "user" | "assistant"
  content: string
  used?: string[]
  cards?: Card[]
  names?: string[]
  charts?: ChartSpec[]
  stats?: StatSpec[]
  printCards?: PrintCardSpec[]
  /** A company report drawn as a document (report-card.tsx) instead of text. */
  report?: ChatReport
  /** Still arriving from the server (the words stream in). */
  streaming?: boolean
  /** What the assistant is doing right now — "Checking Top Sales board…". */
  status?: string
  /** The reader pressed Stop; the text is what had arrived by then. */
  stopped?: boolean
  typed?: boolean
  /** When it was sent/received (ISO), shown as a small time. */
  at?: string
}

/**
 * "Full report for today / the last 7 days / this month / last month" — the
 * four periods the company report covers. Anything else (a quarter, custom
 * dates) stays a normal question for the model.
 */
function reportPeriodOf(question: string): ReportPeriodKey | null {
  const q = question.toLowerCase()
  if (!/\b(full|complete|overall|company)\b[^.?!]*\breport\b|^(daily|weekly|monthly) report$/.test(q.trim())) return null
  if (/\btoday\b|^daily/.test(q)) return "today"
  if (/last 7 days|past 7 days|last seven days|this week|^weekly/.test(q)) return "last7"
  if (/last month|previous month/.test(q)) return "last_month"
  if (/this month|month to date|^monthly/.test(q)) return "month"
  return null
}

function CardRow({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {cards.map((c) =>
        c.kind === "event" ? (
          // An event: its banner on top, the date and venue, the figures that matter as chips.
          <a
            key={`${c.kind}:${c.title}`}
            href={c.href ?? undefined}
            target={c.href ? "_blank" : undefined}
            rel="noreferrer"
            className={`group/ev overflow-hidden rounded-xl border border-[#eceef1] bg-white transition-colors ${c.href ? "hover:border-[#d6b357]" : ""} ${c.facts && c.facts.length > 3 ? "sm:col-span-2" : ""}`}
          >
            <div className="relative aspect-[16/7] w-full overflow-hidden bg-[#001f3f]">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt={c.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover/ev:scale-[1.03]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-['Outfit'] text-2xl font-bold text-[#d6b357]">{c.title.charAt(0).toUpperCase()}</span>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">Event</span>
            </div>
            <div className="px-3 py-2.5">
              <p className="line-clamp-2 font-['Outfit'] text-[13.5px] font-bold leading-snug text-[#0d1117]">{c.title}</p>
              {c.subtitle && <p className="mt-0.5 truncate text-[11.5px] text-[#6b7280]">{c.subtitle}</p>}
              {c.facts && c.facts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.facts.map((f) => (
                    <span key={f} className="rounded-full border border-[#e8eaed] bg-[#f6f7f9] px-2 py-0.5 text-[10.5px] font-semibold text-[#374151]">{f}</span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ) : c.kind === "poster" ? (
          // A generated poster: shown big, opens full size for download/share.
          <a
            key={`${c.kind}:${c.title}`}
            href={c.image ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 border border-[#eceef1] bg-white p-3 transition-colors hover:border-[#d6b357]"
          >
            {c.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.image}
                alt={`Poster: ${c.title}`}
                loading="lazy"
                className="h-auto w-full max-w-[220px] border border-[#e7d9a8]"
              />
            )}
            <div className="text-center">
              <p className="text-[13px] font-bold text-[#0d1117]">{c.title}</p>
              {c.subtitle && <p className="text-[11.5px] text-[#6b7280]">{c.subtitle}</p>}
            </div>
          </a>
        ) : (
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
        ),
      )}
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

/** Printable business card faces — drawn in the browser with the SAME canvas
 *  renderer as the Business Card maker (pixel-identical), so front and back of
 *  every design work here, with print-size downloads. */
function PrintBusinessCards({ spec }: { spec: PrintCardSpec }) {
  const [faces, setFaces] = useState<Record<string, { front: string; back: string }>>({})
  const designs = spec.designs.filter(isDesignId)
  const data: CardData = {
    name: spec.member.name,
    phoneDial: spec.member.phoneDial,
    phoneLocal: spec.member.phoneLocal,
    email: spec.member.email,
    // Remote S3/Google photos go through the image proxy so the canvas can
    // export without tainting — same trick as the poster maker.
    avatarUrl:
      spec.member.avatarUrl && isSafeRemoteImageUrl(spec.member.avatarUrl)
        ? `/api/image-proxy?url=${encodeURIComponent(spec.member.avatarUrl)}`
        : spec.member.avatarUrl,
    initials: spec.member.initials,
  }
  const dataKey = JSON.stringify(spec)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const out: Record<string, { front: string; back: string }> = {}
      for (const id of designs) {
        try {
          const [front, back] = await Promise.all([
            renderCard("front", id, data, DISP_W, DISP_H),
            renderCard("back", id, data, DISP_W, DISP_H),
          ])
          out[id] = { front, back }
          if (alive) setFaces({ ...out })
        } catch {
          // One failed design must not blank the rest.
        }
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  const download = async (id: DesignId, side: "front" | "back") => {
    const url = await renderCard(side, id, data, EXPORT_W, EXPORT_H)
    const a = document.createElement("a")
    a.href = url
    a.download = `business-card-${id}-${side}-${spec.member.name.replace(/\s+/g, "-").toLowerCase()}.png`
    a.click()
  }

  return (
    <div className="space-y-4">
      {designs.map((id) => {
        const d = CARD_DESIGNS.find((x) => x.id === id)
        const f = faces[id]
        return (
          <div key={id}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">
              {d?.name ?? id} — {spec.member.name}
            </p>
            {f ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["front", "back"] as const).map((side) => (
                  <div key={side} className="border border-[#eceef1] bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f[side]} alt={`${d?.name ?? id} ${side}`} className="h-auto w-full" />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{side}</span>
                      <button
                        type="button"
                        onClick={() => void download(id, side)}
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#001f3f] hover:text-[#8a6d2a]"
                      >
                        <Download className="h-3.5 w-3.5" /> Download print size
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center border border-[#eceef1] bg-white text-[12px] text-[#9ca3af]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering…
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The first screen: one question per line, grouped by what the admin runs. */
const SUGGESTION_GROUPS = [
  { label: "Sales", items: ["Who are the top agents this year?", "How are sales growing month by month?", "Anything waiting for validation?"] },
  { label: "Leads", items: ["How many leads did we get this month?", "Any unanswered inquiries?", "Priority buyers from Buyers Link?"] },
  { label: "Projects", items: ["Cheapest 1-bedroom in JVC?", "Azizi projects handing over in 2027?", "Tell me about Azizi Venice"] },
  { label: "People", items: ["Who has the most reviews?", "Who hasn't sold anything this year?", "Whose birthday is coming up?"] },
  { label: "Website & events", items: ["How many website visits this week?", "How did the Career Summit go?", "What do people search on Google to find us?"] },
  { label: "Reports", items: ["Give me the full report for this month", "Sales report for last quarter", "What happened today?"] },
] as const

/** Markdown the model sometimes emits mid-stream — the final reply arrives cleaned by the server. */
const liveClean = (t: string) => t.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").replace(/`/g, "")

/** One-tap professional reports — each sends a preset question. */
const REPORT_BUTTONS = [
  { label: "Daily Report", prompt: "Give me the full report for today" },
  { label: "Weekly Report", prompt: "Give me the full report for the last 7 days" },
  { label: "Monthly Report", prompt: "Give me the full report for this month" },
] as const

/** Tool names → human wording for the tiny "checked" line. */
const TOOL_LABELS: Record<string, string> = {
  // The agent assistant's own tools (lib/fhi-agent-chat-tools.ts).
  my_sales: "Your sales",
  top_sales_board: "Top Sales board",
  my_leads: "Your leads",
  my_listings: "Your listings",
  my_website: "Your website",
  my_reviews: "Your reviews",
  my_recruits: "Your recruits",
  my_team: "Your team",
  my_events: "Your events",
  person_sales: "Sales lookup",
  top_agents: "Top Sales board",
  top_developers: "Top Developers board",
  top_teams: "Team Sales board",
  sales_summary: "Sales totals",
  agent_sales: "Agent record",
  agent_recruits: "Recruits",
  agent_network: "Network",
  developer_overview: "Developer portfolio",
  projects_stats: "Project counts",
  find_projects: "Projects",
  project_details: "Project details",
  platform_counts: "Platform KPIs",
  recent_sales: "Recent sales",
  sales_pipeline: "Sales pipeline",
  leads_overview: "Leads",
  events_overview: "Events",
  event_attendees: "Event registrations",
  event_engagement: "Event stats",
  new_accounts: "New sign-ups",
  website_traffic: "Google Analytics",
  search_keywords: "Google Search Console",
  activity_feed: "Activity feed",
  activity_log: "Activity log",
  upcoming_birthdays: "Birthday calendar",
  birthday_poster: "Poster studio",
  meeting_poster: "Poster studio",
  business_card: "Business cards",
  print_business_card: "Card designer",
  send_email: "Email sender",
  congratulate_top_agents: "Congratulations mailer",
  support_tickets: "Support",
  company_purchases: "Purchases",
  agent_websites: "Agent websites",
  listings_overview: "Listings",
  clients_overview: "Clients",
  agent_reviews: "Reviews",
  member_lookup: "Member lookup",
  owner_documents: "Owner documents",
  teams_detail: "Teams",
  news_overview: "Website news",
  data_health: "Data health",
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

type Quota = { used: number; limit: number | null; resetsAt: string }
type ConversationRow = { id: string; title: string; updated_at: string }

/** The same chat for two assistants: the admin one (defaults) and the
 *  agent/TL one (features/dashboard/fhi-chat/agent-page.tsx), which points at
 *  its own endpoint, suggestions and a daily question counter. */
export type FhiChatPageProps = {
  endpoint?: string
  /** Which history list the conversations belong to (migration 081). */
  audience?: "admin" | "agent"
  /** sessionStorage key for the conversation open in this tab. */
  storageKey?: string
  subtitle?: string
  intro?: { title: string; text: string }
  suggestions?: ReadonlyArray<{ label: string; items: ReadonlyArray<string> }>
  reports?: ReadonlyArray<{ label: string; prompt: string }>
  placeholder?: string
  footnote?: string
  /** Show "N of M questions left today" from the endpoint's GET and each answer. */
  quota?: boolean
  /** A small link in the header (the admin assistant links to the agents' usage page). */
  headerLink?: { href: string; label: string }
  /** The company-report PDF endpoint — shows the "PDF report" menu beside the report buttons (admin only). */
  pdfReport?: string
}

/** History list sections, newest first — "Today", "Yesterday", "Previous 7 days", "Older". */
function groupByDay(rows: ConversationRow[]): Array<{ label: string; rows: ConversationRow[] }> {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = day(new Date())
  const groups: Record<string, ConversationRow[]> = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] }
  for (const r of rows) {
    const diff = Math.round((today - day(new Date(r.updated_at))) / 86400000)
    groups[diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : diff <= 7 ? "Previous 7 days" : "Older"].push(r)
  }
  return Object.entries(groups).filter(([, rs]) => rs.length).map(([label, rs]) => ({ label, rows: rs }))
}

/**
 * FHI Assistant in a ChatGPT / Claude-style layout (boss via Juliecor,
 * 2026-10-16): the chat fills the content area (the dashboard shell drops its
 * padding for [data-chat-full]); past conversations in a side list saved to
 * the person's account (app/api/assistant/conversations, migration 081); one
 * centred reading column; questions in a soft bubble, answers as plain text
 * with a small FHI mark; a growing composer (Enter sends, Shift+Enter breaks
 * the line) whose send button becomes Stop while an answer streams;
 * Copy / Regenerate under answers; a jump-to-latest button when scrolled up.
 */
export default function FhiChatPage({
  endpoint = "/api/admin/fhi-chat",
  audience = "admin",
  storageKey = CHAT_STORAGE_KEY,
  subtitle = "Ask anything about FHI's data. Every figure comes from the live database.",
  intro = { title: "Your data, answered.", text: "Sales, leads, projects, people, the website — the same figures as your dashboard, in plain language, with charts." },
  suggestions = SUGGESTION_GROUPS,
  reports = REPORT_BUTTONS,
  placeholder = "Ask FHI Assistant anything…",
  footnote = "Admin only · answers are computed from the live database at the moment you ask.",
  quota: showQuota = false,
  headerLink,
  pdfReport,
}: FhiChatPageProps = {}) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Msg[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const exhausted = Boolean(quota && quota.limit !== null && quota.used >= quota.limit)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Persistence bookkeeping: what was last saved, and an in-flight create.
  const savedSigRef = useRef("")
  const creatingRef = useRef<Promise<string | null> | null>(null)
  const idRef = useRef<string | null>(null)

  const listUrl = `/api/assistant/conversations?audience=${audience}`
  const oneUrl = (id: string) => `/api/assistant/conversations/${id}?audience=${audience}`

  const copyAnswer = async (i: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(i)
      window.setTimeout(() => setCopiedIdx((cur) => (cur === i ? null : cur)), 1500)
    } catch {
      // Clipboard can be blocked — the export path still works.
    }
  }

  // History list + the conversation this tab had open. Deferred a tick so
  // nothing sets state synchronously inside the effect.
  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(() => {
      fetch(listUrl, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { conversations: [] }))
        .then((j: { conversations?: ConversationRow[] }) => { if (!cancelled) setConversations(j.conversations ?? []) })
        .catch(() => { if (!cancelled) setConversations([]) })
      let active: string | null = null
      try {
        active = sessionStorage.getItem(storageKey)
      } catch {}
      if (active && /^[0-9a-f-]{36}$/i.test(active)) {
        fetch(`/api/assistant/conversations/${active}?audience=${audience}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((c: { id: string; messages: Msg[] } | null) => {
            if (cancelled || !c) return
            const restored = (c.messages ?? []).filter((m) => !m.streaming).map((m) => ({ ...m, typed: true }))
            savedSigRef.current = JSON.stringify(restored)
            idRef.current = c.id
            setConversationId(c.id)
            setMessages((cur) => (cur.length ? cur : restored))
          })
          .catch(() => {})
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [listUrl, storageKey, audience])

  // The daily counter, for the agent assistant.
  useEffect(() => {
    if (!showQuota) return
    let cancelled = false
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { quota?: Quota }) => {
        if (!cancelled && j.quota) setQuota(j.quota)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [showQuota, endpoint])

  // Save the thread to the person's history once an answer is complete:
  // the first save creates the conversation, later ones update it.
  useEffect(() => {
    if (!messages.length || busy || messages.some((m) => m.streaming)) return
    const sig = JSON.stringify(messages)
    if (sig === savedSigRef.current) return
    const t = window.setTimeout(async () => {
      savedSigRef.current = sig
      try {
        let id = idRef.current
        if (!id && creatingRef.current) id = await creatingRef.current
        if (!id) {
          creatingRef.current = fetch(listUrl.split("?")[0], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience, messages }) })
            .then((r) => (r.ok ? r.json() : null))
            .then((row: ConversationRow | null) => {
              if (!row) return null
              idRef.current = row.id
              setConversationId(row.id)
              setConversations((cs) => [row, ...(cs ?? []).filter((c) => c.id !== row.id)])
              try {
                sessionStorage.setItem(storageKey, row.id)
              } catch {}
              return row.id
            })
            .catch(() => null)
          await creatingRef.current
          creatingRef.current = null
          return
        }
        const res = await fetch(oneUrl(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience, messages }) })
        const row = res.ok ? ((await res.json()) as ConversationRow) : null
        if (row) setConversations((cs) => [row, ...(cs ?? []).filter((c) => c.id !== row.id)])
      } catch {
        savedSigRef.current = ""
      }
    }, 400)
    return () => window.clearTimeout(t)
    // oneUrl/listUrl derive from audience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy, audience, storageKey])

  const newChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setConversationId(null)
    idRef.current = null
    savedSigRef.current = ""
    setHistoryOpen(false)
    try {
      sessionStorage.removeItem(storageKey)
    } catch {}
    inputRef.current?.focus()
  }

  const openConversation = async (id: string) => {
    if (busy) return
    setHistoryOpen(false)
    setError(null)
    try {
      const res = await fetch(oneUrl(id), { cache: "no-store" })
      if (!res.ok) throw new Error()
      const c = (await res.json()) as { id: string; messages: Msg[] }
      const restored = (c.messages ?? []).filter((m) => !m.streaming).map((m) => ({ ...m, typed: true }))
      savedSigRef.current = JSON.stringify(restored)
      idRef.current = c.id
      setConversationId(c.id)
      setMessages(restored)
      try {
        sessionStorage.setItem(storageKey, c.id)
      } catch {}
      window.setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 0)
    } catch {
      setError("Couldn't open that chat — try again.")
    }
  }

  const deleteConversation = async (id: string) => {
    setConfirmDelete(null)
    setConversations((cs) => (cs ?? []).filter((c) => c.id !== id))
    if (id === conversationId) newChat()
    try {
      await fetch(oneUrl(id), { method: "DELETE" })
    } catch {}
  }

  // Scrolling, the way ChatGPT does it: while the reader sits at the bottom,
  // the thread STAYS at the bottom whenever it grows — streamed words, and the
  // tiles, charts and photo cards that land when an answer finishes (they
  // used to leave the view stranded mid-answer) and the reports, which follow
  // down as their figures and then their advice arrive. Scrolling up lets go.
  const stickRef = useRef(true)
  const contentRef = useRef<HTMLDivElement | null>(null)
  // Only the reader's own hand lets go (wheel or swipe up, Page Up / Home /
  // arrows, grabbing the scrollbar) — never the browser's own scroll
  // adjustments while a report or answer reflows, which used to unstick it
  // (a report stopped short of its recommendations). Reaching the bottom again
  // sticks it back.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (near) stickRef.current = true
    setAtBottom(near)
  }
  const touchY = useRef<number | null>(null)
  const letGo = () => {
    stickRef.current = false
  }
  const toBottom = (smooth = true) => {
    stickRef.current = true
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  }
  const messageCount = messages.length
  const hasThread = messageCount > 0
  useEffect(() => {
    const t = window.setTimeout(() => toBottom(true), 0)
    return () => window.clearTimeout(t)
  }, [messageCount])
  useEffect(() => {
    const content = contentRef.current
    const box = scrollRef.current
    if (!hasThread || !content || !box || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      if (!stickRef.current) return
      box.scrollTop = box.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [hasThread])

  // The composer grows with its text, up to a limit.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const stop = () => abortRef.current?.abort()

  const ask = async (raw?: string, base?: Msg[]) => {
    const question = (raw ?? input).trim()
    if (!question || busy || exhausted) return
    setError(null)
    if (raw === undefined) setInput("")
    const next: Msg[] = [...(base ?? messages), { role: "user", content: question, at: new Date().toISOString() }]
    setMessages(next)
    setBusy(true)
    setAtBottom(true)
    const controller = new AbortController()
    abortRef.current = controller
    const aborted = (e: unknown) => e instanceof DOMException && e.name === "AbortError"
    // The full company report: the same document as the PDF, drawn in the chat.
    const reportKey = pdfReport ? reportPeriodOf(question) : null
    if (reportKey && pdfReport) {
      // In stages: a status at once, the figures as soon as they are counted,
      // then the takeaways and recommendations when the model has written them.
      const patchReport = (patch: (m: Msg) => Msg) =>
        setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 && m.streaming ? patch(m) : m)))
      setMessages((ms) => [...ms, { role: "assistant", content: "", streaming: true, status: "Collecting sales, teams, recruitment, leads and website…", typed: true, at: new Date().toISOString() }])
      try {
        const res = await fetch(`${pdfReport}?period=${reportKey}&format=json`, { cache: "no-store", headers: { Accept: "text/event-stream" }, signal: controller.signal })
        type ReportJson = Partial<Pick<ChatReport, "insights">> & { report?: ChatReport["data"]; error?: string }
        if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
          const data = (await res.json().catch(() => ({}))) as ReportJson
          if (!res.ok || !data.report || !data.insights) throw new Error(data.error ?? "Couldn't build the report — try again.")
          const report: ChatReport = { period: reportKey, data: data.report, insights: data.insights }
          patchReport((m) => ({ ...m, content: reportSummaryText(report), report, streaming: false, status: undefined }))
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finished = false
        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let cut: number
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const line = buffer.slice(0, cut).trim()
            buffer = buffer.slice(cut + 2)
            if (!line.startsWith("data:")) continue
            const ev = JSON.parse(line.slice(5)) as { type: string; text?: string; error?: string; report?: ChatReport["data"]; insights?: ChatReport["insights"] }
            if (ev.type === "status") patchReport((m) => ({ ...m, status: ev.text ?? m.status }))
            else if (ev.type === "report" && ev.report) {
              const data = ev.report
              patchReport((m) => ({ ...m, report: { period: reportKey, data, insights: null } }))
            } else if (ev.type === "insights" && ev.insights) {
              const insights = ev.insights
              patchReport((m) => {
                if (!m.report) return m
                const report = { ...m.report, insights }
                return { ...m, report, content: reportSummaryText(report), streaming: false, status: undefined }
              })
            } else if (ev.type === "done") finished = true
            else if (ev.type === "error") throw new Error(ev.error ?? "Couldn't build the report — try again.")
          }
        }
        if (!finished) throw new Error("The report was cut off — try again.")
      } catch (e) {
        // Figures already on screen stay (without the advice); a report that never arrived is dropped.
        setMessages((ms) => {
          const last = ms[ms.length - 1]
          if (!last?.streaming) return ms
          if (last.report) return [...ms.slice(0, -1), { ...last, content: reportSummaryText(last.report), streaming: false, status: undefined, stopped: aborted(e) }]
          return ms.slice(0, -1)
        })
        if (!aborted(e)) setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        abortRef.current = null
        setBusy(false)
        inputRef.current?.focus()
      }
      return
    }
    // The live answer: the reply appears at once with a status line, then the
    // words stream in as the model writes them (lib/fhi-chat-stream.ts).
    const patchLive = (patch: (m: Msg) => Msg) =>
      setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 && m.streaming ? patch(m) : m)))
    let liveText = ""
    let flushTimer: number | null = null
    setMessages((ms) => [...ms, { role: "assistant", content: "", streaming: true, status: "Thinking…", typed: true, at: new Date().toISOString() }])
    const flush = () => {
      flushTimer = null
      const text = liveText
      patchLive((m) => ({ ...m, content: text }))
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      })
      type Final = { reply?: string; used?: string[]; cards?: Card[]; names?: string[]; charts?: ChartSpec[]; stats?: StatSpec[]; printCards?: PrintCardSpec[]; error?: string; quota?: Quota }
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        // Refused before streaming (sign-in, the daily limit…) or an old server: one JSON object.
        const data = (await res.json().catch(() => ({}))) as Final
        if (data.quota) setQuota(data.quota)
        if (!res.ok || !data.reply) throw new Error(data.error ?? "FHI Assistant couldn't answer — try again.")
        patchLive((m) => ({ ...m, content: data.reply ?? "", used: data.used, cards: data.cards, names: data.names, charts: data.charts, stats: data.stats, printCards: data.printCards, streaming: false, status: undefined }))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let finished = false
      while (!finished) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let cut: number
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, cut).trim()
          buffer = buffer.slice(cut + 2)
          if (!line.startsWith("data:")) continue
          const ev = JSON.parse(line.slice(5)) as { type: string; text?: string; tools?: string[]; error?: string; quota?: Quota } & Final
          if (ev.type === "status") {
            const labels = [...new Set((ev.tools ?? []).map((t) => TOOL_LABELS[t] ?? t.replace(/_/g, " ")))]
            patchLive((m) => ({ ...m, status: labels.length ? `Checking ${labels.join(", ")}…` : "Thinking…" }))
          } else if (ev.type === "delta") {
            liveText += ev.text ?? ""
            if (flushTimer === null) flushTimer = window.setTimeout(flush, 50)
          } else if (ev.type === "reset") {
            liveText = ""
            patchLive((m) => ({ ...m, content: "" }))
          } else if (ev.type === "done") {
            if (flushTimer !== null) window.clearTimeout(flushTimer)
            if (ev.quota) setQuota(ev.quota)
            patchLive((m) => ({ ...m, content: ev.reply ?? liveText, used: ev.used, cards: ev.cards, names: ev.names, charts: ev.charts, stats: ev.stats, printCards: ev.printCards, streaming: false, status: undefined }))
            finished = true
          } else if (ev.type === "error") {
            if (ev.quota) setQuota(ev.quota)
            throw new Error(ev.error ?? "FHI Assistant couldn't answer — try again.")
          }
        }
      }
      if (!finished) throw new Error("The answer was cut off — try again.")
    } catch (e) {
      if (flushTimer !== null) window.clearTimeout(flushTimer)
      if (aborted(e)) {
        // Stopped: keep what was written so far, like ChatGPT; nothing written → drop the bubble.
        const text = liveText
        setMessages((ms) => {
          const last = ms[ms.length - 1]
          if (!last?.streaming) return ms
          return text.trim() ? [...ms.slice(0, -1), { ...last, content: text, streaming: false, status: undefined, stopped: true }] : ms.slice(0, -1)
        })
      } else {
        // Drop a half-written answer; keep the question so a retry is one click away.
        setMessages((ms) => (ms[ms.length - 1]?.streaming ? ms.slice(0, -1) : ms))
        setError(e instanceof Error ? e.message : "Something went wrong.")
      }
    } finally {
      abortRef.current = null
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  /** Ask the last question again, replacing the answer after it. */
  const regenerate = () => {
    if (busy) return
    let lastUser = -1
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") { lastUser = i; break }
    if (lastUser < 0) return
    void ask(messages[lastUser].content, messages.slice(0, lastUser))
  }

  const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" }) : null)
  const hour = new Date().getHours()
  const firstName = (profile?.fullname ?? "").trim().split(/\s+/)[0] ?? ""
  const greeting = `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}${firstName ? `, ${firstName}` : ""}.`
  const activeTitle = conversations?.find((c) => c.id === conversationId)?.title
  const lastAssistant = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i
    return -1
  })()

  // ── Pieces ────────────────────────────────────────────────────────────────
  const history = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <button type="button" onClick={newChat} className="flex w-full items-center gap-2 rounded-xl border border-[#e3e6ea] bg-white px-3 py-2.5 text-[13.5px] font-semibold text-[#001f3f] shadow-sm transition-colors hover:border-[#d6b357]">
          <SquarePen className="h-4 w-4" /> New chat
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Your chats">
        {conversations === null ? (
          <div className="space-y-2 px-2 pt-2">{[0, 1, 2, 3].map((i) => <span key={i} className="block h-7 animate-pulse rounded-lg bg-[#eceff3]" />)}</div>
        ) : conversations.length === 0 ? (
          <p className="px-3 pt-2 text-[12.5px] leading-relaxed text-[#9ca3af]">Your chats will appear here. Every conversation is saved to your account.</p>
        ) : (
          groupByDay(conversations).map((g) => (
            <div key={g.label} className="mt-3 first:mt-1">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">{g.label}</p>
              {g.rows.map((c) => (
                <div key={c.id} className={`group/item relative flex items-center rounded-lg ${c.id === conversationId ? "bg-[#e9edf3]" : "hover:bg-[#eef1f5]"}`}>
                  {confirmDelete === c.id ? (
                    <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                      <span className="font-semibold text-[#b91c1c]">Delete this chat?</span>
                      <span className="flex gap-1.5">
                        <button type="button" onClick={() => void deleteConversation(c.id)} className="rounded-md bg-[#b91c1c] px-2 py-0.5 text-[11.5px] font-bold text-white">Delete</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-[#6b7280] hover:bg-white">Cancel</button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={() => void openConversation(c.id)} className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-[13.5px] ${c.id === conversationId ? "font-semibold text-[#001f3f]" : "text-[#374151]"}`} title={c.title}>
                        {c.title}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(c.id)} aria-label={`Delete ${c.title}`} className="mr-1.5 block rounded-md p-1 text-[#9ca3af] hover:bg-white hover:text-[#b91c1c] lg:hidden lg:group-hover/item:block">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </nav>
    </div>
  )

  const composer = (
    <div className="w-full">
      {error && (
        <p role="alert" className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
        className="rounded-[26px] border border-[#dfe3e8] bg-white p-2 shadow-[0_8px_30px_-12px_rgba(0,31,63,0.25)] transition-colors focus-within:border-[#c9ced6]"
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void ask()
            }
          }}
          placeholder={exhausted ? "You've used today's questions — back at midnight Dubai time." : placeholder}
          disabled={exhausted}
          maxLength={1000}
          aria-label="Message FHI Assistant"
          className="block max-h-[200px] w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[15px] leading-6 text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {reports.map((r) => (
              <button
                key={r.label}
                type="button"
                disabled={busy || exhausted}
                onClick={() => void ask(r.prompt)}
                className="rounded-full border border-[#e3e6ea] px-2.5 py-1 text-[12px] font-semibold text-[#374151] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10 hover:text-[#001f3f] disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
            {pdfReport && <PdfReportMenu endpoint={pdfReport} disabled={busy} />}
          </div>
          {busy ? (
            <button type="button" onClick={stop} aria-label="Stop answering" title="Stop" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-white transition-colors hover:bg-[#0b3a68]">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || exhausted} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-white transition-colors hover:bg-[#0b3a68] disabled:bg-[#d5dbe3]">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-[#9ca3af]">{footnote}</p>
    </div>
  )

  return (
    <div data-chat-full className="flex h-full min-h-0 bg-[#f7f8fa]">
      {/* History — a column on wide screens, a drawer on phones. */}
      <aside className="hidden w-64 shrink-0 border-r border-[#e8eaed] bg-[#f1f3f6] lg:block">{history}</aside>
      {historyOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close chats" onClick={() => setHistoryOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-[#f1f3f6] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e3e6ea] px-4 py-3">
              <span className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">Your chats</span>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close" className="rounded-lg p-1 text-[#6b7280] hover:bg-white"><X className="h-4 w-4" /></button>
            </div>
            {history}
          </aside>
        </div>
      )}

      <section className="relative flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#eceef1] bg-white/70 px-3 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Your chats" className="rounded-lg p-2 text-[#374151] hover:bg-[#f1f3f6] lg:hidden"><PanelLeft className="h-4.5 w-4.5" /></button>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#001f3f]"><Sparkles className="h-3.5 w-3.5 text-[#d6b357]" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-['Outfit'] text-[14.5px] font-bold leading-tight text-[#0d1117]">{messages.length && activeTitle ? activeTitle : "FHI Assistant"}</p>
            <p className="hidden truncate text-[11.5px] text-[#9ca3af] sm:block">{subtitle}</p>
          </div>
          {quota && quota.limit !== null && (
            <span title="Questions you can still ask today — the counter resets at midnight Dubai time." className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${exhausted ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#e3e6ea] text-[#6b7280]"}`}>
              {Math.max(0, quota.limit - quota.used)} of {quota.limit} left today
            </span>
          )}
          {headerLink && (
            <Link href={headerLink.href} className="hidden shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#374151] transition-colors hover:bg-[#f1f3f6] sm:inline-flex">
              <BarChart3 className="h-3.5 w-3.5" /> {headerLink.label}
            </Link>
          )}
          <button type="button" onClick={newChat} aria-label="New chat" title="New chat" className="rounded-lg p-2 text-[#374151] transition-colors hover:bg-[#f1f3f6]"><SquarePen className="h-4.5 w-4.5" /></button>
        </header>

        {messages.length === 0 ? (
          /* Welcome: greeting, the composer in the middle, suggestions under it. */
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
              <div className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#001f3f] shadow-[0_10px_24px_-10px_rgba(0,31,63,0.6)]"><Sparkles className="h-6 w-6 text-[#d6b357]" /></span>
                <h1 className="mt-4 font-['Outfit'] text-[28px] font-bold leading-tight text-[#0d1117] sm:text-[32px]">{greeting}</h1>
                <p className="mx-auto mt-1.5 max-w-lg text-[14.5px] leading-relaxed text-[#6b7280]">{intro.text}</p>
              </div>
              <div className="mt-7">{composer}</div>
              <div className="mt-6 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((g) => (
                  <div key={g.label}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">{g.label}</p>
                    <div className="space-y-1.5">
                      {g.items.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy || exhausted}
                          onClick={() => void ask(s)}
                          className="block w-full rounded-xl border border-[#e8eaed] bg-white px-3 py-2 text-left text-[13px] text-[#1f2937] transition-colors hover:border-[#d6b357] hover:bg-[#fffaf0] disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Thread */}
            <div
              ref={scrollRef}
              onScroll={onScroll}
              onWheel={(e) => { if (e.deltaY < 0) letGo() }}
              onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null }}
              onTouchMove={(e) => {
                const y = e.touches[0]?.clientY
                // A finger moving down scrolls the thread up.
                if (touchY.current !== null && y !== undefined && y - touchY.current > 6) letGo()
              }}
              onKeyDown={(e) => { if (["PageUp", "ArrowUp", "Home"].includes(e.key)) letGo() }}
              onPointerDown={(e) => { if (e.target === e.currentTarget) letGo() }}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div ref={contentRef} className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-8 pt-6 sm:px-6">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#e9edf3] px-4 py-2.5 text-[15px] leading-relaxed text-[#0d1117]">{m.content}</p>
                    </div>
                  ) : (
                    <div key={i} id={`chat-msg-${i}`} className="group flex scroll-mt-4 gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#001f3f]"><Sparkles className="h-3.5 w-3.5 text-[#d6b357]" /></span>
                      <div className="min-w-0 flex-1">
                        {m.report && pdfReport ? (
                          <div className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_8px_28px_-16px_rgba(0,31,63,0.28)]">
                            <ReportCard report={m.report} pdfEndpoint={pdfReport} />
                          </div>
                        ) : m.streaming && !m.content ? (
                          <p className="inline-flex items-center gap-2.5 pt-1 text-[14px] text-[#6b7280]" aria-live="polite">
                            <span className="flex items-center gap-1" aria-hidden>
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357] [animation-delay:-0.3s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357] [animation-delay:-0.15s]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357]" />
                            </span>
                            {m.status ?? "Thinking…"}
                          </p>
                        ) : (
                          <>
                            {m.stats && m.stats.length > 1 && (
                              <div className="mb-3">
                                <StatTiles stats={m.stats} />
                              </div>
                            )}
                            <div className="text-[15px] leading-7 text-[#1f2937]">
                              <AnswerBody text={m.streaming ? liveClean(m.content) : m.content} names={m.names ?? (m.cards ?? []).map((c) => c.title)} />
                              {m.streaming && <span className="mt-1 inline-block h-[1em] w-[2px] animate-pulse bg-[#d6b357] align-middle" aria-hidden="true" />}
                            </div>
                            {!m.streaming && m.charts && m.charts.length > 0 && (
                              <div className="mt-4 grid gap-x-8 gap-y-5 rounded-2xl border border-[#eceef1] bg-white px-5 py-4 sm:grid-cols-2">
                                {m.charts.map((c, ci) =>
                                  c.kind === "trend" ? (
                                    <div key={ci} className="sm:col-span-2">
                                      <TrendChart title={c.title} points={c.points} />
                                    </div>
                                  ) : c.kind === "bars" ? (
                                    <div key={ci} className={c.points.length > 6 ? "sm:col-span-2" : ""}>
                                      <BarsChart title={c.title} points={c.points} />
                                    </div>
                                  ) : c.kind === "pie" ? (
                                    <PieChart key={ci} title={c.title} rows={c.rows} />
                                  ) : (
                                    <ShareChart key={ci} chart={c} />
                                  ),
                                )}
                              </div>
                            )}
                            {!m.streaming && m.printCards && m.printCards.length > 0 && (
                              <div className="mt-4 space-y-4">
                                {m.printCards.map((pc, pi) => (
                                  <PrintBusinessCards key={pi} spec={pc} />
                                ))}
                              </div>
                            )}
                            {!m.streaming && m.cards && m.cards.length > 0 && (
                              <div className="mt-4">
                                <CardRow cards={m.cards} />
                              </div>
                            )}
                          </>
                        )}
                        {!m.streaming && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[#6b7280]">
                            <button type="button" onClick={() => void copyAnswer(i, m.content)} title="Copy" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[#eef1f5] hover:text-[#001f3f]">
                              {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-[#15803d]" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedIdx === i ? "Copied" : "Copy"}
                            </button>
                            {i === lastAssistant && !busy && (
                              <button type="button" onClick={regenerate} title="Ask again" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[#eef1f5] hover:text-[#001f3f]">
                                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                              </button>
                            )}
                            {!m.report && (
                              <button type="button" onClick={() => exportAnswer(m.content)} title="Export as PDF" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[#eef1f5] hover:text-[#001f3f]">
                                <Printer className="h-3.5 w-3.5" /> Export PDF
                              </button>
                            )}
                            {m.stopped && <span className="ml-1 text-[11.5px] italic text-[#9ca3af]">Stopped</span>}
                            {m.used && m.used.length > 0 && (
                              <span className="ml-1 flex flex-wrap items-center gap-1">
                                {[...new Set(m.used.map((u) => TOOL_LABELS[u] ?? u.replace(/_/g, " ")))].map((label) => (
                                  <span key={label} className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[10.5px] font-semibold text-[#6b7280]">{label}</span>
                                ))}
                              </span>
                            )}
                            {m.at && <span className="ml-auto text-[11px] text-[#b0b7c3] opacity-0 transition-opacity group-hover:opacity-100">{timeOf(m.at)}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {!atBottom && (
              <button type="button" onClick={() => toBottom(true)} aria-label="Jump to the latest message" className="absolute bottom-[132px] left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[#e3e6ea] bg-white text-[#374151] shadow-md transition-colors hover:text-[#001f3f]">
                <ArrowDown className="h-4 w-4" />
              </button>
            )}

            {/* Composer */}
            <div className="shrink-0 bg-gradient-to-t from-[#f7f8fa] via-[#f7f8fa] to-[#f7f8fa]/0 px-4 pb-3 pt-2 sm:px-6">
              <div className="mx-auto max-w-3xl">{composer}</div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
