"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, Bath, BedDouble, Car, Check, ChevronLeft, ChevronRight, Compass, HardHat, Layers, MapPin, Ruler, X } from "lucide-react"
import type { JdProjectDetail } from "@/lib/johndorf/projects"
import { ease, serif } from "./ui"

type Card = { name: string; place: string; region: string; status?: string; interactive?: true }

/**
 * A project's full sheet: photo gallery on the left (main picture, site plan,
 * latest construction photos), the facts on the right — every house type,
 * the amenities, the construction log — all from Johndorf's own project page.
 */
export function ProjectDetail({ project, detail, onClose }: { project: Card; detail: JdProjectDetail; onClose: () => void }) {
  const [shot, setShot] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const images = detail.images
  const go = (d: number) => setShot((i) => (i + d + images.length) % images.length)

  // Esc closes, arrows page the gallery; the page behind doesn't scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setShot((i) => (i + 1) % images.length)
      if (e.key === "ArrowLeft") setShot((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener("keydown", onKey)
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      window.removeEventListener("keydown", onKey)
      root.style.overflow = prev
    }
  }, [onClose, images.length])

  const img = images[shot]
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-modal="true"
      aria-label={project.name}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#160c0a]/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ duration: 0.5, ease }}
        className="relative grid h-full w-full max-w-[1240px] overflow-hidden bg-[#fbf8f6] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] lg:grid-cols-[1.2fr_1fr]"
      >
        {/* ── gallery ── */}
        <div className="relative flex min-h-[300px] flex-col bg-[#160c0a] sm:min-h-[380px] lg:min-h-[620px]">
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence initial={false}>
              <motion.div key={img.src} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease }} className="absolute inset-0">
                <Image src={img.src} alt={`${project.name} — ${img.label}`} fill sizes="(min-width:1024px) 680px, 100vw" className={img.kind === "plan" ? "object-contain bg-white p-3" : "object-cover"} />
              </motion.div>
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-4 left-5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
              {img.kind === "update" && <HardHat className="h-3.5 w-3.5 text-[#f0b6b1]" />}
              {img.label}
            </span>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#2a1d1b] shadow-lg backdrop-blur transition hover:bg-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#2a1d1b] shadow-lg backdrop-blur transition hover:bg-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto bg-[#160c0a] p-3">
              {images.map((m, i) => (
                <button
                  key={m.src}
                  type="button"
                  onClick={() => setShot(i)}
                  aria-label={`Show ${m.label}`}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === shot ? "border-[#e8c873]" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <Image src={m.src} alt="" fill sizes="96px" className={m.kind === "plan" ? "object-contain bg-white" : "object-cover"} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── facts ── */}
        <div className="relative max-h-[92vh] overflow-y-auto px-6 pb-8 pt-7 sm:px-9">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f1e9e5] text-[#2a1d1b] transition hover:bg-[#e7dbd5]"
          >
            <X className="h-5 w-5" />
          </button>

          <p className="flex flex-wrap items-center gap-2 pr-12 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b4241c]">
            {project.region}
            {project.status && <span className="rounded-full bg-[#2a1d1b] px-2.5 py-1 text-[10px] tracking-[0.14em] text-white">{project.status}</span>}
          </p>
          <h3 className={`${serif} mt-3 pr-10 text-4xl font-semibold leading-[1.05] text-[#2a1d1b] sm:text-5xl`}>{project.name}</h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#7d6c68]">
            <MapPin className="h-4 w-4 shrink-0 text-[#b4241c]" /> {project.place}
          </p>

          {/* house / unit types */}
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7a75]">{detail.units.length > 1 ? `${detail.units.length} house types` : "House type"}</p>
          <div className="mt-3 space-y-3">
            {detail.units.map((u) => (
              <motion.div key={u.type} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="rounded-2xl border border-[#efe6e2] bg-white p-4 sm:p-5">
                <p className={`${serif} text-xl font-semibold text-[#2a1d1b]`}>{u.type}</p>
                <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                  <Stat icon={<Ruler className="h-4 w-4" />} value={u.floorArea ? `${u.floorArea} m²` : "—"} label="Floor area" />
                  <Stat icon={<BedDouble className="h-4 w-4" />} value={u.bedrooms} label="Bedrooms" />
                  <Stat icon={<Bath className="h-4 w-4" />} value={u.baths} label="T&B" />
                  <Stat icon={<Layers className="h-4 w-4" />} value={u.floors} label="Floors" />
                  <Stat icon={<Car className="h-4 w-4" />} value={u.parking} label="Parking" />
                </div>
              </motion.div>
            ))}
          </div>
          {detail.units.some((u) => u.bedrooms.includes("*")) && <p className="mt-2 text-[11px] text-[#a8968f]">* As marked on Johndorf&apos;s project page.</p>}

          {/* amenities */}
          {detail.amenities.length > 0 && (
            <>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7a75]">Amenities &amp; facilities</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                {detail.amenities.map((a, i) => (
                  <motion.li key={a} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.025, ease }} className="flex items-start gap-2 text-sm text-[#4b3b37]">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#b4241c]/10 text-[#b4241c]">
                      <Check className="h-3 w-3" />
                    </span>
                    {a}
                  </motion.li>
                ))}
              </ul>
            </>
          )}

          {/* construction log */}
          {detail.updates && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#2a1d1b] px-5 py-4 text-white">
              <HardHat className="h-6 w-6 shrink-0 text-[#f0b6b1]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0b6b1]">Construction updates</p>
                <p className="mt-0.5 text-sm">
                  {detail.updates.count > 1 ? (
                    <>
                      {detail.updates.count} published, {detail.updates.first} – <span className="font-semibold">{detail.updates.last}</span>
                    </>
                  ) : (
                    <>
                      Latest: <span className="font-semibold">{detail.updates.last}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {project.interactive && (
              <Link href="/johndorf/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#b4241c] px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_-12px_rgba(180,36,28,0.8)] transition hover:bg-[#941414]">
                <Compass className="h-4 w-4" /> Open interactive site plan
              </Link>
            )}
            <a href={detail.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#2a1d1b]/15 bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2a1d1b] transition hover:border-[#2a1d1b]/40">
              Official project page <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-6 text-[11px] text-[#a8968f]">Details and photos from Johndorf&apos;s project page.</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-[#fbf8f6] px-1 py-2.5">
      <span className="text-[#b4241c]">{icon}</span>
      <span className={`${serif} text-lg font-semibold leading-none text-[#2a1d1b]`}>{value}</span>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#8a7a75]">{label}</span>
    </div>
  )
}
