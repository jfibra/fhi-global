import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"

export async function GET() {
  const guard = await requireRole(["super_admin", "admin"])

  if (!guard.ok) {
    return guard.response
  }

  return NextResponse.json({
    ok: true,
    message: "Admin access verified.",
    role: guard.context.profile.role,
  })
}
