/**
 * One-off backfill: put recruits on their recruiter's team.
 *
 * Why: since 2026-10-02 a new recruit joins their recruiter's team on sign-up
 * (lib/recruit-team.ts), but the email-code sign-up path never called it, so
 * every recruit who registered by email code sits in the recruiter's invite
 * network yet is missing from the formal team list (Team Sales, the admin Teams
 * page, FHI Assistant and the Team Performance Report all count the formal list).
 * The code now joins them; this script catches up the ones already missed.
 *
 * Rule (the same one the sign-up code applies): a person with an inviter, no
 * ACTIVE team membership, and a sign-up date on or after --since joins their
 * DIRECT inviter's active team. Top-down: a recruit of a recruit joins the
 * team their inviter was just placed in. Developers are never placed.
 *
 * Safe by design:
 *   - DRY RUN by default: reads only, prints the plan, optionally writes a CSV.
 *   - --apply needs --expect N and refuses to run unless the plan has exactly N
 *     people, so what is written is exactly the list that was reviewed.
 *   - Inserts only for people who STILL have no active membership at write time,
 *     so it never moves someone an admin placed meanwhile; safe to re-run.
 *   - Every row carries a marker in transfer_reason and the person's real
 *     sign-up date as joined_at; --rollback removes exactly those rows.
 *   - NOT a migration on purpose: the migration runner re-applies every file on
 *     every run and would keep re-adding anyone an admin removes later.
 *
 * Usage (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local;
 * note dev and prod share one Supabase project, so --apply writes to production):
 *   node scripts/backfill-recruit-teams.mjs [--since 2026-10-02] [--exclude-roles global_partner,member] [--csv out.csv]
 *   node scripts/backfill-recruit-teams.mjs --apply --expect 202
 *   node scripts/backfill-recruit-teams.mjs --rollback
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const MARKER = "Backfill 2026-11-05: joined their recruiter's team (the email sign-up never added them)"

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

// Mirrors teamRoleFor() in lib/recruit-team.ts — keep the two in step.
function teamRoleFor(accountRole) {
  switch ((accountRole ?? "").toLowerCase()) {
    case "team_leader": return "Team Leader"
    case "unit_manager": return "Unit Manager"
    case "agent":
    case "global_partner": return "Agent"
    case "secretary":
    case "team_secretary": return "Secretary"
    default: return "Member"
  }
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null)
const nameOf = (p) => str(p.fullname) ?? ([p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ") || "Unnamed account")
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`

async function fetchAll(build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

loadDotEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
  process.exit(1)
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// ---------------------------------------------------------------- rollback
if (flag("rollback")) {
  const { data, error } = await admin.from("team_memberships").delete().eq("transfer_reason", MARKER).select("id")
  if (error) { console.error("Rollback failed:", error.message); process.exit(1) }
  console.log(`Rolled back: ${data?.length ?? 0} backfilled membership rows removed.`)
  process.exit(0)
}

// ---------------------------------------------------------------- plan
const since = opt("since", "2026-10-02")
const excluded = new Set((opt("exclude-roles", "") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))

const teams = await fetchAll(() => admin.from("teams").select("id, name, is_active").order("id"))
const activeTeam = new Map(teams.filter((t) => t.is_active).map((t) => [t.id, t]))
const memberships = await fetchAll(() => admin.from("team_memberships").select("user_id, team_id, joined_at").is("left_at", null).order("id"))
const teamOfUser = new Map()
for (const m of [...memberships].sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)))) {
  if (activeTeam.has(m.team_id)) teamOfUser.set(m.user_id, m.team_id) // the latest active membership wins, as in joinInvitersTeam
}
const profiles = await fetchAll(() =>
  admin.from("profiles").select("id, fullname, fname, lname, role, status, joined_at, metadata").not("is_deleted", "is", true).order("id"),
)
const byId = new Map(profiles.map((p) => [p.id, p]))
const inviterOf = (p) => {
  const meta = p.metadata ?? {}
  const by = str(meta.invited_by)
  return by && !str(meta.developer_invite_id) ? by : null
}

const isCandidate = (p) =>
  !!inviterOf(p) &&
  !teamOfUser.has(p.id) &&
  (p.role ?? "").toLowerCase() !== "developer" &&
  !excluded.has((p.role ?? "").toLowerCase()) &&
  String(p.joined_at ?? "").slice(0, 10) >= since

// Where does this person's DIRECT inviter stand? Their team, or (when the inviter is
// themselves being placed) the team the inviter is planned into. Memoised, cycle-safe.
const planned = new Map()
const state = new Map() // id -> "visiting" | "done"
function placeOf(id) {
  if (teamOfUser.has(id)) return teamOfUser.get(id)
  if (planned.has(id)) return planned.get(id)
  return null
}
function plan(p) {
  if (state.get(p.id) === "done") return
  if (state.get(p.id) === "visiting") return // a cycle in invited_by: leave unplaced
  state.set(p.id, "visiting")
  const inviter = byId.get(inviterOf(p))
  if (inviter && isCandidate(inviter)) plan(inviter)
  const team = inviter ? placeOf(inviter.id) : null
  if (team) planned.set(p.id, team)
  state.set(p.id, "done")
}
const candidates = profiles.filter(isCandidate)
for (const p of candidates) plan(p)

const placed = candidates.filter((p) => planned.has(p.id))
const unplaced = candidates.filter((p) => !planned.has(p.id))
const teamName = (id) => activeTeam.get(id)?.name ?? id
const count = (arr, f) => {
  const o = {}
  for (const x of arr) { const k = f(x); o[k] = (o[k] ?? 0) + 1 }
  return o
}
const dates = placed.map((p) => String(p.joined_at).slice(0, 10)).sort()
const { data: past } = placed.length
  ? await admin.from("team_memberships").select("user_id").in("user_id", placed.map((p) => p.id)).not("left_at", "is", null)
  : { data: [] }

console.log(`Backfill plan — sign-ups since ${since}${excluded.size ? `, excluding roles: ${[...excluded].join(", ")}` : ""}`)
console.log("  people to place:                  ", placed.length)
console.log("  cannot be placed (inviter has no team):", unplaced.length)
console.log("  per team:                         ", JSON.stringify(count(placed, (p) => teamName(planned.get(p.id)))))
console.log("  by account role → team role:      ", JSON.stringify(count(placed, (p) => `${p.role}→${teamRoleFor(p.role)}`)))
console.log("  by status:                        ", JSON.stringify(count(placed, (p) => p.status ?? "pending")))
console.log("  sign-up dates:                    ", dates.length ? `${dates[0]} … ${dates.at(-1)}` : "—")
console.log("  with an ENDED earlier membership: ", new Set((past ?? []).map((r) => r.user_id)).size, "(someone removed earlier — worth a look before applying)")

if (unplaced.length) {
  const who = count(unplaced, (p) => {
    const inv = byId.get(inviterOf(p))
    return inv ? `${nameOf(inv)} (${inv.role}, ${inv.status})` : "inviter account missing or deleted"
  })
  console.log("  not placed, by inviter (none of them is on a team, so there is nothing to join):")
  for (const [k, v] of Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`      ${String(v).padStart(3)}  ${k}`)
}

const csvPath = opt("csv")
if (csvPath) {
  const head = ["name", "account_role", "team_role", "status", "signed_up", "invited_by", "inviter_account_role", "team"]
  const lines = [head.join(",")]
  for (const p of placed.sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)))) {
    const inv = byId.get(inviterOf(p))
    lines.push([nameOf(p), p.role, teamRoleFor(p.role), p.status, String(p.joined_at).slice(0, 10), inv ? nameOf(inv) : "", inv?.role ?? "", teamName(planned.get(p.id))].map(csvCell).join(","))
  }
  fs.writeFileSync(csvPath, lines.join("\n") + "\n")
  console.log("  review list written to:           ", csvPath)
}

if (!flag("apply")) {
  console.log("\nDRY RUN — nothing was written. To apply: --apply --expect", placed.length)
  process.exit(0)
}

// ---------------------------------------------------------------- apply
const expect = Number(opt("expect"))
if (!Number.isInteger(expect) || expect !== placed.length) {
  console.error(`\nRefusing to apply: --expect must equal the planned count (${placed.length}); got ${opt("expect") ?? "nothing"}.`)
  process.exit(1)
}

let inserted = 0
let skipped = 0
const todo = placed.map((p) => ({ p, team: planned.get(p.id) }))
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50)
  // Re-check at write time: anyone who got a team since the plan was drawn is left alone.
  const { data: nowHeld, error: heldError } = await admin
    .from("team_memberships").select("user_id").in("user_id", chunk.map((c) => c.p.id)).is("left_at", null)
  if (heldError) { console.error("Stopped:", heldError.message); process.exit(1) }
  const held = new Set((nowHeld ?? []).map((r) => r.user_id))
  const rows = chunk
    .filter((c) => !held.has(c.p.id))
    .map((c) => ({ user_id: c.p.id, team_id: c.team, role_in_team: teamRoleFor(c.p.role), joined_at: c.p.joined_at ?? new Date().toISOString(), transfer_reason: MARKER }))
  skipped += chunk.length - rows.length
  if (!rows.length) continue
  const { error } = await admin.from("team_memberships").insert(rows)
  if (error) { console.error(`Stopped after ${inserted} rows — chunk starting at ${i} failed: ${error.message}`); process.exit(1) }
  inserted += rows.length
}
console.log(`\nApplied: ${inserted} memberships added, ${skipped} skipped (already on a team by now).`)
console.log("Undo with: node scripts/backfill-recruit-teams.mjs --rollback")
