import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

// Publish-time SEO hook. Project, developer, and agent-listing publishes all
// happen client-side through the browser Supabase client, so nothing
// server-side sees the moment content goes live. Publish flows call this
// route afterwards to (a) purge the entity's ISR cache and (b) ping IndexNow
// (Bing/Copilot ecosystem) — the same pairing the news sitemap does in
// after() (app/news-sitemap.xml/route.ts). Only publicly visible entities are
// ever submitted; unpublished ones just get their (now-404ing) path purged.

export const runtime = "nodejs"

type Kind = "project" | "developer" | "agent-listing"

const KINDS: Kind[] = ["project", "developer", "agent-listing"]

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const body = (await req.json().catch(() => null)) as { kind?: unknown; id?: unknown } | null
  const kind = KINDS.includes(body?.kind as Kind) ? (body?.kind as Kind) : null
  const id = typeof body?.id === "string" ? body.id.trim() : ""
  if (!kind || !id) {
    return NextResponse.json({ error: "Missing kind or id" }, { status: 400 })
  }

  // RLS-scoped reads: the caller can only see (and therefore only purge/ping)
  // rows their session is allowed to read.
  const supabase = await createClient()
  let path: string | null = null
  let isPublic = false

  if (kind === "project") {
    const { data } = await supabase
      .from("projects")
      .select("slug, is_published, is_active, deleted_at, developers(slug)")
      .eq("id", id)
      .maybeSingle()
    const dev = (data?.developers as unknown as { slug: string | null } | null)?.slug
    if (data?.slug && dev) {
      path = `/${dev}/${data.slug}`
      isPublic = Boolean(data.is_published && data.is_active && !data.deleted_at)
    }
  } else if (kind === "developer") {
    const { data } = await supabase
      .from("developers")
      .select("slug, is_active, deleted_at")
      .eq("id", id)
      .maybeSingle()
    if (data?.slug) {
      path = `/${data.slug}`
      isPublic = Boolean(data.is_active && !data.deleted_at)
    }
  } else {
    const { data } = await supabase
      .from("agent_listings")
      .select("id, slug, status, deleted_at, agent_id")
      .eq("id", id)
      .maybeSingle()
    // Explicit owner check, mirroring app/api/agent-listings/revalidate.
    if (!data || (data as { agent_id: string | null }).agent_id !== session.context.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    path = `/listings/${data.slug ?? data.id}`
    isPublic = data.status === "published" && !data.deleted_at
  }

  if (!path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  revalidatePath(path)
  if (isPublic) {
    const loc = `${SITE_URL.replace(/\/$/, "")}${path}`
    // after() keeps the serverless function alive for the ping; a bare
    // floating promise could be killed at response time.
    after(() => submitToIndexNow([loc]))
  }
  return NextResponse.json({ ok: true, path, submitted: isPublic })
}
