import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { InView } from "@/components/public/in-view"

/**
 * Homepage "Latest news" rail, right under the hero: the four newest stories
 * as picture-and-title cards — pictures are what get noticed, a text strip
 * was not. One compact row on desktop, a swipeable rail on phones, and the
 * door to /news. Copy claims only what the feed does (headlines, updated
 * daily); the entrance reuses the site's InView + .wf-fade choreography.
 * Renders nothing without stories, so a news outage never leaves a hole.
 */

export type HomeNewsItem = { slug: string; title: string; excerpt: string; img: string; date: string; badge?: string }

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

export function HomeNews({ items }: { items: HomeNewsItem[] }) {
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
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors shrink-0"
            >
              <span className="hidden sm:inline">All news</span>
              <span className="w-8 h-8 bg-[#d6b357] flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-[#001f3f]" />
              </span>
            </Link>
          </div>

          {/* A swipe rail on phones (one and a bit cards showing), a row of four on desktop. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
            {items.map((item, i) => (
              <article
                key={item.slug}
                className="wf-fade group w-[76vw] shrink-0 snap-start sm:w-[44vw] lg:w-auto"
                style={{ ["--d" as string]: `${120 + i * 110}ms` }}
              >
                <Link href={`/news/${item.slug}`} className="block">
                  <span className="relative block aspect-[16/10] overflow-hidden bg-[#eef1f5]">
                    <Image
                      src={item.img}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 76vw, (max-width: 1024px) 44vw, 24vw"
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
        </div>
      </InView>
    </section>
  )
}
