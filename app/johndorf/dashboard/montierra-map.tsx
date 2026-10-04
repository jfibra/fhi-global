"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft, Bath, BedDouble, Car, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, DoorOpen, Expand, Home, Landmark, Layers, MapPin,
  Palette, Ruler, Trees, Warehouse, Waves, X,
} from "lucide-react"
import {
  BLOCKS,
  CLUSTERS,
  FACILITIES,
  HOUSE_MODELS,
  STATUS,
  TOTALS,
  blockLots,
  bookingCounts,
  centroid,
  clusterCounts,
  lotBooking,
  residentialLots,
  type Block,
  type ClusterId,
  type Facility,
  type LotStatus,
} from "@/lib/johndorf/montierra"
import { HouseIllustration } from "./house-illustration"

const RED = "#b4241c"
type Selected = { kind: "block"; item: Block } | { kind: "facility"; item: Facility }
type ColorBy = "status" | "cluster"

const fmt = (n: number) => n.toLocaleString("en-US")
const points = (poly: [number, number][]) => poly.map((p) => p.join(",")).join(" ")
const ease = [0.22, 1, 0.36, 1] as const

/**
 * The Montierra subdivision plan, clickable: every block and facility is a
 * hotspot over the drawing. Block → its homes and availability; a lot → that
 * house and who has it. Few words, big pictures — it's a presentation.
 */
