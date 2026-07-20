import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lookupLrAgent } from "@/lib/lr/lr-api"
import { roleToLabel } from "@/lib/app-roles"

// Session-based Leuterio Realty lookup for the post-Google-redirect modal.
// Runs as the signed-in user (the OAuth redirect already established the
// session) and looks up their Supabase-verified email — no client input is
// trusted. Read-only; provisioning happens in /api/auth/google/finalize.

export const runtime = "nodejs"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const email = (user.email ?? "").toLowerCase()
  const result = await lookupLrAgent(email)
  const lr = result.kind === "agent" ? result.agent : null
  const mappedRole = lr ? lr.mappedFhiRole : "member"

  const meta = user.user_metadata ?? {}
  const picture =
    typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null

  return NextResponse.json({
    google: {
      email,
      name: typeof meta.name === "string" ? meta.name : null,
      picture,
    },
    lr,
    mappedRole,
    mappedRoleLabel: roleToLabel(mappedRole),
  })
}
