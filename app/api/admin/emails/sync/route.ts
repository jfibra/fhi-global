import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { hasInboundMailConfig, syncInboundEmails } from "@/lib/inbound-mail"

// Pull lead replies from the company mailbox into inquiry threads. The Emails
// page fires this on visit and on manual refresh; concurrent calls coalesce
// onto one IMAP session inside lib/inbound-mail.ts.

export const runtime = "nodejs"
// IMAP connect + fetch can take a while on a cold mailbox.
export const maxDuration = 60

export async function POST() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const profile = session.context.profile
  const isAdmin = isAdminStaffRole(profile.role)
  const hasMailbox = Boolean((profile.mailbox_address ?? "").trim())
  if (!isAdmin && !hasMailbox) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!hasInboundMailConfig()) {
    return NextResponse.json({ error: "Inbound mail is not configured." }, { status: 503 })
  }

  try {
    // Admins refresh the whole mailroom (house + every personal mailbox);
    // an owner's visit polls just their own.
    const result = await syncInboundEmails(isAdmin ? "all" : { ownerId: session.context.userId })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    )
  }
}
