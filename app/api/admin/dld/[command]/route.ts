import { NextResponse, type NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import {
  DLD_DATASETS,
  DLD_DEFAULT_TAKE,
  DLD_MAX_TAKE,
  DLD_SEARCH_CHUNK,
  DLD_SEARCH_COLUMN_KEY,
  DLD_SEARCH_SCAN_MAX,
  DLD_SEARCH_SCAN_ROWS_KEY,
  DLD_SEARCH_SCAN_STEP,
  DLD_SEARCH_TERM_KEY,
  DLD_SEARCH_TERM_MAX,
  cellContains,
  isExactLookup,
  isSearchableColumn,
  isDldCommand,
  isDldLookup,
  isValidSort,
  type DldLookupResponse,
  type DldOption,
  type DldQueryResponse,
  type DldRow,
  type DldSearchInfo,
} from "@/lib/dld-open-data"
import { asRows, buildGatewayBody, callGateway, chunkReader, clean, flag, gatewayTotal, type GatewayError } from "@/lib/dld-gateway"
import type { CachedChunk } from "@/lib/dld-cache"

/**
 * Server-side proxy for the Dubai Land Department open-data gateway, feeding
 * the admin "Real Estate Data" tables.
 *
 * `command` is either one of the nine datasets (transactions, rents, …) or one
 * of the three lookups that fill dropdowns (carea-lookup, projects-lookup,
 * ejari-property-types). Anything else is a 404 — this is not a general
 * pass-through to the gateway. (The charts endpoint is the sibling static
 * route app/api/admin/dld/charts.)
 *
 * For datasets, only parameters declared in lib/dld-open-data.ts are forwarded
 * and every value is coerced to a bounded string, so the upstream never sees
 * arbitrary client input. Paging is capped at DLD_MAX_TAKE.
 *
 * Column search (`SEARCH_COLUMN` + `SEARCH_TERM` in the body): the gateway
 * has no `%term%` filter of its own, so the proxy reads the filtered result
 * set in aligned chunks of DLD_SEARCH_CHUNK rows — each chunk cached in
 * Postgres (lib/dld-cache.ts) so repeat searches over the same filters never
 * hit the gateway again — and matches locally:
 *
 *   • whole number on a sortable column → "exact": sort by that column and
 *     binary-search the chunks, ~log2(chunks) gateway calls, whole set covered;
 *   • anything else → "contains": scan the first SEARCH_SCAN_ROWS rows
 *     (default DLD_SEARCH_SCAN_STEP, raised by the UI up to DLD_SEARCH_SCAN_MAX)
 *     in the table's sort order and keep rows whose column contains the term.
 *
 * Both page the matches and report what was scanned in `search`.
 */

export const runtime = "nodejs"
// A cold contains-scan of 5,000 rows is ~5 gateway calls at ~3.5s each.
export const maxDuration = 60

export async function POST(req: NextRequest, ctx: { params: Promise<{ command: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { command } = await ctx.params

  // ── Lookups: no filters, normalized to { value, label } ────────────────────
  if (isDldLookup(command)) {
    const upstream = await callGateway(command, {})
    if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })

    const options: DldOption[] = []
    for (const item of upstream.result) {
      if (!item || typeof item !== "object") continue
      const rec = item as Record<string, unknown>
      // carea-lookup uses AREA_ID; the others use ID.
      const value = clean(rec.AREA_ID ?? rec.ID)
      const label = clean(rec.NAME_EN)
      if (value && label) options.push({ value, label })
    }
    options.sort((a, b) => a.label.localeCompare(b.label))
    return NextResponse.json({ options } satisfies DldLookupResponse, {
      headers: { "Cache-Control": "private, max-age=3600" },
    })
  }

  if (!isDldCommand(command)) {
    return NextResponse.json({ error: "Unknown dataset." }, { status: 404 })
  }

  const dataset = DLD_DATASETS[command]

  let incoming: Record<string, unknown>
  try {
    const parsed: unknown = await req.json()
    incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    incoming = {}
  }

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })
  const body = built.body

  const take = Math.min(DLD_MAX_TAKE, Math.max(1, Number.parseInt(body.P_TAKE, 10) || DLD_DEFAULT_TAKE))
  const skip = Math.max(0, Number.parseInt(body.P_SKIP, 10) || 0)
  body.P_TAKE = String(take)
  body.P_SKIP = String(skip)
  body.P_SORT = isValidSort(dataset, body.P_SORT) ? body.P_SORT : dataset.defaultSort

  // ── Column search: read chunks (cache → gateway), match here, page matches ─
  const searchColumn = clean(incoming[DLD_SEARCH_COLUMN_KEY])
  const searchTerm = clean(incoming[DLD_SEARCH_TERM_KEY]).slice(0, DLD_SEARCH_TERM_MAX).toLowerCase()
  if (searchTerm) {
    if (!isSearchableColumn(dataset, searchColumn)) {
      return NextResponse.json({ error: "Unknown search column." }, { status: 400 })
    }
    const requestedScan = Number.parseInt(clean(incoming[DLD_SEARCH_SCAN_ROWS_KEY]), 10) || DLD_SEARCH_SCAN_STEP
    const scanLimit = Math.min(DLD_SEARCH_SCAN_MAX, Math.max(DLD_SEARCH_SCAN_STEP, requestedScan))
    // `refresh: true` (the page's Refresh button) re-pulls every chunk from DLD.
    const refresh = flag(incoming.refresh)
    const search = isExactLookup(dataset, searchColumn, searchTerm)
      ? await exactLookup(command, body, { column: searchColumn, term: searchTerm, refresh })
      : await containsScan(command, body, { column: searchColumn, term: searchTerm, scanLimit, refresh })
    if ("error" in search) return NextResponse.json({ error: search.error.message }, { status: search.error.status })

    const response: DldQueryResponse = {
      rows: search.matches.slice(skip, skip + take),
      total: search.matches.length,
      skip,
      take,
      search: search.info,
    }
    return NextResponse.json(response)
  }

  const upstream = await callGateway(command, body)
  if (!upstream.ok) return NextResponse.json({ error: upstream.message }, { status: upstream.status })

  const rows = asRows(upstream.result)
  return NextResponse.json({ rows, total: gatewayTotal(rows), skip, take } satisfies DldQueryResponse)
}

