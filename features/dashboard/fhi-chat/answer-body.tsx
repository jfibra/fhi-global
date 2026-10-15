"use client"

/**
 * FHI Assistant answers drawn like the company report (boss via Juliecor,
 * 2026-10-15: "all of the answers look nice like the PDF"). The models write
 * plain text with fixed conventions (both system prompts): CAPS headings on
 * their own line, "- " lines, "- 1. Name: …" rankings, "- Label: value"
 * figures with "(up 33% vs …)" comparisons, dated feed lines, "name - phone -
 * email" contact lists and an "Insight:" line. This turns those into blocks —
 * numbered sections, a figures table with change chips, a ranked table with
 * value bars, a timeline, contact rows with tap-to-call/mail links and a gold
 * callout. Parsing is per line, so it also works on the half-typed text while
 * the typewriter runs. Anything it doesn't recognise stays a paragraph.
 */

import { Fragment } from "react"

type Change = { dir: "up" | "down" | "new"; pct: string; rest: string }
type Block =
  | { kind: "title"; title: string; period: string | null }
  | { kind: "heading"; text: string; n: number | null }
  | { kind: "para"; text: string }
  | { kind: "callout"; label: string; text: string }
  | { kind: "kv"; rows: Array<{ label: string; value: string }> }
  | { kind: "ranked"; rows: Array<{ rank: string; name: string; detail: string; aed: number | null; aedText: string | null }> }
  | { kind: "timeline"; rows: Array<{ when: string; text: string }> }
  | { kind: "contacts"; rows: string[][] }
  | { kind: "bullets"; rows: string[] }
  | { kind: "recs"; rows: Array<{ n: string; title: string | null; text: string }> }

// ─── Parsing ────────────────────────────────────────────────────────────────

function isHeading(line: string): boolean {
  if (line.startsWith("- ")) return false
  const base = line.replace(/\s*\(.*\)\s*:?$/, "").replace(/:$/, "").trim()
  return base.length >= 3 && base.length <= 48 && /[A-Z]{2}/.test(base) && base === base.toUpperCase() && !/^AED\b/.test(base)
}

const WHEN = /^(\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s?[A-Z][a-z]{2} \d{1,2}(?:, \d{4})?(?:,? \d{1,2}:\d{2})?|\d{1,2} [A-Z][a-z]{2}(?: \d{4})?(?:,? \d{1,2}:\d{2})?|\d{1,2}:\d{2})\s*(?:—|–|:|-)\s+(.+)$/
const RANK = /^(\d{1,2})[.)]\s+(.+)$/
const KV = /^([A-Za-z][^:]{0,40}?):\s+(.+)$/
const CALLOUT = /^(Insight|Insights|Note|Tip|Summary|Recommendation|Next steps?|Heads up|Bottom line)\s*:\s*(.+)$/i
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE = /\+?\d[\d\s()-]{6,}\d/
const AED_RE = /AED\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g

type Item = Exclude<Block, { kind: "title" | "heading" | "para" | "callout" }>["kind"]

function classify(item: string): { kind: Item; row: unknown } {
  // "Name - phone - email", "Name - agent - joined 2026-07-21 - validated deals: 8": one row, first part bold.
  const parts = item.split(/\s+[—–-]\s+/)
  if (parts.length >= 3 && !WHEN.test(item) && !RANK.test(item)) return { kind: "contacts", row: parts }
  const w = WHEN.exec(item)
  if (w) return { kind: "timeline", row: { when: w[1], text: w[2] } }
  const r = RANK.exec(item)
  if (r) {
    const body = r[2]
    const cut = body.search(/:\s|\s[—–]\s/)
    const name = cut > 0 ? body.slice(0, cut).trim() : body
    const rest = cut > 0 ? body.slice(cut).replace(/^(:\s|\s[—–]\s)/, "").trim() : ""
    const amounts = rest.match(AED_RE)
    const aedText = amounts ? amounts[amounts.length - 1] : null
    const detail = aedText ? rest.replace(aedText, "").replace(/(^[,;·\s]+|[,;·\s]+$)/g, "").replace(/,\s*,/g, ",") : rest
    return { kind: "ranked", row: { rank: r[1], name, detail, aed: aedText ? Number(aedText.replace(/[^\d.]/g, "")) : null, aedText } }
  }
  const kv = KV.exec(item)
  if (kv && kv[1].split(" ").length <= 6) return { kind: "kv", row: { label: kv[1].trim(), value: kv[2].trim() } }
  return { kind: "bullets", row: item }
}

