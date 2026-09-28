import "server-only"
import { createHash } from "node:crypto"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { DldRow } from "@/lib/dld-open-data"

/**
 * Postgres-backed cache of DLD open-data chunks (table dld_open_data_cache,
 * migration 064). A chunk is one aligned page of a sorted, filtered result
 * set: rows [index * size, (index + 1) * size) for a given dataset, filter
 * body and sort. Both the column "contains" scan and the sort-aware number
 * lookup in app/api/admin/dld/[command] read through this, so a chunk pulled
 * for one is reused by the other, by every admin, on every server instance.
 *
 * Failures here are never fatal: a cache miss or a write error just means
 * the gateway is called again.
 */

/** How long a stored chunk is trusted. DLD publishes daily; six hours keeps
 *  repeat searches instant within a working session without going stale. */
export const DLD_CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** Prune expired rows on roughly one write in this many. */
const PRUNE_EVERY = 25
let writesSincePrune = 0

export interface CachedChunk {
  rows: DldRow[]
  /** The gateway's total for the filter body at fetch time. */
  total: number
}

/** Stable key: dataset + the filter/sort body (paging excluded) + chunk index. */
export function chunkKey(command: string, body: Record<string, string>, chunkIndex: number, chunkSize: number): string {
  const { P_SKIP: _skip, P_TAKE: _take, ...rest } = body
  void _skip
  void _take
  const canonical = JSON.stringify(
    Object.keys(rest)
      .sort()
      .map((k) => [k, rest[k]]),
  )
  const digest = createHash("sha256").update(`${command}|${chunkSize}|${canonical}`).digest("hex").slice(0, 32)
  return `${command}:${digest}:${chunkIndex}`
}

export async function readChunk(key: string): Promise<CachedChunk | null> {
  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from("dld_open_data_cache")
      .select("rows, total, fetched_at")
      .eq("cache_key", key)
      .maybeSingle<{ rows: DldRow[]; total: number; fetched_at: string }>()
    if (error || !data) return null
    if (Date.now() - new Date(data.fetched_at).getTime() > DLD_CACHE_TTL_MS) return null
    return { rows: Array.isArray(data.rows) ? data.rows : [], total: data.total }
  } catch {
    return null
  }
}

export async function writeChunk(key: string, command: string, chunkIndex: number, chunk: CachedChunk): Promise<void> {
  try {
    const supabase = createAdminSupabase()
    await supabase.from("dld_open_data_cache").upsert(
      {
        cache_key: key,
        command,
        chunk_index: chunkIndex,
        row_count: chunk.rows.length,
        total: chunk.total,
        rows: chunk.rows,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    )
    if (++writesSincePrune >= PRUNE_EVERY) {
      writesSincePrune = 0
      const cutoff = new Date(Date.now() - DLD_CACHE_TTL_MS).toISOString()
      await supabase.from("dld_open_data_cache").delete().lt("fetched_at", cutoff)
    }
  } catch {
    /* cache is best-effort */
  }
}
