import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"
import { fetchArticleBySlug } from "@/lib/news-service"
import { DEFAULT_PREVIEW_IMAGE_URL, LEGACY_PREVIEW_IMAGE_URL } from "@/lib/seo"
import { ogPicture } from "@/lib/og-picture"

// Social link-preview card for a news article: the story's photo, a soft navy
// scrim and the white FHI Global mark, so a shared story is recognisably ours
// (Facebook prints the headline under the card itself, so the card carries the
// photo and the brand, not the title). Same construction as app/og/project.
// An article without a usable photo gets a navy card with the mark and the
// headline instead.

export const runtime = "nodejs"

const W = 1200
const H = 630

// The white FHI Global Property mark (2269x835), memoized as a data URL —
// Satori can't fetch relative URLs.
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

// ImageResponse defaults to a year of immutable caching; a story's photo can
// be swapped upstream, so keep it to 5 minutes like the other cards.
const CACHE_HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" }

const isPlaceholder = (u: string | null | undefined) => !u || u === DEFAULT_PREVIEW_IMAGE_URL || u === LEGACY_PREVIEW_IMAGE_URL

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const article = await fetchArticleBySlug(slug).catch(() => null)
  const photoUrl = !isPlaceholder(article?.featuredImage) ? article?.featuredImage : !isPlaceholder(article?.img) ? article?.img : undefined
  const [photo, mark] = await Promise.all([ogPicture(photoUrl, W, H), logo()])
  const category = article?.category?.trim()

  if (!photo) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 64px 56px",
            background: "#001f3f",
            color: "white",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <img src={mark} alt="FHI Global" width={LOGO_W} height={LOGO_H} style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain", marginBottom: 28 }} />
          <div style={{ fontSize: 22, color: "#d6b357", fontWeight: 700, letterSpacing: 3, marginBottom: 14 }}>{(category ?? "NEWS").toUpperCase()}</div>
          <div style={{ fontSize: 52, lineHeight: 1.1, fontWeight: 800, maxWidth: "92%" }}>{article?.title ?? "Dubai real estate news"}</div>
        </div>
      ),
      { width: W, height: H, headers: CACHE_HEADERS },
    )
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#001f3f", fontFamily: "Arial, Helvetica, sans-serif", color: "white" }}>
        <img src={photo} alt="" width={W} height={H} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", top: 0, left: 0 }} />
        {/* Scrim under the mark only — the photo is the card; explicit box because Satori has no `inset`. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            display: "flex",
            backgroundImage: "linear-gradient(180deg, rgba(0,20,40,0) 55%, rgba(0,20,40,0.78) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 48, right: 48, bottom: 40, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <img src={mark} alt="FHI Global" width={LOGO_W} height={LOGO_H} style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain" }} />
          <div style={{ fontSize: 22, color: "#d6b357", fontWeight: 700, letterSpacing: 3, paddingBottom: 6 }}>{category ? `${category.toUpperCase()} · NEWS` : "NEWS"}</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: CACHE_HEADERS },
  )
}
