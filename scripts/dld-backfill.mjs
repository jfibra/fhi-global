/**
 * Backfills the Dubai Land Department archive (migration 065) by walking a
 * date range week by week and calling /api/cron/dld-ingest for each window.
 *
 * It drives the route rather than re-implementing it, so there is exactly one
 * copy of the gateway logic, and every call stays inside the 60s serverless
 * ceiling the route is built for.
 *
 * This is time-sensitive work. The gateway only serves the CURRENT calendar
 * year — 2025 already returns zero rows — so 2026 must be captured before it
 * rolls off on 1 Jan 2027. It cannot be backfilled afterwards.
 *
 * Resumable: a window already recorded 'ok' in dld_ingest_runs is skipped, so
 * an interrupted run picks up where it stopped. Windows the route rejects as
 * too large (HTTP 413) are split in half and retried.
 *
 * Usage:
 *   node scripts/dld-backfill.mjs --dry
 *   node scripts/dld-backfill.mjs --from=01/01/2026 --to=09/28/2026
 *   node scripts/dld-backfill.mjs --base-url=https://fhiglobal.ae
 *
 * Flags:
 *   --from=MM/DD/YYYY   start (default 01/01/2026 — the gateway holds no earlier)
 *   --to=MM/DD/YYYY     end (default today)
 *   --dataset=a,b       transactions|projects|developers|areas (default all)
 *   --weeks=N           window size in days (default 7)
 *   --base-url=URL      target app (default http://localhost:3000)
 *   --dry               fetch and map, write nothing
 *   --force             re-run windows already recorded 'ok'
 *
 * Requires CRON_SECRET when targeting a deployed app, and DATABASE_URL for
 * resume support (without it, every window is attempted).
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

loadDotEnv()

const args = new Map()
for (const arg of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(arg)
  if (m) args.set(m[1], m[2] ?? "true")
}

const DRY = args.has("dry")
const FORCE = args.has("force")
const BASE_URL = (args.get("base-url") ?? "http://localhost:3000").replace(/\/+$/, "")
const DATASET = args.get("dataset") ?? ""
const WINDOW_DAYS = Math.max(1, Number.parseInt(args.get("weeks") ?? "7", 10) || 7)
const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? ""

function parseDldDate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])))
  return Number.isNaN(d.getTime()) ? null : d
}

function fmt(d) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

function addDays(d, n) {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + n)
  return out
}

const fromArg = args.get("from") ?? "01/01/2026"
const toArg = args.get("to") ?? fmt(new Date())
const START = parseDldDate(fromArg)
const END = parseDldDate(toArg)

if (!START || !END) {
  console.error("--from and --to must be MM/DD/YYYY.")
  process.exit(1)
}
if (START > END) {
  console.error("--from is after --to.")
  process.exit(1)
}
if (!CRON_SECRET && !BASE_URL.startsWith("http://localhost")) {
  console.error("CRON_SECRET is required when targeting a deployed app.")
  process.exit(1)
}

/** Windows already recorded 'ok', so a resumed run skips them. */
async function loadCompleted() {
  if (FORCE) return new Set()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn("! DATABASE_URL unset — cannot skip completed windows; attempting all.\n")
    return new Set()
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  })
  try {
    await client.connect()
    const { rows } = await client.query(
      "SELECT command, window_key FROM public.dld_ingest_runs WHERE status = 'ok'",
    )
    return new Set(rows.map((r) => `${r.command}:${r.window_key}`))
  } catch (e) {
    console.warn(`! Could not read dld_ingest_runs (${e.message}); attempting all windows.\n`)
    return new Set()
  } finally {
    await client.end().catch(() => {})
  }
}

async function ingest(from, to) {
  const url = new URL(`${BASE_URL}/api/cron/dld-ingest`)
  url.searchParams.set("from", from)
  url.searchParams.set("to", to)
  if (DATASET) url.searchParams.set("dataset", DATASET)
  if (DRY) url.searchParams.set("dry", "1")

  const res = await fetch(url, {
    headers: CRON_SECRET ? { authorization: `Bearer ${CRON_SECRET}` } : {},
  })
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

/** One window, with retry on upstream flakiness and halving on 413. */
async function runWindow(from, to, depth = 0) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { status, body } = await ingest(from, to)

    if (status === 413 && depth < 4) {
      const start = parseDldDate(from)
      const end = parseDldDate(to)
      const days = Math.round((end - start) / 86_400_000)
      if (days >= 1) {
        const mid = addDays(start, Math.floor(days / 2))
        console.log(`    window too large, splitting`)
        const a = await runWindow(from, fmt(mid), depth + 1)
        const b = await runWindow(fmt(addDays(mid, 1)), to, depth + 1)
        return { ok: a.ok && b.ok, seen: a.seen + b.seen, written: a.written + b.written }
      }
    }

    if (status === 200 && body?.ok) {
      const seen = (body.results ?? []).reduce((n, r) => n + (r.rowsSeen ?? 0), 0)
      const written = (body.results ?? []).reduce((n, r) => n + (r.rowsWritten ?? 0), 0)
      return { ok: true, seen, written }
    }

    const detail =
      body?.error ?? (body?.results ?? []).find((r) => r.error)?.error ?? `HTTP ${status}`
    if (attempt < 3 && (status === 502 || status === 504 || status >= 500)) {
      console.log(`    attempt ${attempt} failed (${detail}); retrying`)
      await new Promise((r) => setTimeout(r, 4000 * attempt))
      continue
    }
    return { ok: false, seen: 0, written: 0, error: detail }
  }
  return { ok: false, seen: 0, written: 0, error: "exhausted retries" }
}

async function main() {
  const completed = await loadCompleted()

  const windows = []
  for (let cursor = START; cursor <= END; cursor = addDays(cursor, WINDOW_DAYS)) {
    const end = addDays(cursor, WINDOW_DAYS - 1)
    windows.push([fmt(cursor), fmt(end > END ? END : end)])
  }

  console.log(
    `DLD backfill — ${windows.length} window(s) of ${WINDOW_DAYS}d, ${fmt(START)} → ${fmt(END)}` +
      `\n  target  ${BASE_URL}` +
      `\n  dataset ${DATASET || "all"}` +
      `${DRY ? "\n  DRY RUN — nothing will be written" : ""}\n`,
  )

  let totalSeen = 0
  let totalWritten = 0
  let skipped = 0
  const failures = []

  for (const [index, [from, to]] of windows.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${windows.length}] ${from}..${to}`

    // Transactions is the dataset with real per-window volume; if its window is
    // already done, treat the whole window as done.
    if (!FORCE && !DRY && completed.has(`transactions:${from}..${to}`)) {
      console.log(`${label}  skipped (already ingested)`)
      skipped++
      continue
    }

    process.stdout.write(`${label}  … `)
    const started = Date.now()
    const result = await runWindow(from, to)
    const secs = ((Date.now() - started) / 1000).toFixed(1)

    if (result.ok) {
      totalSeen += result.seen
      totalWritten += result.written
      console.log(`${result.seen} rows seen, ${result.written} written (${secs}s)`)
    } else {
      failures.push({ from, to, error: result.error })
      console.log(`FAILED — ${result.error} (${secs}s)`)
    }
  }

  console.log(
    `\nDone. ${totalSeen} rows seen, ${totalWritten} written, ${skipped} window(s) skipped.`,
  )
  if (failures.length > 0) {
    console.error(`\n${failures.length} window(s) failed:`)
    for (const f of failures) console.error(`  ${f.from}..${f.to} — ${f.error}`)
    console.error(`\nRe-run to retry only the failed windows.`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
