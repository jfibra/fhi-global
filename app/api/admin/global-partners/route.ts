import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"

/** One Global Partner as the admin Global Partners page lists them. */
export type GlobalPartnerRow = {
  id: string
  name: string
  email: string | null
  photo: string | null
  status: string
  joinedAt: string | null
  /** The country they said they live in now (lib/partner-signup.ts); null = not given yet. */
  basedIn: string | null
  /** From their profile — a hint while basedIn is missing. */
  nationality: string | null
  /** "+63 9171234567", or null. */
  whatsapp: string | null
  invitedBy: { id: string; name: string } | null
  /** When an admin last emailed them the "Where are you based?" reminder. */
  remindedAt: string | null
}

const PAGE = 1000
const nameOf = (p: Record<string, unknown>) =>
  titleCaseName(
    (typeof p.fullname === "string" && p.fullname.trim()) ||
      [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" "),
  ) || "Unnamed account"

/**
 * Every Global Partner (role global_partner, not deleted) with where they're
 * based, their WhatsApp and who invited them — the admin page groups them by
 * country. Admin staff only.
 */
export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, status, profile_url, joined_at, metadata")
      .eq("role", "global_partner")
      .not("is_deleted", "is", true)
      .order("joined_at", { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: "Couldn't load the partners." }, { status: 500 })
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }

  const meta = (p: Record<string, unknown>) => (p.metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

  // Who invited them.
  const inviterIds = [...new Set(rows.map((p) => str(meta(p).invited_by)).filter((v): v is string => Boolean(v)))]
  const inviters = new Map<string, string>()
  for (let i = 0; i < inviterIds.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, fullname, fname, lname").in("id", inviterIds.slice(i, i + 200))
    for (const p of (data ?? []) as Record<string, unknown>[]) inviters.set(String(p.id), nameOf(p))
  }

  // Their sign-in emails live in auth — looked up a few at a time.
  const emails = new Map<string, string>()
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20)
    const users = await Promise.all(
      batch.map((p) => admin.auth.admin.getUserById(String(p.id)).then((r) => r.data.user ?? null, () => null)),
    )
    for (const u of users) if (u?.email) emails.set(u.id, u.email)
  }

  const partners: GlobalPartnerRow[] = rows.map((p) => {
    const m = meta(p)
    const waNumber = str(m.whatsapp_number)
    const inviter = str(m.invited_by)
    return {
      id: String(p.id),
      name: nameOf(p),
      email: emails.get(String(p.id)) ?? null,
      photo: str(p.profile_url),
      status: (str(p.status) ?? "pending").toLowerCase(),
      joinedAt: str(p.joined_at),
      basedIn: str(m.residence_country),
      nationality: str(m.nationality),
      whatsapp: waNumber ? `${str(m.whatsapp_country_code) ?? ""} ${waNumber}`.trim() : null,
      invitedBy: inviter ? { id: inviter, name: inviters.get(inviter) ?? "Unknown account" } : null,
      remindedAt: str(m.partner_info_reminded_at),
    }
  })

  return NextResponse.json({ partners }, { headers: { "Cache-Control": "no-store" } })
}
