"use client"

// Album photo grid + lightbox.
//
// The grid shows the small thumbnails (~40 KB each, natively lazy-loaded, so
// only what's on screen downloads); the lightbox swaps in the ~2000px web
// rendition on demand and preloads its neighbours so arrow-keying feels
// instant. Both renditions were pre-encoded at ingest, so images are served
// exactly as stored — no on-the-fly optimizer work for hundreds of photos.

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

export type GalleryPhoto = {
  id: string
  section: string | null
  url: string
  thumb_url: string
  width: number | null
  height: number | null
}

export function AlbumGrid({ photos, albumTitle }: { photos: GalleryPhoto[]; albumTitle: string }) {
  // Which section is selected in the tabs; null = All.
  const [active, setActive] = useState<string | null>(null)
  // null = closed; otherwise the index into `visible` (lightbox order matches
  // whatever the tabs currently show).
  const [open, setOpen] = useState<number | null>(null)

  const tabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of photos) {
      if (p.section) counts.set(p.section, (counts.get(p.section) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [photos])

  const visible = useMemo(
    () => (active ? photos.filter((p) => p.section === active) : photos),
    [photos, active],
  )

  const sections = useMemo(() => {
    const out: Array<{ name: string | null; items: Array<{ photo: GalleryPhoto; index: number }> }> = []
    visible.forEach((photo, index) => {
      const last = out[out.length - 1]
      if (last && last.name === photo.section) last.items.push({ photo, index })
      else out.push({ name: photo.section, items: [{ photo, index }] })
    })
    return out
  }, [visible])

  const step = useCallback(
    (dir: 1 | -1) => {
      setOpen((cur) => (cur === null ? cur : (cur + dir + visible.length) % visible.length))
    },
    [visible.length],
  )

  const pickTab = (name: string | null) => {
    setActive(name)
    setOpen(null)
  }

  // Keyboard: arrows navigate, Escape closes. Scroll locks while open.
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
      else if (e.key === "ArrowRight") step(1)
      else if (e.key === "ArrowLeft") step(-1)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, step])

  // Warm the neighbours so stepping never shows a blank frame.
  useEffect(() => {
    if (open === null) return
    for (const offset of [1, -1]) {
      const p = visible[(open + offset + visible.length) % visible.length]
      if (p) new window.Image().src = p.url
    }
  }, [open, visible])

  if (photos.length === 0) {
    return (
      <div className="border border-[#e5e8ec] bg-white p-16 text-center">
        <p className="text-sm text-[#6b7280]">Photos are being added to this album — check back shortly.</p>
      </div>
    )
  }

  return (
    <>
      {/* Section tabs — one click straight to Awarding or the portraits,
          instead of scrolling past hundreds of photos. */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            type="button"
            onClick={() => pickTab(null)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] border transition-colors ${
              active === null
                ? "bg-[#001f3f] text-white border-[#001f3f]"
                : "bg-white text-[#5f6368] border-[#e5e8ec] hover:border-[#d6b357] hover:text-[#001f3f]"
            }`}
          >
            All <span className={active === null ? "text-[#d6b357]" : "text-[#9ca3af]"}>· {photos.length}</span>
          </button>
          {tabs.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => pickTab(name)}
              className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] border transition-colors ${
                active === name
                  ? "bg-[#001f3f] text-white border-[#001f3f]"
                  : "bg-white text-[#5f6368] border-[#e5e8ec] hover:border-[#d6b357] hover:text-[#001f3f]"
              }`}
            >
              {name} <span className={active === name ? "text-[#d6b357]" : "text-[#9ca3af]"}>· {count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-10">
        {sections.map((section) => (
          <div key={section.name ?? "all"}>
            {section.name && active === null && (
              <div className="mb-4">
                <h2 className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.16em] text-[#001f3f]">
                  {section.name}
                  <span className="ml-2 text-[#9ca3af] normal-case tracking-normal font-semibold">
                    · {section.items.length}
                  </span>
                </h2>
                <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5" aria-hidden="true" />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {section.items.map(({ photo, index }) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setOpen(index)}
                  aria-label={`Open photo ${index + 1} of ${visible.length}`}
                  className="group relative aspect-[4/3] bg-[#eef1f5] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b357]"
                >
                  {/* Pre-sized thumbnails served as stored — plain img keeps
                      hundreds of tiles off the image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumb_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                  <span className="absolute inset-0 bg-[#001f3f]/0 group-hover:bg-[#001f3f]/20 transition-colors" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Lightbox ── */}
      {open !== null && visible[open] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${albumTitle} — photo ${open + 1} of ${visible.length}`}
          className="fixed inset-0 z-[100] bg-[#000c18]/95 flex items-center justify-center"
          onClick={() => setOpen(null)}
        >
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 sm:px-6 py-4">
            <p className="text-white/70 text-sm font-semibold">
              {open + 1} <span className="text-white/35">/ {visible.length}</span>
              {visible[open].section && (
                <span className="ml-3 text-white/35 hidden sm:inline">{visible[open].section}</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visible[open].url}
            alt={`${albumTitle} — photo ${open + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] object-contain select-none"
          />

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(-1) }}
            aria-label="Previous photo"
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(1) }}
            aria-label="Next photo"
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  )
}
