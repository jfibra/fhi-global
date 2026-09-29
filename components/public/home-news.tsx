import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import { InView } from "@/components/public/in-view"

/**
 * Homepage "Latest news": the newest property stories, so the most-visited
 * page shows the site moves every day. One lead story with its photo, three
 * more as compact rows, and the door to /news. Copy claims only what the
 * feed does (headlines, updated daily); the entrance reuses the site's
 * InView + .wf-fade choreography. Renders nothing without stories, so a
 * news outage never leaves a hole on the homepage.
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
  const [lead, ...rest] = items

  return (
    <section className="relative bg-white border-y border-[#e8eaed]">
      <InView className="wf">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="wf-fade mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
                <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true" />
                Property News
              </p>
              <h2 className="mt-3 font-['Outfit'] text-3xl md:text-[38px] font-bold leading-[1.1] tracking-tight text-[#0d1117]">
                The latest from Dubai&apos;s property market
              </h2>
              <p className="mt-3 text-[15px] text-[#5f6368] max-w-lg">Headlines from the market, updated daily.</p>
            </div>
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors shrink-0 self-start sm:self-auto"
            >
              All news
              <span className="w-8 h-8 bg-[#d6b357] flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-[#001f3f]" />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* The lead story */}
            <article className="wf-fade group lg:col-span-7" style={{ ["--d" as string]: "120ms" }}>
              <Link href={`/news/${lead.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-[#eef1f5]">
                <Image
                  src={lead.img}
                  alt={lead.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {lead.badge?.trim() && (
                  <span className="absolute top-4 left-4 bg-[#0a2647] text-white text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5">
                    {lead.badge.trim()}
                  </span>
                )}
              </Link>
              <div className="pt-5">
                {lead.date && (
                  <p className="inline-flex items-center gap-2 text-xs text-[#9ca3af]">
                    <Clock className="w-3.5 h-3.5" /> {fmt(lead.date)}
                  </p>
                )}
                <Link href={`/news/${lead.slug}`} className="mt-2 block">
                  <h3 className="font-['Outfit'] text-2xl md:text-[28px] font-bold leading-snug tracking-tight text-[#0d1117] group-hover:text-[#b8913f] transition-colors line-clamp-3">
                    {lead.title}
                  </h3>
                </Link>
                {lead.excerpt && <p className="mt-3 text-[15px] text-[#5f6368] leading-relaxed line-clamp-2">{lead.excerpt}</p>}
              </div>
            </article>

            {/* Three more, as rows */}
            {rest.length > 0 && (
              <div className="lg:col-span-5 lg:border-l lg:border-[#eef0f3] lg:pl-10">
                {rest.map((item, i) => (
                  <article
                    key={item.slug}
                    className="wf-fade group grid grid-cols-[104px_1fr] gap-4 py-5 border-b border-[#eef0f3] first:pt-0 last:border-b-0"
                    style={{ ["--d" as string]: `${260 + i * 120}ms` }}
                  >
                    <Link href={`/news/${item.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#eef1f5]">
                      <Image src={item.img} alt={item.title} fill sizes="104px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    </Link>
                    <div className="min-w-0">
                      {item.date && <p className="text-xs text-[#9ca3af]">{fmt(item.date)}</p>}
                      <Link href={`/news/${item.slug}`} className="mt-1 block">
                        <h3 className="font-['Outfit'] text-[15.5px] font-bold leading-snug text-[#0d1117] group-hover:text-[#b8913f] transition-colors line-clamp-3">
                          {item.title}
                        </h3>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </InView>
    </section>
  )
}
