import { NextRequest, NextResponse } from "next/server"
import { fetchArticles } from "@/lib/news-service"

/**
 * GET /api/news/articles?page=1
 * Server-side proxy — returns paginated news articles.
 * The external API key lives only in server env and is never sent to the client.
 */
export async function GET(req: NextRequest) {
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10))
  const articles = await fetchArticles(page)
  return NextResponse.json({ articles })
}
