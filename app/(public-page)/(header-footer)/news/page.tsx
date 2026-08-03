import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createPageMetadata, SITE_URL } from "@/lib/seo"
import {
  fetchArticlesList,
  fetchCategoriesCountries,
  slugify,
  type NewsArticle,
} from "@/lib/news-service"
import { NewsletterSignup } from "@/components/news/newsletter-signup"
import { Clock, Play, TrendingUp, Clock3, ChevronRight } from "lucide-react"

export const revalidate = 300

export const metadata: Metadata = createPageMetadata({
  title: "News | FHI Global — Real Estate Insights",
  description:
    "Stay up to date with the latest real estate news, market trends, and investment insights from FHI Global.",
  pathname: "/news",
  keywords: ["Dubai real estate news", "UAE property updates", "FHI Global news", "property market insights"],
})

type SearchParams = Promise<{ title?: string; category?: string }>

// ── Helpers ────────────────────────────────────────────────────────────────────
function safe(arr: NewsArticle[], i: number): NewsArticle | null {
  return arr[i] ?? null
}

function fmt(dateStr: string) {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

/** Thin section heading */
function SecHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-[#001428] pb-1.5 mb-4">
      <span className="w-1 h-4 bg-[#d6b357] shrink-0" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#001428]">{children}</p>
    </div>
  )
}

