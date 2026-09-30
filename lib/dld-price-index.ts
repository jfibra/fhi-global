import "server-only"
import {
  DLD_PRICE_INDEX_COMMAND,
  type DldPriceIndexResponse,
  type DldPriceIndexSeries,
  type DldRow,
} from "@/lib/dld-open-data"
import { asRows, callGateway } from "@/lib/dld-gateway"
import { chunkKey, readChunk, writeChunk } from "@/lib/dld-cache"

/**
 * Fetches the DLD Property Price Index, cached in the same Postgres table as
 * every other DLD chunk (six hours). Shared by the admin proxy
 * (app/api/admin/dld/charts, kind "price-index") and the public proxy
 * (app/api/dld/price-index) that feeds the /open-data page — one gateway
 * call and one cache entry serve both surfaces.
 */
export async function fetchPriceIndex(
  refresh: boolean,
): Promise<{ ok: true; data: DldPriceIndexResponse } | { ok: false; status: number; message: string }> {
  const key = chunkKey(DLD_PRICE_INDEX_COMMAND, {}, 0, 0)
  let rows: DldRow[]
  let fromCache = false

  const cached = refresh ? null : await readChunk(key)
  if (cached && cached.rows.length > 0) {
    rows = cached.rows
    fromCache = true
  } else {
    const upstream = await callGateway(DLD_PRICE_INDEX_COMMAND, {})
    if (!upstream.ok) return { ok: false, status: upstream.status, message: upstream.message }
    rows = asRows(upstream.result)
    if (rows.length > 0) await writeChunk(key, DLD_PRICE_INDEX_COMMAND, 0, { rows, total: rows.length })
  }

  const bySeries = new Map<string, DldPriceIndexSeries>()
  for (const r of rows) {
    const period = r.IDX_PER === "Quarterly" ? "Quarterly" : r.IDX_PER === "Annual" ? "Annual" : null
    if (!period) continue
    const categoryCode = String(r.IDX_CAT_CODE ?? "")
    const subCategoryCode = String(r.IDX_SUB_CAT_CODE ?? "")
    const id = `${categoryCode}|${subCategoryCode}|${period}`
    let series = bySeries.get(id)
    if (!series) {
      series = {
        category: String(r.IDX_CAT ?? categoryCode),
        categoryCode,
        subCategory: String(r.IDX_SUB_CAT ?? subCategoryCode).trim(),
        subCategoryCode,
        period,
        points: [],
      }
      bySeries.set(id, series)
    }
    series.points.push({
      x: String(r.IDX_X ?? ""),
      actual: num(r.ACTUAL),
      qoq: num(r.QOQ),
      yoy: num(r.YOY),
    })
  }
  for (const s of bySeries.values()) s.points.sort((a, b) => a.x.localeCompare(b.x, undefined, { numeric: true }))

  return { ok: true, data: { series: [...bySeries.values()], fromCache } }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}
