import "server-only"
import sharp from "sharp"
import jsQR from "jsqr"

/**
 * Trakheesi permit QR handling (server only).
 *
 * The Dubai Land Department issues each advertising permit as a QR whose
 * payload is a URL on trakheesi.dubailand.gov.ae. `decodePermitQr` reads that
 * URL out of an uploaded image; `normalizeTrakheesiLink` accepts it only when
 * it really points at the DLD, so nothing else can be dressed up as a permit.
 */

const DLD_HOST = "dubailand.gov.ae"

/** The decoded URL if it is an https link on the DLD's domain, else null. */
export function normalizeTrakheesiLink(raw: string | null | undefined): string | null {
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== "https:") return null
  const host = u.hostname.toLowerCase()
  if (host !== DLD_HOST && !host.endsWith(`.${DLD_HOST}`)) return null
  return u.href
}

/**
 * Decode a QR from an image URL. Small permit images (the DLD's are often
 * under 200px) are upscaled with nearest-neighbour so each module spans
 * several pixels; a few scales are tried before giving up.
 */
export async function decodePermitQr(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl, { cache: "no-store" })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  const base = Math.max(meta.width ?? 0, meta.height ?? 0) || 1
  for (const target of [800, 1200, 400, base]) {
    try {
      const { data, info } = await sharp(buf)
        .flatten({ background: "#ffffff" })
        .resize({ width: target, kernel: "nearest", withoutEnlargement: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const hit = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)
      if (hit?.data) return hit.data
    } catch {
      /* try the next scale */
    }
  }
  return null
}

/** Decode and validate in one step: the DLD link, or null. */
export async function resolvePermitLink(imageUrl: string): Promise<string | null> {
  const raw = await decodePermitQr(imageUrl)
  return normalizeTrakheesiLink(raw)
}
