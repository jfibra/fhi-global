import { orderedProjectGalleryUrls, type BuyRawProject } from "@/lib/buy/cached-projects"

export type ListingExtraImageRow = { url: string; sort_order: number }

/**
 * Public gallery: developer project images first, then sales-uploaded listing images (deduped).
 */
export function mergedListingGalleryUrls(
  proj: BuyRawProject | null,
  agentImages: ListingExtraImageRow[] | null | undefined,
): string[] {
  const dev = orderedProjectGalleryUrls(proj)
  const extra = [...(agentImages ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.url?.trim())
    .filter((u): u is string => Boolean(u))
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of [...dev, ...extra]) {
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}
