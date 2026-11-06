import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { SALE_SELECT } from "@/lib/sales-rules"
import {
  LEADER_CONFIRMABLE,
  leaderAuthority,
  leaderConfirmSchema,
  logLeaderActivity,
  stampName,
  UUID_RE,
} from "@/lib/team-sales-review"

/**
 * The team leader confirms one of their team's sales for the admin to
 * validate — or takes that back (migration 084). Allowed while the leader's
 * team has "Team leader confirms sales first" on, for a sale someone the team
 * covers recorded, and only until the admin decides (pending / under review).
 * A leader never confirms their own sale: it goes straight to the admin.
 *
 * The confirmation is a stamp, not a status: the admin can validate a sale
 * whether or not it has one — they are told when it doesn't.
 */

export const runtime = "nodejs"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["team_leader"])
  if (!guard.ok) return guard.response
  const userId = guard.context.userId

  const { id } = await params
  if (!UUID_RE.test(id)) return bad("Invalid sale id")
  const parsed = leaderConfirmSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad("Invalid request")
  const confirm = parsed.data.confirm

  const admin = createAdminSupabase()
  try {
    const { data: sale, error: readError } = await admin
      .from("sales_reports")
      .select("id, agent_id, validation_status, leader_confirmed_at")
      .eq("id", id)
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!sale) return bad("Sale not found", 404)

    const ownerId = String(sale.agent_id)
    if (ownerId === userId) return bad("This is your own sale — it goes straight to the admin.")
    const { canConfirm } = await leaderAuthority(admin, userId, ownerId)
    if (!canConfirm) {
      return bad("You can't confirm this sale — it isn't your team's, or your team doesn't ask its leader to confirm sales.", 403)
    }
    if (!(LEADER_CONFIRMABLE as readonly string[]).includes(String(sale.validation_status))) {
      return bad("The admin has already decided on this sale.", 409)
    }

    const already = Boolean(sale.leader_confirmed_at)
    if (confirm !== already) {
      const now = new Date().toISOString()
      const { error } = await admin
        .from("sales_reports")
        .update(
          confirm
            ? { leader_confirmed_at: now, leader_confirmed_by: userId, leader_confirmed_by_name: await stampName(admin, userId) }
            : { leader_confirmed_at: null, leader_confirmed_by: null, leader_confirmed_by_name: null },
        )
        .eq("id", id)
      if (error) throw new Error(error.message)
      await logLeaderActivity(admin, {
        saleId: id,
        userId,
        action: confirm ? "leader_confirmed" : "leader_confirmation_removed",
        description: confirm ? "Confirmed by the team leader" : "The team leader took the confirmation back",
      })
    }

    const { data: fresh, error: rereadError } = await admin.from("sales_reports").select(SALE_SELECT).eq("id", id).single()
    if (rereadError) throw new Error(rereadError.message)
    return NextResponse.json({ sale: fresh }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    console.error("[team/sales confirm]", e instanceof Error ? e.message : e)
    return bad("Couldn't save the confirmation. Try again in a moment.", 500)
  }
}
