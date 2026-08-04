"use client"

// Materials gallery — the grid, the one-at-a-time viewer and the download
// buttons. Rendering stays cheap as the folder grows because every tile uses
// next/image: off-screen tiles are never fetched, and the ones that are come
// down as small AVIF/WebP copies sized to the tile, not the original file.

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Download, ImageOff, X, ZoomIn } from "lucide-react"
// Imported from the client-safe module, never from lib/materials (server-only).
import { ALL_CATEGORY, GENERAL_CATEGORY, formatBytes, type Material } from "@/lib/materials-shared"

/** Widths the browser should pick from — mirrors the grid's breakpoints. */
const TILE_SIZES = "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"

export function MaterialsGallery({ materials }: { materials: Material[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [category, setCategory] = useState<string>(ALL_CATEGORY)

  // Tabs are derived from what's actually on disk, so an empty category never
  // shows and a new folder needs no code. General sorts last: it is the
  // uncategorised bucket, not a real category.
  const tabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of materials) counts.set(m.category, (counts.get(m.category) ?? 0) + 1)
    const named = [...counts.keys()]
      .filter((c) => c !== GENERAL_CATEGORY)
      .sort((a, b) => a.localeCompare(b))
    if (counts.has(GENERAL_CATEGORY)) named.push(GENERAL_CATEGORY)
    return [
      { label: ALL_CATEGORY, count: materials.length },
      ...named.map((label) => ({ label, count: counts.get(label) ?? 0 })),
    ]
  }, [materials])

  // The viewer pages through what's on screen, so it indexes the FILTERED
  // list — not the full one — or Next would jump to a hidden image.
  const visible = useMemo(
    () => (category === ALL_CATEGORY ? materials : materials.filter((m) => m.category === category)),
    [materials, category],
  )

  const open = openIndex === null ? null : visible[openIndex] ?? null

  // Switching category while the viewer is open would leave openIndex pointing
  // into a different list, so close it as part of the switch (a handler, not an
  // effect — no cascading render).
  const pickCategory = (label: string) => {
    setOpenIndex(null)
    setCategory(label)
  }

  // The viewer is portalled to <body>: page transitions put a `transform` on an
  // ancestor, which would otherwise make `position: fixed` resolve against that
  // ancestor instead of the viewport and leave the page showing through.
  // No mounted-guard is needed — the portal is only reached once something is
  // open, which takes a click, so `document` is never touched during SSR.

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? null : (i + delta + visible.length) % visible.length)),
    [visible.length],
  )

  // Arrow keys page through the viewer, Escape closes it.
  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      else if (e.key === "ArrowRight") step(1)
      else if (e.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openIndex, close, step])

  // Don't let the page scroll behind the viewer.
  useEffect(() => {
    if (openIndex === null) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [openIndex])

  if (materials.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e5e5e5] bg-white px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f4f6]">
          <ImageOff className="h-7 w-7 text-[#9ca3af]" />
        </div>
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">No materials yet</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[#6b7280]">
          Drop images into <code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-xs">public/materials</code> and
          they appear here on the next deploy — no code changes needed.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Category tabs — only rendered when there is more than one bucket, so a
          single-folder gallery doesn't grow a pointless "All" row. */}
      {tabs.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Material categories">
          {tabs.map((t) => {
            const active = t.label === category
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pickCategory(t.label)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "bg-[#001f3f] text-white"
                    : "border border-black/[0.08] bg-white text-[#374151] hover:border-[#001f3f]/30 hover:text-[#001f3f]"
                }`}
              >
                {t.label}
                <span className={active ? "text-white/60" : "text-[#9ca3af]"}>{t.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="border border-black/[0.08] bg-white px-6 py-14 text-center">
          <p className="text-sm text-[#6b7280]">
            Nothing in <strong className="text-[#0d1117]">{category}</strong> yet.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((m, i) => (
          <figure
            key={m.file}
            className="group overflow-hidden rounded-lg border border-black/[0.08] bg-white transition-shadow hover:shadow-[0_10px_32px_-14px_rgba(0,31,63,0.4)]"
          >
            {/* Fixed square box: the tile reserves its space before the image
                arrives, so loading never shifts the grid. `contain` rather than
                `cover` because these are finished posters — cropping one to fit
                the tile would hide the very artwork being previewed. */}
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`View ${m.title}`}
              className="relative block aspect-square w-full overflow-hidden rounded-t-lg bg-[#eef1f5] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20"
            >
              <Image
                src={m.src}
                alt={m.title}
                fill
                sizes={TILE_SIZES}
                quality={75}
                {...(m.blurDataURL ? { placeholder: "blur" as const, blurDataURL: m.blurDataURL } : {})}
                className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#001f3f]/0 opacity-0 transition-all duration-200 group-hover:bg-[#001f3f]/35 group-hover:opacity-100">
                <ZoomIn className="h-7 w-7 text-white drop-shadow" />
              </span>
            </button>

            {/* No caption — the artwork speaks for itself, and dropping the
                title keeps every card exactly the same height. */}
            <figcaption className="px-3 py-3">
              <a
                href={m.src}
                download={m.file}
                aria-label={`Download ${m.title}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#001f3f] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002b57]"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
      )}

      {/* ── One-at-a-time viewer ─────────────────────────────────────────── */}
      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          onClick={close}
          className="fixed inset-0 z-[200] flex flex-col bg-[#00112a] p-4 sm:p-8"
        >
          <div className="flex items-center justify-between gap-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate font-['Outfit'] text-base font-bold">{open.title}</p>
              <p className="text-xs text-white/50">
                {openIndex! + 1} of {materials.length}
                {open.width && open.height ? ` · ${open.width} × ${open.height}` : ""} · {formatBytes(open.bytes)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={open.src}
                download={open.file}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#d6b357] px-4 py-2 text-sm font-bold text-[#001f3f] transition-colors hover:bg-[#c8a544]"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Sized to the viewport rather than the original: a 4000px poster
                still arrives as a screen-sized copy. */}
            <Image
              key={open.src}
              src={open.src}
              alt={open.title}
              fill
              sizes="100vw"
              quality={80}
              priority
              {...(open.blurDataURL ? { placeholder: "blur" as const, blurDataURL: open.blurDataURL } : {})}
              className="object-contain"
            />

            {materials.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous"
                  className="absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next"
                  className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
