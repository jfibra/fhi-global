import sharp from "sharp"

/**
 * Detect a logo's baked-in background colour from its edge pixels.
 *
 * Returns a CSS hex (e.g. "#000000") when the opaque edge pixels agree on one
 * colour — the logo was exported on a solid field — so the surrounding panel
 * can be painted to match. Returns null for transparent logos, photos and
 * gradients, where the caller should keep its own default background.
 *
 * Server-only (sharp). Pure and deterministic, so the result is safe to store.
 */
export async function detectLogoBackground(input: Buffer): Promise<string | null> {
  let img: ReturnType<typeof sharp>
  try {
    img = sharp(input, { failOn: "none" }).ensureAlpha()
  } catch {
    return null
  }
  const meta = await img.metadata()
  if (!meta.width || !meta.height || meta.width < 8 || meta.height < 8) return null
  // Work on a small copy — edge colour does not need full resolution.
  const W = Math.min(meta.width, 256)
  const { data, info } = await img.resize({ width: W, fit: "inside" }).raw().toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height
  const px = (x: number, y: number) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]] as const }

  const edge: Array<readonly [number, number, number, number]> = []
  for (let x = 0; x < w; x++) { edge.push(px(x, 0), px(x, h - 1)) }
  for (let y = 1; y < h - 1; y++) { edge.push(px(0, y), px(w - 1, y)) }

  const transparent = edge.filter((p) => p[3] < 32).length / edge.length
  if (transparent > 0.5) return null // transparent logo — nothing to match

  const opaque = edge.filter((p) => p[3] >= 32)
  const mean = opaque.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => Math.round(v / opaque.length))
  const agree = opaque.filter((p) => Math.abs(p[0] - mean[0]) + Math.abs(p[1] - mean[1]) + Math.abs(p[2] - mean[2]) < 48).length / opaque.length
  if (agree < 0.9) return null // photo or gradient — no single background

  return "#" + mean.map((v) => v.toString(16).padStart(2, "0")).join("")
}

/** True when a hex background is dark enough that light text/icons belong on it. */
export function isDarkHex(hex: string | null | undefined): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}
