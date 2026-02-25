import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"

export async function GET() {
  const guard = await requireActiveSession()

  if (!guard.ok) {
    return guard.response
  }

  const { userId, email, profile } = guard.context

  return NextResponse.json({
    user: {
      id: userId,
      email,
    },
    profile,
    role: profile.role,
  })
}
