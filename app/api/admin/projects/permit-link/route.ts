import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireActiveSession } from "@/lib/auth-guard"
import { resolvePermitLink } from "@/lib/trakheesi"

// Reads the Dubai Land Department link out of an uploaded Trakheesi QR image.
// Any active account may call it (staff and developer-portal users both
// upload permits); it only reads the image and returns the link, the caller
// stores it on the project through its normal save path.

export const runtime = "nodejs"

const Body = z.object({ imageUrl: z.string().url().max(2000) })

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = Body.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid image URL." }, { status: 400 })

  // Only images from our own bucket are fetched server-side.
  const publicBase = process.env.S3_PUBLIC_URL ?? ""
  if (!publicBase || !parsed.data.imageUrl.startsWith(publicBase)) {
    return NextResponse.json({ error: "Image must be an uploaded project file." }, { status: 400 })
  }

  try {
    const link = await resolvePermitLink(parsed.data.imageUrl)
    return NextResponse.json({ link })
  } catch (err) {
    console.error("[permit-link] decode failed:", err instanceof Error ? err.message : err)
    return NextResponse.json({ link: null })
  }
}
