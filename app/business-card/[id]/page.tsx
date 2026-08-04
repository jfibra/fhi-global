import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { SITE_URL, createPageMetadata } from "@/lib/seo"
import { readThemeChoice, resolveTheme } from "@/lib/profile-themes"
import { profileOgCardVersion, readProfileOgCard, resolveOgLinkText } from "@/lib/profile-og-card"
import { roleToLabel } from "@/lib/app-roles"
import {
  readCustomLinks, readFeaturedProjects, readFixedButtonLabels, readSocialLinks,
  readTagline, titleCaseName, type FeaturedItem,
} from "@/lib/public-profile"
import { PublicProfile, type PublicProfileData } from "@/features/business-card/public-profile"

/**
 * Public share page for one person's business card — the destination of the
 * "Share your business profile link" panel in the dashboard.
 *
 * Deliberately OUTSIDE the (public-page) route group: this is a full-bleed link
 * page meant to be opened from a bio link on a phone, so it renders standalone
 * without the site header/footer chrome.
 *
 * Keyed by profile id rather than email. The page is unauthenticated, so an
 * email-keyed URL would turn it into a contact-detail lookup for any address
 * someone cared to try; a uuid cannot be guessed.
 */

type Props = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Developers are internal partner accounts — they have no public card to share. */
const NO_PUBLIC_CARD = new Set(["developer"])

function money(amount: number | string | null | undefined, currency: string | null): string {
  const n = typeof amount === "string" ? Number(amount) : amount
  if (n == null || !Number.isFinite(n)) return "Price on request"
  return `${(currency || "AED").toUpperCase()} ${new Intl.NumberFormat("en-US").format(n)}`
}

/**
 * The pinned listings and projects, resolved to public cards.
 *
 * Both reads are filtered to what a stranger may actually open — a listing must
 * be published, a project published and not deleted — so unpinning is not the
 * only thing that can take an item off the page. A stale id in the stored pick
 * list simply resolves to nothing rather than a dead card.
 */
