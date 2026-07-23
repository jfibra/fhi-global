import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageEvents } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { sendRaffleWinnerEmail } from "@/lib/mailer"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Email a raffle winner their proof-of-winning (name, event, prize). Triggered
 * by the host from the raffle winners panel — deliberately manual so test
 * draws never email real people.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canManageEvents(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { registrationId?: unknown; prize?: unknown }
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : ""
  const prize = typeof body.prize === "string" ? body.prize.trim().slice(0, 80) : ""
  if (!UUID_RE.test(id) || !UUID_RE.test(registrationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const [regResult, eventResult] = await Promise.all([
    admin
      .from("event_registrations")
      .select("id, full_name, email")
      .eq("id", registrationId)
      .eq("event_id", id)
      .maybeSingle(),
    admin.from("events").select("id, title").eq("id", id).is("deleted_at", null).maybeSingle(),
  ])

  if (regResult.error || eventResult.error) {
    console.error("[events/notify-winner] lookup failed:", regResult.error ?? eventResult.error)
    return NextResponse.json({ error: "Couldn't look up the winner — please try again" }, { status: 500 })
  }
  const registration = regResult.data
  const event = eventResult.data
  if (!registration || !event) {
    return NextResponse.json({ error: "Winner not found for this event" }, { status: 404 })
  }

  try {
    await sendRaffleWinnerEmail({
      to: registration.email as string,
      fullName: registration.full_name as string,
      eventTitle: (event.title as string) ?? "FHI Global event",
      prize: prize || null,
    })
  } catch (e) {
    console.error("[events/notify-winner] send failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't send the email — check the SMTP settings" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
