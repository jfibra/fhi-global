import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { getRecruitsForUser } from "@/features/dashboard/invite/get-recruits"

/**
 * On-demand refresh for the recruits list (the page itself SSRs the initial
 * data via getRecruitsForUser). Strictly session-scoped: you only ever see
 * recruits from your own invite link.
 */
export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { userId, profile } = session.context
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const recruits = await getRecruitsForUser(userId)
    return NextResponse.json({ recruits })
  } catch {
    return NextResponse.json({ error: "Failed to load recruits" }, { status: 500 })
  }
}
