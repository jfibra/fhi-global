import { NextResponse } from "next/server"
import { fetchArticles } from "@/lib/news-service"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

async function fetchPublishedNews(maxPages = 8) {
  const all = [] as Awaited<ReturnType<typeof fetchArticles>>
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchArticles(page)
    if (!batch.length) break

    for (const article of batch) {
      if (!article.slug || seen.has(article.slug)) continue
      seen.add(article.slug)
      if (article.isPublished === false) continue
      all.push(article)
    }
  }

  return all
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
}

export async function GET() {
  const news = await fetchPublishedNews()

  const xmlItems = news
    .map((article) => {
      const loc = `${SITE_URL}/news/${article.slug}`
      const pubDate = article.publishedAt || article.date || new Date().toISOString()
      const language = article.language || "en"
      const author = article.author || "FHI Global"

      return `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>FHI Global News</news:name>
        <news:language>${xmlEscape(language)}</news:language>
      </news:publication>
      <news:publication_date>${xmlEscape(pubDate)}</news:publication_date>
      <news:title>${xmlEscape(article.title)}</news:title>
      <news:keywords>${xmlEscape((article.tags ?? []).join(", "))}</news:keywords>
      <news:author>${xmlEscape(author)}</news:author>
    </news:news>
    <lastmod>${xmlEscape(article.updatedAt || pubDate)}</lastmod>
  </url>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${xmlItems}
</urlset>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=900, stale-while-revalidate=3600",
    },
  })
}
