import { NextRequest, NextResponse, after } from "next/server"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { loadSiteByAgent, profileSiteContact } from "@/lib/website-builder-service"
import { loadAgentWebsiteReviews, orderWebsiteReviews } from "@/lib/website-reviews"
import { STORY_BY_AGENT } from "@/lib/films"
import { submitToIndexNow } from "@/lib/indexnow"
import { SITE_URL } from "@/lib/seo"

// One agent website, for admin staff (Agent Resource → Agent Websites):
//   GET    → the site as its page draws it (for the preview), even when taken down
//   PATCH  { live: false } takes it down (soft delete: off the public page, the
//          directory and the sitemap; every section is kept) — { live: true } restores it
//   DELETE ?confirm=<slug> removes it for good: the site row (its featured / areas /
//          gallery rows cascade) and its hero, about and stats rows. Cannot be undone;
//          the agent can build a new one from scratch.
// The agent's own saves never change `is_published` (lib/website-builder-service.ts),
// so a site taken down stays down until an admin restores it.

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

type SiteRow = { id: string; agent_id: string; slug: string; title: string | null; is_published: boolean | null; hero_id: string | null; about_id: string | null }

async function findSite(admin: ReturnType<typeof createAdminSupabase>, id: string) {
  const { data, error } = await admin
    .from("website_builder")
    .select("id, agent_id, slug, title, is_published, hero_id, about_id")
    .eq("id", id)
    .maybeSingle<SiteRow>()
  if (error) throw error
  return data
}

/** The public pages are ISR: show the change at once, and tell Bing/Yandex the page came or went. */
function announce(slug: string) {
  revalidatePath(`/website/${slug}`)
  revalidatePath("/agent-websites")
  revalidatePath("/agents")
  const loc = `${SITE_URL.replace(/\/$/, "")}/website/${slug}`
  after(() => submitToIndexNow([loc]))
}

const actorOf = (g: Extract<Awaited<ReturnType<typeof requireRole>>, { ok: true }>) => ({
  id: g.context.userId,
  name: g.context.profile.fullname ?? g.context.email,
  role: g.context.profile.role,
})

export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "No such website." }, { status: 404 })
  try {
    const admin = createAdminSupabase()
    const row = await findSite(admin, id)
    if (!row) return NextResponse.json({ error: "No such website." }, { status: 404 })
    const [site, contact, approved] = await Promise.all([
      loadSiteByAgent(admin, row.agent_id),
      profileSiteContact(admin, row.agent_id),
      loadAgentWebsiteReviews(admin, row.agent_id).catch(() => []),
    ])
    if (!site) return NextResponse.json({ error: "No such website." }, { status: 404 })
    // As the live page draws it: the "My story" film when no video of their own, numbers with country codes.
    const story = STORY_BY_AGENT[row.agent_id]
    const withStory = !site.data.hero.video?.trim() && story ? { ...site.data, hero: { ...site.data.hero, video: story.hd } } : site.data
    const dial = (code: string, n: string) => {
      const v = n.trim()
      if (!v || v.startsWith("+") || !code) return v
      return `+${code.replace(/\D/g, "")}${v.replace(/\D/g, "").replace(/^0+/, "")}`
    }
    const data = {
      ...withStory,
      agent: { ...withStory.agent, phone: dial(contact.phoneCode, withStory.agent.phone), whatsapp: dial(contact.whatsappCode || contact.phoneCode, withStory.agent.whatsapp) },
    }
    return NextResponse.json({ slug: site.slug, data, reviews: orderWebsiteReviews(approved, data.reviewIds) })
  } catch {
    return NextResponse.json({ error: "Couldn't load that website." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "No such website." }, { status: 404 })
  const body = (await req.json().catch(() => null)) as { live?: unknown } | null
  if (typeof body?.live !== "boolean") return NextResponse.json({ error: "Say whether the site should be live." }, { status: 400 })
  const live = body.live
  try {
    const admin = createAdminSupabase()
    const row = await findSite(admin, id)
    if (!row) return NextResponse.json({ error: "No such website." }, { status: 404 })
    if ((row.is_published !== false) !== live) {
      const { error } = await admin.from("website_builder").update({ is_published: live }).eq("id", id)
      if (error) throw error
      announce(row.slug)
      void logAuditEvent({
        category: "website",
        event: live ? "agent_website_restored" : "agent_website_taken_down",
        actor: actorOf(guard),
        subjectType: "agent_website",
        subjectId: row.id,
        subjectLabel: `/website/${row.slug}`,
        description: live ? `Restored the agent website /website/${row.slug}.` : `Took down the agent website /website/${row.slug} (soft delete — can be restored).`,
        oldValues: { is_published: !live },
        newValues: { is_published: live },
        changedKeys: ["is_published"],
        ...requestContextFromRequest(req),
      })
    }
    return NextResponse.json({ ok: true, live })
  } catch {
    return NextResponse.json({ error: "Couldn't change that website." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "No such website." }, { status: 404 })
  try {
    const admin = createAdminSupabase()
    const row = await findSite(admin, id)
    if (!row) return NextResponse.json({ error: "No such website." }, { status: 404 })
    // The page asks the admin to type the site's address; the route checks it too.
    if (req.nextUrl.searchParams.get("confirm") !== row.slug) {
      return NextResponse.json({ error: "Type the website's address to confirm." }, { status: 400 })
    }
    const { data: hero } = row.hero_id
      ? await admin.from("hero_section").select("stats_id").eq("id", row.hero_id).maybeSingle<{ stats_id: string | null }>()
      : { data: null }
    // The site first (featured, areas and gallery rows go with it), then the rows it pointed at.
    const { error } = await admin.from("website_builder").delete().eq("id", id)
    if (error) throw error
    if (row.hero_id) await admin.from("hero_section").delete().eq("id", row.hero_id)
    if (row.about_id) await admin.from("about_section").delete().eq("id", row.about_id)
    if (hero?.stats_id) await admin.from("website_stats").delete().eq("id", hero.stats_id)
    announce(row.slug)
    void logAuditEvent({
      category: "website",
      event: "agent_website_deleted",
      actor: actorOf(guard),
      subjectType: "agent_website",
      subjectId: row.id,
      subjectLabel: `/website/${row.slug}`,
      description: `Permanently deleted the agent website /website/${row.slug} ("${row.title ?? ""}").`,
      oldValues: { slug: row.slug, title: row.title, agent_id: row.agent_id, was_live: row.is_published !== false },
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Couldn't delete that website." }, { status: 500 })
  }
}
