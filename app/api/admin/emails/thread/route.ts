import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession, requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// The correspondence with one email address, for composed (non-lead) mail:
// everything we sent to it plus every reply it sent back, oldest first.
// Lead conversations don't come through here — they thread by inquiry_id on
// GET /api/admin/inquiries/[id].

export const runtime = "nodejs"

const COLUMNS: string =
  "id, inquiry_id, to_email, to_name, subject, body_text, sent_by, sent_by_name, status, error, direction, from_email, from_name, read_at, created_at"
// Pre-migration-034 shape (no read_at yet).
const COLUMNS_NO_READ: string = COLUMNS.replace(", read_at", "")
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const isAdmin = ROLES_ADMIN_STAFF.map(String).includes(String(session.context.profile.role ?? "").toLowerCase().trim())
  const hasMailbox = Boolean((session.context.profile.mailbox_address ?? "").trim())
  if (!isAdmin && !hasMailbox) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const address = (req.nextUrl.searchParams.get("address") ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const pattern = address.replace(/([%_\\])/g, "\\$1")

  // Two queries merged in code — PostgREST or() chokes on the characters an
  // email address may legally contain.
  const run = (columns: string) =>
    Promise.all([
      (() => {
        let q = admin
          .from("inquiry_emails")
          .select(columns)
          .is("inquiry_id", null)
          .eq("direction", "outbound")
          .ilike("to_email", pattern)
          .order("created_at", { ascending: true })
          .limit(100)
        // Personal mailboxes thread only their own correspondence.
        if (!isAdmin) q = q.eq("sent_by", session.context.userId)
        return q
      })(),
      // Inbound rows exist only for the house mailbox the sync watches —
      // a personal outbox has none, so skip the query entirely.
      isAdmin
        ? admin
            .from("inquiry_emails")
            .select(columns)
            .is("inquiry_id", null)
            .eq("direction", "inbound")
            .ilike("from_email", pattern)
            .order("created_at", { ascending: true })
            .limit(100)
        : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
    ])

  let [outbound, inbound] = await run(COLUMNS)
  // 42703 tiers: 034 not applied (no read_at) → retry without it; 033 not
  // applied (no direction) → there is no correspondence to show at all.
  if (outbound.error?.code === "42703") [outbound, inbound] = await run(COLUMNS_NO_READ)
  if (outbound.error?.code === "42703") {
    return NextResponse.json({ rows: [] })
  }
  if (outbound.error) return NextResponse.json({ error: outbound.error.message }, { status: 500 })

  type Row = { created_at: string }
  const rows = ([...(outbound.data ?? []), ...(inbound.error ? [] : inbound.data ?? [])] as unknown as Row[]).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  return NextResponse.json({ rows })
}

/** Mark every unread reply from an address as read — opening the thread IS reading it. */
export async function PATCH(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  let body: { address?: string }
  try {
    body = (await req.json()) as { address?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const address = String(body.address ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error } = await admin
    .from("inquiry_emails")
    .update({ read_at: new Date().toISOString() })
    .eq("direction", "inbound")
    .is("inquiry_id", null)
    .is("read_at", null)
    .ilike("from_email", address.replace(/([%_\\])/g, "\\$1"))
  // Migration 034 not applied — read state is a no-op until then. 42703 =
  // missing column in a filter; PGRST204 = missing column in the update payload.
  if (error && error.code !== "42703" && error.code !== "PGRST204") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
