import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sendPartnerInfoReminderEmail } from "@/lib/mailer"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Email ONE Global Partner the "Where are you based?" reminder — the admin page
 * sends them one request at a time, so each row shows its own result and a
 * slow mail server never fails a whole batch. Only an active partner who hasn't
 * answered yet (a pending one can't sign in to answer). Stamps
 * metadata.partner_info_reminded_at. Admin staff only.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const body = (await req.json().catch(() => ({}))) as { id?: unknown }
  const id = typeof body.id === "string" ? body.id : ""
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid partner" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: p } = await admin
    .from("profiles")
    .select("id, role, status, is_deleted, fullname, fname, lname, metadata")
    .eq("id", id)
    .maybeSingle<{ id: string; role: string | null; status: string | null; is_deleted: boolean | null; fullname: string | null; fname: string | null; lname: string | null; metadata: Record<string, unknown> | null }>()
  if (!p || p.role !== "global_partner" || p.is_deleted) {
    return NextResponse.json({ error: "Not a Global Partner" }, { status: 404 })
  }
  if (p.status !== "active") {
    return NextResponse.json({ error: "Waiting for approval — they can't sign in yet" }, { status: 409 })
  }
  const meta = p.metadata ?? {}
  if (typeof meta.residence_country === "string" && meta.residence_country) {
    return NextResponse.json({ error: "Already told us where they're based" }, { status: 409 })
  }

  const { data: auth } = await admin.auth.admin.getUserById(id)
  const email = auth?.user?.email
  if (!email) return NextResponse.json({ error: "No email on this account" }, { status: 409 })

  try {
    await sendPartnerInfoReminderEmail({
      to: email,
      name: p.fullname?.trim() || [p.fname, p.lname].filter(Boolean).join(" ") || null,
    })
  } catch (e) {
    console.error("[global-partners/remind] send failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "The email couldn't be sent" }, { status: 502 })
  }

  // Re-read before stamping: sending took a moment, and the partner may have
  // answered meanwhile — never write back the copy from before the email.
  const remindedAt = new Date().toISOString()
  const { data: fresh } = await admin.from("profiles").select("metadata").eq("id", id).maybeSingle<{ metadata: Record<string, unknown> | null }>()
  await admin
    .from("profiles")
    .update({ metadata: { ...(fresh?.metadata ?? meta), partner_info_reminded_at: remindedAt } })
    .eq("id", id)

  return NextResponse.json({ ok: true, remindedAt })
}
