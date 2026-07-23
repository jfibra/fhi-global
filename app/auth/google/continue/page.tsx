import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProfileByUserId, pickSafePostLoginRedirect } from "@/lib/auth"
import GoogleContinuePanel from "./continue-panel"

// Post-Google-redirect landing. The session is already established (by
// /auth/callback). First-time Google users see the Leuterio Realty account
// modal here before provisioning; already-provisioned users are sent straight
// to their dashboard.

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function GoogleContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>
}) {
  const { next, ref } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const { profile } = await getProfileByUserId(supabase, user.id)
  const meta = (profile?.metadata ?? {}) as Record<string, unknown>

  // Returning Google user — skip the modal, go where they were headed.
  if (meta.google_provisioned === true) {
    redirect(pickSafePostLoginRedirect(next ?? null, profile?.role ?? null))
  }

  return <GoogleContinuePanel next={next ?? null} inviteRef={ref ?? null} />
}
