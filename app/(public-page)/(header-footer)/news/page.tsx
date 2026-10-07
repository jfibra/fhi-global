import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createPageMetadata, jsonLdScript, SITE_URL } from "@/lib/seo"
import {
  fetchArticlesList,
  fetchCategoriesCountries,
  newsConfigured,
  slugify,
  type NewsArticle,
} from "@/lib/news-service"
import { NewsletterSignup } from "@/components/news/newsletter-signup"
import { NewsTicker } from "@/components/public/news-ticker"
import { NewsHero } from "@/components/public/news-hero"
import { ArrowRight, TrendingUp } from "lucide-react"

export const revalidate = 300

// 100 full article cards made this page ~940 KB of HTML for a fold that shows
// five; 30 rows per page with real <a> pagination keeps every article
// reachable at a fraction of the parse cost.
const PAGE_SIZE = 30

type SearchParams = Promise<{ title?: string; category?: string; page?: string }>

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Pagination href that keeps the category filter and drops page=1. */
function newsPageHref(category: string | undefined, page: number): string {
  const p = new URLSearchParams()
  if (category) p.set("category", category)
  if (page > 1) p.set("page", String(page))
  const qs = p.toString()
  return qs ? `/news?${qs}` : "/news"
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { page, category } = await searchParams
  const pageNum = parsePage(page)
  // Self-canonical per page so the article links on deep pages stay in the
  // crawl graph. A category view lists a subset of the same syndicated articles
  // (and used to canonicalise to the unfiltered list although its content
  // differs): it stays out of the index, links followed, canonical to itself.
  return createPageMetadata({
    title: pageNum > 1 ? `Real Estate News & Insights — Page ${pageNum}` : "Real Estate News & Insights",
    description:
      "Stay up to date with the latest real estate news, market trends, and investment insights from FHI Global.",
    pathname: newsPageHref(category || undefined, pageNum),
    robots: category ? { index: false, follow: true } : undefined,
    keywords: ["Dubai real estate news", "UAE property updates", "FHI Global news", "property market insights"],
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

/** Section heading — gold rule under a plain uppercase label. */
function SecHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">{children}</h2>
      <span className="block w-12 h-[3px] bg-[#d6b357] mt-2.5" aria-hidden="true" />
    </div>
  )
}

/** The category label above a headline. Upstream sends no category per article,
 *  so this falls back to the badge when there is one and stays silent when not
 *  — an invented label would be worse than none. */
function Kicker({ item }: { item: NewsArticle }) {
  const label = item.badge?.trim()
  if (!label) return null
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">{label}</span>
  )
}

