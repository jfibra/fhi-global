import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { fetchArticles } from "@/lib/news-service"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

type PublicRoute = {
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
}

const STATIC_PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/",           priority: 1.0, changeFrequency: "daily" },
  { path: "/buy",        priority: 0.9, changeFrequency: "daily" },
  { path: "/rent",       priority: 0.9, changeFrequency: "daily" },
  { path: "/projects",   priority: 0.9, changeFrequency: "daily" },
  { path: "/developers", priority: 0.7, changeFrequency: "weekly" },
  { path: "/news",       priority: 0.7, changeFrequency: "daily" },
  { path: "/about",      priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact",    priority: 0.6, changeFrequency: "monthly" },
]

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [{ data: projects }, { data: developers }, { data: agentListings }, news] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, updated_at")
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null),
    supabase
      .from("developers")
      .select("slug, updated_at")
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("agent_listings")
      .select("id, slug, updated_at")
      .eq("status", "published")
      .is("deleted_at", null),
    fetchPublishedNews(),
  ])

  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const projectEntries: MetadataRoute.Sitemap = (projects ?? [])
    .filter((row) => row.slug)
    .map((row) => ({
      url: `${SITE_URL}/projects/${row.slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }))

  const developerEntries: MetadataRoute.Sitemap = (developers ?? [])
    .filter((row) => row.slug)
    .map((row) => ({
      url: `${SITE_URL}/developers/${row.slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    }))

  const listingEntries: MetadataRoute.Sitemap = (agentListings ?? []).map((row) => ({
    url: `${SITE_URL}/listings/${row.slug ?? row.id}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const newsEntries: MetadataRoute.Sitemap = news.map((article) => ({
    url: `${SITE_URL}/news/${article.slug}`,
    lastModified: article.updatedAt ? new Date(article.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  return [
    ...staticEntries,
    ...projectEntries,
    ...developerEntries,
    ...listingEntries,
    ...newsEntries,
  ]
}
