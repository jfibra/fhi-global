// Server-side service for the per-agent Website Builder (migration 035).
//
// The editor works with the template's WebsiteData shape (app/website/_data);
// this module translates that to/from the normalized tables — website_builder
// (title mirrors the hero headline, slug generated from it once and immutable,
// contact + cta jsonb), hero_section / website_stats / about_section (1:1),
// and featured_section / service_areas_section / gallery_section (1:N).
// Featured items are stored as IDs only and re-resolved to card data on every
// load, so unpublished projects/listings drop off automatically.
//
// Server-only: always called with the service-role client (lib/admin-supabase)
// after the caller has checked the session/role.

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  SAMPLE_DATA,
  type EditableStat, type GalleryCategory, type Project, type Property,
  type StatIconKey, type WebsiteData,
} from "@/app/website/_data"

// ─── Shared card mapping (also used by the picker API routes) ─────────────────

function compactPrice(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return ""
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${currency} ${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`
  }
  if (value >= 1_000) return `${currency} ${Math.round(value / 1_000)}K`
  return `${currency} ${value.toLocaleString()}`
}

const PROJECT_CARD_SELECT =
  "id, name, location, community, city, launch_price_from, currency, main_image, developers ( name, logo_url ), project_units ( bedrooms ), project_property_types ( property_types ( name ) ), project_images ( url, is_main, rank )"

/** Published projects mapped to the template's ProjectCard shape. When `ids`
 *  is given, only those projects are returned, in the ids' order. */
export async function fetchProjectCards(
  admin: SupabaseClient,
  opts: { ids?: number[] } = {},
): Promise<Project[]> {
  if (opts.ids && opts.ids.length === 0) return []

  let query = admin
    .from("projects")
    .select(PROJECT_CARD_SELECT)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)

  if (opts.ids) query = query.in("id", opts.ids)
  else query = query.order("created_at", { ascending: false }).limit(200)

  const { data, error } = await query
  if (error) throw new Error("Failed to load projects")

  const cards: Project[] = (data ?? []).map((row) => {
    const developer = (Array.isArray(row.developers) ? row.developers[0] : row.developers) as
      | { name: string | null; logo_url: string | null }
      | null

    const images = ((row.project_images ?? []) as { url: string; is_main: boolean | null; rank: number | null }[])
      .slice()
      .sort((a, b) => Number(b.is_main ?? false) - Number(a.is_main ?? false) || (a.rank ?? 0) - (b.rank ?? 0))
    const image = (row.main_image as string | null) ?? images[0]?.url ?? ""

    const beds = ((row.project_units ?? []) as { bedrooms: number | null }[])
      .map((u) => u.bedrooms)
      .filter((b): b is number => b != null)
    const bedRange = beds.length
      ? Math.min(...beds) === Math.max(...beds)
        ? `${Math.min(...beds)} Bed`
        : `${Math.min(...beds)} - ${Math.max(...beds)} Bed`
      : ""
    const typeName = (((row.project_property_types ?? []) as { property_types: { name: string | null } | { name: string | null }[] | null }[])
      .map((t) => (Array.isArray(t.property_types) ? t.property_types[0]?.name : t.property_types?.name))
      .find(Boolean) ?? "") as string
    const units = [bedRange, typeName ? `${typeName}s` : ""].filter(Boolean).join(" ")

    const location = [row.community, row.city].filter(Boolean).join(", ") || ((row.location as string | null) ?? "")
    const currency = ((row.currency as string | null) ?? "AED").trim() || "AED"

    return {
      sourceId: String(row.id),
      image,
      badge: "Off Plan",
      developerName: developer?.name ?? "",
      developerLogo: developer?.logo_url ?? "",
      title: (row.name as string) ?? "",
      location,
      units,
      from: compactPrice(row.launch_price_from as number | null, currency),
    } satisfies Project
  })

  if (!opts.ids) return cards
  const byId = new Map(cards.map((c) => [c.sourceId!, c]))
  return opts.ids.map((id) => byId.get(String(id))).filter((c): c is Project => !!c)
}

type UnitFacts = {
  unit_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | string | null
}

const LISTING_CARD_SELECT =
  "id, title, listing_kind, price, currency, unit_type, projects ( name, city, location, community, launch_price_from, currency, project_units ( unit_type, bedrooms, bathrooms, size_sqft ) ), agent_listing_images ( url, sort_order )"

/** Published listings mapped to the template's PropertyCard shape. Filter by
 *  `agentId` for "own listings" pickers, or by `ids` (returned in order). */
export async function fetchListingCards(
  admin: SupabaseClient,
  opts: { ids?: string[]; agentId?: string } = {},
): Promise<Property[]> {
  if (opts.ids && opts.ids.length === 0) return []

  let query = admin
    .from("agent_listings")
    .select(LISTING_CARD_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)

  if (opts.ids) query = query.in("id", opts.ids)
  else query = query.order("updated_at", { ascending: false }).limit(200)
  if (opts.agentId) query = query.eq("agent_id", opts.agentId)

  const { data, error } = await query
  if (error) throw new Error("Failed to load listings")

  const cards: Property[] = (data ?? []).map((row) => {
    const project = (Array.isArray(row.projects) ? row.projects[0] : row.projects) as
      | {
          name: string | null
          city: string | null
          location: string | null
          community: string | null
          launch_price_from: number | string | null
          currency: string | null
          project_units: UnitFacts[] | null
        }
      | null

    const images = ((row.agent_listing_images ?? []) as { url: string; sort_order: number | null }[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const units = project?.project_units ?? []
    const unit = units.find((u) => u.unit_type && u.unit_type === row.unit_type) ?? units[0] ?? null

    const location =
      [project?.community, project?.city].filter(Boolean).join(", ") || (project?.location ?? "")

    const rawPrice = (row.price as number | null) ?? (project?.launch_price_from != null ? Number(project.launch_price_from) : null)
    const currency = ((row.currency as string | null) ?? project?.currency ?? "AED").trim() || "AED"
    const price = rawPrice != null && Number.isFinite(rawPrice) && rawPrice > 0 ? `${currency} ${rawPrice.toLocaleString()}` : ""

    const isRent = (row.listing_kind as string) === "rent"
    const sqftNum = unit?.size_sqft != null ? Number(unit.size_sqft) : null

    return {
      sourceId: row.id as string,
      image: images[0]?.url ?? "",
      badge: isRent ? "For Rent" : "For Sale",
      title: (row.title as string) ?? "",
      location,
      beds: unit?.bedrooms != null ? String(unit.bedrooms) : "",
      baths: unit?.bathrooms != null ? String(unit.bathrooms) : "",
      sqft: sqftNum != null && Number.isFinite(sqftNum) && sqftNum > 0 ? sqftNum.toLocaleString() : "",
      price,
      suffix: isRent ? "/ Year" : "",
    } satisfies Property
  })

  if (!opts.ids) return cards
  const byId = new Map(cards.map((c) => [c.sourceId!, c]))
  return opts.ids.map((id) => byId.get(id)).filter((c): c is Property => !!c)
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** base, base-2, base-3, … — the first slug not already taken. */
async function ensureUniqueSlug(admin: SupabaseClient, base: string): Promise<string> {
  const clean = slugify(base) || "agent-site"
  const { data } = await admin
    .from("website_builder")
    .select("slug")
    .or(`slug.eq.${clean},slug.like.${clean}-%`)
  const taken = new Set((data ?? []).map((r) => r.slug as string))
  if (!taken.has(clean)) return clean
  for (let n = 2; ; n++) {
    const candidate = `${clean}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

// ─── DB ↔ WebsiteData mapping ────────────────────────────────────────────────

const GALLERY_DB_CATEGORY: Record<GalleryCategory, string> = {
  "Event Photos": "events",
  Certificates: "certificates",
  "Awards & Recognition": "awards_recognition",
}
const GALLERY_UI_CATEGORY: Record<string, GalleryCategory> = Object.fromEntries(
  Object.entries(GALLERY_DB_CATEGORY).map(([ui, db]) => [db, ui as GalleryCategory]),
)

type DbStat = { icon?: string; name?: string; value?: string }

const statsToDb = (stats: EditableStat[]): DbStat[] =>
  stats.map((s) => ({ icon: s.icon ?? "", name: s.label, value: s.value }))

const statsFromDb = (raw: unknown): EditableStat[] =>
  (Array.isArray(raw) ? (raw as DbStat[]) : []).map((s) => ({
    icon: (s.icon || undefined) as StatIconKey | undefined,
    value: s.value ?? "",
    label: s.name ?? "",
  }))

/** The title column mirrors the hero headline, flattened to one line. */
function titleFromHero(data: WebsiteData): string {
  return `${data.hero.headline.replace(/\s+/g, " ").trim()} ${data.hero.headlineAccent.trim()}`.trim()
}

export type SavedSite = { websiteId: string; slug: string }

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveSite(
  admin: SupabaseClient,
  agentId: string,
  data: WebsiteData,
): Promise<SavedSite> {
  const now = new Date().toISOString()
  const title = titleFromHero(data)

  const heroJson = {
    Headline: data.hero.headline,
    "Headline accent": data.hero.headlineAccent,
    headline_color: data.hero.headlineColor ?? null,
    accent_color: data.hero.headlineAccentColor ?? null,
    description_color: data.hero.descriptionColor ?? null,
  }
  const socialsJson = {
    twitter: null,
    facebook: data.about.socials.facebook || null,
    linkedin: data.about.socials.linkedin || null,
    instagram: data.about.socials.instagram || null,
    youtube: data.about.socials.youtube || null,
  }

  const { data: existing, error: existingError } = await admin
    .from("website_builder")
    .select("id, slug, hero_id, about_id")
    .eq("agent_id", agentId)
    .maybeSingle()
  if (existingError) throw new Error("Failed to load existing site")

  let websiteId: string
  let slug: string

  if (existing) {
    websiteId = existing.id as string
    slug = existing.slug as string // immutable after first save

    const { data: heroRow } = await admin
      .from("hero_section")
      .select("stats_id")
      .eq("id", existing.hero_id as string)
      .maybeSingle()
    const statsId = (heroRow?.stats_id as string | null) ?? null

    if (statsId) {
      await admin
        .from("website_stats")
        .update({ hero_stats: statsToDb(data.hero.stats), stats_section: statsToDb(data.bandStats), updated_at: now })
        .eq("id", statsId)
    }
    await admin
      .from("hero_section")
      .update({
        headline: heroJson,
        description: data.hero.description,
        banner: data.hero.image,
        overlay: data.hero.overlay ?? 0,
        updated_at: now,
      })
      .eq("id", existing.hero_id as string)
    await admin
      .from("about_section")
      .update({
        heading: data.about.heading,
        bio: data.about.bio,
        photo: data.about.portrait,
        views: data.about.views,
        listing_count: data.about.listings,
        rating: data.about.rating,
        socials: socialsJson,
        updated_at: now,
      })
      .eq("id", existing.about_id as string)
    const { error } = await admin
      .from("website_builder")
      .update({
        title,
        title_description: data.hero.description,
        contact: data.agent,
        cta: data.cta,
        is_published: true,
        updated_at: now,
      })
      .eq("id", websiteId)
    if (error) throw new Error("Failed to save site")
  } else {
    const { data: statsRow, error: statsError } = await admin
      .from("website_stats")
      .insert({ agent_id: agentId, hero_stats: statsToDb(data.hero.stats), stats_section: statsToDb(data.bandStats) })
      .select("id")
      .single()
    if (statsError) throw new Error("Failed to save stats")

    const { data: heroRow, error: heroError } = await admin
      .from("hero_section")
      .insert({
        agent_id: agentId,
        headline: heroJson,
        description: data.hero.description,
        banner: data.hero.image,
        overlay: data.hero.overlay ?? 0,
        stats_id: statsRow.id,
      })
      .select("id")
      .single()
    if (heroError) throw new Error("Failed to save hero")

    const { data: aboutRow, error: aboutError } = await admin
      .from("about_section")
      .insert({
        agent_id: agentId,
        heading: data.about.heading,
        bio: data.about.bio,
        photo: data.about.portrait,
        views: data.about.views,
        listing_count: data.about.listings,
        rating: data.about.rating,
        socials: socialsJson,
      })
      .select("id")
      .single()
    if (aboutError) throw new Error("Failed to save about")

    slug = await ensureUniqueSlug(admin, title)
    const { data: siteRow, error: siteError } = await admin
      .from("website_builder")
      .insert({
        agent_id: agentId,
        title,
        slug,
        title_description: data.hero.description,
        contact: data.agent,
        cta: data.cta,
        hero_id: heroRow.id,
        about_id: aboutRow.id,
        is_published: true,
      })
      .select("id")
      .single()
    if (siteError) throw new Error("Failed to save site")
    websiteId = siteRow.id as string
  }

  // 1:N sections are replaced wholesale — ranks are just array positions.
  await admin.from("featured_section").delete().eq("website_id", websiteId)
  const featuredRows = [
    ...data.projects
      .filter((p) => p.sourceId && Number.isFinite(Number(p.sourceId)))
      .map((p, i) => ({ website_id: websiteId, agent_id: agentId, project_id: Number(p.sourceId), rank: i })),
    ...data.properties
      .filter((p) => p.sourceId)
      .map((p, i) => ({ website_id: websiteId, agent_id: agentId, listing_id: p.sourceId!, rank: i })),
  ]
  if (featuredRows.length) {
    const { error } = await admin.from("featured_section").insert(featuredRows)
    if (error) throw new Error("Failed to save featured items")
  }

  // Service areas are SHARED (migration 036): choose an existing catalog row
  // by name (case-insensitive) or insert a new one, then link it to the site.
  await admin.from("service_areas_section").delete().eq("website_id", websiteId)
  const wantedAreas = data.areas
    .map((a) => ({ name: a.label.trim(), photo: a.image.trim() }))
    .filter((a) => a.name)
  if (wantedAreas.length) {
    const { data: catalog, error: catalogError } = await admin
      .from("service_areas")
      .select("id, name, photo")
    if (catalogError) throw new Error("Failed to load service areas")
    const byName = new Map((catalog ?? []).map((c) => [(c.name as string).toLowerCase(), c]))

    const areaIds: string[] = []
    for (const a of wantedAreas) {
      const existing = byName.get(a.name.toLowerCase())
      if (existing) {
        // Shared row wins; only backfill a photo the catalog doesn't have yet.
        if (!existing.photo && a.photo) {
          await admin.from("service_areas").update({ photo: a.photo }).eq("id", existing.id as string)
        }
        areaIds.push(existing.id as string)
        continue
      }
      const { data: inserted, error: insertError } = await admin
        .from("service_areas")
        .insert({ name: a.name, photo: a.photo, created_by: agentId })
        .select("id, name, photo")
        .single()
      if (insertError) throw new Error("Failed to save service areas")
      byName.set(a.name.toLowerCase(), inserted)
      areaIds.push(inserted.id as string)
    }

    const { error } = await admin.from("service_areas_section").insert(
      areaIds.map((areaId, i) => ({ website_id: websiteId, agent_id: agentId, area_id: areaId, rank: i })),
    )
    if (error) throw new Error("Failed to save service areas")
  }

  // One row per category; the photos array's order is the display order.
  await admin.from("gallery_section").delete().eq("website_id", websiteId)
  const galleryRows = (Object.keys(GALLERY_DB_CATEGORY) as GalleryCategory[])
    .map((cat) => ({
      website_id: websiteId,
      agent_id: agentId,
      category: GALLERY_DB_CATEGORY[cat],
      photos: (data.gallery[cat] ?? []).map((p) => p.trim()).filter(Boolean),
    }))
    .filter((row) => row.photos.length > 0)
  if (galleryRows.length) {
    const { error } = await admin.from("gallery_section").insert(galleryRows)
    if (error) throw new Error("Failed to save gallery")
  }

  return { websiteId, slug }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export type LoadedSite = { websiteId: string; slug: string; title: string; data: WebsiteData }

async function loadSite(
  admin: SupabaseClient,
  by: { agentId?: string; slug?: string },
): Promise<LoadedSite | null> {
  let query = admin.from("website_builder").select("*")
  if (by.agentId) query = query.eq("agent_id", by.agentId)
  else if (by.slug) query = query.eq("slug", by.slug).eq("is_published", true)
  else return null

  const { data: site, error } = await query.maybeSingle()
  if (error || !site) return null

  const websiteId = site.id as string
  const data = structuredClone(SAMPLE_DATA)

  const contact = (site.contact ?? {}) as Partial<WebsiteData["agent"]>
  data.agent = { ...data.agent, ...contact }
  const cta = (site.cta ?? {}) as Partial<WebsiteData["cta"]>
  data.cta = { ...data.cta, ...cta }

  const [{ data: hero }, { data: about }, { data: featured }, { data: areas }, { data: gallery }] = await Promise.all([
    admin.from("hero_section").select("*, website_stats ( hero_stats, stats_section )").eq("id", site.hero_id as string).maybeSingle(),
    admin.from("about_section").select("*").eq("id", site.about_id as string).maybeSingle(),
    admin.from("featured_section").select("project_id, listing_id, rank").eq("website_id", websiteId).order("rank"),
    admin.from("service_areas_section").select("rank, service_areas ( name, photo )").eq("website_id", websiteId).order("rank"),
    admin.from("gallery_section").select("photos, category").eq("website_id", websiteId),
  ])

  if (hero) {
    const h = (hero.headline ?? {}) as Record<string, unknown>
    data.hero.headline = typeof h.Headline === "string" ? h.Headline : ""
    data.hero.headlineAccent = typeof h["Headline accent"] === "string" ? (h["Headline accent"] as string) : ""
    if (typeof h.headline_color === "string") data.hero.headlineColor = h.headline_color
    if (typeof h.accent_color === "string") data.hero.headlineAccentColor = h.accent_color
    if (typeof h.description_color === "string") data.hero.descriptionColor = h.description_color
    data.hero.description = (hero.description as string) ?? ""
    data.hero.image = (hero.banner as string) || data.hero.image
    data.hero.overlay = (hero.overlay as number) ?? 0
    const stats = (Array.isArray(hero.website_stats) ? hero.website_stats[0] : hero.website_stats) as
      | { hero_stats: unknown; stats_section: unknown }
      | null
    if (stats) {
      data.hero.stats = statsFromDb(stats.hero_stats)
      data.bandStats = statsFromDb(stats.stats_section)
    }
  }

  if (about) {
    data.about.heading = (about.heading as string) ?? ""
    data.about.bio = (about.bio as string) ?? ""
    data.about.portrait = (about.photo as string) || data.about.portrait
    data.about.views = (about.views as string) ?? ""
    data.about.listings = (about.listing_count as string) ?? ""
    data.about.rating = (about.rating as string) ?? ""
    const s = (about.socials ?? {}) as Record<string, unknown>
    data.about.socials = {
      facebook: typeof s.facebook === "string" ? s.facebook : "",
      instagram: typeof s.instagram === "string" ? s.instagram : "",
      linkedin: typeof s.linkedin === "string" ? s.linkedin : "",
      youtube: typeof s.youtube === "string" ? s.youtube : "",
    }
  }

  const projectIds = (featured ?? []).filter((f) => f.project_id != null).map((f) => f.project_id as number)
  const listingIds = (featured ?? []).filter((f) => f.listing_id != null).map((f) => f.listing_id as string)
  const [projectCards, listingCards] = await Promise.all([
    fetchProjectCards(admin, { ids: projectIds }),
    fetchListingCards(admin, { ids: listingIds }),
  ])
  data.projects = projectCards
  data.properties = listingCards

  data.areas = (areas ?? []).map((row) => {
    const area = (Array.isArray(row.service_areas) ? row.service_areas[0] : row.service_areas) as
      | { name: string | null; photo: string | null }
      | null
    return { image: area?.photo ?? "", label: area?.name ?? "" }
  })

  data.gallery = { "Event Photos": [], Certificates: [], "Awards & Recognition": [] }
  for (const g of gallery ?? []) {
    const cat = GALLERY_UI_CATEGORY[(g.category as string) ?? ""]
    if (!cat) continue
    const photos = Array.isArray(g.photos) ? (g.photos as unknown[]) : []
    data.gallery[cat] = photos.filter((p): p is string => typeof p === "string" && !!p)
  }

  return { websiteId, slug: site.slug as string, title: site.title as string, data }
}

export const loadSiteByAgent = (admin: SupabaseClient, agentId: string) => loadSite(admin, { agentId })
export const loadSiteBySlug = (admin: SupabaseClient, slug: string) => loadSite(admin, { slug })
