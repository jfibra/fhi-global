import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole, ROLES_SALES_PIPELINE, ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * Eligible referrers for the admin user-editor "Referred by" picker. These are
 * the same roles that can generate an invite link (sales pipeline + admin
 * staff — see app/dashboard/invite/page.tsx). Admin-gated; returns only safe
 * fields (id / name / role), no emails or phones.
 *
 * `?include=<id>` guarantees the given profile is present in the list even if
 * its role isn't eligible, so the editor can always render the current referrer.
 */
export type ReferrerOption = { id: string; fullname: string; role: string }

async function isAdminCaller(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  return !!profile && isAdminStaffRole(profile.role)
}

export async function GET(req: NextRequest) {
  if (!(await isAdminCaller())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const includeId = req.nextUrl.searchParams.get("include")?.trim() || null
  const admin = createAdminSupabase()

  const eligibleRoles = [...ROLES_SALES_PIPELINE, ...ROLES_ADMIN_STAFF]

  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, fname, lname, role")
    .in("role", eligibleRoles)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("fullname", { ascending: true })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: "Failed to load referrers" }, { status: 500 })
  }

  const toOption = (p: {
    id: string
    fullname: string | null
    fname: string | null
    lname: string | null
    role: string | null
  }): ReferrerOption => ({
    id: p.id,
    fullname:
      p.fullname?.trim() ||
      [p.fname, p.lname].filter(Boolean).join(" ").trim() ||
      "Unnamed user",
    role: p.role ?? "member",
  })

  const referrers: ReferrerOption[] = (data ?? []).map(toOption)

  // Ensure the currently-set referrer is always selectable, even if their role
  // no longer matches the eligible set (e.g. later demoted to member).
  if (includeId && !referrers.some((r) => r.id === includeId)) {
    const { data: extra } = await admin
      .from("profiles")
      .select("id, fullname, fname, lname, role")
      .eq("id", includeId)
      .maybeSingle<{ id: string; fullname: string | null; fname: string | null; lname: string | null; role: string | null }>()
    if (extra) referrers.unshift(toOption(extra))
  }

  return NextResponse.json({ referrers })
}
