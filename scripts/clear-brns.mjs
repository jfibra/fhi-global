/**
 * One-off: clear every saved RERA BRN (profiles.metadata.license_number).
 *
 * Why (boss, 2026-11-09): BRNs used to be typed in without any check, so the
 * saved ones can't be trusted. After this runs, everyone is sent to their
 * profile page (lib/brn-required.ts) on their next dashboard visit to save
 * a BRN the Dubai Land Department register has — or ticks "I'm not a broker".
 *
 * Safe by design:
 *   - DRY RUN by default: reads only, prints who has a BRN.
 *   - --apply needs --expect N and refuses unless exactly N profiles hold a
 *     BRN, so what is cleared is exactly the list that was reviewed.
 *   - Before clearing it writes a backup (id + BRN) to --backup (default
 *     brn-backup-<timestamp>.json); --rollback <file> puts them back, only on
 *     profiles that still have no BRN and haven't ticked "I'm not a broker".
 *   - Each row is re-read right before it's written, so other metadata saved
 *     meanwhile is never lost. "I'm not a broker" (metadata.not_broker) is
 *     left alone. The `brokers` table (DLD copies) is not touched.
 *   - NOT a migration on purpose: the migration runner re-applies every file on
 *     every run and would keep wiping BRNs people save later.
 *
 * Usage (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local;
 * dev and prod share one Supabase project, so --apply writes to production):
 *   node scripts/clear-brns.mjs
 *   node scripts/clear-brns.mjs --apply --expect 42 [--backup brn-backup.json]
 *   node scripts/clear-brns.mjs --rollback brn-backup-2026-11-09T10-00-00.json
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadDotEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, d = null) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d
}

const brnOf = (metadata) => {
  const v = metadata?.license_number
  if (typeof v === "number") return String(v)
  return typeof v === "string" && v.trim() ? v.trim() : null
}
const nameOf = (p) =>
  (typeof p.fullname === "string" && p.fullname.trim()) ||
  [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ") ||
  "Unnamed account"

loadDotEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function profilesWithBrn() {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("profiles")
      .select("id, fullname, fname, lname, role, metadata")
      .order("id")
      .range(from, from + 999)
    if (error) throw new Error(`Reading profiles failed: ${error.message}`)
    for (const p of data ?? []) {
      const brn = brnOf(p.metadata)
      if (brn) out.push({ id: p.id, name: nameOf(p), role: p.role, brn })
    }
    if (!data || data.length < 1000) break
  }
  return out
}

async function writeMetadata(id, change) {
  const { data, error } = await db.from("profiles").select("metadata").eq("id", id).maybeSingle()
  if (error || !data) return `read failed${error ? `: ${error.message}` : ""}`
  const next = change(data.metadata ?? {})
  if (!next) return "skipped"
  const { error: upErr } = await db.from("profiles").update({ metadata: next }).eq("id", id)
  return upErr ? `write failed: ${upErr.message}` : "ok"
}

async function main() {
  const rollbackFile = opt("rollback")
  if (rollbackFile) {
    const rows = JSON.parse(fs.readFileSync(path.resolve(rollbackFile), "utf8"))
    let restored = 0
    for (const r of rows) {
      const res = await writeMetadata(r.id, (m) =>
        brnOf(m) || m.not_broker === true ? null : { ...m, license_number: r.brn },
      )
      if (res === "ok") restored++
      else if (res !== "skipped") console.error(`  ${r.id} (${r.name}): ${res}`)
    }
    console.log(`Rollback: restored ${restored} of ${rows.length} BRNs (the rest already have a new answer).`)
    return
  }

  const list = await profilesWithBrn()
  console.log(`${list.length} profile(s) have a saved BRN:\n`)
  for (const p of list) console.log(`  ${p.brn.padEnd(10)}  ${p.name}  (${p.role ?? "no role"})  ${p.id}`)

  if (!flag("apply")) {
    console.log(`\nDry run — nothing changed. To clear them: node scripts/clear-brns.mjs --apply --expect ${list.length}`)
    return
  }
  const expect = Number(opt("expect"))
  if (!Number.isInteger(expect) || expect !== list.length) {
    console.error(`\nRefusing: --expect ${opt("expect") ?? "(missing)"} doesn't match the ${list.length} found. Re-run the dry run and check the list.`)
    process.exit(1)
  }

  const backup = path.resolve(opt("backup", `brn-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`))
  fs.writeFileSync(backup, JSON.stringify(list, null, 2))
  console.log(`\nBackup written: ${backup}`)

  let cleared = 0
  for (const p of list) {
    const res = await writeMetadata(p.id, (m) => (brnOf(m) ? { ...m, license_number: null } : null))
    if (res === "ok") cleared++
    else if (res !== "skipped") console.error(`  ${p.id} (${p.name}): ${res}`)
  }
  console.log(`Cleared ${cleared} of ${list.length} BRNs. Undo: node scripts/clear-brns.mjs --rollback ${path.relative(process.cwd(), backup)}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