export function MontierraMap() {
  const [sel, setSel] = useState<Selected | null>(null)
  const [lot, setLot] = useState<number | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [filter, setFilter] = useState<ClusterId | null>(null)

  const all = useMemo<Selected[]>(
    () => [...BLOCKS.map((b) => ({ kind: "block", item: b }) as Selected), ...FACILITIES.map((f) => ({ kind: "facility", item: f }) as Selected)],
    [],
  )
  const hovered = all.find((s) => s.item.id === hover) ?? null
  const select = (s: Selected | null) => {
    setSel(s)
    setLot(null)
  }

  // Esc: back out of a lot, then close.
  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (lot !== null) setLot(null)
      else setSel(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sel, lot])

  const inFilter = (s: Selected) => !filter || (s.kind === "block" && s.item.runs.some((r) => r[2] === filter))
  const panelKey = sel ? `${sel.item.id}:${lot ?? ""}` : "empty"

  return (
    <div className="space-y-6">
      {/* ── Headline numbers ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { icon: Layers, label: "Blocks", value: TOTALS.blocks },
          { icon: Home, label: "Home lots", value: TOTALS.lots },
          { icon: Trees, label: "Parks", value: TOTALS.parks + 1 },
          { icon: Warehouse, label: "Commercial sqm", value: TOTALS.commercialSqm },
          { icon: Palette, label: "Clusters", value: 3 },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.5, ease }}
            className="rounded-lg border border-[#ece5e2] bg-white px-4 py-3.5"
          >
            <s.icon className="h-4 w-4 text-[#b4241c]" />
            <p className="mt-2 font-[family-name:var(--font-jd-serif)] text-2xl font-semibold tabular-nums text-[#2a1d1b]">
              <CountUp to={s.value} />
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a7a75]">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* ── The plan ── */}
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease }} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b4241c]">Subdivision plan</p>
            {/* Cluster legend — also filters the map */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(CLUSTERS) as ClusterId[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter((f) => (f === k ? null : k))}
                  aria-pressed={filter === k}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-px ${
                    filter === k ? "border-[#2a1d1b] bg-[#2a1d1b] text-white" : "border-[#e3dcd8] bg-white text-[#4b3b37] hover:border-[#b4241c]"
                  }`}
                >
                  <span className="h-3 w-3 rounded-sm" style={{ background: CLUSTERS[k].color }} />
                  {CLUSTERS[k].label.replace(" Cluster", "")}
                  <span className={`text-[11px] tabular-nums ${filter === k ? "text-white/70" : "text-[#a89c98]"}`}>{TOTALS.byCluster[k]}</span>
                </button>
              ))}
              <a
                href="/johndorf/montierra-plan.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e3dcd8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b3b37] transition-all hover:-translate-y-px hover:border-[#b4241c]"
                title="Open the full-size plan"
              >
                <Expand className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[#ece5e2] bg-white shadow-[0_24px_60px_-32px_rgba(80,20,15,0.45)]">
            <Image
              src="/johndorf/montierra-plan.jpg"
              alt="Montierra subdivision plan"
              width={2048}
              height={1448}
              priority
              sizes="(min-width: 1280px) calc(100vw - 500px), (min-width: 1024px) calc(100vw - 440px), 100vw"
              className="block h-auto w-full select-none"
              draggable={false}
            />
            <svg viewBox="0 0 2000 1414" className="absolute inset-0 h-full w-full" aria-label="Blocks and facilities on the plan">
              {all.map((s) => {
                const active = sel?.item.id === s.item.id
                const dim = filter ? !inFilter(s) : false
                const hot = hover === s.item.id
                // Blocks breathe until something is picked — the hint that they're clickable.
                const breathe = !sel && !hot && !dim && s.kind === "block"
                return (
                  <polygon
                    key={s.item.id}
                    points={points(s.item.polygon)}
                    role="button"
                    tabIndex={0}
                    aria-label={s.item.name}
                    onMouseEnter={() => setHover(s.item.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(s.item.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => select(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        select(s)
                      }
                    }}
                    className={`cursor-pointer outline-none transition-[fill] duration-200 ${breathe ? "jd-breathe" : ""}`}
                    style={{
                      fill: active ? "rgba(180,36,28,0.24)" : hot ? "rgba(255,255,255,0.30)" : dim ? "rgba(247,244,242,0.74)" : "transparent",
                      stroke: active || hot || breathe ? RED : "transparent",
                      strokeOpacity: active || hot ? 1 : undefined,
                      strokeWidth: active ? 7 : 4,
                      strokeLinejoin: "round",
                    }}
                  />
                )
              })}
            </svg>
            {/* hover label */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  key={hovered.item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md bg-[#2a1d1b] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                  style={{ left: `${(centroid(hovered.item.polygon)[0] / 2000) * 100}%`, top: `${(centroid(hovered.item.polygon)[1] / 1414) * 100}%` }}
                >
                  {hovered.item.name}
                  {hovered.kind === "block" && hovered.item.kind === "residential" && (
                    <span className="ml-1.5 font-normal text-white/70">· {bookingCounts(hovered.item).available} available</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick list — every hotspot, for keyboards, phones and finding a block fast */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {all.map((s) => (
              <button
                key={s.item.id}
                type="button"
                onClick={() => select(s)}
                onMouseEnter={() => setHover(s.item.id)}
                onMouseLeave={() => setHover(null)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all hover:-translate-y-px ${
                  sel?.item.id === s.item.id
                    ? "border-[#b4241c] bg-[#b4241c] text-white"
                    : "border-[#e3dcd8] bg-white text-[#4b3b37] hover:border-[#b4241c] hover:text-[#b4241c]"
                }`}
              >
                {s.item.name.replace(" · Commercial Zone", "").replace("Main Gate & Guardhouse", "Gate").replace("Clubhouse & Pool", "Clubhouse")}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── Details — beside the map on desktop ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={panelKey}
                initial={{ opacity: 0, x: 28, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 18, scale: 0.985 }}
                transition={{ duration: 0.28, ease }}
              >
                {sel ? <Details sel={sel} lot={lot} onLot={setLot} onClose={() => select(null)} /> : <EmptyPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {/* ── Details — a sheet over the map on phones ── */}
      <AnimatePresence>
        {sel && (
          <motion.div key="sheet" className="fixed inset-0 z-[80] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close" className="absolute inset-0 bg-[#2a1d1b]/55 backdrop-blur-[2px]" onClick={() => select(null)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease }}
              className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-2xl bg-[#f7f4f2] p-4 pb-8 shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#d9cfca]" />
              <AnimatePresence mode="wait">
                <motion.div key={panelKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Details sel={sel} lot={lot} onLot={setLot} onClose={() => select(null)} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Numbers that count up when they appear. */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const dur = 900
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{fmt(n)}</>
}

function EmptyPanel() {
  return (
    <div className="rounded-lg border border-dashed border-[#d9cfca] bg-white/60 p-10 text-center">
      <motion.span
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#b4241c]/10"
      >
        <MapPin className="h-6 w-6 text-[#b4241c]" />
      </motion.span>
      <h3 className="mt-4 font-[family-name:var(--font-jd-serif)] text-2xl font-semibold text-[#2a1d1b]">Select a block</h3>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-semibold text-[#7d6c68]">
        {(Object.keys(STATUS) as LotStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5e2] bg-white px-2.5 py-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[k].color }} /> {STATUS[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A photo that drifts slowly; the illustration stands in until the file exists. */
function Photo({ src, alt, fallback, className = "aspect-[16/9]" }: { src?: string; alt: string; fallback: React.ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={`overflow-hidden ${className}`}>{fallback}</div>
  return (
    <div className={`overflow-hidden bg-[#ece5e2] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local presentation renders */}
      <img src={src} alt={alt} onError={() => setFailed(true)} className="jd-kenburns h-full w-full object-cover" />
    </div>
  )
}

function Tile({ icon: Icon, value, label }: { icon: typeof Ruler; value: string; label: string }) {
  return (
    <div className="rounded-md border border-[#ece5e2] bg-white px-3 py-2.5">
      <Icon className="h-4 w-4 text-[#b4241c]" />
      <p className="mt-1.5 font-[family-name:var(--font-jd-serif)] text-lg font-semibold leading-none text-[#2a1d1b]">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a89c98]">{label}</p>
    </div>
  )
}

function Details({ sel, lot, onLot, onClose }: { sel: Selected; lot: number | null; onLot: (n: number | null) => void; onClose: () => void }) {
  const isHomeLot = sel.kind === "block" && sel.item.kind === "residential" && lot !== null
  const eyebrow =
    sel.kind === "facility" ? "Facility" : sel.item.kind === "commercial" ? "Commercial zone" : isHomeLot ? sel.item.name : "Residential block"
  const title = isHomeLot ? `Lot ${lot}` : sel.item.name.replace(" · Commercial Zone", "")
  const sub =
    sel.kind === "block" && sel.item.kind === "residential"
      ? isHomeLot
        ? CLUSTERS[blockLots(sel.item)[lot - 1].cluster ?? "green"].label
        : `${residentialLots(sel.item)} lots · ${sel.item.areas[0]}–${sel.item.areas[sel.item.areas.length - 1]} sqm`
      : sel.kind === "block"
        ? `${fmt(sel.item.areaSqm ?? 0)} sqm`
        : sel.item.areaSqm
          ? `${fmt(sel.item.areaSqm)} sqm`
          : sel.item.detail

  return (
    <div className="overflow-hidden rounded-lg border border-[#ece5e2] bg-white shadow-[0_24px_60px_-32px_rgba(80,20,15,0.45)]">
      <div className="relative bg-[#2a1d1b] px-5 pt-5 pb-4 text-white">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#b4241c]" />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-4 rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          {isHomeLot && (
            <button type="button" onClick={() => onLot(null)} aria-label="Back to the block" className="-ml-1.5 rounded p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e6a39e]">{eyebrow}</p>
        </div>
        <h3 className="mt-1 pr-8 font-[family-name:var(--font-jd-serif)] text-3xl font-semibold leading-tight">{title}</h3>
        <p className="mt-1 text-sm text-white/70">{sub}</p>
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4 lg:max-h-[calc(100vh-11rem)]">
        {sel.kind === "facility" ? (
          <FacilityDetails f={sel.item} />
        ) : sel.item.kind === "commercial" ? (
          <CommercialDetails b={sel.item} />
        ) : lot !== null ? (
          <LotDetails b={sel.item} lot={lot} onLot={onLot} />
        ) : (
          <BlockDetails key={sel.item.id} b={sel.item} onLot={onLot} />
        )}
      </div>
    </div>
  )
}

function HouseCard({ cluster, compact = false }: { cluster: ClusterId; compact?: boolean }) {
  const house = HOUSE_MODELS[cluster]
  return (
    <div className="overflow-hidden rounded-lg border border-[#ece5e2]">
      <div className="relative">
        <Photo src={house.photos[0]} alt={house.name} fallback={<HouseIllustration cluster={cluster} className="h-full w-full" />} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2a1d1b]/80 to-transparent px-4 pb-3 pt-10 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur">
            <span className="h-2 w-2 rounded-full" style={{ background: CLUSTERS[cluster].color }} /> {CLUSTERS[cluster].label}
          </span>
          <p className="mt-1 font-[family-name:var(--font-jd-serif)] text-xl font-semibold leading-tight">{house.name}</p>
          {!compact && <p className="text-xs text-white/75">{house.type}</p>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 p-3">
        <Tile icon={Ruler} value={`${house.floorAreaSqm}`} label="sqm floor" />
        <Tile icon={BedDouble} value={`${house.bedrooms}`} label="Bedrooms" />
        <Tile icon={Bath} value={`${house.baths}`} label="Baths" />
        <Tile icon={Car} value={`${house.carport}`} label={house.carport > 1 ? "Cars" : "Car"} />
      </div>
    </div>
  )
}

function BlockDetails({ b, onLot }: { b: Block; onLot: (n: number) => void }) {
  const counts = clusterCounts(b)
  const clusters = (Object.keys(CLUSTERS) as ClusterId[]).filter((k) => counts[k] > 0)
  const lots = blockLots(b)
  const booked = bookingCounts(b)
  const [model, setModel] = useState<ClusterId>(clusters[0] ?? "green")
  const [colorBy, setColorBy] = useState<ColorBy>("status")

  return (
    <div className="space-y-4">
      {/* Availability at a glance */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(STATUS) as LotStatus[]).map((k, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35, ease }}
            className="rounded-md px-3 py-2.5"
            style={{ background: STATUS[k].soft }}
          >
            <p className="font-[family-name:var(--font-jd-serif)] text-2xl font-semibold leading-none tabular-nums" style={{ color: STATUS[k].text }}>
              {booked[k]}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: STATUS[k].text }}>
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS[k].color }} /> {STATUS[k].label}
            </p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={model} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease }}>
          <HouseCard cluster={model} />
        </motion.div>
      </AnimatePresence>

      {clusters.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {clusters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setModel(k)}
              aria-pressed={model === k}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-px ${
                model === k ? "border-[#2a1d1b] bg-[#2a1d1b] text-white" : "border-[#e3dcd8] text-[#4b3b37] hover:border-[#b4241c]"
              }`}
            >
              <span className="h-3 w-3 rounded-sm" style={{ background: CLUSTERS[k].color }} />
              {CLUSTERS[k].label.replace(" Cluster", "")}
              <span className={`tabular-nums ${model === k ? "text-white/70" : "text-[#a89c98]"}`}>{counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Lots — tap one for the house and who has it */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a89c98]">Lots · {b.lots}</p>
          <div className="inline-flex rounded-md border border-[#e3dcd8] p-0.5">
            {([
              ["status", CircleDot, "Colour by availability"],
              ["cluster", Palette, "Colour by cluster"],
            ] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setColorBy(mode)}
                aria-pressed={colorBy === mode}
                aria-label={label}
                title={label}
                className={`rounded p-1.5 transition-colors ${colorBy === mode ? "bg-[#2a1d1b] text-white" : "text-[#8a7a75] hover:text-[#2a1d1b]"}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
          {lots.map((l, i) => {
            const booking = l.cluster ? lotBooking(b.id, l.no) : null
            const bg = l.facility
              ? "#a9cbd6"
              : l.park
                ? "#1f8a2e"
                : !l.cluster
                  ? "#e9e2de"
                  : colorBy === "cluster"
                    ? CLUSTERS[l.cluster].color
                    : booking!.status === "available"
                      ? STATUS.available.soft
                      : STATUS[booking!.status].color
            const fg = l.park
              ? "#fff"
              : colorBy === "cluster"
                ? l.cluster === "yellow" || !l.cluster
                  ? "#2a1d1b"
                  : "#fff"
                : booking?.status === "available"
                  ? STATUS.available.text
                  : booking
                    ? "#fff"
                    : "#2a1d1b"
            const title = l.facility ?? (l.park ? `Lot ${l.no} · Parks & playgrounds` : booking ? `Lot ${l.no} · ${STATUS[booking.status].label}` : `Lot ${l.no}`)
            return (
              <motion.button
                key={l.no}
                type="button"
                disabled={!l.cluster}
                onClick={() => onLot(l.no)}
                title={title}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(0.6, i * 0.012), duration: 0.25, ease }}
                whileHover={l.cluster ? { scale: 1.18, zIndex: 1 } : undefined}
                whileTap={l.cluster ? { scale: 0.95 } : undefined}
                className={`flex aspect-square items-center justify-center rounded-[4px] text-[10px] font-bold ${l.cluster ? "cursor-pointer shadow-sm" : "cursor-default"} ${
                  colorBy === "status" && booking?.status === "available" ? "ring-1 ring-inset ring-[#2f9e44]/40" : ""
                }`}
                style={{ background: bg, color: fg }}
              >
                {l.no}
              </motion.button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[#8a7a75]">
          {colorBy === "status" ? (
            (Object.keys(STATUS) as LotStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: k === "available" ? STATUS.available.soft : STATUS[k].color, boxShadow: k === "available" ? "inset 0 0 0 1px rgba(47,158,68,0.5)" : undefined }} /> {STATUS[k].label}
              </span>
            ))
          ) : (
            clusters.map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: CLUSTERS[k].color }} /> {CLUSTERS[k].label.replace(" Cluster", "")}
              </span>
            ))
          )}
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#1f8a2e]" /> Park</span>
          {b.facilities && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#a9cbd6]" /> Facility</span>}
        </div>
      </div>
    </div>
  )
}

function LotDetails({ b, lot, onLot }: { b: Block; lot: number; onLot: (n: number) => void }) {
  const lots = blockLots(b)
  const l = lots[lot - 1]
  const cluster = l.cluster ?? "green"
  const booking = lotBooking(b.id, lot)
  const s = STATUS[booking.status]
  const homes = lots.filter((x) => x.cluster).map((x) => x.no)
  const at = homes.indexOf(lot)
  const prev = at > 0 ? homes[at - 1] : null
  const next = at >= 0 && at < homes.length - 1 ? homes[at + 1] : null
  const initials = booking.buyer ? booking.buyer.split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w.length > 2).slice(0, 2).map((w) => w[0]).join("") : ""

  return (
    <div className="space-y-4">
      <HouseCard cluster={cluster} compact />

      {/* Who has it */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease }}
        className="relative overflow-hidden rounded-lg border px-4 py-4"
        style={{ background: s.soft, borderColor: `${s.color}55` }}
      >
        <div className={`flex items-center gap-3 ${booking.status === "available" ? "jd-shine" : ""}`}>
          {booking.status === "available" ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: s.color }}>
              <CheckCircle2 className="h-5 w-5" />
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-jd-serif)] text-base font-semibold text-white" style={{ background: s.color }}>
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: s.text }}>
              {s.label}
            </p>
            {booking.buyer ? (
              <>
                <p className="truncate font-[family-name:var(--font-jd-serif)] text-xl font-semibold leading-tight text-[#2a1d1b]">{booking.buyer}</p>
                <p className="text-xs text-[#7d6c68]">{booking.date}</p>
              </>
            ) : (
              <p className="font-[family-name:var(--font-jd-serif)] text-xl font-semibold leading-tight text-[#2a1d1b]">Open for reservation</p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        <Tile icon={MapPin} value={`${b.areas[0]}–${b.areas[b.areas.length - 1]}`} label="Lot sqm (block)" />
        <Tile icon={Layers} value={`${HOUSE_MODELS[cluster].storeys}`} label="Storeys" />
      </div>

      {/* Walk the block */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={prev === null}
          onClick={() => prev !== null && onLot(prev)}
          className="inline-flex items-center gap-1 rounded-md border border-[#e3dcd8] px-3 py-2 text-xs font-semibold text-[#4b3b37] transition-colors hover:border-[#b4241c] hover:text-[#b4241c] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> {prev !== null ? `Lot ${prev}` : "—"}
        </button>
        <button
          type="button"
          disabled={next === null}
          onClick={() => next !== null && onLot(next)}
          className="inline-flex items-center gap-1 rounded-md border border-[#e3dcd8] px-3 py-2 text-xs font-semibold text-[#4b3b37] transition-colors hover:border-[#b4241c] hover:text-[#b4241c] disabled:opacity-30"
        >
          {next !== null ? `Lot ${next}` : "—"} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function CommercialDetails({ b }: { b: Block }) {
  return (
    <div className="space-y-4">
      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#e9d6bd] to-[#d7bb97]">
        <Warehouse className="h-12 w-12 text-[#7a5a3a]" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Ruler} value={fmt(b.areaSqm ?? 0)} label="sqm" />
        <Tile icon={DoorOpen} value="Own" label="Entrance / exit" />
      </div>
      <p className="text-xs text-[#7d6c68]">{b.frontage.join(" · ")}</p>
    </div>
  )
}

function FacilityDetails({ f }: { f: Facility }) {
  const Icon = f.kind === "park" ? Trees : f.kind === "clubhouse" ? Waves : f.kind === "gate" ? DoorOpen : f.kind === "rotunda" ? CircleDot : Landmark
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-[#ece5e2]">
        <Photo
          src={f.photo}
          alt={f.name}
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#dfe9ee] to-[#c4d7df]">
              <Icon className="h-12 w-12 text-[#4a6b7a]" />
            </div>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {f.areaSqm && <Tile icon={Ruler} value={fmt(f.areaSqm)} label="sqm" />}
        <Tile icon={Icon} value={f.kind === "park" ? `${TOTALS.parks + 1}` : f.kind === "clubhouse" ? "CF" : f.kind === "gate" ? "15 M" : f.kind === "rotunda" ? "12 M" : "CF"} label={f.kind === "park" ? "Park areas" : f.kind === "gate" || f.kind === "rotunda" ? "RROW" : "Community facility"} />
      </div>
      <p className="text-xs text-[#7d6c68]">{f.detail}</p>
    </div>
  )
}
