import "server-only"
import { createHash } from "node:crypto"
import path from "node:path"
import { unstable_cache } from "next/cache"

/**
 * Covers for the public Forms shelf (/forms): page 1 of each PDF, rendered on
 * the server and served as a small WebP by app/(public-page)/(header-footer)/
 * forms/cover/[id]/route.ts.
 *
 * The shelf used to draw them in the browser (pdf.js, like the dashboard's
 * PdfThumbnail): a first visit downloaded pdf.js plus every whole PDF — about
 * 9 MB for seven forms, through an uncached route — and rasterised them one
 * by one, so the tiles sat on a PDF icon for seconds. Now the page HTML
 * carries an <img> per form and a cover weighs ~40 KB.
 *
 * A cover is rendered once per file, not once per visit:
 *  - the Data Cache (unstable_cache) keeps the encoded image across
 *    deployments. Vercel's CDN cache is per deployment, so without it every
 *    deploy would send the first visitors back to a cold render;
 *  - the CDN keeps the response per region and the browser for a year: the
 *    URL carries ?v=, a hash of the file URL and COVER_REV, so another file or
 *    a new rendering gets a new address.
 *
 * pdf.js and @napi-rs/canvas load from node_modules at run time
 * (serverExternalPackages), and the route's outputFileTracingIncludes ship
 * the font, CMap and wasm files pdf.js reads off disk plus the canvas binary
 * (next.config.mjs).
 */

/** Bump to re-render every cover under a new URL (size, quality or renderer change). */
const COVER_REV = 1
/** The tile is at most ~384 CSS px wide, so 768 px stays sharp on a 2x screen. */
const COVER_WIDTH = 768
const COVER_WEBP_QUALITY = 78
const PDF_FETCH_TIMEOUT_MS = 20_000
/** pdf.js reads its standard fonts, CMaps, wasm decoders and ICC profile from here by path. */
const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist")

export const isPdfFileName = (fileName: string) => /\.pdf$/i.test(fileName)

/** The cover's ?v= — changes with the file and with COVER_REV, so its URL can be cached for a year. */
export function formCoverVersion(fileUrl: string): string {
  return createHash("sha256").update(`${COVER_REV}:${fileUrl}`).digest("base64url").slice(0, 12)
}

/** Same-origin address of a form's cover, or null when the file is not a PDF. */
export function formCoverHref(form: { id: string; file_url: string; file_name: string }): string | null {
  return isPdfFileName(form.file_name) ? `/forms/cover/${form.id}?v=${formCoverVersion(form.file_url)}` : null
}

/** Page 1 of the PDF at fileUrl as base64 WebP (the Data Cache stores JSON). Throws on any failure, so a failure is never cached. */
async function renderCover(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl, { cache: "no-store", signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`form cover: storage answered ${res.status}`)
  const data = new Uint8Array(await res.arrayBuffer())

  const { createCanvas } = await import("@napi-rs/canvas")
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  // On the server pdf.js runs its worker in-process. Handing it the module up
  // front replaces its own import of ./pdf.worker.mjs, which file tracing can't follow.
  const g = globalThis as { pdfjsWorker?: unknown }
  // @ts-expect-error -- pdfjs-dist ships no type declarations for its worker module
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs")

  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: `${PDFJS_DIR}/standard_fonts/`,
    cMapUrl: `${PDFJS_DIR}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${PDFJS_DIR}/wasm/`,
    iccUrl: `${PDFJS_DIR}/iccs/`,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  }).promise
  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: COVER_WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    // @napi-rs/canvas implements the canvas API pdf.js draws with; only the DOM type differs.
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise
    return (await canvas.encode("webp", COVER_WEBP_QUALITY)).toString("base64")
  } finally {
    await doc.destroy()
  }
}

const cachedCover = unstable_cache(renderCover, ["form-cover", `rev-${COVER_REV}`], {
  revalidate: false,
  tags: ["form-cover"],
})

/** The WebP cover of the PDF stored at fileUrl — from the Data Cache, or rendered now. */
export async function getFormCover(fileUrl: string): Promise<Buffer> {
  return Buffer.from(await cachedCover(fileUrl), "base64")
}
