import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"

export async function PATCH(req: Request) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response

  const { userId, profile } = guard.context

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { phone?: string; phone_country_code?: string; phone_number?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { phone, phone_country_code, phone_number } = body

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!phone && !phone_number) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
  }

  // Basic E.164-ish validation: starts with + and at least 4 digits after
  const e164 = phone ?? ""
  if (e164 && !/^\+\d{4,}$/.test(e164)) {
    return NextResponse.json(
      { error: "Phone must be a valid number in international format (e.g. +971XXXXXXXXX)" },
      { status: 422 },
    )
  }

  // ── Update phone in profile metadata ──────────────────────────────────────
  const adminClient = createAdminSupabase()

  const existingMeta = (profile.metadata as Record<string, unknown>) ?? {}
  const newMeta = {
    ...existingMeta,
    phone_number: phone_number ?? e164,
    ...(phone_country_code ? { phone_country_code } : {}),
  }

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
