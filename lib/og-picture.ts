// A remote image as a data URI that next/og (Satori) can draw.
//
// Satori draws JPEG and PNG; the AVIF/WebP renders on S3 come out blank, so an
// `<img src={main_image}>` in an ImageResponse silently loses the photo. sharp
// resizes the file to its box and re-encodes it as JPEG. It is imported on
// demand inside a try, so a sharp that fails to load (every route using it
// needs libvips packaged — see outputFileTracingIncludes in next.config.mjs)
// costs the photo, never the card: the file is then used as-is when it is
// already JPEG/PNG, otherwise null and the caller falls back.

export async function ogPicture(
  url: string | null | undefined,
  width: number,
  height: number,
  /** "inside" scales the whole picture to fit the box (no crop) — for callers that frame it themselves. */
  fit: "cover" | "inside" = "cover",
): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    try {
      const { default: sharp } = await import("sharp")
      const out = await sharp(buf)
        .resize(width, height, fit === "cover" ? { fit: "cover", position: "attention" } : { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
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
 * can't, the PNG goes out unchanged — never a broken card.
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
    return res
  }
}