async function loadFeatured(
  admin: ReturnType<typeof createAdminSupabase>,
  agentId: string,
  projectIds: number[],
): Promise<{ listings: FeaturedItem[]; projects: FeaturedItem[] }> {
  const [listingsRes, projectsRes] = await Promise.all([
    admin
      .from("agent_listings")
      .select("id, slug, title, listing_kind, unit_type, price, currency, projects ( name, city, launch_price_from, currency, main_image ), agent_listing_images ( url, sort_order )")
      .eq("agent_id", agentId)
      .eq("is_featured", true)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    projectIds.length
      ? admin
          .from("projects")
          .select("id, name, slug, city, main_image, launch_price_from, currency, developers(slug)")
          .in("id", projectIds)
          .eq("is_published", true)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const listings: FeaturedItem[] = ((listingsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const proj = r.projects as Record<string, unknown> | null
    const images = (r.agent_listing_images ?? []) as { url: string; sort_order: number }[]
    const cover =
      [...images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
      (typeof proj?.main_image === "string" ? proj.main_image : null)
    return {
      kind: "listing",
      href: `/listings/${(r.slug as string) || (r.id as string)}`,
      title: String(r.title ?? "Listing"),
      subtitle: [r.unit_type, `For ${r.listing_kind}`].filter(Boolean).join(" · "),
      // A project-linked listing inherits the developer's price.
      price: money(
        (r.price as number | null) ?? (proj?.launch_price_from as number | null) ?? null,
        (r.currency as string | null) ?? (proj?.currency as string | null),
      ),
      image: cover,
    }
  })

  // Kept in the agent's chosen order, which the stored list preserves.
  const byId = new Map(
    ((projectsRes.data ?? []) as Record<string, unknown>[]).map((p) => [Number(p.id), p]),
  )
  const projects: FeaturedItem[] = projectIds.flatMap((pid) => {
    const p = byId.get(pid)
    if (!p) return []
    const dev = p.developers as { slug?: string | null } | null
    return [{
      kind: "project" as const,
      href: dev?.slug ? `/${dev.slug}/${p.slug as string}` : `/projects/${p.slug as string}`,
      title: String(p.name ?? "Project"),
      subtitle: typeof p.city === "string" ? p.city : "",
      price: money(p.launch_price_from as number | null, p.currency as string | null),
      image: typeof p.main_image === "string" ? p.main_image : null,
    }]
  })

  return { listings, projects }
}

async function loadProfile(id: string): Promise<PublicProfileData | null> {
  if (!UUID_RE.test(id)) return null

  const admin = createAdminSupabase()

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, fname, lname, fullname, profile_url, status, is_deleted, metadata")
    .eq("id", id)
    .maybeSingle()

  if (!profile) return null
  if (profile.is_deleted || profile.status !== "active") return null
  if (NO_PUBLIC_CARD.has(profile.role ?? "")) return null

  // Email lives in auth.users, not profiles — a single direct admin read, no paging.
  const { data: authUser } = await admin.auth.admin.getUserById(id)
  const email = authUser?.user?.email?.toLowerCase() ?? ""

  const meta = (profile.metadata as Record<string, unknown> | null) ?? {}
  const countryCode = typeof meta.phone_country_code === "string" ? meta.phone_country_code : "+971"
  const phoneNumber = typeof meta.phone_number === "string" ? meta.phone_number : ""

  const fullname =
    (profile.fullname ?? "").trim() ||
    [profile.fname, profile.lname].filter(Boolean).join(" ").trim() ||
    email.split("@")[0]

  const initials =
    [profile.fname, profile.lname]
      .map((p) => (p ?? "").trim().charAt(0).toUpperCase())
      .join("") || fullname.charAt(0).toUpperCase()

  // Avatars live on S3/Google, which the card canvas can't read cross-origin —
  // the same-origin proxy is what makes the PNG export work.
  const rawAvatar = (profile.profile_url ?? "").trim()
  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith("/")
      ? rawAvatar
      : `/api/image-proxy?url=${encodeURIComponent(rawAvatar)}`
    : null

  return {
    id: profile.id,
    fullname,
    initials,
    roleLabel: roleToLabel(profile.role),
    email,
    countryCode,
    phoneNumber,
    avatarUrl,
    tagline: readTagline(profile.metadata),
    links: readCustomLinks(profile.metadata),
    buttonLabels: readFixedButtonLabels(profile.metadata),
    theme: resolveTheme(readThemeChoice(profile.metadata)),
    ogCard: readProfileOgCard(profile.metadata),
    socials: readSocialLinks(profile.metadata),
    ...(await loadFeatured(admin, profile.id, readFeaturedProjects(profile.metadata))),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await loadProfile(id)
  if (!data) {
    return createPageMetadata({
      title: "Profile not found | FHI Global",
      description: "This business profile link is no longer active.",
    })
  }
  // A designed 1200×630 card, never the bare avatar — a square portrait dropped
  // into a 1.91:1 slot gets letterboxed or centre-cropped by every network.
  //
  // First choice is the Business Card front the agent rendered and uploaded from
  // the Link Preview tab. Anyone who has never opened that tab falls back to the
  // generated /og/business-card card, whose version param is a hash of the saved
  // options so scrapers re-fetch on a change and not otherwise.
  const version = profileOgCardVersion(data.ogCard)
  const previewImage =
    data.ogCard.image ?? `${SITE_URL.replace(/\/$/, "")}/og/business-card/${data.id}?v=${version}`

  // The link's text, from the SAME resolver the maker's feed preview renders —
  // the preview's promise is "identical to a real share", which only one shared
  // code path can keep. Title: custom when typed and shown, else the brand
  // default (never an empty tag — crawlers replace those with the <title>, i.e.
  // the name, defeating the hide toggle). Description: the tagline, else the
  // generated line; the override lost its editor.
  const og = resolveOgLinkText(data.ogCard, { tagline: data.tagline })

  return {
    ...createPageMetadata({
      // No " | FHI Global" suffix here — createPageMetadata's template
      // appends one, and spelling it out again doubled it in the tab. The
      // browser-tab title keeps the name: hiding it from a feed shouldn't
      // anonymise the tab.
      title: data.ogCard.title || titleCaseName(data.fullname),
      openGraphTitle: og.title,
      // Omitted entirely when blank — an empty content="" is noise, no tag is
      // the honest "no description".
      description: og.description || undefined,
      imageUrl: previewImage,
      // og:url carries the same version stamp the share buttons append.
      // Facebook treats og:url as the canonical and reuses its cached metadata
      // for it — a clean canonical here would collapse every versioned share
      // back onto the stale cache entry and undo the cache-busting. The page is
      // noindexed, so canonical hygiene costs nothing.
      pathname: `/business-card/${data.id}?v=${version}`,
    }),
    // A personal contact page has no business in search results.
    robots: { index: false, follow: false },
  }
}

export default async function PublicBusinessCardPage({ params }: Props) {
  const { id } = await params
  const data = await loadProfile(id)
  if (!data) notFound()
  return <PublicProfile data={data} />
}
