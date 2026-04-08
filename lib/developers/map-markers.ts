const DUBAI = { lat: 25.2048, lng: 55.2708 }

function parseCoord(v: string | null | undefined): number | null {
  if (v == null) return null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export type DeveloperForMap = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
}

export type DeveloperMapMarker = {
  id: string
  lat: number
  lng: number
  title: string
  slug: string
  logo_url: string | null
}

type ProjectCoordRow = {
  developer_id: string | null
  latitude: string | null
  longitude: string | null
}

/** Mean lat/lng of published projects per developer; otherwise a small offset from Dubai so every pin is visible. */
export function buildDeveloperMapMarkers(
  developers: DeveloperForMap[],
  projectRows: ProjectCoordRow[],
): DeveloperMapMarker[] {
  const byDev = new Map<string, { lats: number[]; lngs: number[] }>()
  for (const row of projectRows) {
    if (!row.developer_id) continue
    const lat = parseCoord(row.latitude)
    const lng = parseCoord(row.longitude)
    if (lat == null || lng == null) continue
    const g = byDev.get(row.developer_id) ?? { lats: [], lngs: [] }
    g.lats.push(lat)
    g.lngs.push(lng)
    byDev.set(row.developer_id, g)
  }

  const total = developers.length
  return developers.map((d, index) => {
    const agg = byDev.get(d.id)
    let lat: number
    let lng: number
    if (agg && agg.lats.length > 0) {
      lat = agg.lats.reduce((a, b) => a + b, 0) / agg.lats.length
      lng = agg.lngs.reduce((a, b) => a + b, 0) / agg.lngs.length
    } else {
      const angle = (index / Math.max(1, total)) * Math.PI * 2 + 0.35
      const ring = Math.floor(index / 10)
      const r = 0.014 + ring * 0.009
      lat = DUBAI.lat + Math.cos(angle) * r
      lng = DUBAI.lng + Math.sin(angle) * r
    }
    return {
      id: d.id,
      lat,
      lng,
      title: d.name,
      slug: d.slug,
      logo_url: d.logo_url ?? null,
    }
  })
}
