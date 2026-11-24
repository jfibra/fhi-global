import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { requireRole } from "@/lib/auth-guard"
import { revokeGrant } from "@/lib/oauth/server"

/** An admin disconnects anyone's Claude connection; the person's next call is refused. Audited. */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f-]{36}$/i

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown connection." }, { status: 404 })
  try {
    const grant = await revokeGrant(id, guard.context.userId)
    if (!grant) return NextResponse.json({ error: "Unknown connection, or already disconnected." }, { status: 404 })
    const { data: who } = await createAdminSupabase().from("profiles").select("fullname").eq("id", grant.user_id).maybeSingle<{ fullname: string | null }>()
    void logAuditEvent({
      category: "claude_sign_in",
      event: "disconnected_by_admin",
      actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
      subjectType: "profile",
      subjectId: grant.user_id,
      subjectLabel: who?.fullname ?? null,
      description: `${guard.context.profile.fullname ?? "An admin"} disconnected ${grant.client_name ?? "Claude"} from ${who?.fullname ?? "a member"}'s FHI account`,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[admin/connected-apps]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't disconnect. Try again." }, { status: 500 })
  }
}
