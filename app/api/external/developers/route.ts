import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { UUID_RE, pageParams, requireExternalKey } from "@/lib/external-api"
import { isLiveProject, isTestRecord } from "@/lib/listing-publish-checks"
import { SITE_URL } from "@/lib/seo"

/**
 * GET /api/external/developers — the developers FHI works with, for the
 * cross-company AI chat. Keyed (lib/external-api.ts). Read-only.
 *
 *   ?q=<words>            name contains
 *   ?id=<id>  ?slug=<slug>   one developer
 *   ?page=1&limit=50      limit ≤ 100; by name
 *
 * → { success, data: developer[], meta: { total, page, limit } }
 * Each developer: name, slug, public page, logo, website, business contact,
 * verified flag, rating, and how many live projects they have with us.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Row = {
  id: string
  name: string
  slug: string | null
  description: string | null
  logo_url: string | null
  website_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  rating: number | string | null
  is_verified: boolean | null
  is_active: boolean | null
  updated_at: string | null
}

const site = SITE_URL.replace(/\/$/, "")

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const { page, limit, from, to } = pageParams(q)
  const words = (q.get("q") ?? "").trim().toLowerCase()
  const oneId = (q.get("id") ?? "").trim()
  const oneSlug = (q.get("slug") ?? "").trim()
  if (oneId && !UUID_RE.test(oneId)) return NextResponse.json({ error: "id must be a developer id." }, { status: 400 })

  let query = admin.from("developers").select("id, name, slug, description, logo_url, website_url, phone, email, address, rating, is_verified, is_active, updated_at").is("deleted_at", null).limit(2000)
  if (oneId) query = query.eq("id", oneId)
  if (oneSlug) query = query.eq("slug", oneSlug)
  const [{ data, error }, projects] = await Promise.all([
    query,
    admin.from("projects").select("developer_id, name, is_published, is_active, deleted_at").is("deleted_at", null).eq("is_published", true).limit(5000),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const liveCount = new Map<string, number>()
  for (const p of (projects.data ?? []) as Array<{ developer_id: string | null; name: string; is_published: boolean | null; is_active: boolean | null; deleted_at: string | null }>) {
    if (!p.developer_id || !isLiveProject(p) || isTestRecord({ title: p.name })) continue
    liveCount.set(p.developer_id, (liveCount.get(p.developer_id) ?? 0) + 1)
  }

  let rows = ((data ?? []) as Row[]).filter((d) => d.is_active !== false)
  if (words) rows = rows.filter((d) => words.split(/\s+/).every((w) => d.name.toLowerCase().includes(w)))
  rows.sort((a, b) => a.name.localeCompare(b.name))
  const total = rows.length

  const dataOut = rows.slice(from, to + 1).map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    url: d.slug ? `${site}/developers/${d.slug}` : null,
    logo_url: d.logo_url,
    description: d.description,
    contact: { website: d.website_url, phone: d.phone, email: d.email, address: d.address },
    verified: d.is_verified === true,
    rating: d.rating === null ? null : Number(d.rating),
    live_projects: liveCount.get(d.id) ?? 0,
    updated_at: d.updated_at,
  }))

  return NextResponse.json({ success: true, data: dataOut, meta: { total, page, limit, filters: { q: words || null } } }, { headers: { "cache-control": "no-store" } })
}
