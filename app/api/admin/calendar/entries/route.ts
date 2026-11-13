import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { createEntry, sanitizeEntryInput } from "@/lib/calendar/entries"

/**
 * Company calendar entries (migration 090) — admin staff add what the system
 * does not know by itself: meetings, trainings, roadshows, developer launches,
 * deadlines, office closures. POST creates one; PATCH / DELETE live under
 * entries/[id]. Service role behind requireRole; every write is audited.
 */

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const parsed = sanitizeEntryInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const entry = await createEntry(createAdminSupabase(), parsed.value, guard.context.userId)
    void logAuditEvent({
      category: "calendar",
      event: "entry_created",
      actor: { id: guard.context.userId, name: guard.context.profile.fullname ?? guard.context.email, role: guard.context.profile.role },
      subjectType: "calendar_entry",
      subjectId: entry.id,
      subjectLabel: entry.title,
      description: `Added "${entry.title}" on ${entry.starts_on}${entry.ends_on !== entry.starts_on ? ` to ${entry.ends_on}` : ""} for ${entry.audience}.`,
      newValues: parsed.value,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ entry })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the entry." }, { status: 500 })
  }
}
