/**
 * Creates supabase/migrations/NNN_snake_case.sql from the next free number.
 *
 * Usage:
 *   npm run db:new-migration -- buy_saved_searches
 *   npm run db:new-migration -- add_listing_alerts
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const migrationsDir = path.join(ROOT, "supabase", "migrations")

const raw = process.argv.slice(2).join("_").replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")

if (!raw) {
  console.error("Usage: npm run db:new-migration -- <short_name>\nExample: npm run db:new-migration -- buy_saved_searches")
  process.exit(1)
}

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true })
}

const existing = fs
  .readdirSync(migrationsDir)
  .filter((f) => /^\d{3}_[^/]+\.sql$/.test(f))
  .map((f) => parseInt(f.slice(0, 3), 10))
  .filter((n) => Number.isFinite(n))

const next = (existing.length ? Math.max(...existing) : 0) + 1
const num = String(next).padStart(3, "0")
const filename = `${num}_${raw.toLowerCase()}.sql`
const full = path.join(migrationsDir, filename)

if (fs.existsSync(full)) {
  console.error("File already exists:", filename)
  process.exit(1)
}

const body = `-- Migration ${num}: ${raw.replace(/_/g, " ")}
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

-- TODO: DDL here (prefer IF NOT EXISTS / idempotent patterns)

COMMIT;
`

fs.writeFileSync(full, body, "utf8")
console.log("Created", path.relative(ROOT, full))
console.log("Edit the file, then run: npm run db:migrate")
