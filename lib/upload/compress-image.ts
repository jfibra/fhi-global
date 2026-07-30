/**
 * Client-side upload compression — runs in the BROWSER, before the file is sent.
 *
 * Same shape as filipinohomes-api's ImageUploadController::handleS3Upload
 * (scale down to a max width, re-encode as WebP, search the quality setting for
 * the largest one that fits a byte budget), but done with canvas instead of
 * libvips/GD, and on the user's machine instead of the server.
 *
 * Why client-side: the dominant cost of an upload is pushing the ORIGINAL over
 * the user's connection. A 12MP phone photo is ~8-12MB; on a typical mobile
 * uplink that is tens of seconds before the server has even seen it. Shrinking
 * first turns that into ~100KB, so the network leg — not the encoding — stops
 * being the bottleneck. It also takes the CPU work out of the serverless
 * function entirely.
 *
 * Deliberately narrow, matching the server behaviour it replaces: only
 * jpeg/png/webp are touched. Anything else (PDF, Office docs, SVG, GIF) is
 * returned as-is, so the attachment flows that accept mixed file types keep
 * working unchanged.
 */

/** Max dimension after resize; never upscales a smaller source. */
const MAX_WIDTH = 1200
/** Quality ladder bounds, as fractions (canvas takes 0..1, not 0..100). */
const MIN_QUALITY = 0.04
const MAX_QUALITY = 0.92
/** Target output size — the search keeps the best quality that still fits. */
const TARGET_BYTES = 100 * 1024
/** Probe count for the quality search. 5 halvings over the 0.04..0.92 range
 *  lands within ~0.03 of the optimum — past that the file-size difference is
 *  smaller than the cost of another encode. */
const SEARCH_STEPS = 5

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export type CompressedImage = {
  /** Ready to append to FormData. The original when nothing was done. */
  file: File
  originalBytes: number
  bytes: number
  /** False when the type wasn't compressible, or compression failed. */
  compressed: boolean
  width: number | null
  height: number | null
}

/** Swap the extension so the stored filename matches the real bytes. */
function toWebpName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "")
  return `${base || "upload"}.webp`
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality))
}

/**
 * Draw the source into a canvas at the target size, asking the browser for its
 * best resampling filter.
 *
 * `imageSmoothingQuality = "high"` is the one knob canvas exposes here, and it
 * matters: the server used to resample with libvips' Lanczos3, which weighs many
 * source pixels per output pixel, whereas canvas defaults to a cheaper
 * bilinear-class filter. Measured on a detailed test photo at an identical
 * ~100KB output, the resampler alone was worth ~1.4dB PSNR (lanczos3 33.85 vs
 * bilinear 32.47) — so it is worth asking for the good one.
 *
 * Deliberately a SINGLE draw. The classic workaround for canvas downscaling is
 * to halve repeatedly until the last step is under 2x, on the theory that a
 * naive filter undersamples at large ratios. That is a real problem in older
 * engines, but every extra resampling pass also loses a little detail — and with
 * "high" smoothing, modern browsers already box-filter properly. Absent a way to
 * measure real canvas output from here, the simpler path is the safer one: one
 * draw cannot compound its own error.
 */
function drawDownscaled(
  source: CanvasImageSource,
  destW: number,
  destH: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas")
  canvas.width = destW
  canvas.height = destH
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, destW, destH)
  return canvas
}

/**
 * Decode to a bitmap with EXIF orientation already applied.
 *
 * `imageOrientation: "from-image"` matters for correctness, not tidiness: WebP
 * carries no EXIF orientation tag, so a portrait phone photo would otherwise be
 * re-encoded permanently sideways. Falls back to an <img> element, which applies
 * orientation itself, on browsers without that createImageBitmap option.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.addEventListener("load", () => resolve(img))
      img.addEventListener("error", () => reject(new Error("Could not decode the image.")))
      img.src = url
    })
  } finally {
    // Revoked after decode: the bitmap/element already holds the pixels.
    URL.revokeObjectURL(url)
  }
}

/**
 * Compress an image in the browser before upload. Fails OPEN — on any problem
 * (unsupported type, decode failure, no canvas) the original file is returned
 * so the upload still goes through, just uncompressed.
 */
export async function compressImageForUpload(file: File): Promise<CompressedImage> {
  const unchanged: CompressedImage = {
    file,
    originalBytes: file.size,
    bytes: file.size,
    compressed: false,
    width: null,
    height: null,
  }

  if (!COMPRESSIBLE_TYPES.has(file.type)) return unchanged

  try {
    const source = await decode(file)
    const srcW = "width" in source ? source.width : 0
    const srcH = "height" in source ? source.height : 0
    if (!srcW || !srcH) return unchanged

    // Never upscale — a 600px logo asked to fit 1200 stays 600.
    const scale = Math.min(1, MAX_WIDTH / srcW)
    const width = Math.max(1, Math.round(srcW * scale))
    const height = Math.max(1, Math.round(srcH * scale))

    const canvas = drawDownscaled(source as CanvasImageSource, width, height)
    if ("close" in source) source.close()
    if (!canvas) return unchanged

    // Highest quality first: if it already fits, no search is needed at all.
    let best = await canvasToBlob(canvas, MAX_QUALITY)
    if (!best) return unchanged

    if (best.size > TARGET_BYTES) {
      // Binary search downward for the best quality that fits. If even the floor
      // overshoots, the floor is what ships — mirrors the server/PHP behaviour,
      // since there is no further knob once the dimensions are already capped.
      let lo = MIN_QUALITY
      let hi = MAX_QUALITY
      const floor = await canvasToBlob(canvas, MIN_QUALITY)
      if (floor) best = floor
      for (let i = 0; i < SEARCH_STEPS; i++) {
        const mid = (lo + hi) / 2
        const candidate = await canvasToBlob(canvas, mid)
        if (!candidate) break
        if (candidate.size <= TARGET_BYTES) {
          best = candidate
          lo = mid
        } else {
          hi = mid
        }
      }
    }

    // A pathological source can compress *worse* than it arrived (e.g. an
    // already-optimised small JPEG). Keep whichever is actually smaller.
    if (best.size >= file.size) return unchanged

    return {
      file: new File([best], toWebpName(file.name), { type: "image/webp" }),
      originalBytes: file.size,
      bytes: best.size,
      compressed: true,
      width,
      height,
    }
  } catch (err) {
    console.error("[compress-image] falling back to the original upload:", err)
    return unchanged
  }
}
