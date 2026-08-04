/**
 * Client-safe half of the Materials feature.
 *
 * The gallery is a client component, so anything it imports ends up in the
 * browser bundle. The shape and the byte formatter live here; the directory
 * scan (fs + sharp, `server-only`) stays in lib/materials.ts so it can never
 * be pulled across that boundary.
 */

export type Material = {
  /** File name on disk, e.g. "materials1.jpg". */
  file: string
  /** Public URL of the ORIGINAL file — what Download serves. */
  src: string
  /** Human label derived from the file name. */
  title: string
  bytes: number
  width: number | null
  height: number | null
  /** Inline base64 LQIP, or null when the image couldn't be probed. */
  blurDataURL: string | null
  /** Display label of the folder the file sits in — "Motivation",
   *  "Inspiration"… Files at the root of public/materials get GENERAL. */
  category: string
}

/** Bucket for files sitting directly in public/materials, uncategorised. */
export const GENERAL_CATEGORY = "General"

/** Label of the "show everything" tab. */
export const ALL_CATEGORY = "All"

/** "84 KB" / "1.0 MB" — matches how the rest of the dashboard shows file sizes. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}
