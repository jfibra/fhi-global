import { NextRequest, NextResponse } from "next/server"
import { verifyGoogleCredential } from "@/lib/google/verify-id-token"
import { lookupLrAgent } from "@/lib/lr/lr-api"
import { roleToLabel } from "@/lib/app-roles"

// Pre-sign-in inspection for the Google flow: given a verified Google
// credential, look up the email in Leuterio Realty and return what the modal
// should show. This creates NO account — provisioning happens at
// /api/auth/google/finalize after the user confirms. Verifying the credential
// (and using its email, never a client-supplied one) keeps this from being an
// open LR-scraping proxy.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { credential?: unknown } | null
  const credential = typeof body?.credential === "string" ? body.credential : ""
  if (!credential) {
    return NextResponse.json({ error: "Missing credential" }, { status: 400 })
  }

  const identity = await verifyGoogleCredential(credential)
  if (!identity) {
    return NextResponse.json({ error: "Invalid Google credential" }, { status: 401 })
  }

  const result = await lookupLrAgent(identity.email)
  const lr = result.kind === "agent" ? result.agent : null
  const mappedRole = lr ? lr.mappedFhiRole : "member"

  return NextResponse.json({
    google: {
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
    },
    lr,
    mappedRole,
    mappedRoleLabel: roleToLabel(mappedRole),
  })
}
