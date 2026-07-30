import sharp from "sharp"

/**
 * Server-side upload compression, ported from filipinohomes-api's
 * ImageUploadController::handleS3Upload (app/Http/Controllers/ImageUploadController.php):
 * scale down to a max width (never upscale), re-encode as WebP, and binary-search
 * the quality setting until the output fits a target byte budget. Every fhi-global
 * upload route was previously forwarding the raw client bytes straight to S3 —
 * this is what puts a compression step in front of that.
 *
 * Deliberately narrow: only jpeg/png/webp go through the pipeline (the same set
 * Laravel's `mimes:jpeg,jpg,png,webp` validates upstream). Anything else — PDFs,
 * Office documents, SVG (vector; rasterizing would lose scalability), GIF
 * (animated; sharp would flatten to one frame) — passes through untouched, same
 * as before this existed.
 */

// Serverless hardening. libvips keeps an operation/pixel cache and a worker
// thread pool, both sized for a long-lived server — in a memory-capped function
// they are pure overhead and the most common cause of an OOM kill (which the
// caller's try/catch CANNOT recover from, because the process dies).
sharp.cache(false)
sharp.concurrency(1)

/** Max dimension after resize; sharp never upscales past the source. */
const MAX_WIDTH = 1200
/** Quality search stays inside this range, exactly like the PHP original. */
const MIN_QUALITY = 4
const MAX_QUALITY = 92
/** Target output size; the search finds the highest quality that still fits.
 *  filipinohomes-api's PHP pipeline targets 50KB — fhi-global deliberately
 *  targets a looser 100KB instead, so this is not meant to track that value. */
const TARGET_BYTES = 100 * 1024
/** ~24MP. Guards against a decompression-bomb input exhausting memory. */
const MAX_INPUT_PIXELS = 24_000_000

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export type CompressedUpload = {
  buffer: Buffer
  contentType: string
  /** False when the input wasn't a compressible raster type, or compression failed. */
  compressed: boolean
}

async function encodeUnderTarget(
  encode: (quality: number) => Promise<Buffer>,
): Promise<Buffer> {
  const best = await encode(MAX_QUALITY)
  if (best.byteLength <= TARGET_BYTES) return best

  // Binary search for the highest quality that still fits the budget. Mirrors
  // the PHP version's fallback: if even MIN_QUALITY doesn't fit, that's what
  // ships — there's no further downsizing knob left to turn.
  let winner = await encode(MIN_QUALITY)
  let lo = MIN_QUALITY
  let hi = MAX_QUALITY - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = await encode(mid)
    if (candidate.byteLength <= TARGET_BYTES) {
      winner = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return winner
}

/**
 * Compress an uploaded image before it reaches S3. Fails open on anything
 * unexpected (corrupt bytes, an unsupported encoding) — an upload should never
 * hard-fail just because compression couldn't run. The reason is logged rather
 * than swallowed silently, so a production failure is diagnosable.
 */
export async function compressImageForUpload(
  input: Buffer,
  contentType: string,
): Promise<CompressedUpload> {
  if (!COMPRESSIBLE_TYPES.has(contentType)) {
    return { buffer: input, contentType, compressed: false }
  }

  try {
    // Decode + resize EXACTLY ONCE, into a small intermediate.
    //
    // The previous version kept one sharp pipeline and `.clone()`d it per
    // quality attempt. clone() shares the input but still re-runs the whole
    // pipeline, so every attempt re-decoded the full-size original — up to 8
    // full decodes of a multi-megapixel photo for a single upload. That is the
    // expensive part (a 1200px re-encode is cheap by comparison), and on a
    // memory/time-capped serverless function it is what tips a large phone
    // photo over the edge.
    //
    // `.rotate()` with no argument applies the EXIF orientation tag before the
    // pixels are touched. Required for correctness, not just tidiness: WebP
    // output carries no EXIF orientation, so a portrait phone photo would
    // otherwise be re-encoded permanently sideways.
    const resized = await sharp(input, {
      failOn: "none",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .toBuffer()

    // Every attempt below now decodes this already-small intermediate.
    const encode = (quality: number) => sharp(resized).webp({ quality }).toBuffer()
    const buffer = await encodeUnderTarget(encode)
    return { buffer, contentType: "image/webp", compressed: true }
  } catch (err) {
    // Fail open — the original still gets uploaded — but leave a trace, since a
    // silent catch here is exactly what makes a production-only failure
    // impossible to diagnose.
    console.error("[compress-image] falling back to the original upload:", err)
    return { buffer: input, contentType, compressed: false }
  }
}
