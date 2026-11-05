import { NextRequest } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { reportGET, reportPOST } from "@/lib/team-report/handler"

/**
 * The Team Performance Report for any team — what the admin Teams page's "Performance report" button
 * opens (boss, 2026-11-05). Admin staff only. The request logic is shared with the team leaders' own
 * door (app/api/team/report) in lib/team-report/handler.tsx — read the contract there.
 */

export const runtime = "nodejs"
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  return reportGET(req, id, { kind: "admin" })
}

export async function POST(req: NextRequest, context: Ctx) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  return reportPOST(req, id, { kind: "admin" })
}
