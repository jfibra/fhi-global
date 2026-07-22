import { NextRequest, NextResponse } from "next/server"
import { resolveInviteToken } from "@/lib/developer-invites"

// Public token check for the /join page. Returns only display-safe fields —
// never the token, created_by, or use/limit counts.

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const res = await resolveInviteToken(token)
  if (res.status !== "valid") {
    return NextResponse.json({ status: res.status })
  }
  return NextResponse.json({
    status: "valid",
    autoActivate: res.config.autoActivate,
    developer: res.config.developer, // {id,name,slug,logo_url,is_verified} or null (generic)
  })
}
