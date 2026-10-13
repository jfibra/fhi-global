"use client"

/**
 * The genealogy as an org chart: the root at the top, recruits fanning out on
 * connector lines, photos in circles, tap a person to open the next level.
 * Michelle has 214 direct recruits, so every branch pages its children ten at
 * a time (‹ 1–10 of 214 ›), the canvas pans (drag) and zooms (wheel, pinch,
 * buttons), and "Focus" makes any person the top of the chart.
 *
 * Pure layout: every open node's width is the sum of its visible children's
 * widths; the parent sits centred above them; connectors are drawn in one SVG
 * over the same coordinates. No chart library.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Crosshair, Minus, Plus, Maximize2, TrendingUp, UserPlus } from "lucide-react"
import { roleToLabel } from "@/lib/app-roles"
import { STATUS_COLORS } from "@/lib/user-service"
import type { GenealogyNode, GenealogyResponse } from "@/app/api/genealogy/route"

const NODE_W = 156
const NODE_H = 128
const H_GAP = 18
const V_GAP = 64
const PAGE = 10

type Person = { id: string; name: string; photo: string | null; role: string | null; status: string | null; direct: number; network: number; deals: number; level: number }
type Placed = { p: Person; x: number; y: number; children: Placed[]; page: number; pages: number; total: number }

function Avatar({ p, size }: { p: Person; size: number }) {
  const cls = `rounded-full object-cover ring-[3px] ${p.deals > 0 ? "ring-[#d6b357]" : "ring-white"} shadow-[0_6px_16px_-8px_rgba(0,31,63,0.5)]`
  return p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo} alt="" loading="lazy" width={size} height={size} draggable={false} className={cls} style={{ width: size, height: size }} />
  ) : (
    <span className={`flex items-center justify-center bg-gradient-to-br from-[#001f3f] to-[#003366] font-['Outfit'] font-bold text-white ${cls}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {p.name.charAt(0).toUpperCase()}
    </span>
  )
}

export function TreeChart({ data, selling }: { data: GenealogyResponse; selling: boolean }) {
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data])
  const childrenOf = useMemo(() => {
    const m = new Map<string, GenealogyNode[]>()
    for (const n of data.nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n])
    // Sellers and recruiters first, so the interesting people are on page 1.
    for (const list of m.values()) list.sort((a, b) => b.deals - a.deals || b.network - a.network || (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""))
    return m
  }, [data])
  const rootPerson = useCallback(
    (id: string): Person => {
      if (id === data.root.id) return { id, name: data.root.name, photo: data.root.photo, role: data.root.role, status: "active", direct: data.summary.direct, network: data.summary.network, deals: 0, level: 0 }
      const n = byId.get(id)!
      return { ...n }
    },
    [data, byId],
  )

  const [focus, setFocus] = useState(data.root.id)
  const [open, setOpen] = useState<Set<string>>(() => new Set([data.root.id]))
  const [page, setPage] = useState<Map<string, number>>(new Map())
  const [view, setView] = useState({ x: 0, y: 0, s: 1 })
  const frame = useRef<HTMLDivElement>(null)
  // The canvas size as state, so zoom/fit never read the ref during render.
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setFrameSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)

  // Branch filter: with "Selling only", a child is shown when its branch holds a seller.
  const hasSeller = useMemo(() => {
    const m = new Map<string, boolean>()
    const walk = (id: string): boolean => {
      if (m.has(id)) return m.get(id)!
      const own = (byId.get(id)?.deals ?? 0) > 0
      const any = (childrenOf.get(id) ?? []).reduce((a, c) => walk(c.id) || a, false) || own
      m.set(id, any)
      return any
    }
    for (const n of data.nodes) walk(n.id)
    return m
  }, [data, byId, childrenOf])
  const kidsOf = useCallback((id: string) => (childrenOf.get(id) ?? []).filter((c) => !selling || hasSeller.get(c.id)), [childrenOf, selling, hasSeller])

  // Layout: widths bottom-up, positions top-down.
  const layout = useMemo(() => {
    const width = (id: string): number => {
      if (!open.has(id)) return NODE_W
      const kids = kidsOf(id)
      const pg = page.get(id) ?? 0
      const slice = kids.slice(pg * PAGE, pg * PAGE + PAGE)
      if (!slice.length) return NODE_W
      return Math.max(NODE_W, slice.reduce((a, c) => a + width(c.id), 0) + H_GAP * (slice.length - 1))
    }
    const place = (id: string, x: number, y: number): Placed => {
      const p = rootPerson(id)
      const kids = kidsOf(id)
      const pg = page.get(id) ?? 0
      const pages = Math.max(1, Math.ceil(kids.length / PAGE))
      const slice = open.has(id) ? kids.slice(pg * PAGE, pg * PAGE + PAGE) : []
      const w = width(id)
      const children: Placed[] = []
      let cx = x
      for (const c of slice) {
        const cw = width(c.id)
        children.push(place(c.id, cx, y + NODE_H + V_GAP))
        cx += cw + H_GAP
      }
      return { p, x: x + (w - NODE_W) / 2, y, children, page: pg, pages, total: kids.length }
    }
    const root = place(focus, 0, 0)
    let maxX = 0
    let maxY = 0
    const walk = (n: Placed) => {
      maxX = Math.max(maxX, n.x + NODE_W)
      maxY = Math.max(maxY, n.y + NODE_H)
      n.children.forEach(walk)
    }
    walk(root)
    return { root, w: maxX, h: maxY }
  }, [focus, open, page, kidsOf, rootPerson])

  const fit = useCallback(() => {
    const fw = frameSize.w
    const fh = frameSize.h
    if (!fw || !fh) return
    // Never shrink below 0.6 — cards must stay readable; the canvas pans for the rest.
    const s = Math.min(1, Math.max(0.6, (fw - 32) / Math.max(layout.w, 1), 0.6), (fh - 40) / Math.max(layout.h, 1), 1)
    setView({ s, x: (fw - layout.w * s) / 2, y: 24 })
  }, [layout, frameSize])
  useEffect(() => {
    // Keep the top centred as branches open; the user's own zoom is kept.
    // Deferred a tick so the effect never sets state synchronously.
    if (!frameSize.w) return
    const id = window.setTimeout(() => setView((v) => ({ ...v, x: (frameSize.w - layout.w * v.s) / 2 })), 0)
    return () => window.clearTimeout(id)
  }, [layout, frameSize.w])
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    // Fit once per focused person (and once the canvas has a size).
    if (!frameSize.w || fitted.current === focus) return
    fitted.current = focus
    const id = window.setTimeout(fit, 0)
    return () => window.clearTimeout(id)
  }, [focus, frameSize.w, fit])

  const zoom = useCallback(
    (f: number, cx?: number, cy?: number) => {
      const px = cx ?? frameSize.w / 2
      const py = cy ?? frameSize.h / 2
      setView((v) => {
        const s = Math.min(2.5, Math.max(0.2, v.s * f))
        return { s, x: px - ((px - v.x) * s) / v.s, y: py - ((py - v.y) * s) / v.s }
      })
    },
    [frameSize],
  )
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top)
    },
    [zoom],
  )
  const onDown = useCallback((e: React.PointerEvent) => {
    setView((v) => {
      drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false }
      return v
    })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])
  const onMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
  }, [])
  const onUp = useCallback(() => {
    // Keep `moved` for the click that follows the pointer-up, then forget the drag.
    const d = drag.current
    if (d) window.setTimeout(() => { if (drag.current === d) drag.current = null }, 0)
  }, [])
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const setPg = (id: string, pg: number) => setPage((m) => new Map(m).set(id, pg))
  const focusOn = (id: string) => {
    setFocus(id)
    setOpen((s) => new Set([...s, id]))
  }
  // A click that ends a drag must not open a branch.
  const clickCard = useCallback((id: string, total: number) => {
    if (drag.current?.moved || total === 0) return
    toggle(id)
  }, [])

  // Flatten for rendering.
  const placed: Placed[] = []
  const links: Array<{ from: Placed; to: Placed }> = []
  const collect = (n: Placed) => {
    placed.push(n)
    for (const c of n.children) {
      links.push({ from: n, to: c })
      collect(c)
    }
  }
  collect(layout.root)

  // Breadcrumb from the real root down to the focused person.
  const trail: Person[] = []
  for (let cur: string | undefined = focus; cur && cur !== data.root.id; cur = byId.get(cur)?.parentId) trail.unshift(rootPerson(cur))

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Chart path" className="flex flex-wrap items-center gap-1 text-[12px] font-semibold text-[#6b7280]">
          <button type="button" onClick={() => focusOn(data.root.id)} className={`rounded-md px-1.5 py-0.5 hover:bg-[#f1f3f6] ${focus === data.root.id ? "text-[#001f3f]" : ""}`}>{data.root.name}</button>
          {trail.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-[#c5ccd6]" />
              <button type="button" onClick={() => focusOn(p.id)} className={`rounded-md px-1.5 py-0.5 hover:bg-[#f1f3f6] ${focus === p.id ? "text-[#001f3f]" : ""}`}>{p.name}</button>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {[
            { label: "Zoom out", icon: Minus, act: () => zoom(1 / 1.25) },
            { label: "Zoom in", icon: Plus, act: () => zoom(1.25) },
            { label: "Fit to screen", icon: Maximize2, act: fit },
          ].map((b) => (
            <button key={b.label} type="button" onClick={b.act} aria-label={b.label} title={b.label} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#374151] transition-colors hover:border-[#d6b357]">
              <b.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div
        ref={frame}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-[70vh] min-h-[520px] cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-[#e8eaed] active:cursor-grabbing"
        style={{ backgroundColor: "#f7f8fa", backgroundImage: "radial-gradient(#d9dde3 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, width: layout.w, height: layout.h }}>
          <svg className="pointer-events-none absolute left-0 top-0" width={layout.w} height={layout.h} aria-hidden="true">
            {links.map(({ from, to }) => {
              const x1 = from.x + NODE_W / 2
              const y1 = from.y + NODE_H
              const x2 = to.x + NODE_W / 2
              const y2 = to.y
              const ym = y1 + V_GAP / 2
              return <path key={`${from.p.id}-${to.p.id}`} d={`M${x1},${y1} V${ym} H${x2} V${y2}`} fill="none" stroke={to.p.deals > 0 ? "#d6b357" : "#b9c2cf"} strokeWidth={to.p.deals > 0 ? 2.5 : 2} strokeLinejoin="round" />
            })}
          </svg>
          {placed.map((n) => {
            const p = n.p
            const isRoot = n === layout.root
            const isOpen = open.has(p.id) && n.total > 0
            const c = STATUS_COLORS[p.status ?? "pending"] ?? STATUS_COLORS.pending
            return (
              <div key={p.id} className="absolute" style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}>
                <div
                  className={`group relative flex h-full flex-col items-center rounded-2xl border bg-white px-2 pb-2 pt-3 text-center shadow-[0_10px_26px_-18px_rgba(0,31,63,0.45)] transition-shadow hover:shadow-[0_14px_30px_-16px_rgba(0,31,63,0.55)] ${isRoot ? "border-[#d6b357]" : "border-[#e5e8ec]"}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    clickCard(p.id, n.total)
                  }}
                  role={n.total > 0 ? "button" : undefined}
                  title={n.total > 0 ? (isOpen ? "Close branch" : "Open branch") : undefined}
                >
                  <Avatar p={p} size={44} />
                  <p className="mt-1.5 line-clamp-2 w-full font-['Outfit'] text-[12px] font-bold leading-tight text-[#0d1117]">{p.name}</p>
                  <p className="mt-0.5 text-[10px] text-[#9ca3af]">{roleToLabel(p.role)}{!isRoot && p.status ? <> · <span className={`${c.text} font-semibold capitalize`}>{p.status}</span></> : null}</p>
                  <div className="mt-auto flex items-center gap-1 text-[10px] font-bold">
                    {p.network > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#001f3f]/5 px-1.5 py-0.5 text-[#001f3f]">
                        <UserPlus className="h-2.5 w-2.5" /> {p.network}
                      </span>
                    )}
                    {p.deals > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                        <TrendingUp className="h-2.5 w-2.5" /> {p.deals}
                      </span>
                    )}
                  </div>
                  {!isRoot && p.network > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        focusOn(p.id)
                      }}
                      title="Make this person the top of the chart"
                      aria-label={`Focus on ${p.name}`}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#e5e8ec] bg-white text-[#6b7280] opacity-0 shadow transition-opacity hover:border-[#d6b357] hover:text-[#001f3f] group-hover:opacity-100"
                    >
                      <Crosshair className="h-3 w-3" />
                    </button>
                  )}
                  {n.total > 0 && (
                    <span className={`absolute -bottom-3 left-1/2 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold ${isOpen ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#d6b357] bg-white text-[#001f3f]"}`}>
                      {isOpen ? "–" : `+${n.total}`}
                    </span>
                  )}
                </div>
                {isOpen && n.pages > 1 && (
                  <div className="absolute left-1/2 top-full z-10 mt-5 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-[#e5e8ec] bg-white px-1 py-0.5 text-[10.5px] font-bold text-[#374151] shadow" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Previous ten" disabled={n.page === 0} onClick={() => setPg(p.id, n.page - 1)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f1f3f6] disabled:opacity-30">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {n.page * PAGE + 1}–{Math.min(n.total, (n.page + 1) * PAGE)} of {n.total}
                    <button type="button" aria-label="Next ten" disabled={n.page >= n.pages - 1} onClick={() => setPg(p.id, n.page + 1)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f1f3f6] disabled:opacity-30">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[10.5px] font-semibold text-[#9ca3af]">Drag to move · scroll or pinch to zoom · tap a person to open their branch</p>
      </div>
    </div>
  )
}
