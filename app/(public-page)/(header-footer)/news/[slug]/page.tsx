import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  fetchArticleBySlug,
  fetchArticlesList,
  toManilaIso,
} from "@/lib/news-service"
import { DEFAULT_PREVIEW_IMAGE_URL, LEGACY_PREVIEW_IMAGE_URL, jsonLdScript, truncateDescription } from "@/lib/seo"
import { ContentBlocks } from "@/components/news/content-blocks"
import { CopyLinkButton } from "@/components/news/copy-link-button"
import { NewsViewTracker } from "@/components/news/news-view-tracker"
import { Clock, Play } from "lucide-react"

export const revalidate = 300

/**
 * Prerender only the newest articles, and only in production — everything
 * else is on-demand ISR (cached on first hit, refreshed every 5 minutes).
 * Locally VERCEL_ENV is unset, so dev/CI builds never depend on the API.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (process.env.VERCEL_ENV !== "production") return []
  try {
    const { articles } = await fetchArticlesList({ page: 1, perPage: 12 })
    return articles.filter((a) => a.slug).map((a) => ({ slug: a.slug }))
  } catch {
    return []
  }
}

// ── Metadata ───────────────────────────────────────────────────────────────────
type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

  const article = await fetchArticleBySlug(slug)
  // notFound() here, not a placeholder title: aborting in metadata is what
  // turns a dead article URL into a real HTTP 404.
  if (!article) notFound()

  const canonical = `${siteUrl}/news/${article.slug}`
  // Never fall back to the raw title — a description that duplicates the
  // title is a duplicate-content signal, not a snippet.
  const description =
    truncateDescription(article.excerpt) ||
    "Dubai real estate news and market analysis from FHI Global."
  // Placeholder rejection must recognize BOTH defaults: stored/upstream
  // article data still carries the legacy URL (dead host), while the
  // news-service stamps the current one.
  const isPlaceholderImage = (u: string | null | undefined) =>
    !u || u === DEFAULT_PREVIEW_IMAGE_URL || u === LEGACY_PREVIEW_IMAGE_URL
  const image = !isPlaceholderImage(article.featuredImage)
    ? article.featuredImage
    : !isPlaceholderImage(article.img)
      ? article.img
      : undefined
  const keywords = [
    ...article.keywords,
    ...article.topics,
    article.category,
    article.author,
    "Dubai real estate news",
    "FHI Global news",
  ].filter(Boolean) as string[]
  const publishedTime = toManilaIso(article.publishedAt || article.date) ?? undefined
  const modifiedTime = toManilaIso(article.updatedAt) ?? publishedTime

  return {
    // absolute: bypasses the layout template so the full headline survives —
    // truncating to fit the template amputated the keyword-bearing tail, and
    // Google shortens over-long titles far more gracefully than we can.
    title: { absolute: `${article.title} | FHI Global News` },
    description,
    metadataBase: new URL(siteUrl),
    keywords,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      url: canonical,
      type: "article",
      publishedTime,
      modifiedTime,
      authors: article.author ? [article.author] : undefined,
      tags: article.tags,
      images: image ? [{ url: image, alt: article.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

// ── Time ago label ─────────────────────────────────────────────────────────────
// Expects an ISO string WITH offset (toManilaIso) — a naive upstream timestamp
// would be parsed in the server's timezone and produce negative diffs on UTC.
function timeAgoLabel(isoDate: string | null): string {
  if (!isoDate) return "UPDATED RECENTLY"
  const diff = Date.now() - new Date(isoDate).getTime()
  if (!Number.isFinite(diff)) return "UPDATED RECENTLY"
  if (diff < 60_000) return "JUST UPDATED" // includes clock skew (negative diffs)
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 60) return `UPDATED ${mins} MIN AGO`
  if (hours < 24) return `UPDATED ${hours} HOUR${hours === 1 ? "" : "S"} AGO`
  if (days < 30) return `UPDATED ${days} DAY${days === 1 ? "" : "S"} AGO`
  return "UPDATED RECENTLY"
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

// ── Share strip ────────────────────────────────────────────────────────────────
function ShareStrip({ url, title, compact }: { url: string; title: string; compact?: boolean }) {
  const e = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mr-1">Share</span>
      )}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${e}`}
        target="_blank" rel="noopener noreferrer"
        className="w-7 h-7 rounded-full bg-[#1877f2] flex items-center justify-center text-white hover:opacity-75 transition-opacity"
        aria-label="Share on Facebook"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${e}&text=${t}`}
        target="_blank" rel="noopener noreferrer"
        className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white hover:opacity-75 transition-opacity"
        aria-label="Share on X / Twitter"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${e}`}
        target="_blank" rel="noopener noreferrer"
        className="w-7 h-7 rounded-full bg-[#0077b5] flex items-center justify-center text-white hover:opacity-75 transition-opacity"
        aria-label="Share on LinkedIn"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
      </a>
      <CopyLinkButton url={url} />
    </div>
  )
}

// ── Author schema heuristic ────────────────────────────────────────────────────
// Human bylines ("Maria Dela Cruz") → Person; desk names ("HOMESPH NEWS",
// "FHI Global Editorial Team") → Organization. E-E-A-T signal for Google.
function authorSchema(author: string | undefined) {
  const name = (author ?? "").trim() || "FHI Global Editorial Team"
  const words = name.split(/\s+/)
  const looksHuman =
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((w) => /^[A-Za-zÀ-ÿ.'-]+$/.test(w)) &&
    !/\b(news|team|desk|editorial|global|staff|inc|llc|media)\b/i.test(name)
  return { "@type": looksHuman ? "Person" : "Organization", name }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function NewsDetailPage({ params }: PageProps) {
  const { slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

  // Fetch in parallel
  const [article, latestList] = await Promise.all([
    fetchArticleBySlug(slug),
    fetchArticlesList({ page: 1, perPage: 20 }),
  ])

  if (!article) {
    notFound()
  }

  const articleUrl = `${siteUrl}/news/${article.slug}`
  const publishedIso = toManilaIso(article.publishedAt || article.date)
  const modifiedIso = toManilaIso(article.updatedAt) ?? publishedIso
  const timeLabel = timeAgoLabel(modifiedIso ?? publishedIso)

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt || article.title,
    image: article.featuredImage || article.img,
    inLanguage: "en",
    author: authorSchema(article.author),
    publisher: {
      "@type": "Organization",
      name: "FHI Global",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/android-chrome-512x512.png`,
      },
    },
    ...(publishedIso ? { datePublished: publishedIso } : {}),
    ...(modifiedIso ? { dateModified: modifiedIso } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    ...(article.category ? { articleSection: article.category } : {}),
    ...(article.keywords.length ? { keywords: article.keywords.join(", ") } : {}),
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "News", item: `${siteUrl}/news` },
      ...(article.category && article.categorySlug
        ? [{
            "@type": "ListItem",
            position: 3,
            name: article.category,
            item: `${siteUrl}/news?category=${encodeURIComponent(article.categorySlug)}`,
          }]
        : []),
      {
        "@type": "ListItem",
        position: article.category && article.categorySlug ? 4 : 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  }

  // Related stories — deterministic: same category first, then most recent.
  const pool = latestList.articles.filter((a) => a.slug !== article.slug)
  const sameCategory = pool.filter((a) => a.categorySlug && a.categorySlug === article.categorySlug)
  const others = pool.filter((a) => !sameCategory.includes(a))
  const related = [...sameCategory, ...others].slice(0, 7)

  const latestStories = related.slice(0, 4)
  const trending = related.slice(4, 7)

  return (
    <div className="min-h-screen bg-white font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema) }}
      />
      <NewsViewTracker slug={article.slug} />

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/" className="hover:text-[#d6b357] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-[#d6b357] transition-colors">News</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{article.title}</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── LEFT / MAIN ARTICLE ─────────────────────────────────────────── */}
          <article className="lg:col-span-8">

            {/* Title block with left border style */}
            <div className="border-l-4 border-[#d6b357] pl-4 mb-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#001428] leading-tight">
                {article.title}
              </h1>
            </div>

            {/* Meta row: updated label + author + share actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 py-3 border-y border-gray-100">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#d6b357]">
                  {timeLabel}
                </span>
                {article.author && (
                  <span className="text-xs text-gray-500">
                    By <span className="font-semibold text-[#001428]">{article.author}</span>
                  </span>
                )}
                {article.readTime && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {article.readTime}
                  </span>
                )}
              </div>
              <ShareStrip url={articleUrl} title={article.title} />
            </div>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-base sm:text-lg text-gray-600 font-medium leading-relaxed mb-5 border-b border-gray-100 pb-5">
                {article.excerpt}
              </p>
            )}

            {/* Featured image */}
            <div className="relative overflow-hidden aspect-video bg-gray-100 mb-6">
              <Image
                src={article.img}
                alt={article.title}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
              />
              {article.hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-current" />
                  </div>
                </div>
              )}
            </div>

            {/* Article content */}
            <div className="mb-8">
              <ContentBlocks
                blocks={article.contentBlocks}
                heroSrc={article.img}
                legacyHtml={article.content}
              />
            </div>

            {/* Bottom share section */}
            <div className="border-t border-gray-200 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#001428] mb-0.5">
                  Share this article
                </p>
                <p className="text-[10px] text-gray-400">
                  Help others stay informed about the real estate market.
                </p>
              </div>
              <ShareStrip url={articleUrl} title={article.title} />
            </div>

            {/* Back link */}
            <div className="mt-6">
              <Link
                href="/news"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#001428] hover:text-[#d6b357] transition-colors uppercase tracking-widest"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7" />
                </svg>
                Back to News
              </Link>
            </div>
          </article>

          {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
          <aside className="lg:col-span-4 flex flex-col gap-8">

            {/* LATEST STORIES */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#001428] border-b-2 border-[#001428] pb-1 mb-4">
                Latest Stories
              </p>
              <ul className="space-y-4">
                {latestStories.map((item) => (
                  <li key={item.id}>
                    <Link href={`/news/${item.slug}`} className="group flex gap-3">
                      <div className="relative w-16 h-12 shrink-0 overflow-hidden bg-gray-100">
                        <Image
                          src={item.img}
                          alt={item.title}
                          fill
                          sizes="64px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-2 mb-1">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-gray-400">{fmt(item.date)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* TRENDING */}
            {trending.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#001428] border-b-2 border-[#001428] pb-1 mb-4">
                  Trending
                </p>
                <ul className="space-y-4">
                  {trending.map((item) => (
                    <li key={item.id}>
                      <Link href={`/news/${item.slug}`} className="group block">
                        <div className="relative overflow-hidden aspect-video bg-gray-100 mb-2">
                          <Image
                            src={item.img}
                            alt={item.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {item.badge && (
                            <span className="absolute top-1.5 left-1.5 bg-[#d6b357] text-[#001428] text-[8px] font-black uppercase px-1.5 py-0.5">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#001428] group-hover:text-[#d6b357] transition-colors leading-snug line-clamp-2 mb-1">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-gray-400">{fmt(item.date)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Static ad / newsletter promo */}
            <div className="bg-[#001428] p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#d6b357] mb-2">
                Stay Informed
              </p>
              <p className="text-sm font-bold leading-snug mb-3">
                Get the latest real estate intelligence delivered to your inbox.
              </p>
              <Link
                href="/contact"
                className="inline-block bg-[#d6b357] text-[#001428] text-xs font-black uppercase tracking-widest px-4 py-2 hover:bg-[#c4a247] transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </aside>

        </div>
      </main>

    </div>
  )
}