/** Thumbnail card (image top, title below) */
function ThumbCard({ item }: { item: NewsArticle }) {
  return (
    <Link href={`/news/${item.slug}`} className="group flex flex-col gap-1.5">
      <div className="relative overflow-hidden aspect-[4/3] bg-gray-100">
        <Image
          src={item.img}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {item.badge && (
          <span className="absolute top-1.5 left-1.5 bg-[#d6b357] text-[#001428] text-[8px] font-black uppercase px-1.5 py-0.5 leading-tight">
            {item.badge}
          </span>
        )}
        {item.hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="w-3 h-3 text-white fill-current" />
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-3">
        {item.title}
      </p>
      {item.date && <p className="text-[10px] text-gray-400">{fmt(item.date)}</p>}
    </Link>
  )
}

/** Overlay card — gradient title on image */
function OverlayCard({ item, tall = false }: { item: NewsArticle; tall?: boolean }) {
  return (
    <Link href={`/news/${item.slug}`}
      className={`group relative overflow-hidden bg-gray-200 block ${tall ? "aspect-[3/4]" : "aspect-[4/3]"}`}>
      <Image
        src={item.img}
        alt={item.title}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      {item.badge && (
        <span className="absolute top-2 left-2 bg-[#d6b357] text-[#001428] text-[8px] font-black uppercase px-1.5 py-0.5 leading-tight">
          {item.badge}
        </span>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-black text-sm leading-tight line-clamp-3 group-hover:text-[#d6b357] transition-colors">
          {item.title}
        </p>
        {item.date && <p className="text-white/50 text-[10px] mt-1">{fmt(item.date)}</p>}
      </div>
    </Link>
  )
}

/** Archive row — horizontal card with thumb + meta */
function ArchiveRow({ item, rank }: { item: NewsArticle; rank?: number }) {
  return (
    <Link href={`/news/${item.slug}`} className="group flex gap-3 py-3 border-b border-gray-100 last:border-0 items-start">
      {rank !== undefined && (
        <span className="shrink-0 w-6 text-center font-black text-lg text-[#d6b357]/60 leading-none mt-0.5">
          {rank}
        </span>
      )}
      <div className="relative w-20 h-14 shrink-0 overflow-hidden bg-gray-100">
        <Image
          src={item.img}
          alt={item.title}
          fill
          sizes="80px"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {item.hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="w-2.5 h-2.5 text-white fill-current" />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-2 mb-1">
          {item.title}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          {item.date && <span>{fmt(item.date)}</span>}
          {item.readTime && (
            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{item.readTime}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { title, category } = await searchParams

  if (title) {
    redirect(`/news/${slugify(title)}`)
  }

  // One list call (per_page is capped at 100 upstream) + the category pairs
  // that power the filter chips. Dedup by UUID id as a cheap guard.
  const activeCategory = typeof category === "string" && category.trim() ? category.trim() : undefined
  const [{ articles: fetched, total }, categoryPairs] = await Promise.all([
    fetchArticlesList({ page: 1, perPage: 100, categorySlug: activeCategory }),
    fetchCategoriesCountries(),
  ])
  const seen = new Set<string>()
  const all: NewsArticle[] = []
  for (const a of fetched) {
    if (!seen.has(a.id)) { seen.add(a.id); all.push(a) }
  }

  // Distinct categories (pairs are category × country) with summed counts.
  const categoryChips = [...categoryPairs
    .reduce((map, p) => {
      const existing = map.get(p.categorySlug)
      if (existing) existing.articleCount += p.articleCount
      else map.set(p.categorySlug, { ...p })
      return map
    }, new Map<string, (typeof categoryPairs)[number]>())
    .values()].sort((a, b) => b.articleCount - a.articleCount)

  if (all.length === 0 && !activeCategory) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center py-24 px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">No news available</h1>
            <p className="text-gray-500 text-sm">Check back soon for the latest real estate news and market updates.</p>
          </div>
        </main>
      </div>
    )
  }

  // ── Adaptive slicing ─────────────────────────────────────────────────────────
  // Hero: up to 3 overlay cards
  const heroCount    = Math.min(3, all.length)
  const heroArticles = all.slice(0, heroCount)

  // After hero: divide remaining into card grid + archive
  const afterHero    = all.slice(heroCount)
  // Card grid: next up-to-9 articles (fills 3x3 max)
  const cardGrid     = afterHero.slice(0, 9)
  // Feature + list combo (only meaningful if 5+ cards)
  const featureBig   = cardGrid.length >= 5 ? safe(cardGrid, 0) : null
  const featureList  = cardGrid.length >= 5 ? cardGrid.slice(1, 5) : []
  const thumbGrid    = cardGrid.length < 5 ? cardGrid : cardGrid.slice(5)
  // Archive rows: everything beyond the card grid
  const archiveItems = afterHero.slice(9)

  // Sidebar
  const mostReadItems  = all.slice(0, Math.min(5, all.length))
  const sidebarRecent  = all.slice(5, 10)

  // Grid column class for hero based on count
  const heroGridCols =
    heroCount === 1 ? "grid-cols-1" :
    heroCount === 2 ? "grid-cols-1 md:grid-cols-2" :
                     "grid-cols-1 md:grid-cols-3"

  // Grid column class for thumb cards based on count
  const thumbCols =
    thumbGrid.length === 1 ? "grid-cols-1 sm:grid-cols-2" :
    thumbGrid.length === 2 ? "grid-cols-2" :
                             "grid-cols-2 sm:grid-cols-3"

  const shownCount = total > 0 && !activeCategory ? total : all.length

  // CollectionPage + ItemList structured data for the news hub.
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "FHI Global News",
    description:
      "The latest real estate news, market trends, and investment insights from FHI Global.",
    url: `${SITE_URL}/news`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: all.slice(0, 10).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/news/${item.slug}`,
        name: item.title,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      {/* ── TICKER ── */}
      {all.length > 0 && (
        <div className="bg-[#001428]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center overflow-hidden">
            <span className="shrink-0 bg-[#d6b357] text-[#001428] text-[10px] font-black uppercase tracking-widest px-3 py-1 mr-4">
              BREAKING
            </span>
            <div className="flex items-center overflow-hidden gap-0 min-w-0">
              {all.slice(0, 6).map((item, i) => (
                <span key={item.id} className="flex items-center shrink-0">
                  {i > 0 && <span className="w-px h-3 bg-white/20 mx-3" />}
                  <Link href={`/news/${item.slug}`}
                    className="text-white/80 text-[11px] hover:text-[#d6b357] transition-colors truncate max-w-[200px]">
                    {item.title}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight text-[#001428] uppercase">Latest News</h1>
          <span className="text-[10px] text-gray-400">{shownCount} article{shownCount !== 1 ? "s" : ""}</span>
        </div>
        {/* Category filter chips */}
        {categoryChips.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <Link
              href="/news"
              className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                !activeCategory
                  ? "bg-[#001428] text-white border-[#001428]"
                  : "bg-white text-[#001428] border-gray-300 hover:border-[#001428]"
              }`}
            >
              All
            </Link>
            {categoryChips.map((chip) => (
              <Link
                key={chip.categorySlug}
                href={`/news?category=${encodeURIComponent(chip.categorySlug)}`}
                className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                  activeCategory === chip.categorySlug
                    ? "bg-[#001428] text-white border-[#001428]"
                    : "bg-white text-[#001428] border-gray-300 hover:border-[#001428]"
                }`}
              >
                {chip.category}
                <span className="ml-1.5 text-[#d6b357]">{chip.articleCount}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Filtered empty state ── */}
      {all.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-lg font-bold text-gray-800 mb-2">No articles in this category yet</h2>
          <p className="text-gray-500 text-sm">
            Try another category or{" "}
            <Link href="/news" className="text-[#d6b357] font-semibold hover:underline">view all news</Link>.
          </p>
        </div>
      )}

      {/* ── HERO OVERLAY CARDS ── */}
      <div className="bg-[#001428] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid ${heroGridCols} gap-3`}>
            {heroArticles.map((item) => (
              <OverlayCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN + SIDEBAR ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ════ MAIN ════ */}
          <main className="lg:col-span-8 space-y-6">

            {/* Latest News — feature + list (only when 5+ cards available) */}
            {featureBig && (
              <section className="bg-white p-4 shadow-sm">
                <SecHead>Latest News</SecHead>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-6">
                    <OverlayCard item={featureBig} />
                  </div>
                  <ul className="sm:col-span-6 space-y-2.5">
                    {featureList.map((item) => (
                      <li key={item.id}>
                        <Link href={`/news/${item.slug}`} className="group flex gap-2.5 items-start">
                          <div className="relative w-16 h-11 shrink-0 overflow-hidden bg-gray-100">
                            <Image
                              src={item.img}
                              alt={item.title}
                              fill
                              sizes="64px"
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-2">
                              {item.title}
                            </p>
                            {item.date && <p className="text-[10px] text-gray-400 mt-0.5">{fmt(item.date)}</p>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Card grid — remaining cards after feature (or all cards if < 5) */}
            {(cardGrid.length < 5 ? cardGrid : thumbGrid).length > 0 && (
              <section className="bg-white p-4 shadow-sm">
                <SecHead>{featureBig ? "More Stories" : "Latest News"}</SecHead>
                <div className={`grid ${thumbCols} gap-4`}>
                  {(cardGrid.length < 5 ? cardGrid : thumbGrid).map((item) => (
                    <ThumbCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Archive rows — only shown when articles exist beyond the card grid */}
            {archiveItems.length > 0 && (
              <section className="bg-white p-4 shadow-sm">
                <SecHead>All Stories</SecHead>
                {archiveItems.map((item) => (
                  <ArchiveRow key={item.id} item={item} />
                ))}
                <div className="mt-4 text-center">
                  <button className="bg-[#001428] text-white text-xs font-black uppercase tracking-widest px-8 py-2.5 hover:bg-[#d6b357] hover:text-[#001428] transition-colors">
                    More Posts
                  </button>
                </div>
              </section>
            )}

          </main>

          {/* ════ SIDEBAR ════ */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="lg:sticky lg:top-[52px] space-y-5">

              {/* Most Read Today — always shown */}
              <div className="bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b-2 border-[#001428] pb-1.5 mb-4">
                  <TrendingUp className="w-3.5 h-3.5 text-[#d6b357]" />
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#001428]">Most Read Today</p>
                </div>
                <ol>
                  {mostReadItems.map((item, i) => (
                    <ArchiveRow key={item.id} item={item} rank={i + 1} />
                  ))}
                </ol>
              </div>

              {/* Recent Posts — only shown if articles exist beyond index 5 */}
              {sidebarRecent.length > 0 && (
                <div className="bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b-2 border-[#001428] pb-1.5 mb-4">
                    <Clock3 className="w-3.5 h-3.5 text-[#d6b357]" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#001428]">Recent Posts</p>
                  </div>
                  <ul className="space-y-3">
                    {sidebarRecent.map((item) => (
                      <li key={item.id}>
                        <Link href={`/news/${item.slug}`} className="group flex gap-2.5 items-start">
                          <div className="relative w-14 h-10 shrink-0 overflow-hidden bg-gray-100">
                            <Image
                              src={item.img}
                              alt={item.title}
                              fill
                              sizes="56px"
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-2">
                              {item.title}
                            </p>
                            {item.date && <p className="text-[10px] text-gray-400 mt-0.5">{fmt(item.date)}</p>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Newsletter signup */}
              <NewsletterSignup />

              {/* About this feed */}
              <div className="bg-[#001428] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#d6b357] mb-2">FHI Global News</p>
                <p className="text-white/70 text-[11px] leading-relaxed">
                  Real estate intelligence and OFW community news curated for Filipinos worldwide.
                </p>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-white/40 text-[10px]">{all.length} articles</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#d6b357]/50" />
                </div>
              </div>

            </div>
          </aside>

        </div>
      </div>

    </div>
  )
}
