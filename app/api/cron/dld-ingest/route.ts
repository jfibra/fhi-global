import { NextResponse, type NextRequest } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { DLD_DATASETS, DLD_SEARCH_CHUNK, toDldDate, type DldRow } from "@/lib/dld-open-data"
import { asRows, buildGatewayBody, callGateway, gatewayTotal } from "@/lib/dld-gateway"
import {
  mapArea,
  mapDeveloper,
  mapProject,
  mapTransaction,
  upsertRows,
  type ArchiveRow,
} from "@/lib/dld-archive"

/**
 * Ingests Dubai Land Department open data into the archive tables (migration
 * 065). 6:00 AM Dubai daily via vercel.json ("0 2 * * *" UTC).
 *
 * The gateway only serves the current calendar year — 2025 already returns
 * nothing — so this is the only way FHI accumulates Dubai transaction history.
 * Missing a run is recoverable; missing a year is not.
 *
 * One code path, two callers:
 *   • no ?from/?to  → the last INGEST_OVERLAP_DAYS days. This is the cron.
 *   • ?from=&to=    → exactly that window. This is scripts/dld-backfill.mjs
 *                     walking 2026 a week at a time.
 * The overlap is deliberate: the gateway's date filter does not line up
 * exactly with INSTANCE_DATE, and DLD posts some transactions late. Re-reading
 * days already held is free because the primary key is a content hash, so the
 * upsert is an exact no-op.
 *
 * Auth matches the other two crons: Vercel sends
 * "Authorization: Bearer $CRON_SECRET"; manual runs can pass ?secret=.
 * ?dry=1 fetches and maps but writes nothing (safe in prod).
 */

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

/** Days of re-read on an unwindowed (cron) run. */
const INGEST_OVERLAP_DAYS = 7

/**
 * Chunks one invocation will pull before giving up. Each is ~4s against the
 * gateway, so 12 is roughly 48s — inside the 60s ceiling with room to write.
 * A window needing more is REJECTED rather than truncated: silently archiving
 * part of a window would leave a permanent hole that no later run would fix.
 */
const MAX_CHUNKS_PER_RUN = 12

type IngestTarget = "transactions" | "projects" | "developers" | "areas"
const ALL_TARGETS: IngestTarget[] = ["areas", "developers", "projects", "transactions"]

const TABLES: Record<IngestTarget, { table: string; conflict: string }> = {
  transactions: { table: "dld_transactions", conflict: "row_hash" },
  projects: { table: "dld_projects", conflict: "project_number" },
  developers: { table: "dld_developers", conflict: "developer_number" },
  areas: { table: "dld_areas", conflict: "area_id" },
}

const MAPPERS: Record<IngestTarget, (row: DldRow) => ArchiveRow | null> = {
  transactions: mapTransaction,
  projects: mapProject,
  developers: mapDeveloper,
  areas: mapArea,
}

function isTarget(value: string): value is IngestTarget {
  return (ALL_TARGETS as string[]).includes(value)
}

/** MM/DD/YYYY, the only format the gateway accepts. */
function isDldDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value)
}

/** Pages a filtered result set out of the gateway, refusing to truncate. */
async function pullAll(
  command: string,
  body: Record<string, string>,
): Promise<{ ok: true; rows: DldRow[]; total: number } | { ok: false; status: number; message: string }> {
  const rows: DldRow[] = []
  let total = 0

  for (let index = 0; index < MAX_CHUNKS_PER_RUN; index++) {
    const upstream = await callGateway(command, {
      ...body,
      P_SKIP: String(index * DLD_SEARCH_CHUNK),
      P_TAKE: String(DLD_SEARCH_CHUNK),
    })
    if (!upstream.ok) return { ok: false, status: upstream.status, message: upstream.message }

    const chunk = asRows(upstream.result)
    if (index === 0) {
      total = gatewayTotal(chunk)
      const needed = Math.ceil(total / DLD_SEARCH_CHUNK)
      if (needed > MAX_CHUNKS_PER_RUN) {
        return {
          ok: false,
          status: 413,
          message: `Window holds ${total} rows (${needed} chunks), over the ${MAX_CHUNKS_PER_RUN}-chunk budget for one run. Narrow the date range.`,
        }
      }
    }

    rows.push(...chunk)
    if (chunk.length < DLD_SEARCH_CHUNK || rows.length >= total) break
  }

  return { ok: true, rows, total }
}

/**
 * The gateway body for a target. Dates are ignored by the areas lookup.
 *
 * Projects and developers are registers, not a stream: the gateway only
 * serves the current calendar year of them (a few hundred rows), and the
 * project → developer lookup behind the Developers Breakdown tab needs ALL
 * of this year's projects, not the ones that happened to START in the last
 * week. So those two always pull from 1 January of the window's year to the
 * window's end, whatever `from` the caller passed. (Before this, a nightly
 * run with the 7-day transaction window archived almost no projects, and
 * the register matched 1 transaction in 10,930.)
 */
