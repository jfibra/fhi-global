import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  changedFields,
  clientPayload,
  normalizePartners,
  partnersChanged,
  partnersForWrite,
  SALE_SELECT,
  saleDetailsPayload,
  validateSaleFormData,
  validateSalePartners,
  type SaleFormData,
  type SalePartner,
} from "@/lib/sales-rules"
import {
  LEADER_CONFIRMABLE,
  leaderAuthority,
  leaderEditSchema,
  logLeaderActivity,
  stampName,
  UUID_RE,
} from "@/lib/team-sales-review"

/**
 * A team leader edits one of their team's sales (migration 084) — the sale's
 * details, its client and its partnership split. Allowed only while the
 * leader's team has "Team leader can edit sales" on and the sale was recorded
 * by someone the team covers (subteams included, the leader too); both are
 * decided by team_leader_scope() in SQL, never by the request.
 *
 * The sale keeps its validation and commission status — a leader's edit is
 * stamped (edited_*) and logged field by field instead (the boss's call). With
 * `confirm`, the same save also confirms the sale for the admin, when the team
 * asks for that and the sale is still waiting.
 *
 * Runs on the service role: RLS lets a leader read their team's sales, never
 * write them, so this route is the only door.
 */

export const runtime = "nodejs"

const CLIENT_COLUMNS = "first_name,middle_name,last_name,email,phone,age,gender,occupation,street,city,state_province,country"

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["team_leader"])
  if (!guard.ok) return guard.response
  const userId = guard.context.userId

  const { id } = await params
  if (!UUID_RE.test(id)) return bad("Invalid sale id")

  const parsed = leaderEditSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return bad("Invalid request")
  const form = parsed.data.form as SaleFormData
  const partners = parsed.data.partners as SalePartner[] | null

  const admin = createAdminSupabase()
  try {
    const { data: existing, error: readError } = await admin
      .from("sales_reports")
      .select(`*, clients(${CLIENT_COLUMNS})`)
      .eq("id", id)
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!existing) return bad("Sale not found", 404)

    const ownerId = String(existing.agent_id)
    const authority = await leaderAuthority(admin, userId, ownerId)
    if (!authority.canEdit) {
      return bad("You can't edit this sale — it isn't your team's, or your team doesn't let its leader edit sales.", 403)
    }

    const formError = Object.values(validateSaleFormData(form))[0]
    if (formError) return bad(formError)
    if (partners && partners.length > 0) {
      const partnerError = Object.values(validateSalePartners(partners, ownerId, { editing: true }))[0]
      if (partnerError) return bad(partnerError)
    }

    const details = saleDetailsPayload(form)
    const client = clientPayload(form)
    const clientRow = (Array.isArray(existing.clients) ? existing.clients[0] : existing.clients) as Record<string, unknown> | null
    const detailChanges = changedFields(existing as Record<string, unknown>, details)
    const clientChanges = changedFields(clientRow, client)
    const currentPartners = normalizePartners(existing.partners)
    const partnersEdited = partners != null && partnersChanged(currentPartners, partners)
    const edited = Boolean(detailChanges || clientChanges || partnersEdited)

    const status = String(existing.validation_status ?? "pending")
    const confirmNow =
      parsed.data.confirm === true &&
      authority.canConfirm &&
      ownerId !== userId &&
      !existing.leader_confirmed_at &&
      (LEADER_CONFIRMABLE as readonly string[]).includes(status)

    if (edited || confirmNow) {
      const now = new Date().toISOString()
      const name = await stampName(admin, userId)

      if (clientChanges && existing.client_id) {
        const { error } = await admin.from("clients").update(client).eq("id", existing.client_id)
        if (error) throw new Error(error.message)
      }

      const update: Record<string, unknown> = {}
      if (edited) {
        Object.assign(update, details, {
          updated_by: userId,
          updated_at: now,
          edited_at: now,
          edited_by: userId,
          edited_by_name: name,
        })
        // The 055 trigger re-validates the new split and keeps partner_agent_ids in step.
        if (partnersEdited) update.partners = partnersForWrite(partners ?? [])
      }
      if (confirmNow) {
        Object.assign(update, { leader_confirmed_at: now, leader_confirmed_by: userId, leader_confirmed_by_name: name })
      }

      const { error: updateError } = await admin.from("sales_reports").update(update).eq("id", id)
      if (updateError) {
        // The partners trigger speaks in plain sentences ("Shares must total exactly 100%") — pass it on.
        return bad(updateError.message, updateError.code === "P0001" ? 400 : 500)
      }

      const log = (action: string, field: string | null, oldValue: unknown, newValue: unknown) =>
        logLeaderActivity(admin, { saleId: id, userId, action, field, oldValue, newValue, description: "Edited by the team leader" })
      if (detailChanges) await log("sale_updated", null, detailChanges.before, detailChanges.after)
      if (clientChanges) await log("client_information_updated", "client", clientChanges.before, clientChanges.after)
      if (partnersEdited) await log("partners_updated", "partners", currentPartners, partnersForWrite(partners ?? []))
      if (confirmNow) {
        await logLeaderActivity(admin, { saleId: id, userId, action: "leader_confirmed", description: "Confirmed by the team leader" })
      }
    }

    const { data: sale, error: rereadError } = await admin.from("sales_reports").select(SALE_SELECT).eq("id", id).single()
    if (rereadError) throw new Error(rereadError.message)
    return NextResponse.json({ sale }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    console.error("[team/sales edit]", e instanceof Error ? e.message : e)
    return bad("Couldn't save the sale. Try again in a moment.", 500)
  }
}
