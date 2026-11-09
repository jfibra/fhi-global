import "server-only"

import { z } from "zod"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"

/**
 * Server side of a team leader reviewing their team's sales (migration 084):
 * who they lead and what each team's switches allow, the name stamped onto a
 * sale for who acted, and the request shapes of app/api/team/sales/*.
 *
 * Who leads whom is decided ONLY by team_leader_scope() in SQL — the same
 * function behind the leader's read access (RLS) — so the routes can never
 * allow an edit the database wouldn't show, or the other way round.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type LeaderMember = {
  memberId: string
  teamId: string
  teamName: string
  canEdit: boolean
  canConfirm: boolean
}

/** Everyone the leader's teams cover — subteams included, the leader too — with what the switches allow. */
export async function leaderScope(admin: Admin, leaderId: string): Promise<LeaderMember[]> {
  const { data, error } = await admin.rpc("team_leader_scope", { _leader: leaderId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ member_id: string; team_id: string; team_name: string | null; can_edit: boolean; can_confirm: boolean }>).map((r) => ({
    memberId: String(r.member_id),
    teamId: String(r.team_id),
    teamName: r.team_name ?? "",
    canEdit: Boolean(r.can_edit),
    canConfirm: Boolean(r.can_confirm),
  }))
}

/** What the leader may do with the sales one agent recorded. */
export async function leaderAuthority(
  admin: Admin,
  leaderId: string,
  agentId: string,
): Promise<{ canEdit: boolean; canConfirm: boolean }> {
  const member = (await leaderScope(admin, leaderId)).find((m) => m.memberId === agentId)
  return { canEdit: Boolean(member?.canEdit), canConfirm: Boolean(member?.canConfirm) }
}

/**
 * The name stamped onto a sale for who acted — a snapshot, so a later rename
 * doesn't rewrite it. Same fallbacks as migration 024: the profile's name, its
 * first + last name, then the email's local part.
 */
export async function stampName(admin: Admin, userId: string): Promise<string | null> {
  const { data: p } = await admin.from("profiles").select("fullname, fname, lname").eq("id", userId).maybeSingle()
  const name =
    titleCaseName(String(p?.fullname ?? "").replace(/\s+/g, " ").trim()) ||
    [p?.fname, p?.lname].filter(Boolean).join(" ").trim()
  if (name) return name
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email?.split("@")[0] ?? null
}

/** Activity log entry on behalf of the leader. Best effort — a logging hiccup must not fail the save. */
export async function logLeaderActivity(
  admin: Admin,
  entry: {
    saleId: string
    userId: string
    action: string
    field?: string | null
    oldValue?: unknown
    newValue?: unknown
    description?: string | null
  },
): Promise<void> {
  const { error } = await admin.from("sales_activity_logs").insert({
    sales_report_id: entry.saleId,
    action_type: entry.action,
    field_name: entry.field ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    description: entry.description ?? null,
    performed_by: entry.userId,
    performed_role: "team_leader",
  })
  if (error) console.error("[team-sales] activity log failed:", error.message)
}

export { LEADER_CONFIRMABLE } from "@/lib/sales-rules"

// ─── Request shapes ───────────────────────────────────────────────────────────
// The edit dialog sends the same SaleFormData the admin's save uses, as
// strings. Bounds are generous: they stop abuse, not long payment terms.

const text = (max: number) => z.string().max(max)

const clientSchema = z.object({
  first_name: text(120),
  middle_name: text(120),
  last_name: text(120),
  email: text(200),
  phone: text(60),
  age: text(4),
  gender: text(40),
  occupation: text(160),
  street: text(300),
  city: text(120),
  state_province: text(120),
  country: text(120),
})

export const leaderEditSchema = z.object({
  form: z.object({
    sale_type: z.enum(["project", "brokerage", "rental"]),
    developer_id: text(100),
    project_id: text(20),
    project_unit_id: text(20),
    unit_number: text(120),
    block_number: text(120),
    lot_number: text(120),
    property_type: text(120),
    property_address: text(500),
    client: clientSchema,
    contract_price: text(30),
    reservation_date: text(10),
    payment_plan: text(1000),
    payment_terms: text(5000),
    price_per_sqft: text(30),
    total_area_sqft: text(30),
    remarks: text(5000),
    // Sent by the dialog, never written by a leader's save.
    commission_status: text(30),
    validation_status: text(30),
  }),
  /** null = leave the partnership as it is; [] = make it a solo sale. */
  partners: z
    .array(
      z.object({
        agent_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        name: text(200),
        role: z.enum(["lead", "co_agent"]),
        share: z.number().finite(),
        brn: text(40).nullable(),
      }),
    )
    .max(3)
    .nullable(),
  confirm: z.boolean().optional(),
})

export const leaderConfirmSchema = z.object({ confirm: z.boolean() })

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
