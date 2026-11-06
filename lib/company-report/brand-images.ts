import "server-only"

/**
 * Pictures for the PDF reports (company report, team report). @react-pdf
 * draws PNG and JPEG only, and the originals are big (the brand marks are
 * 2–3k px PNGs; team logos come off S3 as whatever was uploaded, WebP
 * included), so every picture is fetched once, shrunk and re-encoded as PNG
 * with sharp, and kept per process. A picture that can't be fetched or
 * decoded is simply left out of the document — a report never fails over a
 * logo.
 */

const TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; p: Promise<Buffer | null> }>()

async function fetchPng(url: string, width: number, format: "png" | "jpeg"): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length) return null
    try {
      const { default: sharp } = await import("sharp")
      const img = sharp(buf).resize({ width, withoutEnlargement: true })
      // Photos (a project hero, a portrait) as JPEG: a tenth of the PNG's size, which matters for a brochure sent on WhatsApp.
      return format === "jpeg" ? await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer() : await img.png({ compressionLevel: 9 }).toBuffer()
    } catch {
      // No sharp (local dev without the native build): a PNG/JPEG original still draws as is.
      const type = (res.headers.get("content-type") ?? "").toLowerCase()
      return /png|jpe?g/.test(type) || /\.(png|jpe?g)(\?|$)/i.test(url) ? buf : null
    }
  } catch {
    return null
  }
}

/** Any image URL as a PNG buffer no wider than `width` (a JPEG with `{ photo: true }` — for photographs), or null when it can't be drawn. */
export function pdfImage(url: string | null | undefined, width: number, opts: { photo?: boolean } = {}): Promise<Buffer | null> {
  const u = (url ?? "").trim()
  if (!/^https?:\/\//i.test(u)) return Promise.resolve(null)
  const format = opts.photo ? "jpeg" : "png"
  const key = `${u}@${width}:${format}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p
  const p = fetchPng(u, width, format)
  const entry = { at: Date.now(), p }
  cache.set(key, entry)
  // A miss is never kept: the next report tries again.
  p.then((b) => {
    if (!b && cache.get(key) === entry) cache.delete(key)
  })
  return p
}

/** The brand marks in public/, shrunk for print (the originals are 2–3k px PNGs). */
export function brandImage(origin: string, file: string, width: number): Promise<Buffer | null> {
  return pdfImage(`${origin}/${file}`, width)
}
