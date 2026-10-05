"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { InView } from "@/components/public/in-view"
import { ShareNews } from "@/components/public/share-news"

/**
 * Homepage "Latest news", right under the hero: the newest stories as
 * picture-and-title cards in a carousel — one card slides in every few
 * seconds, round and round, so the page's first screen is never flat.
 * The track is a native scroll-snap rail (a finger swipes it on phones), the
 * arrows and the auto-advance just scroll it; a thin gold line shows how far
 * along it is. It holds while hovered, focused or touched, only runs while on
 * screen, and never auto-runs for reduced-motion visitors. Copy claims only
 * what the feed does (headlines, updated daily). Renders nothing without
 * stories, so a news outage never leaves a hole.
 */

export type HomeNewsItem = { slug: string; title: string; excerpt: string; img: string; date: string; badge?: string }

const STEP_MS = 4500

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

export function HomeNews({ items }: { items: HomeNewsItem[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState(false)
  const [onScreen, setOnScreen] = useState(false)
  const [still, setStill] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setStill(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Only run while the rail is actually in view.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // The gold line follows the scroll position.
  const onScroll = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 1)
  }, [])

  /** One card wide, including the gap. */
  const stepWidth = () => {
    const el = track.current
    const a = el?.children[0] as HTMLElement | undefined
    const b = el?.children[1] as HTMLElement | undefined
    return a && b ? b.offsetLeft - a.offsetLeft : (a?.offsetWidth ?? 0)
  }

  const go = useCallback(
    (dir: 1 | -1) => {
      const el = track.current
      if (!el) return
      const step = stepWidth()
      if (!step) return
      const max = el.scrollWidth - el.clientWidth
      const atEnd = el.scrollLeft >= max - 2
      const atStart = el.scrollLeft <= 2
      const behavior: ScrollBehavior = still ? "auto" : "smooth"
      if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior })
      else if (dir === -1 && atStart) el.scrollTo({ left: max, behavior })
      else el.scrollBy({ left: dir * step, behavior })
    },
    [still],
  )

  useEffect(() => {
    if (items.length < 2 || held || still || !onScreen) return
    const t = window.setInterval(() => go(1), STEP_MS)
    return () => window.clearInterval(t)
  }, [items.length, held, still, onScreen, go])

  if (items.length === 0) return null

  return (
    <section className="relative bg-white border-b border-[#e8eaed]">
      <InView className="wf">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <div className="wf-fade mb-6 flex items-end justify-between gap-6">
            <div>
              <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#c0392b] opacity-60 animate-ping motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c0392b]" />
                </span>
                Latest news
              </p>
              <h2 className="mt-2 font-['Outfit'] text-2xl md:text-[30px] font-bold leading-[1.1] tracking-tight text-[#0d1117]">
                Dubai property, today
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Previous stories"
                    className="hidden sm:inline-flex h-10 w-10 items-center justify-center border border-[#e5e8ec] bg-white text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Next stories"
                    className="hidden sm:inline-flex h-10 w-10 items-center justify-center border border-[#e5e8ec] bg-white text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <Link
                href="/news"
                aria-label="All news"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors sm:ml-2"
              >
                <span className="hidden sm:inline">All news</span>
                <span className="w-10 h-10 bg-[#d6b357] flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-[#001f3f]" />
                </span>
              </Link>
            </div>
          </div>

          {/* The track: four cards per screen on desktop, two on tablets, one and a bit on phones. */}
          <div
            ref={track}
            onScroll={onScroll}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            onTouchStart={() => setHeld(true)}
            onTouchEnd={() => setHeld(false)}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:px-0"
          >
            {items.map((item, i) => (
              <article
                key={item.slug}
                className="wf-fade group relative w-[76vw] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]"
                style={{ ["--d" as string]: `${120 + Math.min(i, 3) * 110}ms` }}
              >
                {/* Over the photo, beside the card's link — a tap here never opens the story. */}
                <ShareNews slug={item.slug} title={item.title} className="absolute right-3 top-3 z-10" />
                <Link href={`/news/${item.slug}`} className="block">
                  <span className="relative block aspect-[16/10] overflow-hidden bg-[#eef1f5]">
                    <Image
                      src={item.img}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 76vw, (max-width: 1024px) 48vw, 24vw"
                      priority={i === 0}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    {item.badge?.trim() && (
                      <span className="absolute left-3 top-3 bg-[#0a2647] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                        {item.badge.trim()}
                      </span>
                    )}
                  </span>
                  <span className="mt-3 block text-xs text-[#9ca3af]">{fmt(item.date)}</span>
                  <h3 className="mt-1.5 font-['Outfit'] text-[16px] font-bold leading-snug text-[#0d1117] line-clamp-3 transition-colors group-hover:text-[#b8913f]">
                    {item.title}
                  </h3>
                </Link>
              </article>
            ))}
          </div>

          {/* How far along the rail is. */}
          {items.length > 1 && (
            <div className="mt-6 h-px w-full bg-[#e8eaed]" aria-hidden="true">
              <div className="h-px bg-[#d6b357] transition-[width] duration-300" style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }} />
            </div>
          )}
        </div>
      </InView>
    </section>
  )
}
