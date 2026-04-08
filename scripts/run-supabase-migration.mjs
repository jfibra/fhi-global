/**
 * Applies incremental SQL migrations in supabase/migrations/.
 *
 * Use this when you add new tables/columns (e.g. buy page saved searches).
 * Your base schema should already exist in Supabase; add only new numbered files.
 *
 * Skipped files: _*.sql (templates), *.example.sql
 *
 * Requires DATABASE_URL (Dashboard → Settings → Database → URI, not the JWT keys).
 *
 * Usage:
 *   npm run db:new-migration -- buy_feature_name
 *   npm run db:migrate
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
    const text = fs.readFileSync(p, "utf8")
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

loadDotEnv()

const migrationsDir = path.join(ROOT, "supabase", "migrations")
if (!fs.existsSync(migrationsDir)) {
  console.error("No supabase/migrations directory found.")
  process.exit(1)
}

const files = fs
  .readdirSync(migrationsDir)
  .filter(
    (f) =>
      f.endsWith(".sql") &&
      !f.startsWith("_") &&
      !f.endsWith(".example.sql")
  )
  .sort()

if (files.length === 0) {
  console.log(`No runnable migrations in supabase/migrations/.
Skipped: files starting with _ (e.g. _TEMPLATE.sql) and *.example.sql.

When you need a new table or column:
  npm run db:new-migration -- short_description
  # edit the new .sql file
  npm run db:migrate
`)
  process.exit(0)
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error(`
Missing DATABASE_URL (required because you have migration files to run).

1. Open Supabase Dashboard → Project Settings → Database.
2. Copy "Connection string" → URI (include password).
3. Add to .env or .env.local:

   DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres

   Prefer direct connection on port 5432 for DDL when possible.
`)
  process.exit(1)
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
})

async function main() {
  await client.connect()
  console.log("Connected. Running migrations…\n")

  for (const file of files) {
    const full = path.join(migrationsDir, file)
    const sql = fs.readFileSync(full, "utf8")
    process.stdout.write(`  → ${file} … `)
    try {
      await client.query(sql)
      console.log("ok")
    } catch (e) {
      console.log("failed")
      console.error(e.message)
      process.exitCode = 1
      break
    }
  }

  await client.end()
  if (process.exitCode === 0) {
    console.log("\nDone.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
