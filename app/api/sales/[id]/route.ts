import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { isAdminStaffRole, normalizeAppRole } from "@/lib/app-roles"

/**
 * Delete a sale. Admin-staff only, destructive. Runs on the service-role client
 * with an explicit admin check (RLS is not the guard here). The sale's activity
 * log, validation comments and attachments all cascade on delete; the client
 * row is removed too, but only when no other sale still references it.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid sale id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = normalizeAppRole(profile?.role)
    if (!profile || !isAdminStaffRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createAdminSupabase()

    const { data: sale, error: saleError } = await admin
      .from("sales_reports")
      .select("id, client_id")
      .eq("id", id)
      .single()

    if (saleError || !sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    // Children (activity logs, validation comments, attachments) cascade on delete.
    const { error: deleteError } = await admin.from("sales_reports").delete().eq("id", id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Best-effort: drop the now-orphaned client row (each sale gets its own client
    // on encode), but never if another sale still points at it.
    if (sale.client_id) {
      const { count } = await admin
        .from("sales_reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", sale.client_id)
      if (!count) {
        await admin.from("clients").delete().eq("id", sale.client_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[sales-delete]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
