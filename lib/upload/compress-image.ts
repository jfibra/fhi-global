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

/** Max dimension after resize; sharp never upscales past the source. */
const MAX_WIDTH = 1200
/** Quality search stays inside this range, exactly like the PHP original. */
const MIN_QUALITY = 4
const MAX_QUALITY = 92
/** Target output size; the search finds the highest quality that still fits.
 *  filipinohomes-api's PHP pipeline targets 50KB — fhi-global deliberately
 *  targets a looser 100KB instead, so this is not meant to track that value. */
const TARGET_BYTES = 100 * 1024

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
 * hard-fail just because compression couldn't run.
 */
export async function compressImageForUpload(
  input: Buffer,
  contentType: string,
): Promise<CompressedUpload> {
  if (!COMPRESSIBLE_TYPES.has(contentType)) {
    return { buffer: input, contentType, compressed: false }
  }

  try {
    // Decode + resize once; `.clone()` branches the pipeline per quality
    // attempt without re-decoding the source each time (sharp docs recommend
    // clone() over re-constructing sharp(input) per candidate).
    const resized = sharp(input).resize({ width: MAX_WIDTH, withoutEnlargement: true })
    const encode = (quality: number) => resized.clone().webp({ quality }).toBuffer()
    const buffer = await encodeUnderTarget(encode)
    return { buffer, contentType: "image/webp", compressed: true }
  } catch {
    return { buffer: input, contentType, compressed: false }
  }
}
