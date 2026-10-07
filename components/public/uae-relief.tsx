"use client"

import { useEffect, useRef } from "react"
import { EMIRATES } from "@/lib/emirates"
import { UAE_EMIRATES, UAE_VIEWBOX } from "@/lib/uae-emirates"

/**
 * The 3D UAE relief itself, split out of UaeMap so the page can mount it only when it is near the
 * viewport (it is ~40 stacked SVG planes — about 100 KB of HTML — that nobody sees until they scroll to
 * the section). UaeMap keeps the copy, the counts and the emirate link list, which stay in the server
 * HTML; this component draws the model and reports hover through `onActive`.
 *
 * A navy slab of the country sits on a receding dot-grid floor. Each emirate with live projects rises out
 * of the slab as a gold block whose height follows its project count, so Dubai stands tallest. The relief
 * is stacked SVG layers in a CSS preserve-3d context. The model tilts a few degrees toward the pointer and
 * floats slowly. Boundaries: Natural Earth 10m admin-1 (public domain).
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

/** The relief's width / height, for the placeholder that keeps its place before it mounts (no layout shift). */
export const UAE_RELIEF_ASPECT = ASPECT

export function UaeRelief({
  counts,
  active,
  onActive,
}: {
  counts: Record<string, number>
  active: string | null
  onActive: (code: string | null) => void
}) {
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
  // The block's entrance delay follows its rank by project count (largest first), among the emirates that have projects.
  const litByCount = EMIRATES.filter((e) => (counts[e.code] ?? 0) > 0).sort((a, b) => (counts[b.code] ?? 0) - (counts[a.code] ?? 0))
  const rank = (code: string) => litByCount.findIndex((e) => e.code === code)

  const slabLayers = Array.from({ length: SLAB / SLAB_STEP }, (_, i) => -SLAB + i * SLAB_STEP)

  return (
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
                  onMouseEnter={() => onActive(p.code)}
                  onMouseLeave={() => onActive(null)}
                />
                <Label code={p.code} cx={p.cx} cy={p.cy} name={p.name} count={count} dim={false} />
              </Plane>
            </div>
          )
        })}
      </div>
    </div>
  )
}
