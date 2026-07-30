import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { normalizeTagline, parseSocialLinks, type SocialLinks } from "@/lib/public-profile"

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
    socials?: unknown
    tagline?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { phone, phone_country_code, phone_number, business_card_design, socials, tagline } = body

  // ── Validate ───────────────────────────────────────────────────────────────
  const BUSINESS_CARD_DESIGNS = ["classic", "platinum", "noir"]
  if (business_card_design !== undefined && !BUSINESS_CARD_DESIGNS.includes(business_card_design)) {
    return NextResponse.json({ error: "Unknown business card design" }, { status: 422 })
  }

  // `socials` is normalised and host-checked here because these links are
  // rendered on a public page — a Facebook field must not be able to point
  // somewhere else. An omitted key leaves the stored links untouched; an empty
  // object clears them all.
  let parsedSocials: SocialLinks | undefined
  if (socials !== undefined) {
    const parsed = parseSocialLinks(socials)
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `That doesn't look like a valid ${parsed.invalid} link` },
        { status: 422 },
      )
    }
    parsedSocials = parsed.value
  }

  // Normalised rather than rejected: a too-long or oddly-spaced tagline is a
  // typing artefact, not an error worth blocking a save over. An empty string
  // clears it.
  const normalizedTagline = tagline === undefined ? undefined : normalizeTagline(tagline)

  if (
    !phone && !phone_number && !business_card_design &&
    parsedSocials === undefined && normalizedTagline === undefined
  ) {
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
    ...(parsedSocials !== undefined ? { socials: parsedSocials } : {}),
    ...(normalizedTagline !== undefined ? { tagline: normalizedTagline } : {}),
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
