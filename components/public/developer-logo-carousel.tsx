"use client"

import { memo, useEffect, useRef } from "react"
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

const LogoTile = memo(function LogoTile({ dev }: { dev: DeveloperLogoItem }) {
  return (
    <Link
      href={`/${dev.slug}`}
      className="group relative flex h-[188px] w-[calc((100%-20px)/2)] shrink-0 items-center justify-center bg-white p-8 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-2 sm:w-[calc((100%-40px)/3)] lg:w-[calc((100%-80px)/5)] after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:shadow-[0_14px_30px_-10px_rgba(0,31,63,0.35)] after:transition-opacity after:duration-300 hover:after:opacity-100"
    >
      {dev.logo_url ? (
        <Image
          src={dev.logo_url}
          alt={dev.name}
          width={160}
          height={160}
          className="max-h-[110px] w-full object-contain grayscale-[15%] transition-[filter] duration-300 group-hover:grayscale-0"
        />
      ) : (
        <span className="text-center text-sm font-semibold uppercase tracking-widest text-[#4b5563]">
          {dev.name}
        </span>
      )}
    </Link>
  )
})

/**
 * Auto-sliding partner logo strip: white square tiles with centered developer
 * logos. Each logo appears exactly once; the strip advances one tile at a
 * time and slides back to the start after the last one. Pauses while
 * hovered/touched, and idles entirely while off-screen or in a hidden tab.
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

    let onScreen = false
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
    })
    observer.observe(track)

    const id = setInterval(() => {
      if (pausedRef.current || !onScreen || document.hidden) return
      const firstTile = track.firstElementChild as HTMLElement | null
      if (!firstTile) return

      // Second tile's offset minus the first's = tile width + gap, without a
      // getComputedStyle pass.
      const secondTile = firstTile.nextElementSibling as HTMLElement | null
      const step = secondTile
        ? secondTile.offsetLeft - firstTile.offsetLeft
        : firstTile.offsetWidth
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

    return () => {
      observer.disconnect()
      clearInterval(id)
    }
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
      className="flex gap-5 overflow-x-auto pt-3 pb-8 -mb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Featured developer partners"
    >
      {developers.map((dev) => (
        <LogoTile key={dev.id} dev={dev} />
      ))}
    </div>
  )
}
