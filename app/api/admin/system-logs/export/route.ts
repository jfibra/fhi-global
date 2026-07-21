import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Download audit logs as CSV or JSON (optionally date-bounded). Not paginated —
// capped at EXPORT_CAP rows. Reuses the same filter shape as the list route.

export const runtime = "nodejs"

const EXPORT_CAP = 50000

const CSV_COLUMNS = [
  "id",
  "occurred_at",
  "category",
  "event",
  "source",
  "actor_id",
  "actor_role",
  "actor_name",
  "subject_type",
  "subject_id",
  "subject_label",
  "description",
  "ip_address",
  "url",
] as const

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let s = typeof value === "string" ? value : JSON.stringify(value)
  // Neutralize spreadsheet formula injection: audit fields (actor_name,
  // subject_label, description, url, ip) can carry unauthenticated attacker
  // input (e.g. a crafted registration name or Referer). A cell starting with
  // = + - @ or a control char is treated as a formula by Excel/Sheets, so
  // prefix it with an apostrophe to force text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const format = sp.get("format") === "json" ? "json" : "csv"
  const from = sp.get("from") ?? ""
  const to = sp.get("to") ?? ""

  const admin = createAdminSupabase()
  let query = admin
    .from("audit_logs")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(EXPORT_CAP)

  if (from) query = query.gte("occurred_at", `${from}T00:00:00`)
  if (to) query = query.lte("occurred_at", `${to}T23:59:59.999`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `audit-logs-${stamp}.${format}`

  const ctx = requestContextFromRequest(req)
  await logAuditEvent({
    category: "system",
    event: "exported",
    source: "dashboard",
    actor: {
      id: guard.context.userId,
      name: guard.context.profile.fullname,
      role: guard.context.profile.role,
    },
    description: `Exported ${rows.length} audit log(s) as ${format.toUpperCase()}`,
    newValues: { format, from: from || null, to: to || null, count: rows.length },
    ...ctx,
  })

  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  }

  const header = CSV_COLUMNS.join(",")
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))
    .join("\n")
  const csv = `${header}\n${body}`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
