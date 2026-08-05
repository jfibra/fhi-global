import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { hasInboundMailConfig, syncInboundEmails } from "@/lib/inbound-mail"

// Pull lead replies from the company mailbox into inquiry threads. The Emails
// page fires this on visit and on manual refresh; concurrent calls coalesce
// onto one IMAP session inside lib/inbound-mail.ts.

export const runtime = "nodejs"
// IMAP connect + fetch can take a while on a cold mailbox.
export const maxDuration = 60

export async function POST() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  if (!hasInboundMailConfig()) {
    return NextResponse.json({ error: "Inbound mail is not configured." }, { status: 503 })
  }

  try {
    const result = await syncInboundEmails()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    )
  }
}
