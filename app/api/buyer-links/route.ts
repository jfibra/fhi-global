import { NextResponse } from "next/server"
import { randomInt } from "node:crypto"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_BUYER_LINK_OWNERS } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { BUYER_LINK_COLUMNS } from "@/lib/buyer-links"

// The signed-in agent's one Buyers Link (migration 061): returned if it
// exists, created on first use otherwise. Idempotent, so the dashboard just
// calls it on load. The owner is always the session user.

export const runtime = "nodejs"

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")

export async function POST() {
  const guard = await requireRole([...ROLES_BUYER_LINK_OWNERS])
  if (!guard.ok) return guard.response
  const agentId = guard.context.userId
  const admin = createAdminSupabase()

  const existing = async () =>
    admin.from("buyer_links").select(BUYER_LINK_COLUMNS).eq("agent_id", agentId).maybeSingle()

  const found = await existing()
  if (found.error) return NextResponse.json({ error: found.error.message }, { status: 500 })
  if (found.data) return NextResponse.json({ link: found.data })

  // 31^8 codes: a code clash is vanishingly rare. A clash on agent_id means a
  // second tab created the link a moment ago, so read that one back.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await admin
      .from("buyer_links")
      .insert({ agent_id: agentId, code: newCode(), title: "Buyers Link", project_ids: [] })
      .select(BUYER_LINK_COLUMNS)
      .single()
    if (!error) return NextResponse.json({ link: data })
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 })
    const again = await existing()
    if (again.data) return NextResponse.json({ link: again.data })
  }
  return NextResponse.json({ error: "Could not create your link — please try again." }, { status: 500 })
}