type SearchOutcome = { matches: DldRow[]; info: DldSearchInfo } | { error: GatewayError }

// ─── "contains": scan the first N rows in table order ────────────────────────

async function containsScan(
  command: string,
  body: Record<string, string>,
  opts: { column: string; term: string; scanLimit: number; refresh?: boolean },
): Promise<SearchOutcome> {
  const reader = chunkReader(command, body, { refresh: opts.refresh })
  const matches: DldRow[] = []
  let scanned = 0
  let available = 0

  for (let index = 0; scanned < opts.scanLimit; index++) {
    const chunk = await reader.get(index)
    if ("error" in chunk) {
      await reader.flush()
      return chunk
    }
    if (index === 0) available = chunk.total
    scanned += chunk.rows.length
    for (const row of chunk.rows) if (cellContains(row[opts.column], opts.term)) matches.push(row)
    // Short page → the gateway has nothing more for these filters.
    if (chunk.rows.length < DLD_SEARCH_CHUNK || scanned >= available) break
  }
  await reader.flush()

  return {
    matches,
    info: {
      column: opts.column,
      term: opts.term,
      mode: "contains",
      scanned,
      available,
      truncated: scanned < available,
      scanLimit: opts.scanLimit,
      cacheHits: reader.hits,
      cacheMisses: reader.misses,
    },
  }
}

// ─── "exact": sort by the column, binary-search the chunks ───────────────────

function numericCell(row: DldRow | undefined, column: string): number | null {
  const v = row?.[column]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v)
  return null
}

async function exactLookup(
  command: string,
  body: Record<string, string>,
  opts: { column: string; term: string; refresh?: boolean },
): Promise<SearchOutcome> {
  const target = Number(opts.term)
  const sortedBody = { ...body, P_SORT: `${opts.column}_ASC` }
  const reader = chunkReader(command, sortedBody, { refresh: opts.refresh })

  const first = await reader.get(0)
  if ("error" in first) {
    await reader.flush()
    return first
  }
  const available = first.total
  const lastIndex = Math.max(0, Math.ceil(available / DLD_SEARCH_CHUNK) - 1)

  const done = async (matches: DldRow[], scanned: number): Promise<SearchOutcome> => ({
    matches,
    info: {
      column: opts.column,
      term: opts.term,
      mode: "exact",
      scanned,
      available,
      truncated: false,
      scanLimit: available,
      cacheHits: reader.hits,
      cacheMisses: reader.misses,
    },
  })

  // Values that don't read as numbers (e.g. a text column that happens to be
  // sortable) can't be bisected — fall back to a plain scan of what we have.
  if (first.rows.length === 0 || numericCell(first.rows[0], opts.column) === null) {
    return containsScan(command, body, { column: opts.column, term: opts.term, scanLimit: DLD_SEARCH_SCAN_STEP, refresh: opts.refresh })
  }

  // Find the first chunk whose last value >= target. Chunks visited are cached,
  // so a second lookup with the same filters costs no gateway calls.
  const chunks = new Map<number, CachedChunk>([[0, first]])
  const load = async (i: number) => {
    const have = chunks.get(i)
    if (have) return have
    const c = await reader.get(i)
    if ("error" in c) throw c
    chunks.set(i, c)
    return c
  }

  try {
    let lo = 0
    let hi = lastIndex
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      const c = await load(mid)
      const last = numericCell(c.rows[c.rows.length - 1], opts.column)
      if (last !== null && last < target) lo = mid + 1
      else hi = mid
    }

    // Equal values can straddle a chunk boundary — collect from `lo` onward
    // until the values pass the target.
    const matches: DldRow[] = []
    let scanned = 0
    for (let i = lo; i <= lastIndex; i++) {
      const c = await load(i)
      scanned += c.rows.length
      let passed = false
      for (const row of c.rows) {
        const v = numericCell(row, opts.column)
        if (v === target) matches.push(row)
        else if (v !== null && v > target) {
          passed = true
          break
        }
      }
      if (passed || c.rows.length < DLD_SEARCH_CHUNK) break
    }
    await reader.flush()
    return done(matches, scanned)
  } catch (err) {
    await reader.flush()
    if (err && typeof err === "object" && "error" in err) return err as SearchOutcome
    return { error: { status: 502, message: "Dubai Land Department returned an error. Try again in a moment." } }
  }
}
