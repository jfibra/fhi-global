import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import {
  ROLES_ADMIN_STAFF,
  ROLES_SALES_PIPELINE,
  ROLES_SALE_AGENT_PROFILES,
  roleToLabel,
} from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"

/**
 * Partner suggestions for "Do you have a partner with this sale?" on Record
 * Your Sale. The same kind of lookup as the event "Invited by" box
 * (app/api/events/inviters), but for signed-in encoders only, and it returns
 * the profile id — a partner is linked to the sale, not just named.
 *
 * Only active FHI sales agents can be partners (the migration 055 trigger
 * enforces the same list), and the caller is never suggested to themselves.
 * Runs on the caller's own session: profiles is readable by any signed-in user
 * (migration 020), so no service-role client is needed.
 */

const MIN_QUERY = 2
const LIMIT = 8

export async function GET(req: NextRequest) {
  const session = await requireRole([...ROLES_ADMIN_STAFF, ...ROLES_SALES_PIPELINE])
  if (!session.ok) return session.response

  // Letters (any script), marks, spaces, dots, apostrophes and hyphens only —
  // strips ilike wildcards and anything else before it reaches the query.
  const raw = req.nextUrl.searchParams.get("q") ?? ""
  const q = raw.replace(/[^\p{L}\p{M} .'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60)
  if (q.length < MIN_QUERY) return NextResponse.json({ agents: [] })

  const supabase = await createClient()
  let query = supabase
    .from("profiles")
    .select("id, fullname, profile_url, role, metadata")
    .in("role", [...ROLES_SALE_AGENT_PROFILES])
    .eq("status", "active")
    .not("is_deleted", "is", true)
    .neq("id", session.context.userId)
  // Every typed word must appear, so "maria santos" still finds a name stored
  // with a double space or a middle name in between.
  for (const word of q.split(" ")) query = query.ilike("fullname", `%${word}%`)

  const { data, error } = await query.order("fullname").limit(LIMIT)

  if (error) {
    console.error("[sales/partner-agents] lookup failed:", error.message)
    return NextResponse.json({ agents: [] })
  }

  const agents = (data ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    const avatar = typeof r.profile_url === "string" && /^https?:\/\//.test(r.profile_url.trim()) ? r.profile_url.trim() : null
    return {
      id: String(r.id),
      name: titleCaseName(((r.fullname as string | null) ?? "").replace(/\s+/g, " ").trim()) || "Agent",
      avatar,
      role_label: roleToLabel(r.role as string | null),
      phone: typeof meta.phone_number === "string" && meta.phone_number.trim() ? meta.phone_number.trim() : null,
    }
  })

  return NextResponse.json({ agents }, { headers: { "Cache-Control": "private, no-store" } })
}
