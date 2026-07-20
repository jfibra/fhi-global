import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lookupLrAgent, resolveGoogleRole } from "@/lib/lr/lr-api"
import { roleToLabel } from "@/lib/app-roles"
import { getProfileByUserId } from "@/lib/auth"

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

  // Show the role the account will actually end up with: an existing curated
  // (non-member) role is preserved, an un-curated member is upgraded to the LR
  // role — matching what /api/auth/google/finalize will persist.
  const { profile } = await getProfileByUserId(supabase, user.id)
  const mappedRole = resolveGoogleRole(profile?.role, lr)

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