/** Headings whose list items are actions — drawn as numbered recommendation cards. */
const RECS_HEADING = /RECOMMEND|ACTIONS?\b|NEXT STEPS|WHAT TO DO|ADVICE|ACTION PLAN/

function recRow(item: string, index: number): { n: string; title: string | null; text: string } {
  const r = RANK.exec(item)
  const n = r ? r[1] : String(index + 1)
  const body = r ? r[2] : item
  const m = /^(.{3,70}?):\s+(.+)$/.exec(body)
  return m ? { n, title: m[1].trim(), text: m[2].trim() } : { n, title: null, text: body }
}

export function parseAnswer(text: string): Block[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const blocks: Block[] = []
  const headingCount = lines.filter((l) => l && isHeading(l)).length
  const firstLine = lines.find((l) => l)
  let n = 0
  let titleDone = false
  let inRecs = false
  for (const line of lines) {
    if (!line) continue
    if (isHeading(line)) {
      if (!titleDone && line === firstLine && (headingCount >= 2 || lines.filter(Boolean).length >= 4)) {
        titleDone = true
        const m = /^(.*?)\s*\((.*)\)\s*:?$/.exec(line)
        blocks.push({ kind: "title", title: (m ? m[1] : line).replace(/:$/, ""), period: m ? m[2] : null })
        continue
      }
      titleDone = true
      n++
      inRecs = RECS_HEADING.test(line)
      blocks.push({ kind: "heading", text: line.replace(/:$/, ""), n })
      continue
    }
    titleDone = true
    const c = CALLOUT.exec(line.replace(/^-\s+/, ""))
    if (c) {
      blocks.push({ kind: "callout", label: c[1], text: c[2] })
      continue
    }
    // Under a RECOMMENDATIONS heading, "- 1. …", "1. …" and "- …" items are all actions.
    if (inRecs && (line.startsWith("- ") || line.startsWith("• ") || /^\d{1,2}[.)]\s/.test(line))) {
      const item = /^\d/.test(line) ? line : line.slice(2).trim()
      const last = blocks[blocks.length - 1]
      if (last && last.kind === "recs") last.rows.push(recRow(item, last.rows.length))
      else blocks.push({ kind: "recs", rows: [recRow(item, 0)] })
      continue
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const { kind, row } = classify(line.slice(2).trim())
      const last = blocks[blocks.length - 1]
      if (last && last.kind === kind) (last.rows as unknown[]).push(row)
      else blocks.push({ kind, rows: [row] } as Block)
      continue
    }
    blocks.push({ kind: "para", text: line })
  }
  // Number sections only when there are several.
  const headings = blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading")
  if (headings.length < 2) for (const h of headings) h.n = null
  return blocks
}

// ─── Inline: names navy, AED gold, comparisons as chips ─────────────────────

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
const CHANGE_RE = "\\((?:up|down) \\d+(?:\\.\\d+)?%[^)]*\\)|\\([+-]\\d+(?:\\.\\d+)?%[^)]*\\)|\\(new[^)]*\\)"

function parseChange(s: string): Change | null {
  const inner = s.replace(/^\(|\)$/g, "")
  let m = /^(up|down) (\d+(?:\.\d+)?%)\s*(.*)$/i.exec(inner)
  if (m) return { dir: m[1].toLowerCase() as "up" | "down", pct: m[2], rest: m[3] }
  m = /^([+-])(\d+(?:\.\d+)?%)\s*(.*)$/.exec(inner)
  if (m) return { dir: m[1] === "-" ? "down" : "up", pct: m[2], rest: m[3] }
  m = /^new\s*(.*)$/i.exec(inner)
  if (m) return { dir: "new", pct: "new", rest: m[1] }
  return null
}

