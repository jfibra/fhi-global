import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { after } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageDeveloperContent, isDeveloperRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"
import { allowRequest } from "@/lib/rate-limit"
import { moveDeveloperPages } from "@/lib/developer-move"

// Publish-time SEO hook. Project, developer, and agent-listing writes all
// happen client-side through the browser Supabase client, so nothing
// server-side sees the moment content changes. Those flows call this route
// afterwards to (a) purge the entity's ISR cache and the cached lists it feeds,
// and (b) ping IndexNow (Bing/Copilot ecosystem) — the same pairing the news
// sitemap does in after() (app/news-sitemap.xml/route.ts).
//
// The page is always purged (cheap; it also drops a cached 404 once a draft goes
// live). IndexNow and the cached lists are touched only when something PUBLIC
// changed: the entity is online now (publish, or an edit to a live page), or it was
// just taken down (`removed` — an unpublish or delete, which IndexNow takes as
// "this URL changed" so a dead page leaves Bing's index promptly). A draft that was
// never online is purged but never announced: submitting dozens of 404 URLs while an
// editor works on a draft is what gets an IndexNow key rate-limited.

export const runtime = "nodejs"

type Kind = "project" | "developer" | "agent-listing"

const KINDS: Kind[] = ["project", "developer", "agent-listing"]

// Tags the cached lists are stored under. { expire: 0 } = gone at once; the
// default stale-while-revalidate profile would serve the old list to the next visitor.
const NOW = { expire: 0 } as const

const abs = (path: string) => `${SITE_URL.replace(/\/$/, "")}${path}`

