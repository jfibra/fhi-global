import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { BUYER_LEAD_COLUMNS, type BuyerLead } from "@/lib/buyer-links"

// Communication → Buyer Leads: every agent's Buyers Link briefs for admin
// staff, read-only. RLS keeps buyer_link_leads owner-only for the browser
// client (migration 060), so this reads on the service role behind
// requireRole and adds whose link each brief came through. Nothing here
// writes: leads stay the agent's.

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const { data, error } = await admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).order("created_at", { ascending: false }).limit(5000)
  if (error) return NextResponse.json({ error: "Couldn't load the leads." }, { status: 500 })
  const leads = (data ?? []) as unknown as BuyerLead[]

  const ids = [...new Set(leads.map((l) => l.agent_id))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: agents } = await admin.from("profiles").select("id, fullname").in("id", ids)
    for (const a of (agents ?? []) as { id: string; fullname: string | null }[]) names.set(a.id, titleCaseName(a.fullname ?? "") || "Unknown agent")
  }
  return NextResponse.json({
    leads: leads.map((l) => ({ ...l, agent: { id: l.agent_id, name: names.get(l.agent_id) ?? "Unknown agent" } })),
  })
}
