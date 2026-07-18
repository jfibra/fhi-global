// Shared PNG capture for the marketing generators (flyer + announcement).
//
// Two problems this solves with html-to-image:
//   1. Speed — by default it re-fetches + base64-embeds every web font on every
//      call, and re-downloads every image (cacheBust). We compute the font-embed
//      CSS ONCE (module-cached, warmed when a modal opens) and reuse it, and
//      turn cacheBust off so cached images inline instantly.
//   2. Partial exports ("only the logo shows") — that's a race: html-to-image
//      rasterizes the cloned <foreignObject> before its fonts/images have loaded
//      in that isolated SVG, so text/photos come out blank. Passing a
//      precomputed fontEmbedCSS (fonts inlined as data URIs → rendered
//      synchronously) and awaiting every <img> decode first removes the race.

let fontCSSCache: string | null = null
let fontCSSPromise: Promise<string> | null = null

/** Compute (once) and cache the base64 @font-face CSS for the document. */
export async function ensureFontEmbedCSS(node: HTMLElement): Promise<string> {
  if (fontCSSCache != null) return fontCSSCache
  if (!fontCSSPromise) {
    fontCSSPromise = import("html-to-image")
      .then((m) => m.getFontEmbedCSS(node))
      .then((css) => {
        fontCSSCache = css
        return css
      })
      .catch(() => {
        fontCSSCache = ""
        return ""
      })
  }
  return fontCSSPromise
}

/** Kick off font-embed computation early (e.g. when the editor opens) so the
 *  first Download/Print is instant. Safe to call repeatedly. */
export function warmFontEmbedCSS(node: HTMLElement | null): void {
  if (node) void ensureFontEmbedCSS(node)
}

async function awaitImages(node: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map(async (img) => {
      try {
        if (!(img.complete && img.naturalWidth > 0)) {
          await new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true })
            img.addEventListener("error", () => resolve(), { once: true })
          })
        }
        if (typeof img.decode === "function") await img.decode()
      } catch {
        /* ignore individual image failures */
      }
    }),
  )
}

const dataUrlCache = new Map<string, string>()

async function urlToDataUrl(url: string): Promise<string> {
  const cached = dataUrlCache.get(url)
  if (cached) return cached
  const res = await fetch(url, { cache: "force-cache" })
  const blob = await res.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
  dataUrlCache.set(url, dataUrl)
  return dataUrl
}

// Swap every remote <img> src for a data URL up-front so html-to-image has
// nothing to fetch during rasterization — that internal fetch has a concurrency
// limit + timeout and intermittently drops images (e.g. the 2nd/3rd mosaic
// thumbnails), which is what caused the export to differ from the preview.
// Returns a restore fn that puts the original srcs back.
async function inlineImages(node: HTMLElement): Promise<() => void> {
  const imgs = Array.from(node.querySelectorAll("img"))
  const restores: Array<() => void> = []
  await Promise.all(
    imgs.map(async (img) => {
      const orig = img.getAttribute("src")
      if (!orig || orig.startsWith("data:")) return
      try {
        const dataUrl = await urlToDataUrl(orig)
        img.setAttribute("src", dataUrl)
        restores.push(() => img.setAttribute("src", orig))
        if (typeof img.decode === "function") {
          try {
            await img.decode()
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* leave the original src — html-to-image will still try */
      }
    }),
  )
  return () => restores.forEach((r) => r())
}

/** Rasterize a node to a PNG data URL, reliably and fast. */
export async function capturePng(
  node: HTMLElement,
  { width, height, pixelRatio = 2 }: { width: number; height: number; pixelRatio?: number },
): Promise<string> {
  const m = await import("html-to-image")
  await awaitImages(node)
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
  }
  const fontEmbedCSS = await ensureFontEmbedCSS(node)
  const restore = await inlineImages(node)
  try {
    return await m.toPng(node, {
      width,
      height,
      pixelRatio,
      cacheBust: false,
      backgroundColor: "#ffffff",
      fontEmbedCSS,
      style: { transform: "none", margin: "0" },
    })
  } finally {
    restore()
  }
}
