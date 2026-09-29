"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

/**
 * The News masthead as a story slider: the newest articles' photos crossfade
 * on the right (with a slow drift while on screen) and each story's headline,
 * excerpt and "Read article" take turns on the left — the way news sites lead
 * with pictures that change. The H1 above the stories is fixed copy, so the
 * page keeps one stable headline for search. The first story is in the
 * server HTML; the rest turn on the client. Hovering or focusing holds the
 * current story; dots and arrows step by hand; reduced motion means no
 * auto-advance, no drift, instant swaps. With no stories (deeper pages of
 * the archive) it is the plain masthead.
 */

export type HeroStory = { slug: string; title: string; excerpt: string; img: string; date: string; badge?: string }

const INTERVAL_MS = 6500

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

export function NewsHero({ stories }: { stories: HeroStory[] }) {
  const [i, setI] = useState(0)
  const [held, setHeld] = useState(false)
  const [still, setStill] = useState(false)
  const n = stories.length

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setStill(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (n < 2 || held || still) return
    const t = window.setInterval(() => setI((x) => (x + 1) % n), INTERVAL_MS)
    return () => window.clearInterval(t)
  }, [n, held, still])

  const story = stories[i]
  const fade = still ? "" : "transition-opacity duration-700 ease-out"

  return (
    <section
      className="relative bg-white overflow-hidden border-b border-[#e8eaed]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {/* The pictures: every story's photo is in place, only the current one shows. */}
      <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]" aria-hidden="true">
        {n === 0 ? (
          <Image src="/background/dubai.webp" alt="" fill sizes="(max-width: 1024px) 100vw, 58vw" priority className="object-cover object-center" />
        ) : (
          stories.map((s, k) => (
            <Image
              key={s.slug}
              src={s.img}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 58vw"
              priority={k === 0}
              className={`object-cover object-center ${fade} ${k === i ? "opacity-100" : "opacity-0"} ${k === i && !still ? "nh-drift" : ""}`}
            />
          ))
        )}
        {/* Fade the photo into the page so the words never sit on busy pixels. */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/10 lg:from-white lg:via-white/70 lg:to-transparent" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-14">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">Property Insights</p>
          <h1
            className={`font-['Outfit'] font-bold text-[#0d1117] tracking-tight mt-3 ${
              n > 0 ? "text-2xl md:text-[30px] leading-[1.15]" : "text-3xl md:text-[42px] leading-[1.12]"
            }`}
          >
            Dubai Real Estate News &amp; Market Intelligence
          </h1>

          {n === 0 ? (
            <p className="mt-4 text-[15.5px] leading-relaxed text-[#4b5563] max-w-lg">
              Stay informed with the latest market trends, expert analysis, developer updates and investment
              opportunities in Dubai.
            </p>
          ) : (
            <>
              {/* The story of the moment. Keyed, so each change eases in afresh. */}
              <div key={story.slug} className={`mt-7 border-l-2 border-[#d6b357] pl-5 ${still ? "" : "nh-swap"}`} aria-live="off">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">
                  <span>{story.badge?.trim() || "Latest"}</span>
                  {story.date && <span className="font-semibold normal-case tracking-normal text-[#9ca3af]">{fmt(story.date)}</span>}
                </p>
                <Link href={`/news/${story.slug}`} className="group mt-2 block">
                  <h2 className="font-['Outfit'] text-[26px] md:text-[34px] font-bold leading-[1.15] tracking-tight text-[#0d1117] line-clamp-3 group-hover:text-[#b8913f] transition-colors">
                    {story.title}
                  </h2>
                </Link>
                {story.excerpt && <p className="mt-3 text-[15px] leading-relaxed text-[#4b5563] line-clamp-2 max-w-lg">{story.excerpt}</p>}
                <Link
                  href={`/news/${story.slug}`}
                  className="mt-5 inline-flex items-center gap-2.5 bg-[#0a2647] hover:bg-[#001f3f] text-white px-6 py-3.5 text-[15px] font-bold transition-colors"
                >
                  Read article <ArrowRight className="w-[18px] h-[18px]" />
                </Link>
              </div>

              {n > 1 && (
                <div className="mt-8 flex items-center gap-5">
                  <div className="flex items-center gap-2" role="tablist" aria-label="Stories">
                    {stories.map((s, k) => (
                      <button
                        key={s.slug}
                        type="button"
                        role="tab"
                        aria-selected={k === i}
                        aria-label={`Story ${k + 1} of ${n}`}
                        onClick={() => setI(k)}
                        className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-7 bg-[#d6b357]" : "w-2 bg-[#0d1117]/20 hover:bg-[#0d1117]/40"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-[#9ca3af]">
                    {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setI((x) => (x - 1 + n) % n)}
                      aria-label="Previous story"
                      className="inline-flex h-9 w-9 items-center justify-center border border-[#e5e8ec] bg-white/80 text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setI((x) => (x + 1) % n)}
                      aria-label="Next story"
                      className="inline-flex h-9 w-9 items-center justify-center border border-[#e5e8ec] bg-white/80 text-[#6b7280] transition-colors hover:border-[#d6b357] hover:text-[#0d1117]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
