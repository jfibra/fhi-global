import { NextRequest, NextResponse, after } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireActiveSession } from "@/lib/auth-guard"
import { canUseWebsiteBuilder } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteByAgent, saveSite } from "@/lib/website-builder-service"
import { agentSiteMissing, isPlausibleBrn, isPlausibleBrokerage, isPlausibleOrn } from "@/lib/agent-site"
import { submitToIndexNow } from "@/lib/indexnow"
import { SITE_URL } from "@/lib/seo"
import type { WebsiteData } from "@/app/website/_data"

// The agent's own Website Builder site: GET loads it (WebsiteData shape,
// featured items re-resolved from live projects/listings), PUT saves the whole
// draft across the website_builder tables. The slug is minted once from the
// agent's name (migration 058) and stays stable; an old address redirects.
//
// Both verbs also report `complete` / `missing`: whether the site is offered to
// search engines (robots index + the agent-sites sitemap) and, when not, what
// the agent still has to add (lib/agent-site.ts) — the editor prints it.

export const runtime = "nodejs"

// The only fields validated deeply are the ones a site publishes as a claim
// about the agent's licence: a made-up BRN/ORN next to a "RERA Licensed
// Broker" badge is a compliance problem (see lib/agent-site.ts). Blank is
// allowed — the credential simply is not shown.
const CredentialsSchema = z.object({
  agent: z.object({
    brn: z.string().trim().max(20).default("").refine((v) => v === "" || isPlausibleBrn(v), "RERA BRN must be the 4–7 digit number on your broker card."),
    orn: z.string().trim().max(20).default("").refine((v) => v === "" || isPlausibleOrn(v), "RERA ORN must be the office registration number (2–6 digits)."),
    brokerage: z.string().trim().max(120).default("").refine((v) => v === "" || isPlausibleBrokerage(v), "Enter your brokerage's name, or leave it blank."),
  }),
})

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const site = await loadSiteByAgent(createAdminSupabase(), session.context.userId)
    if (!site) return NextResponse.json({ exists: false })
    return NextResponse.json({ exists: true, slug: site.slug, data: site.data, complete: site.complete, missing: site.missing })
  } catch {
    return NextResponse.json({ error: "Failed to load site" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseWebsiteBuilder(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let data: WebsiteData
  try {
    data = (await req.json()) as WebsiteData
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
  if (!data || typeof data !== "object" || !data.hero || !data.about || !data.agent) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }
  const credentials = CredentialsSchema.safeParse(data)
  if (!credentials.success) {
    return NextResponse.json({ error: credentials.error.issues[0]?.message ?? "Invalid credentials." }, { status: 400 })
  }

  try {
    const admin = createAdminSupabase()
    // Was the site listed before this save? (A failed lookup counts as "no" — worst case one extra ping.)
    const wasComplete = (await loadSiteByAgent(admin, session.context.userId).catch(() => null))?.complete ?? false

    const saved = await saveSite(admin, session.context.userId, data)

    // The same three stored fields the page's robots tag and the sitemap shard read.
    const missing = agentSiteMissing({ name: data.agent.name, bio: data.about.bio, portrait: data.about.portrait })
    const complete = missing.length === 0

    // The public pages are ISR (300 s): show the save at once, in the site, the directory and the roster.
    revalidatePath(`/website/${saved.slug}`)
    revalidatePath("/agent-websites")
    revalidatePath("/agents")

    // Tell Bing/Yandex only when the site starts or stops being listed — a routine edit is not worth a ping.
    if (complete !== wasComplete) {
      const loc = `${SITE_URL.replace(/\/$/, "")}/website/${saved.slug}`
      after(() => submitToIndexNow([loc]))
    }

    return NextResponse.json({ slug: saved.slug, complete, missing })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save site"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
