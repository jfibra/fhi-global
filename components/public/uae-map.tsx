"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { EMIRATES } from "@/lib/emirates"
import { UAE_EMIRATES, UAE_VIEWBOX } from "@/lib/uae-emirates"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"

/**
 * "Where we build": the UAE drawn in gold hairlines, each emirate lit in
 * proportion to its live project count, beside a list of the emirates with
 * counts that lead to the filtered projects page.
 *
 * Counts arrive from the page (counted from published rows by
 * `countByEmirate`), so the map never shows a figure the catalogue does not
 * hold. Entrance: the outlines draw themselves in one after another, the
 * fills glow up behind them, then the labels and the list settle in. Hovering
 * a row or an emirate highlights both.
 */

/**
 * Label anchors in viewBox units. The two big emirates are labelled in place;
 * the five small northern ones are too tight to label on the map itself, so
 * their labels stack in a column to the right, joined by leader lines. The
 * viewBox is widened by LABEL_GUTTER to make room for that column.
 */
const LABEL_GUTTER = 230
const LABEL: Record<string, { x?: number; y?: number; dx?: number; dy?: number; anchor: "start" | "middle" | "end" }> = {
  AZ: { dx: 0, dy: 0, anchor: "middle" },
  DU: { dx: -22, dy: 34, anchor: "end" },
  RK: { x: 1060, y: 70, anchor: "start" },
  UQ: { x: 1060, y: 130, anchor: "start" },
  AJ: { x: 1060, y: 190, anchor: "start" },
  SH: { x: 1060, y: 250, anchor: "start" },
  FU: { x: 1060, y: 310, anchor: "start" },
}
const [, , VB_W, VB_H] = UAE_VIEWBOX.split(" ").map(Number)
const VIEWBOX = `0 0 ${VB_W + LABEL_GUTTER} ${VB_H}`

