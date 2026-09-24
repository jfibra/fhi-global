"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { EMIRATES } from "@/lib/emirates"
import { UAE_EMIRATES, UAE_VIEWBOX } from "@/lib/uae-emirates"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"

/**
 * "Where we build": the UAE as a tilted 3D relief.
 *
 * A navy slab of the country sits on a receding dot-grid floor. Each emirate
 * with live projects rises out of the slab as a gold block whose height
 * follows its project count, so Dubai stands tallest. The relief is built
 * from stacked SVG layers in a CSS preserve-3d context: a few dark layers
 * make the slab's thickness, and each block is its own stack of gold-brown
 * layers under a lit top face that carries the label. Hovering a list row or
 * a block lifts that emirate further; the model tilts a few degrees toward
 * the pointer and floats slowly.
 *
 * Counts arrive from the page (counted from published rows by
 * `countByEmirate`), so the map never shows a figure the catalogue does not
 * hold. Boundaries: Natural Earth 10m admin-1 (public domain).
 */

/** Label anchors (viewBox units). The north is too tight to label in place,
 * so those five stack in a column to the right with leader lines. */
const LABEL_GUTTER = 230
const LABEL: Record<string, { x?: number; y?: number; dx?: number; dy?: number; anchor: "start" | "middle" | "end" }> = {
  AZ: { dx: 0, dy: 0, anchor: "middle" },
  DU: { dx: -22, dy: 36, anchor: "end" },
  RK: { x: 1060, y: 70, anchor: "start" },
  UQ: { x: 1060, y: 132, anchor: "start" },
  AJ: { x: 1060, y: 194, anchor: "start" },
  SH: { x: 1060, y: 256, anchor: "start" },
  FU: { x: 1060, y: 318, anchor: "start" },
}
const [, , VB_W, VB_H] = UAE_VIEWBOX.split(" ").map(Number)
const VIEWBOX = `0 0 ${VB_W + LABEL_GUTTER} ${VB_H}`
const ASPECT = `${VB_W + LABEL_GUTTER} / ${VB_H}`

/** Slab thickness and block heights, in CSS px along the 3D z axis. */
const SLAB = 16
const SLAB_STEP = 4
const BLOCK_MIN = 10
const BLOCK_MAX = 46
const BLOCK_STEP = 4

const NAVY_SIDE = "#061a33"
const NAVY_TOP = "#0e2b4f"

/** Block colour runs from a dim bronze (a handful of projects) to bright gold
 * (the most), so the count shows in the metal itself, not just the height. */
const BRONZE_TOP = "#6b5322"
const GOLD_TOP = "#dcbb5e"
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
const mix = (a: string, b: string, t: number) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t))
const shade = (h: string, f: number) => toHex(hex(h).map((v) => v * f))

