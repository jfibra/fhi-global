import { NextRequest, NextResponse } from "next/server"
import { fetchArticleBySlug } from "@/lib/news-service"

/**
 * GET /api/news/article?slug=...
 * Server-side proxy — returns a single news article by slug.
 * The external API key lives only in server env and is never sent to the client.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? ""
  if (!slug) {
    return NextResponse.json({ article: null }, { status: 400 })
  }
  const article = await fetchArticleBySlug(slug)
  return NextResponse.json({ article })
}
