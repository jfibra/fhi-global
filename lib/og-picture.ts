// A remote image as a data URI that next/og (Satori) can draw.
//
// Satori draws JPEG and PNG; the AVIF/WebP renders on S3 come out blank, so an
// `<img src={main_image}>` in an ImageResponse silently loses the photo. sharp
// resizes the file to its box and re-encodes it as JPEG. It is imported on
// demand inside a try, so a sharp that fails to load (every route using it
// needs libvips packaged — see outputFileTracingIncludes in next.config.mjs)
// costs the photo, never the card: the file is then used as-is when it is
// already JPEG/PNG, otherwise null and the caller falls back.

/** A slow origin read (the S3 bucket is in Singapore; some legacy originals are 9 MB) costs the photo, never the card. */
const OG_FETCH_TIMEOUT_MS = 6000

/**
 * Cache-Control for a card. ImageResponse defaults to a YEAR of immutable caching, so every card sets its own:
 *  - VERSIONED (a day at the CDN, a week of stale-while-revalidate) only for a COMPLETE card whose every
 *    input is in the ?v= token the page puts on its URL (lib/og-url.ts) — an edit then changes the URL;
 *  - SHORT (5 minutes) for everything else: fallback cards, a photo that failed to load, and the cards whose
 *    URL version cannot cover what they draw (the listing card, the business card).
 */
export const OG_CACHE_VERSIONED = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
export const OG_CACHE_SHORT = "public, max-age=300, s-maxage=300"
export const ogCacheHeaders = (complete: boolean): { "cache-control": string } => ({
  "cache-control": complete ? OG_CACHE_VERSIONED : OG_CACHE_SHORT,
})

/**
 * A colour value that is safe to hand to sharp: #rgb / #rgba / #rrggbb / #rrggbbaa or rgb()/rgba(). A
 * hand-edited developers.logo_bg must not make sharp throw and silently drop a perfectly good logo.
 */
export function ogColor(value: string | null | undefined, fallback = "#ffffff"): string {
  const v = (value ?? "").trim()
  return /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([\d\s.,%]+\))$/i.test(v) ? v : fallback
}

export async function ogPicture(
  url: string | null | undefined,
  width: number,
  height: number,
  /** "inside" scales the whole picture to fit the box (no crop) — for callers that frame it themselves. */
  fit: "cover" | "inside" = "cover",
  /** Composite a transparent picture (a logo) onto this colour — JPEG has no alpha, and transparent pixels would turn black. */
  background?: string,
): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(OG_FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    try {
      const { default: sharp } = await import("sharp")
      let pipeline = sharp(buf).resize(
        width,
        height,
        fit === "cover" ? { fit: "cover", position: "attention" } : { fit: "inside", withoutEnlargement: true },
      )
      if (background) pipeline = pipeline.flatten({ background: ogColor(background) })
      const out = await pipeline.jpeg({ quality: 82 }).toBuffer()
      return `data:image/jpeg;base64,${out.toString("base64")}`
    } catch {
      const passthrough = type === "image/jpeg" || type === "image/png" || /\.(jpe?g|png)(\?|$)/i.test(url)
      return passthrough && buf.length < 4_000_000 ? `data:${type || "image/jpeg"};base64,${buf.toString("base64")}` : null
    }
  } catch {
    return null
  }
}

/**
 * A rendered thumbnail (ImageResponse PNG) re-encoded as JPEG. Photo cards come
 * out of Satori as 0.7–1.4 MB PNGs; WhatsApp is widely reported to skip link
 * previews whose picture is much over ~300 KB, so a share showed no thumbnail
 * there (2026-10-04). As JPEG they're ~100–250 KB. sharp loads on demand; if it
 * can't, the PNG goes out unchanged — never a broken card — but on the SHORT cache: a PNG fallback must
 * never be pinned under a long header, so it heals on the next deploy.
 */
export async function ogJpeg(res: Response, quality = 82): Promise<Response> {
  if (!res.ok) return res
  try {
    const png = Buffer.from(await res.clone().arrayBuffer())
    const { default: sharp } = await import("sharp")
    const jpg = await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer()
    const headers = new Headers(res.headers)
    headers.set("Content-Type", "image/jpeg")
    headers.delete("Content-Length")
    return new Response(new Uint8Array(jpg), { status: res.status, headers })
  } catch {
    const headers = new Headers(res.headers)
    headers.set("cache-control", OG_CACHE_SHORT)
    return new Response(res.body, { status: res.status, headers })
  }
}
