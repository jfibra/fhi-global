"use client"

import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import Image from "next/image"
import { ChevronDown, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"

/**
 * Tiles shown before "View all photos". Galleries run to a median of 13 and a
 * maximum of 70 images — 7 and 35 rows on a two-column phone — which buried
 * the unit table, location and FAQ beneath them. Eight fills two desktop rows
 * and four mobile rows.
 */
const COLLAPSED_COUNT = 8

type ProjectImage = {
  id: number
  image_url: string
  caption?: string | null
  rank?: number | null
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }

/**
 * Tiles wipe in as the section scrolls into view (CSS `.pp-tile`). Clicking a
 * tile opens the lightbox; where the browser supports view transitions the
 * thumbnail morphs into the large photo and back again on close. Arrow keys
 * step through the photos, Escape closes.
 */
export function ProjectGallery({
  images,
  projectName,
  location,
}: {
  images: ProjectImage[]
  /** Names the property in every alt — captions are empty in practice, and
   *  "Image N" carries zero signal for Google Images. */
  projectName?: string
  location?: string | null
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([])

  const collapsible = images.length > COLLAPSED_COUNT
  const subject = [projectName, location].filter(Boolean).join(", ")
  const altFor = (img: ProjectImage, idx: number) =>
    img.caption ?? (subject ? `${subject} — photo ${idx + 1} of ${images.length}` : `Photo ${idx + 1} of ${images.length}`)

  /** Apply a state change inside a view transition when available, naming
   *  the thumbnail so the browser morphs it to (or from) the large photo. */
  const withMorph = (idx: number | null, apply: () => void) => {
    const doc = document as DocWithVT
    const tile = idx !== null ? tileRefs.current[idx] : null
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (typeof doc.startViewTransition !== "function" || reduce || !tile) {
      apply()
      return
    }
    tile.style.viewTransitionName = "gallery-shot"
    const t = doc.startViewTransition(() => flushSync(apply))
    t.finished.finally(() => {
      tile.style.viewTransitionName = ""
    })
  }

  const open = (idx: number) => withMorph(idx, () => setLightboxIndex(idx))
  const close = () => withMorph(lightboxIndex, () => setLightboxIndex(null))
  const step = (dir: -1 | 1) =>
    setLightboxIndex((i) => (i === null ? null : Math.min(images.length - 1, Math.max(0, i + dir))))

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "ArrowLeft") step(-1)
      if (e.key === "ArrowRight") step(1)
    }
    window.addEventListener("keydown", onKey)
    document.body.classList.add("overflow-hidden")
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.classList.remove("overflow-hidden")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex === null])

  if (!images.length) return null

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((img, idx) => (
          <button
            key={img.id}
            ref={(el) => { tileRefs.current[idx] = el }}
            onClick={() => open(idx)}
            aria-label={`View ${altFor(img, idx)}`}
            // Hidden tiles stay in the markup (alt text included) but are not
            // painted, so the browser never fetches them until they are shown.
            hidden={collapsible && !showAll && idx >= COLLAPSED_COUNT}
            className={`pp-tile group relative aspect-square overflow-hidden border border-[#e8eaed] bg-[#f3f4f6] transition-colors hover:border-[#001f3f]/30 ${idx === 0 ? "col-span-2 row-span-2" : ""}`}
            style={{ ["--d" as string]: `${Math.min(idx, 8) * 70}ms` }}
          >
            <Image
              src={img.image_url}
              alt={altFor(img, idx)}
              fill
              sizes={idx === 0 ? "(min-width: 1024px) 44vw, (min-width: 768px) 60vw, 92vw" : "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
              <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>
        ))}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-[#001f3f] transition-colors hover:text-[#b8913f]"
        >
          {showAll ? "Show fewer photos" : `View all ${images.length} photos`}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="pp-lightbox fixed inset-0 z-[9999] flex items-center justify-center bg-[#030d1c]/95 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={altFor(images[lightboxIndex], lightboxIndex)}
        >
          <button
            onClick={close}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); step(-1) }}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-5xl flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={images[lightboxIndex].id}
              src={images[lightboxIndex].image_url}
              alt={altFor(images[lightboxIndex], lightboxIndex)}
              className="pp-lightbox-img max-h-[80vh] w-auto object-contain shadow-2xl"
              style={{ viewTransitionName: "gallery-shot" }}
            />
            {images[lightboxIndex].caption && <p className="text-sm text-white/60">{images[lightboxIndex].caption}</p>}
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6b357]/80">
              {lightboxIndex + 1} / {images.length}
            </p>
          </div>

          {lightboxIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); step(1) }}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
