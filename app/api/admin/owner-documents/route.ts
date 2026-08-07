import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"

/**
 * Admin-only: list every owner-document request with the creating agent's name
 * + avatar. Runs on the service-role client (bypasses RLS) so the profiles join
 * always resolves; authorization is by the caller's real DB role.
 */
export const runtime = "nodejs"

const SELECT =
  "id, token, agent_id, label, status, owner_name, owner_id_number, owner_email, owner_mobile, property_building, unit_number, community_area, title_deed_number, noc_valid_until, submitted_at, expires_at, created_at, updated_at, deleted_at, agent:profiles!agent_id(fullname, fname, lname, profile_url, role)"

type AgentEmbed = { fullname: string | null; fname: string | null; lname: string | null; profile_url: string | null; role: string | null } | null

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("owner_document_requests")
    .select(SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requests = (data ?? []).map((row) => {
    const agent = (Array.isArray(row.agent) ? row.agent[0] : row.agent) as AgentEmbed
    const agentName =
      agent?.fullname?.trim() || [agent?.fname, agent?.lname].filter(Boolean).join(" ").trim() || null
    const { agent: _agent, ...rest } = row as typeof row & { agent: unknown }
    void _agent
    return {
      ...rest,
      agent_name: agentName,
      agent_avatar: agent?.profile_url ?? null,
      agent_role: agent?.role ?? null,
    }
  })

  return NextResponse.json({ requests })
}
