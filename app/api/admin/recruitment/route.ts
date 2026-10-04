import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { fetchAllSales, saleCredits } from "@/lib/fhi-chat-tools"

// Accounts & Invites → Recruitment: every live account as one compact row —
// who they are, their status, when they joined and who invited them
// (metadata.invited_by, stamped at registration). The page builds the rest
// from this: the approval queue, the recruiter leaderboard and each
// recruiter's downline. Developer-invite registrations carry no inviter here:
// they belong to a developer's own invite link, not to a person's network
// (same rule as the account 360 view). Admin staff only; service role, since
// profiles is read across every account.

export const runtime = "nodejs"

export type RecruitmentPerson = {
  id: string
  name: string
  role: string | null
  status: string
  photo: string | null
  joinedAt: string | null
  /** The inviting account's id, or null. */
  invitedBy: string | null
  /** Their own VALIDATED sales (partner shares respected), all time. */
  deals: number
  sales: number
  /** The country they said they live in (Global Partner sign-up, lib/partner-signup.ts). */
  basedIn: string | null
  /** "+63 9171234567" — only for accounts waiting for approval, where it's shown. */
  whatsapp: string | null
}

/** One agent's credit on one validated sale — what a sales figure is made of. */
export type RecruitmentDeal = {
  saleId: string
  agentId: string
  /** Reservation date, else when it was recorded. */
  date: string
  project: string | null
  developer: string | null
  unit: string | null
  saleType: string | null
  /** The full contract price and this agent's share of it. */
  price: number
  share: number
  value: number
}

const PAGE = 1000

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, status, profile_url, joined_at, metadata")
      .not("is_deleted", "is", true)
      .order("joined_at", { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: "Couldn't load the accounts." }, { status: 500 })
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }

  // Own validated sales per account — the leaderboard sums them over a downline.
  const sold = new Map<string, { deals: number; value: number }>()
  for (const s of await fetchAllSales(admin)) {
    if (s.validation_status !== "validated") continue
    for (const c of saleCredits(s)) {
      const t = sold.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      sold.set(c.agentId, t)
    }
  }

  const people: RecruitmentPerson[] = rows.map((p) => {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    const invitedBy = typeof meta.invited_by === "string" && meta.invited_by && !meta.developer_invite_id ? meta.invited_by : null
    const raw = (typeof p.fullname === "string" && p.fullname.trim()) || [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")
    const status = ((p.status as string | null) ?? "pending").toLowerCase()
    const waNumber = typeof meta.whatsapp_number === "string" ? meta.whatsapp_number.trim() : ""
    const waCode = typeof meta.whatsapp_country_code === "string" ? meta.whatsapp_country_code.trim() : ""
    return {
      id: String(p.id),
      name: titleCaseName(raw) || "Unnamed account",
      role: (p.role as string | null) ?? null,
      status,
      photo: (p.profile_url as string | null) || null,
      joinedAt: (p.joined_at as string | null) ?? null,
      invitedBy,
      deals: sold.get(String(p.id))?.deals ?? 0,
      sales: Math.round(sold.get(String(p.id))?.value ?? 0),
      basedIn: typeof meta.residence_country === "string" && meta.residence_country ? meta.residence_country : null,
      whatsapp: status === "pending" && waNumber ? `${waCode} ${waNumber}`.trim() : null,
    }
  })

  // The validated sales themselves, one line per credited agent, so a figure
  // on the page can open into "which agent, which project, how much".
  const { data: saleRows } = await admin
    .from("sales_reports")
    .select("id, agent_id, contract_price, reservation_date, created_at, sale_type, unit_number, partners, projects(name), developers(name)")
    .eq("validation_status", "validated")
    .order("reservation_date", { ascending: false })
    .limit(5000)
  const deals: RecruitmentDeal[] = []
  for (const row of (saleRows ?? []) as Array<Record<string, unknown>>) {
    const price = Number(row.contract_price ?? 0)
    const shared = (Array.isArray(row.partners) ? row.partners : []).flatMap((p) => {
      const r = (p ?? {}) as { agent_id?: unknown; share?: unknown }
      return typeof r.agent_id === "string" ? [{ agentId: r.agent_id, share: Number(r.share) || 0 }] : []
    })
    const credits = shared.length ? shared : [{ agentId: String(row.agent_id), share: 100 }]
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
    for (const c of credits) {
      deals.push({
        saleId: String(row.id),
        agentId: c.agentId,
        date: (row.reservation_date as string | null) ?? String(row.created_at).slice(0, 10),
        project: one(row.projects as { name: string | null } | null)?.name ?? null,
        developer: one(row.developers as { name: string | null } | null)?.name ?? null,
        unit: (row.unit_number as string | null) ?? null,
        saleType: (row.sale_type as string | null) ?? null,
        price,
        share: c.share,
        value: Math.round((price * c.share) / 100),
      })
    }
  }

  return NextResponse.json({ people, deals })
}
