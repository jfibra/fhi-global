import { NextResponse } from "next/server"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { requireRole } from "@/lib/auth-guard"

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])

  if (!guard.ok) {
    return guard.response
  }

  return NextResponse.json({
    ok: true,
    message: "Admin access verified.",
    role: guard.context.profile.role,
  })
}