function bodyFor(target: IngestTarget, from: string, to: string): { ok: true; body: Record<string, string> } | { ok: false; error: string } {
  if (target === "areas") return { ok: true, body: {} }

  const dataset = DLD_DATASETS[target]
  const registerFrom = target === "projects" || target === "developers" ? `01/01/${to.slice(-4)}` : from
  const incoming: Record<string, string> = { P_FROM_DATE: registerFrom, P_TO_DATE: to }
  // Projects declare a date-type selector with no default in the catalog;
  // 1 = Start Date, which is what the DLD site itself submits.
  if (target === "projects") incoming.P_DATE_TYPE = "1"

  const built = buildGatewayBody(dataset, incoming)
  if (!built.ok) return { ok: false, error: built.error }
  built.body.P_SORT = dataset.defaultSort
  return { ok: true, body: built.body }
}

interface TargetResult {
  target: IngestTarget
  rowsSeen: number
  rowsWritten: number
  skipped: number
  status: "ok" | "error"
  error?: string
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === "production"
  if (secret) {
    const auth = req.headers.get("authorization")
    const qs = req.nextUrl.searchParams.get("secret")
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else if (isProd) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 })
  }

  const params = req.nextUrl.searchParams
  const dry = params.get("dry") === "1"

  const fromParam = params.get("from")?.trim() ?? ""
  const toParam = params.get("to")?.trim() ?? ""
  if ((fromParam && !isDldDate(fromParam)) || (toParam && !isDldDate(toParam))) {
    return NextResponse.json({ error: "from/to must be MM/DD/YYYY." }, { status: 400 })
  }

  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(defaultFrom.getDate() - INGEST_OVERLAP_DAYS)
  const from = fromParam || toDldDate(defaultFrom)
  const to = toParam || toDldDate(now)

  const datasetParam = params.get("dataset")?.trim()
  let targets: IngestTarget[] = ALL_TARGETS
  if (datasetParam) {
    const requested = datasetParam.split(",").map((s) => s.trim()).filter(Boolean)
    const bad = requested.filter((r) => !isTarget(r))
    if (bad.length > 0) {
      return NextResponse.json({ error: `Unknown dataset(s): ${bad.join(", ")}` }, { status: 400 })
    }
    targets = requested.filter(isTarget)
  }

  const windowKey = `${from}..${to}`
  const supabase = createAdminSupabase()
  const results: TargetResult[] = []

  for (const target of targets) {
    // The lookup has no window of its own; key it by the day it was synced so
    // re-running the cron does not create a new bookkeeping row every time.
    const key = target === "areas" ? `full:${to}` : windowKey

    const built = bodyFor(target, from, to)
    if (!built.ok) {
      results.push({ target, rowsSeen: 0, rowsWritten: 0, skipped: 0, status: "error", error: built.error })
      continue
    }

    const command = target === "areas" ? "carea-lookup" : target
    const pulled = await pullAll(command, built.body)
    if (!pulled.ok) {
      results.push({ target, rowsSeen: 0, rowsWritten: 0, skipped: 0, status: "error", error: pulled.message })
      if (!dry) await recordRun(supabase, target, key, from, to, 0, 0, "error", pulled.message)
      continue
    }

    const mapper = MAPPERS[target]
    const mapped: ArchiveRow[] = []
    for (const row of pulled.rows) {
      const m = mapper(row)
      if (m) mapped.push(m)
    }
    const skipped = pulled.rows.length - mapped.length

    if (dry) {
      results.push({ target, rowsSeen: pulled.rows.length, rowsWritten: 0, skipped, status: "ok" })
      continue
    }

    try {
      const { table, conflict } = TABLES[target]
      const written = await upsertRows(supabase, table, mapped, conflict)
      results.push({ target, rowsSeen: pulled.rows.length, rowsWritten: written, skipped, status: "ok" })
      await recordRun(supabase, target, key, from, to, pulled.rows.length, written, "ok", null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upsert failed."
      results.push({ target, rowsSeen: pulled.rows.length, rowsWritten: 0, skipped, status: "error", error: message })
      await recordRun(supabase, target, key, from, to, pulled.rows.length, 0, "error", message)
    }
  }

  const failed = results.filter((r) => r.status === "error")
  return NextResponse.json(
    { window: { from, to }, dry, results, ok: failed.length === 0 },
    { status: failed.length > 0 ? 500 : 200 },
  )
}

async function recordRun(
  supabase: ReturnType<typeof createAdminSupabase>,
  command: string,
  windowKey: string,
  from: string,
  to: string,
  rowsSeen: number,
  rowsWritten: number,
  status: "ok" | "error",
  error: string | null,
): Promise<void> {
  // MM/DD/YYYY → YYYY-MM-DD for the DATE columns.
  const asDate = (d: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d)
    return m ? `${m[3]}-${m[1]}-${m[2]}` : null
  }
  await supabase.from("dld_ingest_runs").upsert(
    {
      command,
      window_key: windowKey,
      window_from: asDate(from),
      window_to: asDate(to),
      rows_seen: rowsSeen,
      rows_written: rowsWritten,
      status,
      error,
      finished_at: new Date().toISOString(),
    },
    { onConflict: "command,window_key" },
  )
}