/** Wide row: thumbnail left, text right — the mockup's "Latest Articles" item. */
function ArticleRow({ item }: { item: NewsArticle }) {
  return (
    <article className="group grid grid-cols-[110px_1fr] sm:grid-cols-[210px_1fr] gap-4 sm:gap-6 py-6 border-b border-[#eef0f3] last:border-b-0">
      <Link href={`/news/${item.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#eef1f5]">
        <Image
          src={item.img}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 110px, 210px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>
      <div className="min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Kicker item={item} />
          {item.date && <span className="text-xs text-[#9ca3af]">{fmt(item.date)}</span>}
        </div>
        <Link href={`/news/${item.slug}`} className="mt-1.5">
          <h3 className="font-['Outfit'] text-[17px] sm:text-lg font-bold text-[#0d1117] leading-snug group-hover:text-[#b8913f] transition-colors line-clamp-2">
            {item.title}
          </h3>
        </Link>
        {item.excerpt && (
          <p className="mt-2 text-sm text-[#6b7280] leading-relaxed line-clamp-2">{item.excerpt}</p>
        )}
        <Link
          href={`/news/${item.slug}`}
          className="mt-auto pt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors self-start"
        >
          Read Article <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  )
}

/** Numbered sidebar entry — the mockup's "Trending Now" row. */
function TrendingRow({ item, rank }: { item: NewsArticle; rank: number }) {
  return (
    <li>
      <Link href={`/news/${item.slug}`} className="group flex gap-3 items-start py-3 border-b border-[#eef0f3] last:border-b-0">
        <span className="font-['Outfit'] text-lg font-bold text-[#d6b357] tabular-nums leading-none pt-0.5 w-6 shrink-0">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="relative w-[68px] h-[52px] shrink-0 overflow-hidden bg-[#eef1f5]">
          <Image src={item.img} alt={item.title} fill sizes="68px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0d1117] leading-snug line-clamp-3 group-hover:text-[#b8913f] transition-colors">
            {item.title}
          </p>
          {item.date && <p className="text-[11px] text-[#9ca3af] mt-1">{fmt(item.date)}</p>}
        </div>
      </Link>
    </li>
  )
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { title, category, page } = await searchParams

  if (title) {
    redirect(`/news/${slugify(title)}`)
  }
  const pageNum = parsePage(page)

  // One paged list call + the category pairs that power the filter chips.
  // Dedup by UUID id as a cheap guard.
  const activeCategory = typeof category === "string" && category.trim() ? category.trim() : undefined
  const [{ articles: fetched, lastPage }, categoryPairs] = await Promise.all([
    fetchArticlesList({ page: pageNum, perPage: PAGE_SIZE, categorySlug: activeCategory }),
    fetchCategoriesCountries(),
  ])
  const seen = new Set<string>()
  const all: NewsArticle[] = []
  for (const a of fetched) {
    if (!seen.has(a.id)) { seen.add(a.id); all.push(a) }
  }
  // lastPage 0 is the upstream-FAILURE sentinel (a real Laravel page always
  // reports ≥ 1). An outage must answer 5xx, never notFound(): a 404 fired
  // during ISR revalidation would cache a hard 404 over the live archive.
  if (lastPage === 0 && all.length === 0 && newsConfigured()) {
    throw new Error("News upstream unavailable")
  }
  const totalPages = Math.max(1, lastPage || 1)
  // Out-of-range pages 404 instead of serving an empty shell that indexes.
  if (pageNum > 1 && all.length === 0) notFound()

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
        <div className="flex-1 flex flex-col items-center justify-center py-24 px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">No news available</h1>
            <p className="text-gray-500 text-sm">Check back soon for the latest real estate news and market updates.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Slicing ──────────────────────────────────────────────────────────────
  // Page 1: the five newest lead the masthead slider, the next six run in the
  // Live strip, and the rows start after the slider's five so nothing shows
  // twice above the fold (the sidebar's Trending recaps the top five). Deeper
  // pages are plain rows. `all` is newest-first upstream.
  const isFirstPage = pageNum === 1
  const latest = isFirstPage ? all[0] ?? null : null
  const heroStories = isFirstPage ? all.slice(0, 5) : []
  const tickerItems = isFirstPage ? (all.length > 6 ? all.slice(5, 11) : all.slice(0, 6)) : []
  const listItems = isFirstPage ? all.slice(heroStories.length) : all
  const trending = all.slice(0, Math.min(5, all.length))

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
    <div className="min-h-screen bg-[#f7f8fa] font-sans">
      {/* Page 1 only: deeper pages would claim the /news identity while
          listing a different slice of articles. */}
      {isFirstPage && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionSchema) }}
        />
      )}

      {/* ── MASTHEAD ──────────────────────────────────────────────────────
          A story slider on page 1: the five newest articles, pictures and
          headlines taking turns (the boss: pictures that change, like a
          news site). Deeper pages get the plain masthead. */}
      <NewsHero stories={heroStories.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, img: a.img, date: a.date, badge: a.badge }))} />

      {/* ── LIVE STRIP ────────────────────────────────────────────────────
          The six newest headlines, one at a time, changing every few seconds
          (the boss: the headline should change). The first is in the server
          HTML; the rest slide in on the client — see NewsTicker. */}
      {latest && <NewsTicker items={tickerItems.map((a) => ({ slug: a.slug, title: a.title, date: a.date }))} />}

      {/* ── CATEGORY TABS ─────────────────────────────────────────────────
          Underlined tabs rather than bordered chips. Same links, same
          ?category= filtering, same counts. */}
      {categoryChips.length > 0 && (
        <div className="bg-white border-b border-[#e8eaed]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 overflow-x-auto scrollbar-none">
            <Link
              href="/news"
              className={`shrink-0 py-4 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                !activeCategory
                  ? "text-[#0d1117] border-[#d6b357]"
                  : "text-[#6b7280] border-transparent hover:text-[#0d1117]"
              }`}
            >
              All
            </Link>
            {categoryChips.map((chip) => (
              <Link
                key={chip.categorySlug}
                href={`/news?category=${encodeURIComponent(chip.categorySlug)}`}
                className={`shrink-0 py-4 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  activeCategory === chip.categorySlug
                    ? "text-[#0d1117] border-[#d6b357]"
                    : "text-[#6b7280] border-transparent hover:text-[#0d1117]"
                }`}
              >
                {chip.category}
                <span className="ml-1.5 text-xs text-[#9ca3af]">{chip.articleCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtered empty state ── */}
      {all.length === 0 && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-lg font-bold text-[#0d1117] mb-2">No articles in this category yet</h2>
          <p className="text-[#6b7280] text-sm">
            Try another category or{" "}
            <Link href="/news" className="text-[#b8913f] font-semibold hover:underline">view all news</Link>.
          </p>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ════ MAIN ════ */}
          <div className="lg:col-span-8 space-y-10">

            {/* Latest Articles — one column of wide rows */}
            {listItems.length > 0 && (
              <section>
                <SecHead>Latest Articles</SecHead>
                <div className="bg-white border border-[#e8eaed] px-6">
                  {listItems.map((item) => (
                    <ArticleRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Pagination — real <a> links keep the archive crawlable now that
                the page renders 30 rows instead of the whole feed. */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2">
                {pageNum > 1 && (
                  <Link
                    href={newsPageHref(activeCategory, pageNum - 1)}
                    className="px-4 py-2 border border-[#e8eaed] bg-white text-sm font-semibold text-[#0d1117] hover:border-[#d6b357] transition-colors"
                  >
                    Newer
                  </Link>
                )}
                <span className="px-2 text-sm text-[#6b7280]">
                  Page {pageNum} of {totalPages}
                </span>
                {pageNum < totalPages && (
                  <Link
                    href={newsPageHref(activeCategory, pageNum + 1)}
                    className="px-4 py-2 border border-[#e8eaed] bg-white text-sm font-semibold text-[#0d1117] hover:border-[#d6b357] transition-colors"
                  >
                    Older
                  </Link>
                )}
              </nav>
            )}

          </div>

          {/* ════ SIDEBAR ════ */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="lg:sticky lg:top-[52px] space-y-6">

              {/* Trending Now */}
              {trending.length > 0 && (
                <div className="bg-white border border-[#e8eaed] p-5">
                  <p className="font-['Outfit'] text-[13px] font-bold uppercase tracking-[0.14em] text-[#0d1117]">
                    Trending Now
                  </p>
                  <span className="block w-10 h-[3px] bg-[#d6b357] mt-2 mb-1" aria-hidden="true" />
                  <ol>
                    {trending.map((item, i) => (
                      <TrendingRow key={item.id} item={item} rank={i + 1} />
                    ))}
                  </ol>
                </div>
              )}

              {/* Newsletter — unchanged component, so the subscribe API keeps working */}
              <NewsletterSignup />

              {/* Off-plan promo — routes into the landing page we already rank for */}
              <Link
                href="/off-plan-projects-in-dubai"
                className="group relative block overflow-hidden bg-[#0a2647] p-6 min-h-[190px]"
              >
                <Image
                  src="/background/dubai.webp"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover opacity-30 transition-transform duration-500 group-hover:scale-105"
                  aria-hidden="true"
                />
                <div className="relative">
                  <h3 className="font-['Outfit'] text-xl font-bold text-white leading-snug">
                    Explore Premium<br />Off-Plan Projects
                  </h3>
                  <p className="mt-2 text-[13px] text-white/70 leading-relaxed max-w-[230px]">
                    Discover Dubai&apos;s most exclusive off-plan developments.
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d6b357]">
                    Explore Projects <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>

            </div>
          </aside>

        </div>

        {/* ── MARKET INSIGHTS BAND ── */}
        <div className="mt-10 bg-[#0a2647] px-6 sm:px-10 py-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <TrendingUp className="w-9 h-9 text-[#d6b357] shrink-0" strokeWidth={1.25} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6b357]">Market Insights</p>
            <p className="mt-1 font-['Outfit'] text-lg sm:text-xl font-bold text-white leading-snug">
              Get exclusive insights and market reports delivered directly to your inbox.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 inline-flex items-center justify-center gap-2 border border-[#d6b357]/70 hover:bg-[#d6b357] hover:text-[#001f3f] text-white px-6 py-3.5 text-sm font-bold transition-colors"
          >
            Talk to Our Team <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

    </div>
  )
}
