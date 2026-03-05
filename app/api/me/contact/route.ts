import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"

export async function PATCH(req: Request) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response

  const { userId, profile } = guard.context

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { phone } = body

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!phone) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
  }

  // Must be E.164 UAE mobile: +971 followed by 5x and 8 more digits
  if (!/^\+9715\d{8}$/.test(phone)) {
    return NextResponse.json(
      { error: "Phone must be a valid UAE mobile number in +971XXXXXXXXX format" },
      { status: 422 },
    )
  }

  // ── Update phone in profile metadata ──────────────────────────────────────
  const adminClient = createAdminSupabase()

  const existingMeta = (profile.metadata as Record<string, unknown>) ?? {}
  const newMeta = { ...existingMeta, phone_number: phone }

  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ metadata: newMeta, updated_at: new Date().toISOString() })
    .eq("id", userId)

  if (profileErr) {
    console.error("[me/contact] profile update error:", profileErr)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
