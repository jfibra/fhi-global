import "server-only"
import {
  DLD_GATEWAY,
  DLD_SEARCH_CHUNK,
  allowedParamsFor,
  type DldDataset,
  type DldRow,
} from "@/lib/dld-open-data"
import { chunkKey, readChunk, writeChunk, type CachedChunk } from "@/lib/dld-cache"

/**
 * Server-side plumbing shared by the DLD proxy routes
 * (app/api/admin/dld/[command] and app/api/admin/dld/charts):
 *
 *   • callGateway   — one POST to the open-data gateway, with the flaky-upstream
 *                     handling (HTML 500 pages, timeouts) turned into a plain
 *                     { status, message } the routes can return as-is;
 *   • buildGatewayBody — the declared-parameters-only body for a dataset, with
 *                     the required/date validation the DLD site itself applies;
 *   • chunkReader   — aligned 1,000-row pages of a sorted, filtered result set,
 *                     read through the Postgres cache (lib/dld-cache.ts).
 */

const UPSTREAM_TIMEOUT_MS = 45_000
const MAX_VALUE_LENGTH = 120

export type GatewayError = { status: number; message: string }

type GatewayEnvelope = {
  responseCode?: number
  validationErrorsList?: unknown[]
  response?: { result?: unknown } | null
}