export function ChangeChip({ change }: { change: Change }) {
  const cls = change.dir === "down" ? "bg-[#fdecec] text-[#b91c1c]" : "bg-[#e8f5ec] text-[#15803d]"
  return (
    <span className="whitespace-nowrap">
      <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${cls}`}>{change.dir === "new" ? "new" : `${change.dir === "up" ? "▲" : "▼"} ${change.pct}`}</span>
      {change.rest && <span className="ml-1 text-[12px] font-normal text-[#9ca3af]">{change.rest}</span>}
    </span>
  )
}

function Inline({ text, names }: { text: string; names: string[] }) {
  const pattern = [...names.filter((n) => n.length > 2).map(escapeRe), "AED\\s?[\\d,]+(?:\\.\\d+)?", CHANGE_RE, EMAIL.source].join("|")
  const lower = new Set(names.map((n) => n.toLowerCase()))
  const parts = text.split(new RegExp(`(${pattern})`, "gi"))
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null
        if (/^AED\s?[\d,]/.test(p)) return <span key={i} className="font-semibold text-[#8a6d2a]">{p}</span>
        if (p.startsWith("(")) {
          const c = parseChange(p)
          if (c) return <ChangeChip key={i} change={c} />
        }
        if (EMAIL.test(p) && !p.includes(" ")) return <a key={i} href={`mailto:${p}`} className="text-[#2f5d8a] underline decoration-[#2f5d8a]/30 underline-offset-2 hover:decoration-[#2f5d8a]">{p}</a>
        if (lower.has(p.toLowerCase())) return <span key={i} className="font-semibold text-[#001f3f]">{p}</span>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

function Contact({ part }: { part: string }) {
  const kv = /^([A-Za-z][\w ]{1,24}):\s*(.+)$/.exec(part)
  if (kv) return <span className="rounded-md bg-[#f4f6f9] px-1.5 py-0.5 text-[12px] text-[#374151]">{kv[1]}: <b className="text-[#0d1117]">{kv[2]}</b></span>
  const email = EMAIL.exec(part)?.[0]
  if (email) return <a href={`mailto:${email}`} className="text-[#2f5d8a] hover:underline">{part}</a>
  const phone = PHONE.exec(part)?.[0]
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    const digits = phone.replace(/[^\d+]/g, "")
    return <a href={`https://wa.me/${digits.replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="text-[#15803d] hover:underline">{part}</a>
  }
  return <span className="text-[#6b7280]">{part}</span>
}

