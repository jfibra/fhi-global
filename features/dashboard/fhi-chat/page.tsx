"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BarChart3, Check, Copy, Download, FileText, Globe, Loader2, Monitor, Printer, RotateCcw, Send, Smartphone, Sparkles, Tablet } from "lucide-react"
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

/**
 * FHI Assistant — the admin one-stop shop for questions about the business.
 * Ask in plain language; the assistant runs the real database queries
 * server-side and answers with exact figures. Admin staff only.
 */

type Card = {
  kind: "agent" | "developer" | "project" | "poster"
  title: string
  subtitle?: string
  image?: string | null
  rank?: number
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
  typed?: boolean
  /** When it was sent/received (ISO), shown as a small time. */
  at?: string
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
      {cards.map((c) =>
        c.kind === "poster" ? (
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

/** The same chat for two assistants: the admin one (defaults) and the
 *  agent/TL one (features/dashboard/fhi-chat/agent-page.tsx), which points at
 *  its own endpoint, suggestions and a daily question counter. */
export type FhiChatPageProps = {
  endpoint?: string
  storageKey?: string
  subtitle?: string
  intro?: { title: string; text: string }
  suggestions?: ReadonlyArray<{ label: string; items: ReadonlyArray<string> }>
  reports?: ReadonlyArray<{ label: string; prompt: string }>
  placeholder?: string
  footnote?: string
  /** Show "N of M questions left today" from the endpoint's GET and each answer. */
  quota?: boolean
  /** A small link in the title band (the admin assistant links to the agents' usage page). */
  headerLink?: { href: string; label: string }
}

export default function FhiChatPage({
  endpoint = "/api/admin/fhi-chat",
  storageKey = CHAT_STORAGE_KEY,
  subtitle = "Ask anything about FHI's data. Every figure comes from the live database.",
  intro = { title: "Your data, answered.", text: "Sales, leads, projects, people, the website — the same figures as your dashboard, in plain language, with charts." },
  suggestions = SUGGESTION_GROUPS,
  reports = REPORT_BUTTONS,
  placeholder = 'Ask FHI Assistant — e.g. "Who sold the most this month?"',
  footnote = "Admin only · answers are computed from the live database at the moment you ask.",
  quota: showQuota = false,
  headerLink,
}: FhiChatPageProps = {}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const exhausted = Boolean(quota && quota.limit !== null && quota.used >= quota.limit)
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
        const raw = sessionStorage.getItem(storageKey)
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
  }, [storageKey])

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

  useEffect(() => {
    // Never delete here: on mount this runs with an empty chat BEFORE the
    // deferred restore reads storage — clearing belongs to "New chat" only.
    if (!messages.length) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)))
    } catch {
      // Storage full or blocked — the chat still works, it just won't persist.
    }
  }, [messages, storageKey])

  const newChat = () => {
    setMessages([])
    setError(null)
    try {
      sessionStorage.removeItem(storageKey)
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
    if (!question || busy || exhausted) return
    setError(null)
    setInput("")
    const next: Msg[] = [...messages, { role: "user", content: question, at: new Date().toISOString() }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
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
        stats?: StatSpec[]
        printCards?: PrintCardSpec[]
        error?: string
        quota?: Quota
      }
      if (data.quota) setQuota(data.quota)
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
          stats: data.stats,
          printCards: data.printCards,
          typed: false,
          at: new Date().toISOString(),
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

  const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" }) : null)

  return (
    <div className="mx-auto max-w-[900px] pb-6">
      {/* Title band — the page's one anchor; everything below flows on the page. */}
      <div className="flex items-center gap-4 rounded-2xl bg-[#001f3f] px-5 py-4 text-white shadow-[0_10px_30px_-14px_rgba(0,31,63,0.6)] sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <Sparkles className="h-5 w-5 text-[#d6b357]" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-['Outfit'] text-lg font-bold leading-tight sm:text-xl">FHI Assistant</h1>
          <p className="truncate text-[12px] text-white/65">{subtitle}</p>
        </div>
        {quota && quota.limit !== null && (
          <span
            title="Questions you can still ask today — the counter resets at midnight Dubai time."
            className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${exhausted ? "border-amber-300/60 bg-amber-400/15 text-amber-200" : "border-white/20 text-white/80"}`}
          >
            {Math.max(0, quota.limit - quota.used)} of {quota.limit} left today
          </span>
        )}
        {headerLink && (
          <Link href={headerLink.href} className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:border-[#d6b357] hover:text-[#d6b357] sm:inline-flex">
            <BarChart3 className="h-3.5 w-3.5" /> {headerLink.label}
          </Link>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:border-[#d6b357] hover:text-[#d6b357] disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>

      {/* Thread */}
      <div className="mt-6 space-y-5">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white px-5 py-8 shadow-[0_6px_24px_-16px_rgba(0,31,63,0.25)] sm:px-8">
            <div className="text-center">
              <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">{intro.title}</p>
              <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-[#6b7280]">{intro.text}</p>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((g) => (
                <div key={g.label}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">{g.label}</p>
                  <div className="space-y-1.5">
                    {g.items.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void ask(s)}
                        className="block w-full rounded-lg border border-[#eceef1] bg-[#fafbfc] px-3 py-2 text-left text-[13px] font-medium text-[#1f2937] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10 hover:text-[#001f3f]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-col items-end gap-1">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#001f3f] px-4 py-2.5 text-[14px] leading-relaxed text-white whitespace-pre-wrap shadow-[0_6px_18px_-10px_rgba(0,31,63,0.6)]">
                  {m.content}
                </p>
                {m.at && <span className="pr-1 text-[10.5px] text-[#9ca3af]">{timeOf(m.at)}</span>}
              </div>
            ) : (
              <div key={i} className="group">
                <div className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_8px_28px_-16px_rgba(0,31,63,0.28)]">
                  <div className="flex items-center gap-2.5 px-5 pt-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#001f3f]">
                      <Sparkles className="h-3.5 w-3.5 text-[#d6b357]" />
                    </span>
                    <span className="font-['Outfit'] text-[12.5px] font-bold text-[#0d1117]">FHI Assistant</span>
                    {m.at && <span className="text-[10.5px] text-[#9ca3af]">{timeOf(m.at)}</span>}
                  </div>
                  {m.stats && m.stats.length > 1 && (
                    <div className="px-5 pt-3">
                      <StatTiles stats={m.stats} />
                    </div>
                  )}
                  <div className="px-5 pb-4 pt-2.5 text-[14px] leading-[1.7] text-[#1f2937] whitespace-pre-wrap">
                    {m.typed === false ? (
                      <TypedText
                        text={m.content}
                        names={m.names ?? (m.cards ?? []).map((c) => c.title)}
                        onDone={() => setMessages((ms) => ms.map((x, xi) => (xi === i ? { ...x, typed: true } : x)))}
                      />
                    ) : (
                      <RichText text={m.content} names={m.names ?? (m.cards ?? []).map((c) => c.title)} />
                    )}
                  </div>
                  {m.typed !== false && m.charts && m.charts.length > 0 && (
                    <div className="grid gap-x-8 gap-y-5 border-t border-[#eef0f3] bg-[#fbfcfd] px-5 py-4 sm:grid-cols-2">
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
                  {m.typed !== false && m.printCards && m.printCards.length > 0 && (
                    <div className="space-y-4 border-t border-[#eef0f3] px-5 py-4">
                      {m.printCards.map((pc, pi) => (
                        <PrintBusinessCards key={pi} spec={pc} />
                      ))}
                    </div>
                  )}
                  {m.typed !== false && m.cards && m.cards.length > 0 && (
                    <div className="border-t border-[#eef0f3] px-3 py-3">
                      <CardRow cards={m.cards} />
                    </div>
                  )}
                  {m.typed !== false && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#eef0f3] px-5 py-2.5">
                      {m.used && m.used.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Sources</span>
                          {[...new Set(m.used.map((u) => TOOL_LABELS[u] ?? u.replace(/_/g, " ")))].map((label) => (
                            <span key={label} className="rounded-full border border-[#e8eaed] bg-[#f6f7f9] px-2 py-0.5 text-[10.5px] font-semibold text-[#374151]">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-3 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => void copyAnswer(i, m.content)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] transition-colors hover:text-[#001f3f]"
                        >
                          {copiedIdx === i ? <Check className="h-3 w-3 text-[#15803d]" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => exportAnswer(m.content)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6b7280] transition-colors hover:text-[#001f3f]"
                        >
                          <Printer className="h-3 w-3" /> Export PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ),
          )
        )}
        {busy && (
          <div className="inline-flex items-center gap-2.5 rounded-2xl border border-[#e8eaed] bg-white px-4 py-3 text-[13px] text-[#6b7280] shadow-[0_8px_28px_-16px_rgba(0,31,63,0.28)]">
            <span className="flex items-center gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d6b357]" />
            </span>
            Checking the numbers…
          </div>
        )}
      </div>

      {/* Composer — stays in view while the thread scrolls behind it. */}
      <div className="sticky bottom-0 z-10 -mx-2 mt-6 bg-gradient-to-t from-[#f4f6f9] via-[#f4f6f9]/95 to-transparent px-2 pb-2 pt-6">
        {error && (
          <p role="alert" className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            {error}
          </p>
        )}
        <div className="rounded-2xl border border-[#e3e6ea] bg-white p-2.5 shadow-[0_14px_40px_-16px_rgba(0,31,63,0.35)]">
          <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
            <span className="inline-flex items-center gap-1 pr-1 text-[10.5px] font-bold uppercase tracking-wide text-[#9ca3af]">
              <FileText className="h-3.5 w-3.5" /> Reports
            </span>
            {reports.map((r) => (
              <button
                key={r.label}
                type="button"
                disabled={busy || exhausted}
                onClick={() => void ask(r.prompt)}
                className="rounded-full border border-[#e3e6ea] bg-[#fafbfc] px-3 py-1 text-[12px] font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10 disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void ask()
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={exhausted ? "You've used today's questions — back tomorrow." : placeholder}
              disabled={busy || exhausted}
              className="w-full rounded-xl border border-transparent bg-[#f4f6f9] px-4 py-3 text-[14px] text-[#111827] placeholder:text-[#9ca3af] transition-colors focus:border-[#001f3f]/30 focus:bg-white focus:outline-none disabled:opacity-70"
            />
            <button
              type="submit"
              disabled={busy || exhausted || !input.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#001f3f] px-5 text-sm font-bold text-white transition-colors hover:bg-[#00152b] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </button>
          </form>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] text-[#9ca3af]">
          {footnote}
          {quota && quota.limit !== null && <span className="sm:hidden"> · {Math.max(0, quota.limit - quota.used)} of {quota.limit} questions left today</span>}
        </p>
      </div>
      <div ref={endRef} aria-hidden />
    </div>
  )
}
