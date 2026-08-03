import { ImageResponse } from "next/og"
import fs from "node:fs/promises"
import path from "node:path"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { roleToLabel } from "@/lib/app-roles"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import { readTagline, titleCaseName } from "@/lib/public-profile"
import { PROFILE_OG_H, PROFILE_OG_W, readProfileOgCard } from "@/lib/profile-og-card"
import ProfileShareCard from "@/features/business-card/profile-share-card"

// Social link-preview image for a public business-card profile. Renders the
// same ProfileShareCard the agent customized in the Link Preview tab, using the
// options saved on profiles.metadata.og_card (absent = default navy card).
// Unknown/inactive profiles get the branded fallback.
//
// /business-card/[id] points here with a ?v=<hash of the saved card> param so
// scrapers re-fetch after every save; the param itself is ignored. Mirrors
// /og/listing/[id] — see that route for the shared conventions.

export const runtime = "nodejs"

/**
 * ImageResponse's production default is a ONE-YEAR immutable cache — right for
 * next/og's usual static use, wrong here: this image changes whenever the
 * profile does, and a year-old copy pinned in a CDN or crawler cache is exactly
 * the "thumbnail never updates" bug. Five minutes still absorbs a scrape burst
 * (Facebook fetches once per share wave), but a redesign propagates on its own.
 */
const CACHE_HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Internal partner accounts have no public card — same rule as the page. */
const NO_PUBLIC_CARD = new Set(["developer"])

// satori can't fetch relative URLs and a self-HTTP fetch would be fragile in
// dev, so the mark is read from disk and memoized as a data URL.
let logoCache: string | null = null
async function logoDataUrl(): Promise<string> {
  if (!logoCache) {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "FHI_Branding_White.png"))
    logoCache = `data:image/png;base64,${buf.toString("base64")}`
  }
  return logoCache
}

/**
 * Google serves OAuth avatars at whatever size the sizing suffix asks for, and
 * the one stored at sign-in is `=s96-c` — 96px. Stretched across the card's
 * 560px photo panel that is visibly blurry, so the suffix is rewritten to ask
 * for a usable size. Any other host is returned untouched.
 */
function upscaleAvatar(url: string): string {
  if (!/googleusercontent\.com/i.test(url)) return url
  // The suffix is the last `=`-delimited segment, e.g. ".../AVvXsE=s96-c".
  return url.replace(/=s\d+(-c)?$/i, "=s640$1")
}

async function fallbackBrandCard() {
  const logo = await logoDataUrl()
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          background: "#001f3f",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="FHI Global" width={300} height={110} style={{ width: 300, height: 110, objectFit: "contain" }} />
        <div style={{ display: "flex", fontSize: 30, color: "#d6b357", fontWeight: 700, letterSpacing: 3 }}>
          DUBAI REAL ESTATE
        </div>
      </div>
    ),
    { width: PROFILE_OG_W, height: PROFILE_OG_H, headers: CACHE_HEADERS },
  )
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const trimmed = (id ?? "").trim()
  if (!UUID_RE.test(trimmed)) return fallbackBrandCard()

  // Service role: profiles RLS is authenticated-only and this route is public.
  // Visibility is enforced explicitly below, as on the other /og routes.
  const supabase = createAdminSupabase()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fname, lname, fullname, profile_url, status, is_deleted, metadata")
    .eq("id", trimmed)
    .maybeSingle()

  if (!profile || profile.is_deleted || profile.status !== "active") return fallbackBrandCard()
  if (NO_PUBLIC_CARD.has(profile.role ?? "")) return fallbackBrandCard()

  const meta = (profile.metadata as Record<string, unknown> | null) ?? {}
  const options = readProfileOgCard(profile.metadata)

  const fullname =
    (profile.fullname ?? "").trim() ||
    [profile.fname, profile.lname].filter(Boolean).join(" ").trim() ||
    "FHI Global"

  const dial = typeof meta.phone_country_code === "string" ? meta.phone_country_code : "+971"
  const local = typeof meta.phone_number === "string" ? meta.phone_number.trim() : ""

  // Email lives in auth.users, and only when the card actually shows it — one
  // avoidable admin round trip per scrape otherwise.
  let email = ""
  if (!options.hide.includes("email")) {
    const { data: authUser } = await supabase.auth.admin.getUserById(trimmed)
    email = authUser?.user?.email?.toLowerCase() ?? ""
  }

  // Raw absolute URL — satori fetches it server-side, no proxy needed. Host
  // allowlisted because profile_url is user-writable; anything else falls back
  // to the initials tile rather than making this server fetch it.
  const rawAvatar = (profile.profile_url ?? "").trim()
  const photoSrc = rawAvatar && isSafeRemoteImageUrl(rawAvatar) ? upscaleAvatar(rawAvatar) : null

  return new ImageResponse(
    (
      <ProfileShareCard
        name={titleCaseName(fullname)}
        role={roleToLabel(profile.role)}
        tagline={readTagline(profile.metadata)}
        phone={local ? `${dial} ${local}` : ""}
        email={email}
        photoSrc={photoSrc}
        logoSrc={await logoDataUrl()}
        options={options}
      />
    ),
    { width: PROFILE_OG_W, height: PROFILE_OG_H, headers: CACHE_HEADERS },
  )
}
