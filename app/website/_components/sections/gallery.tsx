"use client"

// Gallery — no default category: the overview stacks one labeled row per
// category, each an auto-sliding strip (same behavior as the homepage's
// Trusted Partners carousel: one tile per tick, pause on hover/touch, idle
// off-screen or in a hidden tab, slide back to the start after the last).
// Photos are lazy-loaded, so tiles only fetch as they approach the viewport.
// Clicking a category (tab or row label) shows ALL of its photos as a grid;
// clicking it again returns to the overview.

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Award, BadgeCheck, Camera } from "lucide-react"
import { GALLERY_CATEGORIES, GOLD, NAVY, SAMPLE_DATA, type GalleryCategory, type WebsiteData } from "../../_data"
import { Eyebrow } from "../ui"

const CATEGORY_ICONS: Record<GalleryCategory, typeof Camera> = {
  "Event Photos": Camera,
  Certificates: BadgeCheck,
  "Awards & Recognition": Award,
}

function PhotoTile({ category, src, index }: { category: GalleryCategory; src: string; index: number }) {
  return (
    <div className="group h-44 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${category} ${index + 1}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  )
}

/** Auto-sliding photo strip — 4 tiles visible on desktop, advancing one tile
 *  per tick. Native horizontal scroll, so `loading="lazy"` fetches each photo
 *  only as it nears the visible edge instead of all at once. */
function PhotoCarousel({ category, images, interval = 2500 }: { category: GalleryCategory; images: string[]; interval?: number }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track || images.length < 2) return

    let onScreen = false
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
    })
    observer.observe(track)

    const id = setInterval(() => {
      if (pausedRef.current || !onScreen || document.hidden) return
      const firstTile = track.firstElementChild as HTMLElement | null
      if (!firstTile) return
      const secondTile = firstTile.nextElementSibling as HTMLElement | null
      const step = secondTile ? secondTile.offsetLeft - firstTile.offsetLeft : firstTile.offsetWidth
      const maxScroll = track.scrollWidth - track.clientWidth
      // Nothing to slide when every tile already fits.
      if (maxScroll <= 1) return
      if (track.scrollLeft >= maxScroll - 1) {
        track.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        track.scrollTo({ left: track.scrollLeft + step, behavior: "smooth" })
      }
    }, interval)

    return () => {
      observer.disconnect()
      clearInterval(id)
    }
  }, [images.length, interval])

  const pause = () => {
    pausedRef.current = true
  }
  const resume = () => {
    pausedRef.current = false
  }

  return (
    <div
      ref={trackRef}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={`${category} photos`}
    >
      {images.map((src, i) => (
        <div
          key={`${category}-${i}`}
          className="w-[calc((100%-12px)/2)] shrink-0 sm:w-[calc((100%-24px)/3)] lg:w-[calc((100%-36px)/4)]"
        >
          <PhotoTile category={category} src={src} index={i} />
        </div>
      ))}
    </div>
  )
}

export function GallerySection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  // null = overview (an auto-sliding labeled row per category).
  const [category, setCategory] = useState<GalleryCategory | null>(null)
  const withPhotos = GALLERY_CATEGORIES.filter((c) => (data.gallery[c] ?? []).length > 0)
  if (withPhotos.length === 0) return null

  return (
    <section id="gallery" className="scroll-mt-[72px] bg-white">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <Eyebrow center>Gallery</Eyebrow>
        <h2 className="mt-3 text-center font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
          Professional Highlights
        </h2>
        <div className="mx-auto mt-4 flex items-center justify-center gap-2">
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
          <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
          <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
        </div>

        {/* Category tabs — only once a category is focused (switch or click
            the active one again to return to the overview) */}
        {category && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {withPhotos.map((c) => {
              const Icon = CATEGORY_ICONS[c]
              const active = category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(active ? null : c)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12.5px] font-bold transition-colors ${
                    active ? "text-white" : "border border-[#d8d3c6] text-[#5b6472] hover:border-[#9aa0aa]"
                  }`}
                  style={active ? { backgroundColor: NAVY } : undefined}
                >
                  <Icon className="h-4 w-4" style={active ? { color: GOLD } : undefined} />
                  {c}
                </button>
              )
            })}
          </div>
        )}

        {category ? (
          /* Focused category — every photo it has */
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(data.gallery[category] ?? []).map((src, i) => (
              <PhotoTile key={`${category}-${i}`} category={category} src={src} index={i} />
            ))}
          </div>
        ) : (
          /* Overview — one labeled auto-sliding row per category */
          <div className="mt-6 space-y-8">
            {withPhotos.map((c) => {
              const Icon = CATEGORY_ICONS[c]
              const images = data.gallery[c] ?? []
              return (
                <div key={c}>
                  {/* Header — same treatment as the Featured section, plus the
                      category icon on the left of the title */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <button type="button" onClick={() => setCategory(c)} className="inline-flex items-center gap-2 text-left">
                      <Icon className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.8} />
                      <span className="text-[17px] font-bold" style={{ color: NAVY }}>
                        {c}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory(c)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold"
                      style={{ color: NAVY }}
                    >
                      View All <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
                    </button>
                  </div>
                  <PhotoCarousel category={c} images={images} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
