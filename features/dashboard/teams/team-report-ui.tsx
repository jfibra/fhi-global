"use client"

// Small shared pieces of the Team Performance Report screen: number formats, the section block with
// its verdict pill, skeletons, and the people list. Type sizes are the reading sizes for 40+ readers:
// 15–16 px text, nothing under 13 px, greys no lighter than #4b5563, bronze #8a6d2a (not gold) for
// text on white.

import { useId, type ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, Loader2, XOctagon } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import type { StatSpec } from "@/features/dashboard/fhi-chat/charts"
import type { MemberRow } from "@/lib/team-report/data"
import type { Strategy } from "@/lib/team-report/insights"
import { TONE, type SectionKey, type Tone, type Verdict } from "./team-report-verdicts"

// ─── Formats ─────────────────────────────────────────────────────────────────

export const aed = (n: number) => `AED ${Math.round(n || 0).toLocaleString("en-US")}`
export function aedShort(n: number): string {
  const v = Math.round(n || 0)
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `AED ${Math.round(v / 1_000)}K`
  return `AED ${v.toLocaleString("en-US")}`
}
export const num = (n: number) => Math.round(n || 0).toLocaleString("en-US")
export const dealsText = (n: number) => `${n} deal${n === 1 ? "" : "s"}`
export function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%"
  const p = (part / whole) * 100
  return part > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`
}
export const fmtDay = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—")
export const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
export const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
export const roleLine = (m: MemberRow) => [m.roleInTeam, m.subteam].filter(Boolean).join(" · ") || "Member"

// ─── Verdict pill ────────────────────────────────────────────────────────────

const TONE_ICON: Record<Tone, typeof Info> = { good: CheckCircle2, watch: AlertTriangle, urgent: XOctagon, neutral: Info }

/** The fact, the tone word (screen readers) and an icon — the colour is never the only signal. */
export function VerdictPill({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  const Icon = TONE_ICON[verdict.tone]
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[15px] font-bold ${TONE[verdict.tone].pill} ${className}`}>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="sr-only">{TONE[verdict.tone].word}: </span>
      {verdict.fact}
    </span>
  )
}

// ─── Section block, headings, skeletons ──────────────────────────────────────

export function Block({ id, n, title, subtitle, verdict, children }: { id: SectionKey; n: string; title: string; subtitle: string; verdict: Verdict | null; children: ReactNode }) {
  const headingId = useId()
  return (
    <section data-section={id} aria-labelledby={headingId} className="scroll-mt-4 rounded-2xl border border-[#dfe3e9] bg-white shadow-[0_2px_14px_-2px_rgba(0,31,63,0.08)]">
      <header className="mx-5 flex flex-wrap items-start gap-x-4 gap-y-3 border-b-2 border-[#001f3f] pb-4 pt-6 sm:mx-7">
        <span className="font-['Outfit'] text-[36px] font-bold leading-none text-[#8a6d2a]" aria-hidden>{n}</span>
        <div className="min-w-0 flex-1 basis-64">
          <h3 id={headingId} className="font-['Outfit'] text-[24px] font-bold leading-tight text-[#001f3f]">{title}</h3>
          <p className="mt-0.5 text-[16px] text-[#4b5563]">{subtitle}</p>
        </div>
        {verdict && <VerdictPill verdict={verdict} />}
      </header>
      <div className="space-y-7 px-5 py-6 sm:px-7">{children}</div>
    </section>
  )
}

/** A card title inside a section: sentence case, 17 px, with an optional note on the right. */
export const Label = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h4 className="text-[17px] font-bold text-[#001f3f]">{children}</h4>
    {right ? <p className="text-[14px] text-[#4b5563]">{right}</p> : null}
  </div>
)

export function Skeleton({ lines = 3, dark = false }: { lines?: number; dark?: boolean }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`h-4 animate-pulse rounded ${dark ? "bg-white/15" : "bg-[#e5e8ec]"}`} style={{ width: `${94 - i * 13}%` }} />
      ))}
    </div>
  )
}

export function Writing({ label = "FHI Assistant is writing the analysis…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#c9a449] bg-[#fffaf0] px-4 py-3 text-[15px] font-semibold text-[#6b5320]">
      <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> {label}
    </div>
  )
}

// ─── People ──────────────────────────────────────────────────────────────────

export const CohortChip = ({ cohort }: { cohort: MemberRow["cohort"] }) => (
  <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[12px] font-bold ${cohort === "new" ? "bg-[#001f3f] text-white" : "bg-[#e5e9f0] text-[#001f3f]"}`}>{cohort === "new" ? "NEW" : "EXISTING"}</span>
)

/** Avatar, name with the NEW/EXISTING tag, a line under it, and whatever belongs on the right. */
export function People({ rows, right, sub }: { rows: MemberRow[]; right: (m: MemberRow) => ReactNode; sub: (m: MemberRow) => string }) {
  return (
    <ul className="divide-y divide-[#eef0f3] overflow-hidden rounded-xl border border-[#dfe3e9]">
      {rows.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
          <UserAvatar name={m.name} imageUrl={m.photo} size={38} />
          <div className="min-w-0 flex-1 basis-52">
            <p className="text-[16px] font-bold leading-snug text-[#0d1117]">
              {m.name}
              <CohortChip cohort={m.cohort} />
            </p>
            <p className="text-[14px] leading-snug text-[#4b5563]">{sub(m)}</p>
          </div>
          <div className="shrink-0 text-right text-[15px] text-[#1f2937]">{right(m)}</div>
        </li>
      ))}
    </ul>
  )
}

// ─── Tiles and chips ─────────────────────────────────────────────────────────

const toneOf = (change: string | null): StatSpec["tone"] => (!change || change === "0%" ? "flat" : change.startsWith("-") ? "down" : "up")
/** A StatTiles entry; the tile is "neutral" (bronze chip) unless it carries a change. */
export const tile = (label: string, value: string, hint?: string | null, change?: string | null): StatSpec => ({ label, value, hint: hint ?? null, change: change ?? null, tone: change ? toneOf(change) : "neutral" })

export const roleText = (role: string | null) => (role ?? "member").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function ImpactChip({ impact }: { impact: Strategy["impact"] }) {
  const cls = impact === "High" ? "bg-[#001f3f] text-white" : impact === "Quick win" ? "bg-[#fdf3d8] text-[#713f12]" : "bg-[#e5e9f0] text-[#1f2937]"
  return <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${cls}`}>{impact.toUpperCase()}</span>
}