export default function AnswerBody({ text, names }: { text: string; names: string[] }) {
  const blocks = parseAnswer(text)
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "title":
            return (
              <div key={i} className="border-b-2 border-[#001f3f] pb-2">
                <p className="font-['Outfit'] text-[19px] font-bold leading-tight tracking-tight text-[#001f3f]">{titleCase(b.title)}</p>
                {b.period && <p className="mt-0.5 font-['Outfit'] text-[13px] font-semibold text-[#b8913f]">{b.period}</p>}
              </div>
            )
          case "heading":
            return (
              <div key={i} className="flex items-end gap-2.5 border-b border-[#e5e8ec] pb-1.5 pt-2">
                {b.n !== null && <span className="font-['Outfit'] text-[20px] font-bold leading-none text-[#d6b357]">{String(b.n).padStart(2, "0")}</span>}
                <p className="font-['Outfit'] text-[14.5px] font-bold uppercase tracking-[0.06em] text-[#001f3f]">{b.text.replace(/\s*\((.*)\)$/, "")}{/\((.*)\)$/.test(b.text) && <span className="ml-2 text-[12px] font-semibold normal-case tracking-normal text-[#9ca3af]">{/\((.*)\)$/.exec(b.text)?.[1]}</span>}</p>
              </div>
            )
          case "para":
            return <p key={i} className="text-[14px] leading-[1.65] text-[#1f2937]"><Inline text={b.text} names={names} /></p>
          case "callout":
            return (
              <div key={i} className="rounded-xl border-l-[3px] border-[#d6b357] bg-[#f4f6fa] px-4 py-2.5">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#b8913f]">{b.label}</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-[#0d1117]"><Inline text={b.text} names={names} /></p>
              </div>
            )
          case "kv":
            return (
              <dl key={i} className="divide-y divide-[#f0f2f5] overflow-hidden rounded-xl border border-[#eceef1]">
                {b.rows.map((r, ri) => (
                  <div key={ri} className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3.5 py-2 sm:grid-cols-[minmax(120px,34%)_1fr]">
                    <dt className="text-[12px] font-semibold text-[#6b7280]">{r.label}</dt>
                    <dd className="text-[13.5px] font-semibold text-[#0d1117]"><Inline text={r.value} names={names} /></dd>
                  </div>
                ))}
              </dl>
            )
          case "ranked": {
            const max = Math.max(1, ...b.rows.map((r) => r.aed ?? 0))
            const bars = b.rows.some((r) => r.aed)
            return (
              <ol key={i} className="divide-y divide-[#f0f2f5] overflow-hidden rounded-xl border border-[#eceef1]">
                {b.rows.map((r, ri) => (
                  <li key={ri} className="flex items-center gap-3 px-3.5 py-2">
                    <span className={`w-5 shrink-0 text-center font-['Outfit'] text-[14px] font-bold ${r.rank === "1" ? "text-[#b8913f]" : "text-[#c5ccd6]"}`}>{r.rank}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-[#0d1117]">{r.name}</p>
                      {r.detail && <p className="truncate text-[12px] text-[#6b7280]"><Inline text={r.detail} names={[]} /></p>}
                      {bars && r.aed !== null && <div className="mt-1 h-1 rounded-full bg-[#eef0f3]"><div className={`h-full rounded-full ${ri === 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`} style={{ width: `${Math.max(2, (100 * r.aed) / max)}%` }} /></div>}
                    </div>
                    {r.aedText && <span className="shrink-0 font-['Outfit'] text-[14px] font-bold tabular-nums text-[#001f3f]">{r.aedText}</span>}
                  </li>
                ))}
              </ol>
            )
          }
          case "timeline":
            return (
              <ol key={i} className="relative ml-1.5 space-y-2 border-l-2 border-[#e5e8ec] pl-4">
                {b.rows.map((r, ri) => (
                  <li key={ri} className="relative">
                    <span className={`absolute -left-[21px] top-[7px] h-2.5 w-2.5 rounded-full ring-2 ring-white ${ri === 0 ? "bg-[#d6b357]" : "bg-[#001f3f]"}`} />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af]">{prettyWhen(r.when)}</p>
                    <p className="text-[13.5px] leading-snug text-[#1f2937]"><Inline text={r.text} names={names} /></p>
                  </li>
                ))}
              </ol>
            )
          case "contacts":
            return (
              <ul key={i} className="divide-y divide-[#f0f2f5] overflow-hidden rounded-xl border border-[#eceef1]">
                {b.rows.map((parts, ri) => (
                  <li key={ri} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3.5 py-2 text-[13px]">
                    <span className="font-semibold text-[#0d1117]">{parts[0]}</span>
                    {parts.slice(1).map((p, pi) => <Contact key={pi} part={p} />)}
                  </li>
                ))}
              </ul>
            )
          case "recs":
            return (
              <ol key={i} className="space-y-2">
                {b.rows.map((r, ri) => (
                  <li key={ri} className="flex gap-3 rounded-xl border border-[#e8eaed] px-3.5 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-[#f0d89b]">{r.n}</span>
                    <div className="min-w-0 flex-1">
                      {r.title && <p className="font-['Outfit'] text-[14.5px] font-bold leading-snug text-[#001f3f]">{r.title}</p>}
                      <p className={`text-[13.5px] leading-snug text-[#1f2937] ${r.title ? "mt-0.5" : ""}`}><Inline text={r.text} names={names} /></p>
                    </div>
                  </li>
                ))}
              </ol>
            )
          case "bullets":
            return (
              <ul key={i} className="space-y-1.5">
                {b.rows.map((r, ri) => (
                  <li key={ri} className="flex gap-2.5 text-[14px] leading-[1.6] text-[#1f2937]">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6b357]" />
                    <span className="min-w-0"><Inline text={r} names={names} /></span>
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}

/** "2026-10-01" / "2026-10-01 14:32" → "1 Oct 2026" / "1 Oct 2026, 14:32"; anything else as written. */
function prettyWhen(when: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}:\d{2}))?$/.exec(when)
  if (!m) return when
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  return m[4] ? `${d}, ${m[4]}` : d
}

/** "FULL REPORT" → "Full report" for the title line (headings stay small caps). */
function titleCase(s: string): string {
  const t = s.toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
