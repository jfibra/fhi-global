import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { getEntry, sanitizeEntryInput, softDeleteEntry, updateEntry } from "@/lib/calendar/entries"

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "No such entry." }, { status: 404 })

  const parsed = sanitizeEntryInput(await req.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const admin = createAdminSupabase()
    const before = await getEntry(admin, id)
    if (!before) return NextResponse.json({ error: "No such entry." }, { status: 404 })
    const entry = await updateEntry(admin, id, parsed.value, before)
    const changed = (Object.keys(parsed.value) as Array<keyof typeof parsed.value>).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(parsed.value[k] ?? null))
    void logAuditEvent({
      category: "calendar",
      event: "entry_updated",
      actor: { id: guard.context.userId, name: guard.context.profile.fullname ?? guard.context.email, role: guard.context.profile.role },
      subjectType: "calendar_entry",
      subjectId: entry.id,
      subjectLabel: entry.title,
      description: changed.length ? `Changed ${changed.join(", ")} on "${entry.title}".` : `Saved "${entry.title}" with no changes.`,
      oldValues: Object.fromEntries(changed.map((k) => [k, before[k] ?? null])),
      newValues: Object.fromEntries(changed.map((k) => [k, parsed.value[k] ?? null])),
      changedKeys: changed,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ entry })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the entry." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: "No such entry." }, { status: 404 })

  try {
    const admin = createAdminSupabase()
    const before = await getEntry(admin, id)
    if (!before) return NextResponse.json({ error: "No such entry." }, { status: 404 })
    await softDeleteEntry(admin, id)
    void logAuditEvent({
      category: "calendar",
      event: "entry_deleted",
      actor: { id: guard.context.userId, name: guard.context.profile.fullname ?? guard.context.email, role: guard.context.profile.role },
      subjectType: "calendar_entry",
      subjectId: id,
      subjectLabel: before.title,
      description: `Removed "${before.title}" (${before.starts_on}).`,
      oldValues: before,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't remove the entry." }, { status: 500 })
  }
}