export function UaeMap({ counts }: { counts: Record<string, number> }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...Object.values(counts))
  const lit = EMIRATES.filter((e) => (counts[e.code] ?? 0) > 0)
  const rows = [...EMIRATES].sort((a, b) => (counts[b.code] ?? 0) - (counts[a.code] ?? 0))
  const total = Object.values(counts).reduce((n, c) => n + c, 0)

  return (
    <section className="um wf relative overflow-hidden bg-[#06182e] py-24 text-white lg:py-28">
      <noscript>
        <style>{`.um [class*="um-"], .um [class*="wf-"] { opacity: 1 !important; transform: none !important; stroke-dashoffset: 0 !important; filter: none !important; }`}</style>
      </noscript>
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.14),rgba(214,179,87,0))]" aria-hidden="true" />

      <InView className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" threshold={0.2}>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* ── Copy and the list ─────────────────────────────────── */}
          <div className="lg:col-span-5">
            <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              Where we build
            </p>
            <h2 className="mt-5 font-['Outfit'] text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[48px]">
              <span className="wf-word block"><span style={{ ["--i" as string]: 0 }}>Projects across</span></span>
              <span className="wf-word block"><span style={{ ["--i" as string]: 1 }} className="wf-gold">{lit.length} emirates.</span></span>
            </h2>
            <p className="wf-fade mt-6 max-w-md text-[15px] leading-relaxed text-white/70" style={{ ["--d" as string]: "500ms" }}>
              {total.toLocaleString("en-US")} live projects, counted from the listings published on this site.
              Choose an emirate to see what is selling there now.
            </p>

            <ul className="mt-10 border-t border-white/10">
              {rows.map((e, i) => {
                const count = counts[e.code] ?? 0
                const isActive = active === e.code
                const inner = (
                  <>
                    <span className="flex min-w-0 items-center gap-4">
                      <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${count > 0 ? "bg-[#d6b357]" : "bg-white/20"}`} aria-hidden="true" />
                      <span className={`truncate font-['Outfit'] text-[17px] font-bold transition-colors ${count > 0 ? "text-white" : "text-white/40"} ${isActive ? "text-[#e3c06c]" : ""}`}>
                        {e.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="hidden h-1 w-24 overflow-hidden bg-white/10 sm:block" aria-hidden="true">
                        <span className="um-bar block h-full bg-[#d6b357]" style={{ ["--w" as string]: `${Math.round((count / max) * 100)}%`, ["--d" as string]: `${900 + i * 90}ms` }} />
                      </span>
                      <span className={`w-12 text-right font-['Outfit'] text-[17px] font-bold tabular-nums ${count > 0 ? "text-[#d6b357]" : "text-white/30"}`}>
                        {count > 0 ? <CountUp value={count} delay={900 + i * 90} duration={1200} /> : "0"}
                      </span>
                      <ArrowUpRight className={`h-4 w-4 transition-all ${count > 0 ? "text-[#d6b357]" : "text-transparent"} ${isActive ? "translate-x-0.5 -translate-y-0.5" : ""}`} aria-hidden="true" />
                    </span>
                  </>
                )
                const cls = "wf-fade flex items-center justify-between gap-6 border-b border-white/10 py-3.5"
                const style = { ["--d" as string]: `${700 + i * 90}ms` }
                return (
                  <li key={e.code} onMouseEnter={() => setActive(e.code)} onMouseLeave={() => setActive(null)}>
                    {count > 0 ? (
                      <Link href={`/projects?city=${encodeURIComponent(e.cityParam)}`} className={`${cls} group`} style={style} onFocus={() => setActive(e.code)} onBlur={() => setActive(null)}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls} style={style}>{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── The map ───────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            <svg viewBox={VIEWBOX} className="h-auto w-full overflow-visible" role="img" aria-label={`Map of the United Arab Emirates with live project counts: ${rows.map((e) => `${e.name} ${counts[e.code] ?? 0}`).join(", ")}`}>
              <defs>
                <filter id="um-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Fills first, so every outline draws above them */}
              {UAE_EMIRATES.map((p, i) => {
                const count = counts[p.code] ?? 0
                const neutral = p.code.startsWith("NZ")
                const isActive = active === p.code
                const base = count > 0 ? 0.14 + 0.5 * (count / max) : 0.04
                return (
                  <path
                    key={`fill-${p.code}`}
                    d={p.d}
                    className="um-fill"
                    style={{ ["--o" as string]: neutral ? 0 : isActive ? Math.min(0.85, base + 0.25) : base, ["--d" as string]: `${700 + i * 120}ms` }}
                    fill="#d6b357"
                    stroke="none"
                    filter={isActive ? "url(#um-glow)" : undefined}
                  />
                )
              })}
              {/* Outlines draw themselves in, one emirate after another */}
              {UAE_EMIRATES.map((p, i) => {
                const neutral = p.code.startsWith("NZ")
                const isActive = active === p.code
                return (
                  <path
                    key={`line-${p.code}`}
                    d={p.d}
                    pathLength={1}
                    className="um-path"
                    style={{ ["--d" as string]: `${i * 140}ms` }}
                    fill="transparent"
                    stroke={isActive ? "#f6e3a8" : "#d6b357"}
                    strokeWidth={isActive ? 2.2 : neutral ? 0.8 : 1.2}
                    strokeDasharray={neutral ? "4 4" : undefined}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={neutral ? undefined : () => setActive(p.code)}
                    onMouseLeave={neutral ? undefined : () => setActive(null)}
                  />
                )
              })}
              {/* Labels: name and count at each emirate */}
              {UAE_EMIRATES.filter((p) => LABEL[p.code]).map((p, i) => {
                const count = counts[p.code] ?? 0
                const l = LABEL[p.code]
                const x = l.x ?? p.cx + (l.dx ?? 0)
                const y = l.y ?? p.cy + (l.dy ?? 0)
                const dim = count === 0
                const leader = x !== p.cx || y !== p.cy
                return (
                  <g key={`label-${p.code}`} className="um-label pointer-events-none hidden sm:block" style={{ ["--d" as string]: `${1500 + i * 80}ms` }}>
                    {leader && (
                      <line x1={p.cx} y1={p.cy} x2={l.x ? x - 10 : x} y2={l.x ? y + 4 : y} stroke="#d6b357" strokeOpacity={0.45} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    )}
                    <circle cx={p.cx} cy={p.cy} r={3.5} fill={dim ? "#ffffff66" : "#f6e3a8"} />
                    <text x={x} y={y - 5} textAnchor={l.anchor} fill={dim ? "#ffffff80" : "#ffffff"} fontSize={18} fontWeight={700} fontFamily="Outfit, system-ui, sans-serif">
                      {p.name}
                    </text>
                    <text x={x} y={y + 16} textAnchor={l.anchor} fill={dim ? "#ffffff66" : "#d6b357"} fontSize={14} fontWeight={700} fontFamily="Geist, system-ui, sans-serif" letterSpacing={0.5}>
                      {count} {count === 1 ? "project" : "projects"}
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="wf-fade mt-4 text-right text-[11px] uppercase tracking-[0.16em] text-white/40" style={{ ["--d" as string]: "2000ms" }}>
              Boundaries: Natural Earth · counts live from published listings
            </p>
          </div>
        </div>
      </InView>
    </section>
  )
}