export async function callGateway(
  command: string,
  body: Record<string, string>,
): Promise<{ ok: true; result: unknown[] } | { ok: false; status: number; message: string }> {
  let res: Response
  try {
    res = await fetch(`${DLD_GATEWAY}/${command}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError"
    return {
      ok: false,
      status: 504,
      message: timedOut ? "Dubai Land Department did not respond in time." : "Could not reach Dubai Land Department.",
    }
  }

  const text = await res.text()
  let json: GatewayEnvelope | null = null
  try {
    json = JSON.parse(text) as GatewayEnvelope
  } catch {
    json = null
  }

  if (!res.ok || !json) {
    return { ok: false, status: 502, message: "Dubai Land Department returned an error. Try again in a moment." }
  }
  if (Array.isArray(json.validationErrorsList) && json.validationErrorsList.length > 0) {
    return { ok: false, status: 422, message: "Dubai Land Department rejected the filters." }
  }
  const result = json.response?.result
  return { ok: true, result: Array.isArray(result) ? result : [] }
}

/** Coerce any client value to a short string the gateway can take. */
/** True for `true`, "true", "1", 1 — the shape a JSON body may carry. */
export function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1"
}

export function clean(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_VALUE_LENGTH)
}

export function asRows(result: unknown[]): DldRow[] {
  return result.filter((r): r is DldRow => !!r && typeof r === "object")
}

/** The gateway repeats the full match count as `TOTAL` on every row. */
export function gatewayTotal(rows: DldRow[]): number {
  const first = rows[0]?.TOTAL
  return typeof first === "number" ? first : rows.length
}

/**
 * Every declared parameter for the dataset (blank when not supplied — the
 * gateway wants the full set), validated the way the DLD form validates.
 * Paging/sort keys are left for the caller to set.
 */
export function buildGatewayBody(
  dataset: DldDataset,
  incoming: Record<string, unknown>,
): { ok: true; body: Record<string, string> } | { ok: false; error: string } {
  const body: Record<string, string> = {}
  for (const param of allowedParamsFor(dataset)) body[param] = clean(incoming[param])

  for (const f of dataset.filters) {
    if (f.required && !body[f.param]) return { ok: false, error: `${f.label} is required.` }
    if (f.kind === "date" && body[f.param] && !/^\d{2}\/\d{2}\/\d{4}$/.test(body[f.param])) {
      return { ok: false, error: `${f.label} must be MM/DD/YYYY.` }
    }
  }
  return { ok: true, body }
}

export type ChunkReader = {
  /** Rows [index*CHUNK, (index+1)*CHUNK) of the sorted, filtered set. */
  get(index: number): Promise<CachedChunk | { error: GatewayError }>
  /**
   * Wait for cache writes started by `get`. Routes call this before
   * responding: on serverless hosts a write still in flight when the
   * response ends can be dropped, and the next request would re-pull.
   */
  flush(): Promise<void>
  hits: number
  misses: number
}

/**
 * `refresh` skips cache *reads* (every chunk is re-pulled from the gateway
 * and re-written), which is what the page's Refresh buttons ask for.
 */
export function chunkReader(command: string, body: Record<string, string>, opts: { refresh?: boolean } = {}): ChunkReader {
  const pending: Promise<void>[] = []
  const reader: ChunkReader = {
    hits: 0,
    misses: 0,
    async flush() {
      await Promise.allSettled(pending.splice(0))
    },
    async get(index) {
      const key = chunkKey(command, body, index, DLD_SEARCH_CHUNK)
      const cached = opts.refresh ? null : await readChunk(key)
      if (cached) {
        reader.hits++
        return cached
      }
      reader.misses++
      const upstream = await callGateway(command, {
        ...body,
        P_SKIP: String(index * DLD_SEARCH_CHUNK),
        P_TAKE: String(DLD_SEARCH_CHUNK),
      })
      if (!upstream.ok) return { error: { status: upstream.status, message: upstream.message } }
      const rows = asRows(upstream.result)
      const chunk: CachedChunk = { rows, total: gatewayTotal(rows) }
      // An empty page past the end still says "nothing here" — worth caching.
      pending.push(writeChunk(key, command, index, chunk))
      return chunk
    },
  }
  return reader
}

/**
 * Read chunks [from, from + count) with a little concurrency, stopping early
 * at the end of the set. Returns the rows plus the gateway's total, and
 * whether the set ended inside this range.
 */
export async function readChunkRange(
  reader: ChunkReader,
  from: number,
  count: number,
  concurrency = 4,
): Promise<{ rows: DldRow[]; available: number; chunkTo: number; done: boolean } | { error: GatewayError }> {
  const first = await reader.get(from)
  if ("error" in first) return first
  const available = first.total
  const lastIndexInSet = Math.max(0, Math.ceil(available / DLD_SEARCH_CHUNK) - 1)
  const lastIndex = Math.min(from + count - 1, lastIndexInSet)

  const chunks: CachedChunk[] = [first]
  for (let start = from + 1; start <= lastIndex; start += concurrency) {
    const indices = Array.from({ length: Math.min(concurrency, lastIndex - start + 1) }, (_, i) => start + i)
    const results = await Promise.all(indices.map((i) => reader.get(i)))
    for (const r of results) {
      if ("error" in r) return r
      chunks.push(r)
    }
  }
  const rows = chunks.flatMap((c) => c.rows)
  const chunkTo = lastIndex + 1
  return { rows, available, chunkTo, done: chunkTo > lastIndexInSet || rows.length === 0 }
}

/**
 * Read chunks 0..N-1 (N = ceil(limit / CHUNK), stopping early at the end of the
 * set) with a little concurrency — the gateway answers each call in ~4s whatever
 * the size, so four in flight cuts a cold 10,000-row pull from ~40s to ~12s.
 */
export async function readChunksUpTo(
  reader: ChunkReader,
  limit: number,
  concurrency = 4,
): Promise<{ rows: DldRow[]; available: number } | { error: GatewayError }> {
  const first = await reader.get(0)
  if ("error" in first) return first
  const available = first.total
  const wanted = Math.min(limit, available)
  const lastIndex = Math.max(0, Math.ceil(wanted / DLD_SEARCH_CHUNK) - 1)

  const chunks: CachedChunk[] = [first]
  for (let start = 1; start <= lastIndex; start += concurrency) {
    const indices = Array.from({ length: Math.min(concurrency, lastIndex - start + 1) }, (_, i) => start + i)
    const results = await Promise.all(indices.map((i) => reader.get(i)))
    for (const r of results) {
      if ("error" in r) return r
      chunks.push(r)
    }
  }
  return { rows: chunks.flatMap((c) => c.rows).slice(0, wanted), available }
}