/** One SVG plane at a given depth. */
function Plane({ z, className = "", style, children }: { z: number; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <svg
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={`absolute inset-0 h-full w-full overflow-visible ${className}`}
      style={{ transform: `translateZ(${z}px)`, ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function Label({ code, cx, cy, name, count, dim }: { code: string; cx: number; cy: number; name: string; count: number; dim: boolean }) {
  const l = LABEL[code]
  if (!l) return null
  const x = l.x ?? cx + (l.dx ?? 0)
  const y = l.y ?? cy + (l.dy ?? 0)
  const leader = x !== cx || y !== cy
  const halo = { paintOrder: "stroke" as const, stroke: "#06182e", strokeWidth: 4, strokeLinejoin: "round" as const }
  return (
    <g className="um-label hidden sm:block">
      {leader && (
        <line x1={cx} y1={cy} x2={l.x ? x - 10 : x} y2={l.x ? y + 4 : y} stroke="#d6b357" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      <circle cx={cx} cy={cy} r={4} fill={dim ? "#ffffff66" : "#f6e3a8"} />
      <text x={x} y={y - 6} textAnchor={l.anchor} fill={dim ? "#ffffff80" : "#ffffff"} fontSize={20} fontWeight={700} fontFamily="Outfit, system-ui, sans-serif" style={halo}>
        {name}
      </text>
      <text x={x} y={y + 16} textAnchor={l.anchor} fill={dim ? "#ffffff66" : "#f0d89b"} fontSize={15} fontWeight={700} fontFamily="Geist, system-ui, sans-serif" letterSpacing={0.5} style={halo}>
        {count} {count === 1 ? "project" : "projects"}
      </text>
    </g>
  )
}

export function UaeMap({
  counts,
  eyebrow = "Where we build",
  titleTop = "Projects across",
  intro,
  linkParams,
  hideEmpty = false,
}: {
  counts: Record<string, number>
  /** Small gold label above the heading. */
  eyebrow?: string
  /** First line of the heading; the second is always "N emirates." */
  titleTop?: string
  /** Paragraph under the heading; the default explains the site-wide count. */
  intro?: string
  /** Extra query parameters for each emirate row's link, e.g. { developer: id };
   *  the row always adds its own `city`. Plain data, since this is a client component. */
  linkParams?: Record<string, string>
  /** Leave emirates with no projects out of the list (the map still draws them). */
  hideEmpty?: boolean
}) {
  const hrefFor = (cityParam: string) => `/projects?${new URLSearchParams({ ...(linkParams ?? {}), city: cityParam }).toString()}`
  const [active, setActive] = useState<string | null>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // Pointer tilt: a few degrees toward the cursor, written on an animation
  // frame straight to the tilt element; the CSS transition smooths it.
  useEffect(() => {
    const stage = stageRef.current
    const tilt = tiltRef.current
    if (!stage || !tilt) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!window.matchMedia("(pointer: fine)").matches) return
    let raf = 0
    let mx = 0
    let my = 0
    const apply = () => {
      raf = 0
      tilt.style.setProperty("--mx", mx.toFixed(3))
      tilt.style.setProperty("--my", my.toFixed(3))
    }
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      mx = ((e.clientX - r.left) / r.width) * 2 - 1
      my = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onLeave = () => {
      mx = 0
      my = 0
      if (!raf) raf = requestAnimationFrame(apply)
    }
    stage.addEventListener("pointermove", onMove)
    stage.addEventListener("pointerleave", onLeave)
    return () => {
      stage.removeEventListener("pointermove", onMove)
      stage.removeEventListener("pointerleave", onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const max = Math.max(1, ...Object.values(counts))
  const lit = EMIRATES.filter((e) => (counts[e.code] ?? 0) > 0)
  const rows = [...EMIRATES]
    .filter((e) => !hideEmpty || (counts[e.code] ?? 0) > 0)
    .sort((a, b) => (counts[b.code] ?? 0) - (counts[a.code] ?? 0))
  const total = Object.values(counts).reduce((n, c) => n + c, 0)
  const rank = (code: string) => rows.findIndex((e) => e.code === code)

  const slabLayers = Array.from({ length: SLAB / SLAB_STEP }, (_, i) => -SLAB + i * SLAB_STEP)

  return (
    <section className="um wf relative overflow-hidden py-24 text-white lg:py-28">
      <noscript>
        <style>{`.um [class*="um-"], .um [class*="wf-"], .um .um-em svg { opacity: 1 !important; stroke-dashoffset: 0 !important; } .um .um-em { transform: translateZ(var(--h)) !important; }`}</style>
      </noscript>

      {/* Background: deep navy falling to near-black, a gold light behind the
          model, and a faint vignette so the relief reads as lit from above. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#08213f_0%,#06182e_45%,#030d1c_100%)]" />
        <div className="absolute right-[-10%] top-[10%] h-[80%] w-[70%] bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0.04)_55%,rgba(214,179,87,0)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(0,0,0,0.35),transparent_60%)]" />
      </div>

      <InView className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" threshold={0.2}>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-8">
          {/* ── Copy and the list ─────────────────────────────────── */}
          <div className="lg:col-span-5">
            <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              {eyebrow}
            </p>
            <h2 className="mt-5 font-['Outfit'] text-[38px] font-bold leading-[1.05] tracking-tight sm:text-[48px]">
              <span className="wf-word block"><span style={{ ["--i" as string]: 0 }}>{titleTop}</span></span>
              <span className="wf-word block"><span style={{ ["--i" as string]: 1 }} className="wf-gold">{lit.length} {lit.length === 1 ? "emirate" : "emirates"}.</span></span>
            </h2>
            <p className="wf-fade mt-6 max-w-md text-[15px] leading-relaxed text-white/70" style={{ ["--d" as string]: "500ms" }}>
              {intro ?? `${total.toLocaleString("en-US")} live projects, counted from the listings published on this site. The taller the block, the more we have selling there. Choose an emirate to see them.`}
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
                      <Link href={hrefFor(e.cityParam)} className={`${cls} group`} style={style} onFocus={() => setActive(e.code)} onBlur={() => setActive(null)}>
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

          {/* ── The relief ────────────────────────────────────────── */}
          <div className="lg:col-span-7">
            <div ref={stageRef} className="um-stage um-float relative mx-auto w-full max-w-[860px]" style={{ aspectRatio: ASPECT }}>
              <div ref={tiltRef} className="um-tilt absolute inset-0">
                {/* Floor: a dot grid receding under the slab */}
                <div className="um-floor um-layer absolute left-[-30%] top-[-30%] h-[160%] w-[160%]" style={{ transform: `translateZ(${-SLAB - 2}px)`, ["--d" as string]: "0ms" }} />

                {/* Soft shadow under the slab */}
                <Plane z={-SLAB - 1} className="um-layer um-shadow" style={{ ["--d" as string]: "200ms" }}>
                  {UAE_EMIRATES.map((p) => <path key={p.code} d={p.d} fill="#000" fillOpacity={0.55} />)}
                </Plane>

                {/* Slab thickness */}
                {slabLayers.map((z, i) => (
                  <Plane key={`slab-${z}`} z={z} className="um-layer" style={{ ["--d" as string]: `${200 + i * 60}ms` }}>
                    {UAE_EMIRATES.map((p) => <path key={p.code} d={p.d} fill={NAVY_SIDE} stroke={NAVY_SIDE} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
                  </Plane>
                ))}

                {/* Slab top: every emirate flat, outlines drawing in; the
                    neutral zones dashed; zero-count emirates labelled here */}
                <Plane z={0} className="um-layer" style={{ ["--d" as string]: "450ms" }}>
                  {UAE_EMIRATES.map((p, i) => {
                    const neutral = p.code.startsWith("NZ")
                    return (
                      <path
                        key={`top-${p.code}`}
                        d={p.d}
                        pathLength={1}
                        className="um-path"
                        style={{ ["--d" as string]: `${500 + i * 120}ms` }}
                        fill={NAVY_TOP}
                        stroke="#d6b357"
                        strokeOpacity={neutral ? 0.6 : 0.5}
                        strokeWidth={neutral ? 0.8 : 1.1}
                        strokeDasharray={neutral ? "4 4" : undefined}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}
                  {UAE_EMIRATES.filter((p) => LABEL[p.code] && (counts[p.code] ?? 0) === 0).map((p) => (
                    <Label key={`flat-label-${p.code}`} code={p.code} cx={p.cx} cy={p.cy} name={p.name} count={0} dim />
                  ))}
                </Plane>

                {/* Blocks: one stack per emirate with projects */}
                {UAE_EMIRATES.filter((p) => (counts[p.code] ?? 0) > 0).map((p) => {
                  const count = counts[p.code] ?? 0
                  const h = Math.round(BLOCK_MIN + (BLOCK_MAX - BLOCK_MIN) * (count / max))
                  const layers = Math.max(1, Math.round(h / BLOCK_STEP))
                  const isActive = active === p.code
                  // Steep curve so a distant second (27 vs 224) reads as a
                  // muted bronze, not a second Dubai.
                  const t = Math.pow(count / max, 0.6)
                  const top = mix(BRONZE_TOP, GOLD_TOP, t)
                  const side = shade(top, 0.55)
                  const sideLit = shade(top, 0.72)
                  const gradId = `um-gold-${p.code}`
                  return (
                    <div
                      key={`em-${p.code}`}
                      className="um-em absolute inset-0"
                      data-active={isActive ? "true" : "false"}
                      style={{ ["--h" as string]: `${h}px`, ["--d" as string]: `${1100 + rank(p.code) * 160}ms` }}
                    >
                      {Array.from({ length: layers }, (_, i) => {
                        const z = -h + (i * h) / layers
                        const litSide = i > layers * 0.6
                        return (
                          <Plane key={`side-${i}`} z={z}>
                            <path d={p.d} fill={litSide ? sideLit : side} stroke={litSide ? sideLit : side} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                          </Plane>
                        )
                      })}
                      <Plane z={0} className="um-em-top">
                        <defs>
                          {/* Lit from the top-left so the top faces catch light. */}
                          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor={shade(top, 1.18)} />
                            <stop offset="0.55" stopColor={top} />
                            <stop offset="1" stopColor={shade(top, 0.8)} />
                          </linearGradient>
                        </defs>
                        <path
                          d={p.d}
                          fill={`url(#${gradId})`}
                          fillOpacity={1}
                          stroke={isActive ? "#fff3c4" : mix("#b8913f", "#f6e3a8", t)}
                          strokeWidth={isActive ? 2 : 1.2}
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          className="um-hit"
                          onMouseEnter={() => setActive(p.code)}
                          onMouseLeave={() => setActive(null)}
                        />
                        <Label code={p.code} cx={p.cx} cy={p.cy} name={p.name} count={count} dim={false} />
                      </Plane>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="wf-fade mt-6 text-right text-[11px] uppercase tracking-[0.16em] text-white/40" style={{ ["--d" as string]: "2200ms" }}>
              Block height = live projects · boundaries: Natural Earth
            </p>
          </div>
        </div>
      </InView>
    </section>
  )
}
