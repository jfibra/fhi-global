import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { checkPartnerSignupInfo, partnerInfoMetadata } from "@/lib/partner-signup"

/**
 * A Global Partner says where they live now + their WhatsApp — the dashboard
 * pop-up for partners who joined before the invite asked (PartnerInfoGate).
 * Their own account only; merges just those fields into profiles.metadata.
 */
export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (session.context.profile.role !== "global_partner") {
    return NextResponse.json({ error: "Only Global Partners are asked this" }, { status: 403 })
  }

  const checked = checkPartnerSignupInfo(await req.json().catch(() => ({})))
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: current, error: readError } = await admin
    .from("profiles")
    .select("metadata")
    .eq("id", session.context.userId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (readError) return NextResponse.json({ error: "Couldn't save — please try again" }, { status: 500 })

  // The profile picker stores Canada as "+1-CA" — keep it when the dial didn't change.
  const existing = current?.metadata ?? {}
  const oldCode = typeof existing.whatsapp_country_code === "string" ? existing.whatsapp_country_code : ""
  const { error } = await admin
    .from("profiles")
    .update({
      metadata: {
        ...existing,
        ...partnerInfoMetadata(checked.info),
        ...(oldCode.split("-")[0] === checked.info.whatsappCode ? { whatsapp_country_code: oldCode } : {}),
      },
    })
    .eq("id", session.context.userId)
  if (error) return NextResponse.json({ error: "Couldn't save — please try again" }, { status: 500 })

  return NextResponse.json({ ok: true, info: checked.info })
}
