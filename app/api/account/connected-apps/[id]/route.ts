import { NextRequest, NextResponse } from "next/server"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { requireActiveSession } from "@/lib/auth-guard"
import { revokeGrant } from "@/lib/oauth/server"

/** Disconnect one of the caller's own Claude connections — its passes are refused from the next call. */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f-]{36}$/i

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown connection." }, { status: 404 })
  try {
    const grant = await revokeGrant(id, session.context.userId, session.context.userId)
    if (!grant) return NextResponse.json({ error: "Unknown connection, or already disconnected." }, { status: 404 })
    void logAuditEvent({
      category: "claude_sign_in",
      event: "disconnected",
      actor: { id: session.context.userId, name: session.context.profile.fullname, role: session.context.profile.role },
      subjectType: "oauth_grant",
      subjectId: grant.id,
      subjectLabel: grant.client_name ?? "Claude",
      description: `${session.context.profile.fullname ?? "A member"} disconnected ${grant.client_name ?? "Claude"} from their FHI account`,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[connected-apps]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't disconnect. Try again." }, { status: 500 })
  }
}
