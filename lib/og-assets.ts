import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * The two files in public/ that the /og/seo card draws, as data URLs (Satori cannot fetch relative
 * URLs, and a self-HTTP fetch is fragile in dev). Memoised. Each reader is a no-argument function with a
 * literal path.join(process.cwd(), "public", "<file>") so file tracing resolves it statically
 * (next.config.mjs also lists both files under "/og/seo/"). A failed read returns null, so the route
 * degrades to a flat navy card on the short cache instead of a 500.
 */

/** The white FHI mark, drawn header-sized so "Global Property" stays legible once a feed shrinks the card (2269 × 835). */
export const OG_LOGO_H = 80
export const OG_LOGO_W = Math.round((OG_LOGO_H * 2269) / 835)

let logoCache: string | null = null
export async function ogLogo(): Promise<string | null> {
  if (logoCache) return logoCache
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "FHI_Branding_White.png"))
    logoCache = `data:image/png;base64,${buf.toString("base64")}`
    return logoCache
  } catch {
    return null
  }
}

let defaultCache: string | null = null
export async function ogDefaultBackground(): Promise<string | null> {
  if (defaultCache) return defaultCache
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "og-default.jpg"))
    defaultCache = `data:image/jpeg;base64,${buf.toString("base64")}`
    return defaultCache
  } catch {
    return null
  }
}
