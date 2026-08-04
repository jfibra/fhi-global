"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

export interface DeveloperLogoItem {
  id: string
  name: string
  slug: string
  logo_url?: string | null
}

interface DeveloperLogoCarouselProps {
  developers: DeveloperLogoItem[]
  /** Milliseconds between slides */
  interval?: number
}

const DEFAULT_TILE_BG = "#f7f7f7"

const WHITE_TILE_BG = "#ffffff"

/**
 * Reads the logo's own background color by sampling its corner pixels, so the
 * tile can blend seamlessly with non-transparent logos (e.g. white JPEGs).
 * Returns null (keep the default tile color) when any corner is transparent
 * or the canvas can't be read, and plain white when the sample is unreliable:
 * corners that disagree with each other, or a muddy mid-tone gray.
 */
function sampleLogoBg(img: HTMLImageElement): string | null {
  try {
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (w < 8 || h < 8) return null

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)

    const corners: Array<[number, number]> = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
    ]
    const samples: Array<[number, number, number]> = []
    for (const [x, y] of corners) {
      const [cr, cg, cb, ca] = ctx.getImageData(x, y, 1, 1).data
      if (ca < 200) return null // transparent logo — keep the default tile bg
      samples.push([cr, cg, cb])
    }

    const avg = [0, 1, 2].map(
      (i) => samples.reduce((sum, s) => sum + s[i], 0) / samples.length
    )
    // Corners disagree → the "background" is really part of the artwork.
    if (samples.some((s) => s.some((v, i) => Math.abs(v - avg[i]) > 40))) {
      return WHITE_TILE_BG
    }

    const [r, g, b] = avg
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const lum = (r + g + b) / 3
    // Mid-tone gray reads as muddy next to the other tiles — use white.
    if (chroma < 25 && lum > 50 && lum < 225) {
      return WHITE_TILE_BG
    }

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  } catch {
    return null // tainted canvas or read failure — keep the default tile bg
  }
}

function LogoTile({ dev }: { dev: DeveloperLogoItem }) {
  const [bg, setBg] = useState<string | null>(null)

  return (
    <Link
      href={`/${dev.slug}`}
      style={{ backgroundColor: bg ?? DEFAULT_TILE_BG }}
      className="group flex aspect-square w-[calc((100%-20px)/2)] shrink-0 items-center justify-center p-6 transition-colors sm:w-[calc((100%-40px)/3)] lg:w-[calc((100%-80px)/5)]"
    >
      {dev.logo_url ? (
        <Image
          src={dev.logo_url}
          alt={dev.name}
          width={160}
          height={160}
          onLoad={(e) => setBg(sampleLogoBg(e.currentTarget))}
          className="h-full w-full object-contain grayscale-[15%] transition-all duration-300 group-hover:grayscale-0"
        />
      ) : (
        <span className="text-center text-sm font-semibold uppercase tracking-widest text-[#4b5563]">
          {dev.name}
        </span>
      )}
    </Link>
  )
}

/**
 * Auto-sliding partner logo strip: square tiles with centered developer
 * logos, each tile's background adapting to the logo's own background color.
 * Each logo appears exactly once; the strip advances one tile at a time and
 * slides back to the start after the last one. Pauses while hovered/touched.
 */
export function DeveloperLogoCarousel({
  developers,
  interval = 2000,
}: DeveloperLogoCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track || developers.length < 2) return

    const id = setInterval(() => {
      if (pausedRef.current) return
      const firstTile = track.firstElementChild as HTMLElement | null
      if (!firstTile) return

      const styles = getComputedStyle(track)
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0
      const step = firstTile.offsetWidth + gap
      const maxScroll = track.scrollWidth - track.clientWidth

      // Nothing to slide when every tile already fits.
      if (maxScroll <= 1) return

      // At the end, slide back to the first logo instead of looping copies.
      if (track.scrollLeft >= maxScroll - 1) {
        track.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        track.scrollTo({ left: track.scrollLeft + step, behavior: "smooth" })
      }
    }, interval)

    return () => clearInterval(id)
  }, [developers.length, interval])

  if (developers.length === 0) return null

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
      className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Featured developer partners"
    >
      {developers.map((dev) => (
        <LogoTile key={dev.id} dev={dev} />
      ))}
    </div>
  )
}
