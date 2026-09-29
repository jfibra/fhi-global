// A remote image as a data URI that next/og (Satori) can draw.
//
// Satori draws JPEG and PNG; the AVIF/WebP renders on S3 come out blank, so an
// `<img src={main_image}>` in an ImageResponse silently loses the photo. sharp
// resizes the file to its box and re-encodes it as JPEG. It is imported on
// demand inside a try, so a sharp that fails to load (every route using it
// needs libvips packaged — see outputFileTracingIncludes in next.config.mjs)
// costs the photo, never the card: the file is then used as-is when it is
// already JPEG/PNG, otherwise null and the caller falls back.

export async function ogPicture(url: string | null | undefined, width: number, height: number): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    try {
      const { default: sharp } = await import("sharp")
      const out = await sharp(buf).resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer()
      return `data:image/jpeg;base64,${out.toString("base64")}`
    } catch {
      const passthrough = type === "image/jpeg" || type === "image/png" || /\.(jpe?g|png)(\?|$)/i.test(url)
      return passthrough && buf.length < 4_000_000 ? `data:${type || "image/jpeg"};base64,${buf.toString("base64")}` : null
    }
  } catch {
    return null
  }
}
