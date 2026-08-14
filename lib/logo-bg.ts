/**
 * Client-side helper: reads a loaded logo image's own background color by
 * sampling its corner pixels, so the containing tile/panel can blend
 * seamlessly with non-transparent logos (e.g. white JPEGs).
 *
 * Returns null (caller keeps its default background) when any corner is
 * transparent or the canvas can't be read, and plain white when the sample is
 * unreliable: corners that disagree with each other, or a muddy mid-tone gray.
 */

const WHITE_BG = "#ffffff"

// One shared 2×2 canvas for all logos: each corner pixel is drawn straight
// into it, so a logo is never rasterized at full resolution just to read
// four pixels.
let samplerCtx: CanvasRenderingContext2D | null | undefined
function getSamplerCtx() {
  if (samplerCtx === undefined) {
    const canvas = document.createElement("canvas")
    canvas.width = 2
    canvas.height = 2
    samplerCtx = canvas.getContext("2d", { willReadFrequently: true })
  }
  return samplerCtx
}

/** Sample from a raw URL via an offscreen CORS-enabled image, so the visible
 *  <img> is untouched. Resolves null (use the caller's default) whenever the
 *  host blocks CORS or the pixels can't be read. */
export function sampleLogoBgFromUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(sampleLogoBg(img))
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function sampleLogoBg(
  img: HTMLImageElement,
  /** acceptMidTones: keep mid-tone gray backgrounds instead of vetoing them
   *  to white — right for large surfaces (the poster medallion) where a
   *  solid gray disc looks deliberate, wrong for small list tiles. */
  opts?: { acceptMidTones?: boolean },
): string | null {
  try {
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (w < 8 || h < 8) return null

    const ctx = getSamplerCtx()
    if (!ctx) return null
    ctx.clearRect(0, 0, 2, 2)
    ctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1)
    ctx.drawImage(img, w - 3, 2, 1, 1, 1, 0, 1, 1)
    ctx.drawImage(img, 2, h - 3, 1, 1, 0, 1, 1, 1)
    ctx.drawImage(img, w - 3, h - 3, 1, 1, 1, 1, 1, 1)
    const data = ctx.getImageData(0, 0, 2, 2).data

    const samples: Array<[number, number, number]> = []
    for (let i = 0; i < 4; i++) {
      const o = i * 4
      if (data[o + 3] < 200) return null // transparent logo — keep the default bg
      samples.push([data[o], data[o + 1], data[o + 2]])
    }

    const avg = [0, 1, 2].map(
      (i) => samples.reduce((sum, s) => sum + s[i], 0) / samples.length
    )
    // Corners disagree → the "background" is really part of the artwork.
    if (samples.some((s) => s.some((v, i) => Math.abs(v - avg[i]) > 40))) {
      return WHITE_BG
    }

    const [r, g, b] = avg
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const lum = (r + g + b) / 3
    // Mid-tone gray reads as muddy on small tiles — use white unless the
    // caller explicitly wants the true color.
    if (!opts?.acceptMidTones && chroma < 25 && lum > 50 && lum < 225) {
      return WHITE_BG
    }

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  } catch {
    return null // tainted canvas or read failure — keep the default bg
  }
}
