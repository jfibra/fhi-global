import { NextResponse, type NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_DLD_OPEN_DATA, isAdminStaffRole } from "@/lib/app-roles"
import {
  DLD_CHART_BATCH_CHUNKS,
  DLD_CHART_LATEST_N,
  DLD_CHART_SPECS,
  DLD_DATASETS,
  isDldCommand,
  type DldBreakdownResponse,
  type DldChartBucket,
  type DldKpiSums,
  type DldRow,
  type DldSummaryResponse,
  DLD_SUMMARY_SAMPLE,
  SQFT_PER_SQM,
} from "@/lib/dld-open-data"
import { asRows, buildGatewayBody, callGateway, chunkReader, clean, flag, gatewayTotal, readChunkRange, type GatewayError } from "@/lib/dld-gateway"
import { chunkKey, readChunk, writeChunk } from "@/lib/dld-cache"
import { fetchPriceIndex } from "@/lib/dld-price-index"

/**
 * Chart data for the admin "Real Estate Data" → Market Charts tab.
 *
 *   POST { kind: "price-index" }
 *     The DLD Property Price Index (lib/dld-price-index.ts — shared with the
 *     public proxy at app/api/dld/price-index), normalized into 20 series.
 *     Cached in the same Postgres table as the dataset chunks (one entry, six hours).
 *
 *   POST { kind: "summary", command, ...filters }
 *     The fast per-tab strip. Exact counts without pulling rows: the gateway
 *     repeats the full match count on every row, so a one-row request per
 *     option of each "All" select filter gives that option's count. Those run
 *     in parallel and are cached like chunks. Headline figures (average
 *     value, per-sqft, top areas) come from the newest DLD_SUMMARY_SAMPLE rows.
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
  const guard = await requireRole([...ROLES_DLD_OPEN_DATA])
  if (!guard.ok) return guard.response
  const adminStaff = isAdminStaffRole(guard.context.profile.role)

  let incoming: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    incoming = {}
  }

  const kind = clean(incoming.kind)
  // The sales ladder's page is the fixed last-month breakdown only; the
  // summary and index kinds (the admin workbench) stay admin-staff.
  if (!adminStaff && kind !== "breakdown") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  // `refresh: true` re-pulls from DLD instead of reading the Postgres cache.
  const refresh = flag(incoming.refresh)
  if (kind === "price-index") return priceIndex(refresh)
  if (kind === "breakdown") return breakdown(incoming, refresh)
  if (kind === "summary") return summary(incoming, refresh)
  return NextResponse.json({ error: "Unknown chart kind." }, { status: 400 })
}

// ─── Price index ─────────────────────────────────────────────────────────────

async function priceIndex(refresh: boolean): Promise<NextResponse> {
  const result = await fetchPriceIndex(refresh)
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
  return NextResponse.json(result.data)
}

// ─── Dataset breakdown ───────────────────────────────────────────────────────

async function breakdown(incoming: Record<string, unknown>, refresh: boolean): Promise<NextResponse> {
  const command = clean(incoming.command)
  if (!isDldCommand(command)) return NextResponse.json({ error: "Unknown dataset." }, { status: 404 })
  const spec = DLD_CHART_SPECS[command]
  const dataset = DLD_DATASETS[command]

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })
  // Date order when the dataset has a date, so a partial pull is a clean prefix.
  const body = { ...built.body, P_SORT: spec.dateSort ? `${spec.dateSort}_ASC` : dataset.defaultSort }

  const chunkFrom = Math.max(0, Number.parseInt(clean(incoming.chunkFrom), 10) || 0)
  const chunkCount = Math.min(DLD_CHART_BATCH_CHUNKS, Math.max(1, Number.parseInt(clean(incoming.chunkCount), 10) || DLD_CHART_BATCH_CHUNKS))
  const reader = chunkReader(command, body, { refresh })
  const pulled = await readChunkRange(reader, chunkFrom, chunkCount)
  await reader.flush()
  if ("error" in pulled) return NextResponse.json({ error: pulled.error.message }, { status: pulled.error.status })
  const { rows, available, chunkTo, done } = pulled

  // The requested window: a row the gateway returned for it belongs to it,
  // so a day that the cutoff estimate above still leaves a hair outside is
  // folded onto the nearest edge rather than drawn as a stray extra day.
  const windowFrom = windowDay(built.body.P_FROM_DATE)
  const windowTo = windowDay(built.body.P_TO_DATE)
  const clampDay = (day: string) => (windowFrom && day < windowFrom ? windowFrom : windowTo && day > windowTo ? windowTo : day)

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

  // KPI subset (e.g. sales only): sums for the tiles, a location ranking, and
  // the newest rows for the history table. Feeds the per-tab Summary strip's
  // exact-figures upgrade — Breakdowns' own price-per-sqft (`areaAgg` below)
  // is separate and never restricted by category.
  const kpiSpec = spec.kpi
  const kpiLocations = new Map<string, { count: number; value: number }>()
  const kpi: DldKpiSums = { count: 0, valueSum: 0, valueWithAreaSum: 0, areaSqmSum: 0, locations: [] }
  const latestPool: DldRow[] = []

  // Breakdowns' price-per-sqft: over every row in scope, no category filter.
  let areaValueSum = 0
  let areaSqmSum = 0

  for (const row of rows) {
    const value = spec.valueKey ? (num(row[spec.valueKey]) ?? 0) : 0
    totalValue += value

    if (kpiSpec && labelOf(row[kpiSpec.filterKey]) === kpiSpec.filterValue) {
      kpi.count += 1
      kpi.valueSum += value
      const area = num(row[kpiSpec.areaKey]) ?? 0
      if (area > 0 && value > 0) {
        kpi.valueWithAreaSum += value
        kpi.areaSqmSum += area
      }
      bump(kpiLocations, labelOf(row[kpiSpec.locationKey]), value)
      latestPool.push(row)
    }

    if (spec.areaKey && value > 0) {
      const area = num(row[spec.areaKey]) ?? 0
      if (area > 0) {
        areaValueSum += value
        areaSqmSum += area
      }
    }

    const rawDay = spec.dateKey ? isoDay(row[spec.dateKey]) : null
    const day = rawDay ? clampDay(rawDay) : null
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

  let latest: DldRow[] | undefined
  if (kpiSpec) {
    kpi.locations = toBuckets(kpiLocations)
    kpi.valueSum = Math.round(kpi.valueSum)
    kpi.valueWithAreaSum = Math.round(kpi.valueWithAreaSum)
    // Rows arrive in ascending date order — the newest are at the end.
    latest = latestPool
      .slice(-DLD_CHART_LATEST_N)
      .reverse()
      .map((row) => Object.fromEntries(kpiSpec.latestKeys.map((k) => [k, row[k] ?? null])) as DldRow)
  }

  const response: DldBreakdownResponse = {
    command,
    daily: [...daily.entries()]
      .map(([date, v]) => ({ date, count: v.count, value: Math.round(v.value) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    breakdowns: Object.fromEntries(spec.breakdowns.map((k) => [k, toBuckets(breakdowns[k])])),
    top: toBuckets(top),
    totals: { count: rows.length, value: Math.round(totalValue) },
    ...(kpiSpec ? { kpi, latest } : {}),
    ...(spec.areaKey ? { areaAgg: { valueWithAreaSum: Math.round(areaValueSum), areaSqmSum } } : {}),
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

// ─── Fast summary ────────────────────────────────────────────────────────────

const SUMMARY_CONCURRENCY = 6

async function summary(incoming: Record<string, unknown>, refresh: boolean): Promise<NextResponse> {
  const command = clean(incoming.command)
  if (!isDldCommand(command)) return NextResponse.json({ error: "Unknown dataset." }, { status: 404 })
  const spec = DLD_CHART_SPECS[command]
  const dataset = DLD_DATASETS[command]

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })
  const base: Record<string, string> = { ...built.body, P_SORT: spec.dateSort ? `${spec.dateSort}_DESC` : dataset.defaultSort }

  // One reader per distinct body — a "count" is chunk 0 of a 1-row page, so
  // it lands in the same cache table as everything else.
  const counters: Array<{ param: string; option: string; body: Record<string, string> }> = []
  for (const f of dataset.filters) {
    if (f.kind !== "select" || !f.options || base[f.param]) continue
    for (const o of f.options) counters.push({ param: f.param, option: o.label, body: { ...base, [f.param]: o.value } })
  }

  let hits = 0
  let misses = 0
  const countOf = async (body: Record<string, string>): Promise<number | { error: GatewayError }> => {
    const key = chunkKey(command, { ...body, P_TAKE: "1" }, 0, 1)
    const cached = refresh ? null : await readChunk(key)
    if (cached) {
      hits++
      return cached.total
    }
    misses++
    const upstream = await callGateway(command, { ...body, P_SKIP: "0", P_TAKE: "1" })
    if (!upstream.ok) return { error: { status: upstream.status, message: upstream.message } }
    const rows = asRows(upstream.result)
    const total = gatewayTotal(rows)
    await writeChunk(key, command, 0, { rows, total })
    return total
  }

  // Sample: the newest page of rows, through the ordinary chunk cache.
  const reader = chunkReader(command, base, { refresh })
  const samplePromise = reader.get(0)

  // Counts, a few at a time.
  const counts = new Map<number, number>()
  for (let i = 0; i < counters.length; i += SUMMARY_CONCURRENCY) {
    const slice = counters.slice(i, i + SUMMARY_CONCURRENCY)
    const results = await Promise.all(slice.map((c) => countOf(c.body)))
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (typeof r !== "number") return NextResponse.json({ error: r.error.message }, { status: r.error.status })
      counts.set(i + j, r)
    }
  }

  const sampleChunk = await samplePromise
  await reader.flush()
  if ("error" in sampleChunk) return NextResponse.json({ error: sampleChunk.error.message }, { status: sampleChunk.error.status })
  hits += reader.hits
  misses += reader.misses

  const splits: DldSummaryResponse["splits"] = []
  for (const f of dataset.filters) {
    const mine = counters.map((c, i) => ({ c, i })).filter(({ c }) => c.param === f.param)
    if (!mine.length) continue
    splits.push({
      param: f.param,
      label: f.label,
      buckets: mine.map(({ c, i }) => ({ label: c.option, count: counts.get(i) ?? 0, value: 0 })).sort((a, b) => b.count - a.count),
    })
  }

  const rows = sampleChunk.rows.slice(0, DLD_SUMMARY_SAMPLE)
  let sample: DldSummaryResponse["sample"] = null
  if (rows.length) {
    let valueSum = 0
    let valued = 0
    let saleValueWithArea = 0
    let saleArea = 0
    const top = new Map<string, { count: number; value: number }>()
    let from: string | null = null
    let to: string | null = null
    for (const row of rows) {
      const v = spec.valueKey ? num(row[spec.valueKey]) : null
      if (v !== null && v > 0) {
        valueSum += v
        valued++
      }
      if (spec.kpi && labelOf(row[spec.kpi.filterKey]) === spec.kpi.filterValue) {
        const a = num(row[spec.kpi.areaKey]) ?? 0
        if (v !== null && v > 0 && a > 0) {
          saleValueWithArea += v
          saleArea += a
        }
      }
      const label = labelOf(row[spec.topKey])
      const cur = top.get(label) ?? { count: 0, value: 0 }
      cur.count++
      cur.value += v ?? 0
      top.set(label, cur)
      const day = spec.dateKey ? isoDay(row[spec.dateKey]) : null
      if (day) {
        if (!from || day < from) from = day
        if (!to || day > to) to = day
      }
    }
    sample = {
      rows: rows.length,
      dateKey: spec.dateKey ?? null,
      from,
      to,
      avgValue: valued ? valueSum / valued : null,
      perSqft: saleArea > 0 ? saleValueWithArea / (saleArea * SQFT_PER_SQM) : null,
      top: [...top.entries()]
        .map(([label, v]) => ({ label, count: v.count, value: Math.round(v.value) }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 5),
    }
  }

  const response: DldSummaryResponse = {
    command,
    total: sampleChunk.total,
    splits,
    sample,
    cacheHits: hits,
    cacheMisses: misses,
  }
  return NextResponse.json(response)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}

/**
 * The gateway's day does not start at midnight. Probing single-day windows
 * (Oct 2026) shows "09/01/2026" returning INSTANCE_DATE from 2026-08-31T15:16
 * through 2026-09-01T15:13, "09/02" starting at 2026-09-01T15:16, and
 * "09/30" running 2026-09-29T15:15:57 → 2026-09-30T15:14:31 — a cutoff at
 * about 15:15 in the stamps as served (DLD states no timezone). So the day a
 * row belongs to, by DLD's own filter, is the date of (stamp + 8h45m).
 * Bucketing by the raw date put the first ~9 hours of every day on the day
 * before, and made "September" start on 31 Aug. Date-only values (the rents
 * dates, for instance) carry no time and are taken as they are.
 */
const DLD_DAY_CUTOFF_SHIFT_MS = (8 * 60 + 45) * 60 * 1000

/** "2026-09-23T15:30:19" → "2026-09-24" (DLD's day, see above); "2026-09-23" → "2026-09-23"; anything unparsable → null. */
function isoDay(v: unknown): string | null {
  if (typeof v !== "string") return null
  const m = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2})?)?/.exec(v)
  if (!m) return null
  if (!m[2]) return m[1]
  const t = Date.parse(`${m[1]}${m[2]}Z`)
  if (Number.isNaN(t)) return m[1]
  return new Date(t + DLD_DAY_CUTOFF_SHIFT_MS).toISOString().slice(0, 10)
}

/** "09/01/2026" (the gateway's MM/DD/YYYY) → "2026-09-01"; anything else → null. */
function windowDay(v: string | undefined): string | null {
  const m = v ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v) : null
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

function labelOf(v: unknown): string {
  if (v === null || v === undefined) return "Unknown"
  const s = String(v).replace(/ /g, " ").trim()
  return s || "Unknown"
}
