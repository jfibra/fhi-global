import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"

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

  const people: RecruitmentPerson[] = rows.map((p) => {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    const invitedBy = typeof meta.invited_by === "string" && meta.invited_by && !meta.developer_invite_id ? meta.invited_by : null
    const raw = (typeof p.fullname === "string" && p.fullname.trim()) || [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")
    return {
      id: String(p.id),
      name: titleCaseName(raw) || "Unnamed account",
      role: (p.role as string | null) ?? null,
      status: ((p.status as string | null) ?? "pending").toLowerCase(),
      photo: (p.profile_url as string | null) || null,
      joinedAt: (p.joined_at as string | null) ?? null,
      invitedBy,
    }
  })

  return NextResponse.json({ people })
}
