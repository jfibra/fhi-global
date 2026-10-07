import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { revalidateAgentSite } from "@/lib/agent-site-revalidate"

// Approve, hide or re-open one client review (agent_feedback, migration 039).
// An approved review appears on the advisor's website (lib/website-reviews.ts).
// agent_feedback has no client write path under RLS, so this runs on the
// service role behind the super_admin/admin guard.

export const runtime = "nodejs"

const STATUS_WORDS: Record<string, string> = {
  new: "moved back to New",
  approved: "approved for the website",
  hidden: "hidden",
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { status?: string }
  try {
    body = (await req.json()) as { status?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const status = String(body.status ?? "")
  if (!(status in STATUS_WORDS)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("agent_feedback")
    .select("id, status, client_name, agent_name, agent_id")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string; client_name: string; agent_name: string | null; agent_id: string | null }>()
  if (!existing) return NextResponse.json({ error: "Review not found." }, { status: 404 })
  if (existing.status === status) return NextResponse.json({ ok: true })

  const { error } = await admin.from("agent_feedback").update({ status }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Approved reviews are shown on the advisor's website (ISR) — approving, hiding or
  // re-opening one changes that page now, not in up to 5 minutes. The roster's star
  // rating (/agents) comes from the same rows.
  await revalidateAgentSite(admin, existing.agent_id)
  revalidatePath("/agents")

  const advisor = existing.agent_name ?? "an advisor"
  await logAuditEvent({
    category: "feedback",
    event: "updated",
    source: "dashboard",
    actor: {
      id: guard.context.userId,
      name: guard.context.profile.fullname ?? guard.context.email ?? null,
      role: guard.context.profile.role,
    },
    subjectType: "agent_feedback",
    subjectId: id,
    subjectLabel: `${existing.client_name} → ${advisor}`,
    description: `Review from ${existing.client_name} for ${advisor} ${STATUS_WORDS[status]}`,
    oldValues: { status: existing.status },
    newValues: { status },
    changedKeys: ["status"],
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
