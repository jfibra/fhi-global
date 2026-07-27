import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"

export async function PATCH(req: Request) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response

  const { userId, profile } = guard.context

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    phone?: string
    phone_country_code?: string
    phone_number?: string
    business_card_design?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { phone, phone_country_code, phone_number, business_card_design } = body

  // ── Validate ───────────────────────────────────────────────────────────────
  const BUSINESS_CARD_DESIGNS = ["classic", "platinum", "noir"]
  if (business_card_design !== undefined && !BUSINESS_CARD_DESIGNS.includes(business_card_design)) {
    return NextResponse.json({ error: "Unknown business card design" }, { status: 422 })
  }

  if (!phone && !phone_number && !business_card_design) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
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
    ...(phone_number || e164 ? { phone_number: phone_number ?? e164 } : {}),
    ...(phone_country_code ? { phone_country_code } : {}),
    ...(business_card_design ? { business_card_design } : {}),
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
