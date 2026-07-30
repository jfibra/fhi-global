import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { createPageMetadata } from "@/lib/seo"
import { roleToLabel } from "@/lib/app-roles"
import { readCustomLinks, readSocialLinks, readTagline } from "@/lib/public-profile"
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
    socials: readSocialLinks(profile.metadata),
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
  return {
    ...createPageMetadata({
      title: `${data.fullname} | FHI Global`,
      description:
        data.tagline ||
        `${data.fullname} — ${data.roleLabel} at FHI Global. Call, message or save the contact details.`,
      pathname: `/business-card/${data.id}`,
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