// A slug as the site writes them. `fromSlug` comes from the client, so it is held to the same shape before it
// becomes a path.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Every cache that carries a project card or a developer's name/logo/counts. */
function expireCatalogueTags() {
  revalidateTag("projects", NOW) // the /projects grid + facets, llms.txt
  revalidateTag("home", NOW) // featured / hero rows
  revalidateTag("developers", NOW) // the /developers directory (project counts + map pins)
  // /buy and /rent keep their project cards under this tag (120 s); without dropping it an unpublished
  // project would stay linked from the indexable ?page=N pages.
  revalidateTag("buy-projects", NOW)
  // …and their agent-listing cards embed the project's price, photos and live flags (also 120 s).
  revalidateTag("agent-listings", NOW)
}

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  // A publish click or an edit session sends a handful of pings; a loop does not. The ceiling is generous (a
  // bulk unpublish of a whole portfolio must still purge every page) but stops one account from hammering the
  // cache tags and IndexNow with `removed: true` on its own drafts.
  if (!allowRequest(`seo-revalidate:${session.context.userId}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as
    | { kind?: unknown; id?: unknown; removed?: unknown; fromSlug?: unknown }
    | null
  const kind = KINDS.includes(body?.kind as Kind) ? (body?.kind as Kind) : null
  const id = typeof body?.id === "string" ? body.id.trim() : ""
  if (!kind || !id) {
    return NextResponse.json({ error: "Missing kind or id" }, { status: 400 })
  }
  // The caller's hint that this change took the page offline. Only ever widens what is announced — it can
  // never make a public page look private — and the owner/role checks below still gate everything. The
  // callers send it only on a live → off transition; for a soft delete the row itself says what it was.
  let removed = body?.removed === true
  // The slug the entity had before a rename (see SeoPingOptions.fromSlug), shape-checked.
  const rawFrom = typeof body?.fromSlug === "string" ? body.fromSlug.trim().toLowerCase() : ""
  const fromSlug = rawFrom.length <= 120 && SLUG_RE.test(rawFrom) ? rawFrom : ""

  // Projects and developers are anon-readable, so "the session can read the
  // row" gates nothing for them — restrict those kinds to the roles that can
  // actually publish. canManageDeveloperContent is the SAME predicate the
  // publish UI uses (super_admin, admin, editor — features/dashboard/projects/
  // variants.tsx), plus developer-portal users for THEIR OWN company. Otherwise
  // any activated member could churn the ISR cache and spam IndexNow (junk
  // submissions get the key rate-limited or discounted by Bing). Agent listings
  // keep the strict per-row owner check below.
  const role = session.context.profile.role
  const contentManager = canManageDeveloperContent(role)
  const metadata = (session.context.profile.metadata ?? {}) as Record<string, unknown>
  const ownDeveloperId = isDeveloperRole(role) && typeof metadata.developer_id === "string" ? metadata.developer_id.trim() : ""
  if ((kind === "project" || kind === "developer") && !contentManager && !ownDeveloperId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const paths: string[] = []
  let isPublic = false
  // Extra pages to purge that must NOT go to IndexNow (hubs and lists whose URL did not change).
  const purgeOnly: string[] = []

  if (kind === "project") {
    // Service role: a soft-deleted or unpublished project is exactly the row
    // whose removal has to be announced, and the browser session may not see it.
    const { data } = await createAdminSupabase()
      .from("projects")
      .select("slug, developer_id, is_published, is_active, deleted_at, developers(slug)")
      .eq("id", id)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    // A developer-portal user may only touch their own company's projects.
    if (!contentManager && String(data.developer_id ?? "") !== ownDeveloperId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const dev = (data.developers as unknown as { slug: string | null } | null)?.slug
    if (data.slug && dev) {
      paths.push(`/${dev}/${data.slug}`)
      // The developer's own page lists its projects.
      paths.push(`/${dev}`)
      // A rename: the old address 404s now — purge it and announce it as gone along with the new one.
      if (fromSlug && fromSlug !== data.slug) paths.push(`/${dev}/${fromSlug}`)
      isPublic = Boolean(data.is_published && data.is_active && !data.deleted_at)
    }
    // A soft delete leaves the publish flags as they were, so the row tells whether the page was online:
    // deleting a draft is purged but never announced.
    if (data.deleted_at && data.is_published && data.is_active) removed = true
  } else if (kind === "developer") {
    const { data } = await createAdminSupabase()
      .from("developers")
      .select("id, slug, is_active, deleted_at")
      .eq("id", id)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!contentManager && String(data.id) !== ownDeveloperId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (data.slug) {
      paths.push(`/${data.slug}`)
      isPublic = Boolean(data.is_active && !data.deleted_at)
      // An admin renamed the developer directly (the approval flow does this itself): move every URL under it.
      // Only content managers — a company's own slug change goes through approval — and the helper announces
      // both addresses and each published project's, so it replaces the single-page submit below.
      if (fromSlug && fromSlug !== data.slug && contentManager) {
        await moveDeveloperPages(createAdminSupabase(), String(data.id), fromSlug, data.slug)
      }
    }
    purgeOnly.push("/developers")
    if (data.deleted_at && data.is_active) removed = true
  } else {
    // Service role, because the owner's own select policy (agent_listings_select_own) hides a soft-deleted
    // row: through the browser session an agent's delete read back as "not found", so it was never purged
    // or announced. The explicit owner check below is the authorization — only the listing's agent may
    // trigger a purge for it (an admin's edits go through app/api/admin/listings, which purges itself).
    const { data } = await createAdminSupabase()
      .from("agent_listings")
      .select("id, slug, status, deleted_at, agent_id")
      .eq("id", id)
      .maybeSingle()
    if (!data || (data as { agent_id: string | null }).agent_id !== session.context.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    paths.push(`/listings/${data.slug ?? data.id}`)
    // The slug page is the canonical one; the uuid form is the legacy link.
    if (data.slug) paths.push(`/listings/${data.id}`)
    isPublic = data.status === "published" && !data.deleted_at
    // A deleted row that was published is a removal even when the client forgot to say so.
    if (data.deleted_at && data.status === "published") removed = true
    purgeOnly.push("/buy", "/rent")
  }

  if (paths.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const announce = isPublic || removed

  for (const path of [...paths, ...purgeOnly]) revalidatePath(path)
  if (announce) {
    if (kind === "agent-listing") revalidateTag("agent-listings", NOW)
    else expireCatalogueTags()
    // after() keeps the serverless function alive for the ping; a bare floating
    // promise could be killed at response time.
    const urls = paths.map(abs)
    after(() => submitToIndexNow(urls))
  }
  return NextResponse.json({ ok: true, path: paths[0], paths, public: isPublic, submitted: announce })
}
