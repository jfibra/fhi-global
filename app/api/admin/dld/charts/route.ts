import { NextResponse, type NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import {
  DLD_CHART_BATCH_CHUNKS,
  DLD_CHART_SPECS,
  DLD_DATASETS,
  DLD_PRICE_INDEX_COMMAND,
  isDldCommand,
  type DldBreakdownResponse,
  type DldChartBucket,
  type DldPriceIndexResponse,
  type DldPriceIndexSeries,
  type DldRow,
} from "@/lib/dld-open-data"
import { asRows, buildGatewayBody, callGateway, chunkReader, clean, flag, readChunkRange } from "@/lib/dld-gateway"
import { chunkKey, readChunk, writeChunk } from "@/lib/dld-cache"

/**
 * Chart data for the admin "Real Estate Data" → Market Charts tab.
 *
 *   POST { kind: "price-index" }
 *     The DLD Property Price Index, normalized into 20 series. Cached in the
 *     same Postgres table as the dataset chunks (one entry, six hours).
 *
 *   POST { kind: "breakdown", command, chunkFrom?, chunkCount?, ...filters }
 *     Pulls ONE batch (`chunkCount` ≤ DLD_CHART_BATCH_CHUNKS chunks from `chunkFrom`) of the
 *     dataset's rows for the given filters in date order — through the chunk
 *     cache — and aggregates it here: a per-day series, category breakdowns
 *     and a ranking. Every aggregate is mergeable, so the page keeps asking
 *     for the next batch until `coverage.done`; there is no cap on how much
 *     of a range the charts cover, only on one request's duration.
 *
 * This static segment wins over the sibling dynamic route [command], so
 * "charts" is never treated as a dataset name.
 */

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  let incoming: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    incoming = {}
  }

  const kind = clean(incoming.kind)
  // `refresh: true` re-pulls from DLD instead of reading the Postgres cache.
  const refresh = flag(incoming.refresh)
  if (kind === "price-index") return priceIndex(refresh)
  if (kind === "breakdown") return breakdown(incoming, refresh)
  return NextResponse.json({ error: "Unknown chart kind." }, { status: 400 })
}

// ─── Price index ─────────────────────────────────────────────────────────────

async function priceIndex(refresh: boolean): Promise<NextResponse> {
  const key = chunkKey(DLD_PRICE_INDEX_COMMAND, {}, 0, 0)
  let rows: DldRow[]
  let fromCache = false

  const cached = refresh ? null : await readChunk(key)
  if (cached && cached.rows.length > 0) {
    rows = cached.rows
    fromCache = true
  } else {
    const upstream = await callGateway(DLD_PRICE_INDEX_COMMAND, {})
    if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })
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

  const response: DldPriceIndexResponse = { series: [...bySeries.values()], fromCache }
  return NextResponse.json(response)
}

// ─── Dataset breakdown ───────────────────────────────────────────────────────

async function breakdown(incoming: Record<string, unknown>, refresh: boolean): Promise<NextResponse> {
  const command = clean(incoming.command)
  if (!isDldCommand(command)) return NextResponse.json({ error: "Unknown dataset." }, { status: 404 })
  const spec = DLD_CHART_SPECS[command]
  if (!spec) return NextResponse.json({ error: "This dataset has no charts." }, { status: 400 })
  const dataset = DLD_DATASETS[command]

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })
  const body = { ...built.body, P_SORT: `${spec.dateSort}_ASC` }

  const chunkFrom = Math.max(0, Number.parseInt(clean(incoming.chunkFrom), 10) || 0)
  const chunkCount = Math.min(DLD_CHART_BATCH_CHUNKS, Math.max(1, Number.parseInt(clean(incoming.chunkCount), 10) || DLD_CHART_BATCH_CHUNKS))
  const reader = chunkReader(command, body, { refresh })
  const pulled = await readChunkRange(reader, chunkFrom, chunkCount)
  await reader.flush()
  if ("error" in pulled) return NextResponse.json({ error: pulled.error.message }, { status: pulled.error.status })
  const { rows, available, chunkTo, done } = pulled

  const daily = new Map<string, { count: number; value: number }>()
  const breakdowns: Record<string, Map<string, { count: number; value: number }>> = {}
  for (const k of spec.breakdowns) breakdowns[k] = new Map()
  const top = new Map<string, { count: number; value: number }>()
  let totalValue = 0
  let from: string | null = null
  let to: string | null = null

  const bump = (m: Map<string, { count: number; value: number }>, label: string, value: number) => {
    const cur = m.get(label) ?? { count: 0, value: 0 }
    cur.count += 1
    cur.value += value
    m.set(label, cur)
  }

  for (const row of rows) {
    const value = spec.valueKey ? (num(row[spec.valueKey]) ?? 0) : 0
    totalValue += value

    const day = isoDay(row[spec.dateKey])
    if (day) {
      bump(daily, day, value)
      if (!from || day < from) from = day
      if (!to || day > to) to = day
    }
    for (const k of spec.breakdowns) bump(breakdowns[k], labelOf(row[k]), value)
    bump(top, labelOf(row[spec.topKey]), value)
  }

  const toBuckets = (m: Map<string, { count: number; value: number }>): DldChartBucket[] =>
    [...m.entries()]
      .map(([label, v]) => ({ label, count: v.count, value: Math.round(v.value) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const response: DldBreakdownResponse = {
    command,
    daily: [...daily.entries()]
      .map(([date, v]) => ({ date, count: v.count, value: Math.round(v.value) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    breakdowns: Object.fromEntries(spec.breakdowns.map((k) => [k, toBuckets(breakdowns[k])])),
    top: toBuckets(top),
    totals: { count: rows.length, value: Math.round(totalValue) },
    coverage: {
      rows: rows.length,
      available,
      chunkFrom,
      chunkTo,
      done,
      from,
      to,
      cacheHits: reader.hits,
      cacheMisses: reader.misses,
    },
  }
  return NextResponse.json(response)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}

/** "2026-09-23T15:30:19" → "2026-09-23"; anything unparsable → null. */
function isoDay(v: unknown): string | null {
  if (typeof v !== "string") return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v)
  return m ? m[1] : null
}

function labelOf(v: unknown): string {
  if (v === null || v === undefined) return "Unknown"
  const s = String(v).replace(/ /g, " ").trim()
  return s || "Unknown"
}
