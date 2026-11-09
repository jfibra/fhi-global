import "server-only"
import {
  DLD_SEARCH_CHUNK,
  DLD_SEARCH_SCAN_STEP,
  cellContains,
  type DldRow,
  type DldSearchInfo,
} from "@/lib/dld-open-data"
import { chunkReader, type GatewayError } from "@/lib/dld-gateway"
import type { CachedChunk } from "@/lib/dld-cache"

/**
 * Column search over a DLD dataset (moved here from app/api/admin/dld/[command]
 * so the broker lookup, app/api/brokers/[brn], uses the same binary search).
 * See that route's header for how "exact" and "contains" differ.
 */

export type SearchOutcome = { matches: DldRow[]; info: DldSearchInfo } | { error: GatewayError }

// ─── "contains": scan the first N rows in table order ────────────────────────

export async function containsScan(
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

export async function exactLookup(
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
