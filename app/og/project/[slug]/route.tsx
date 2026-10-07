import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import { ogCacheHeaders, ogJpeg, ogPicture } from "@/lib/og-picture"

export const runtime = "nodejs"

// Fallback background when a project has no main_image (or it can't be
// drawn — see lib/og-picture.ts). Read off disk and
// memoized as a data URL (satori can't fetch relative URLs) — same trick as
// app/og/business-card's logoDataUrl. Replaces the legacy Supabase JPG, whose
// host now answers HTTP 402.
let ogDefaultDataUrl: string | null = null
async function defaultBackground(): Promise<string> {
  if (!ogDefaultDataUrl) {
    const buf = await readFile(path.join(process.cwd(), "public", "og-default.jpg"))
    ogDefaultDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`
  }
  return ogDefaultDataUrl
}

// The white FHI Global Property mark (same file as the business and listing
// cards), memoized the same way; 2269x835, drawn header-sized so "Global Property" stays legible once Facebook shrinks the card.
const LOGO_H = 80
const LOGO_W = Math.round((LOGO_H * 2269) / 835)
let logoDataUrl: string | null = null
async function logo(): Promise<string> {
  if (!logoDataUrl) {
    const buf = await readFile(path.join(process.cwd(), "public", "FHI_Branding_White.png"))
    logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`
  }
  return logoDataUrl
}

// Cache: ImageResponse defaults to a YEAR of immutable caching, so the headers are set per card
// (ogCacheHeaders). A COMPLETE card — the project was found and its photo drew — is cached for a day at the CDN,
// because the page's metadata puts a ?v= token on this URL covering everything drawn (lib/og-url.ts); a
// missing project, a query error or a failed photo fetch stays on 5 minutes.

async function render(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const supabase = createAdminSupabase()

  // The same filters the page renders by (is_published + deleted_at), so a shared link never gets the generic card
  // for a project that is live.
  const { data, error } = await supabase
    .from("projects")
    .select("name, city, location, main_image, developers(name)")
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()

  const title = data?.name ?? "FHI Global Project"
  // developers(name) is a to-one embed → an OBJECT, not an array; the old
  // [0] access made the developer name silently vanish from every card.
  const developerName = (data?.developers as unknown as { name?: string | null } | null)?.name
  const subtitle = [developerName, data?.city ?? data?.location].filter(Boolean).join(" • ")
  // The renders on S3 are AVIF/WebP, which Satori draws as nothing — this
  // resizes them to the card as JPEG.
  const photoUrl = data?.main_image && isSafeRemoteImageUrl(data.main_image) ? data.main_image : null
  const picture = await ogPicture(photoUrl, 1200, 630)
  const [image, mark] = await Promise.all([picture ?? defaultBackground(), logo()])

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "Arial, sans-serif",
          color: "white",
          background: "#001f3f",
        }}
      >
        <img
          src={image}
          alt={title}
          width={1200}
          height={630}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
          }}
        />
        {/* Scrim under the text. Explicit box + backgroundImage: Satori has no
            `inset` shorthand, so this div used to have no size and never drew. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(180deg, rgba(0,20,40,0.2) 0%, rgba(0,20,40,0.85) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 44,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <img src={mark} alt="FHI Global" width={LOGO_W} height={LOGO_H} style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain", marginBottom: 6 }} />
          <div style={{ fontSize: 56, lineHeight: 1.05, fontWeight: 800, maxWidth: "90%" }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.9 }}>{subtitle || "Dubai Real Estate"}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: ogCacheHeaders(!error && Boolean(data) && (picture !== null || !data?.main_image)) },
  )
}

/** Out as JPEG — a fraction of the PNG's size, so WhatsApp shows the preview (lib/og-picture.ts). */
export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  return ogJpeg(await render(req, context))
}
