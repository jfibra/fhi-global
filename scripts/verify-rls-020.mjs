/**
 * Dry-run verifier for migration 020 (sales RLS).
 *
 * Applies the migration inside a transaction, impersonates each role the way
 * PostgREST does (SET ROLE + request.jwt.claims), checks what each one can
 * read and write, then ROLLS BACK. Nothing is persisted — this is safe to run
 * against production, and is how the policies were validated before shipping.
 *
 *   node scripts/verify-rls-020.mjs
 */
import fs from "node:fs"
import pg from "pg"

const envFile = [".env.local", ".env"].find((f) => fs.existsSync(f))
const env = fs.readFileSync(envFile, "utf8")
const get = (k) =>
  ((env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "")

const sql = fs
  .readFileSync("supabase/migrations/020_sales_rls.sql", "utf8")
  // The outer transaction is managed here so everything can be rolled back.
  .replace(/^\s*BEGIN;\s*$/m, "")
  .replace(/^\s*COMMIT;\s*$/m, "")

const client = new pg.Client({
  connectionString: get("DATABASE_URL"),
  ssl: { rejectUnauthorized: false },
})

/** Run `fn` as the given user id, exactly as PostgREST would. */
async function asUser(uid, role, fn) {
  await client.query("SET LOCAL ROLE " + role)
  await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role }),
  ])
  const out = await fn()
  await client.query("RESET ROLE")
  return out
}

const count = async (table) => {
  try {
    const r = await client.query(`SELECT count(*)::int AS n FROM public.${table}`)
    return String(r.rows[0].n)
  } catch (e) {
    return "ERR:" + e.message.slice(0, 40)
  }
}

/**
 * Attempt to destroy EVERY row of `table`, report how many it actually got,
 * then undo it. A filter matching no rows proves nothing: RLS silently
 * filters rows rather than raising, so a no-op delete always "succeeds".
 * Rolling back to the savepoint means the rows survive regardless.
 */
const tryDestroy = async (verb, table) => {
  try {
    await client.query("SAVEPOINT w")
    const r =
      verb === "delete"
        ? await client.query(`DELETE FROM public.${table}`)
        : await client.query(`UPDATE public.${table} SET updated_at = now()`)
    await client.query("ROLLBACK TO SAVEPOINT w")
    return r.rowCount > 0 ? `WIPED ${r.rowCount}` : "0 rows"
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT w")
    return e.message.includes("row-level security") || e.message.includes("permission")
      ? "blocked"
      : "err:" + e.message.slice(0, 24)
  }
}

/**
 * Can this user record a sale, the way createSale does — first the client row,
 * then the sale pointing at it? client_id is NOT NULL, so both halves have to
 * pass their policies for this to succeed.
 */
const tryInsertSale = async (uid, forAgentId) => {
  try {
    await client.query("SAVEPOINT i")
    // RETURNING on purpose: createSale reads the new client's id back, and a
    // policy that hides it breaks sale encoding even though the insert works.
    const c = await client.query(
      `INSERT INTO public.clients (first_name, last_name) VALUES ('RLS','Probe') RETURNING id`,
    )
    await client.query(
      `INSERT INTO public.sales_reports (agent_id, client_id, sale_type, contract_price, created_by, updated_by)
       VALUES ($1, $2, 'brokerage', 1, $1, $1)`,
      [forAgentId ?? uid, c.rows[0].id],
    )
    await client.query("ROLLBACK TO SAVEPOINT i")
    return "yes"
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT i")
    return e.message.includes("row-level security") ? "blocked" : "err:" + e.message.slice(0, 22)
  }
}

await client.connect()
await client.query("BEGIN")

try {
  await client.query(sql)
  console.log("migration applied inside transaction\n")

  // Pick one real user per role, plus the agent who actually owns the sale.
  const pick = async (role) =>
    (
      await client.query(
        `SELECT id, COALESCE(fullname,'(unnamed)') AS name FROM public.profiles
         WHERE LOWER(TRIM(role)) = $1 AND status = 'active' AND is_deleted IS NOT TRUE LIMIT 1`,
        [role],
      )
    ).rows[0]

  const owner = (
    await client.query(
      `SELECT p.id, COALESCE(p.fullname,'(unnamed)') AS name
       FROM public.sales_reports s JOIN public.profiles p ON p.id = s.agent_id LIMIT 1`,
    )
  ).rows[0]

  const subjects = [
    ["owning agent", owner, "authenticated"],
    ["another agent", await pick("agent"), "authenticated"],
    ["secretary", await pick("secretary"), "authenticated"],
    ["admin", await pick("admin"), "authenticated"],
    ["member", await pick("member"), "authenticated"],
    ["LOGGED OUT (anon)", { id: null, name: "-" }, "anon"],
  ]

  const totals = {
    sales: await count("sales_reports"),
    clients: await count("clients"),
    attach: await count("sales_attachments"),
    profiles: await count("profiles"),
  }
  console.log("as superuser (ground truth):", JSON.stringify(totals), "\n")

  const rows = []
  for (const [label, who, role] of subjects) {
    if (!who) {
      rows.push({ who: label + " (none in db)", sales: "-", clients: "-", attach: "-", profiles: "-", "del sale": "-" })
      continue
    }
    const r = await asUser(who.id, role, async () => ({
      who: `${label}`,
      sales: await count("sales_reports"),
      clients: await count("clients"),
      attach: await count("sales_attachments"),
      profiles: await count("profiles"),
      "del sales": await tryDestroy("delete", "sales_reports"),
      "del clients": await tryDestroy("delete", "clients"),
      "edit sales": await tryDestroy("update", "sales_reports"),
      "add own sale": await tryInsertSale(who.id),
      // The forged case: recording a sale under somebody else's name. Target
      // someone who is definitely not the subject, or the test proves nothing.
      "add sale AS OTHER": await tryInsertSale(
        who.id,
        owner && owner.id !== who.id ? owner.id : "11111111-1111-1111-1111-111111111111",
      ),
      "del attach": await tryDestroy("delete", "sales_attachments"),
    }))
    rows.push(r)
  }
  console.table(rows)
} catch (e) {
  console.error("FAILED:", e.message)
} finally {
  await client.query("ROLLBACK")
  await client.end()
  console.log("\nrolled back — database unchanged")
}
