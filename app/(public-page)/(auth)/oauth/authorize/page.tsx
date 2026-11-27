import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { roleToLabel } from "@/lib/app-roles"
import { getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { CONSENT_PATH, checkAuthorizeRequest, clientDisplayName, consentItems, eventsScopeAllowed, mcpSignInAllowed } from "@/lib/oauth/server"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { ConsentUI, ConsentShell } from "./consent-ui"

/**
 * The consent page of the Claude sign-in (2026-11-24): claude.ai or Claude
 * Code sends the person here (the authorization_endpoint in the metadata).
 * Signed out → the staff sign-in with `next` back here; signed in → "Allow
 * Claude to read your FHI data?" with what their role gets. Allow and Cancel
 * post to /api/oauth/authorize, which mints the code and hands back the
 * address to go to. A role that manages events is also offered a ticked
 * box, "Create, change and publish company events" (2026-11-27) — the only
 * permission that writes.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Allow Claude · FHI Global",
  robots: { index: false, follow: false },
}

export default async function AuthorizePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = searchParams ? await searchParams : {}
  const raw: Record<string, string> = {}
  for (const [k, v] of Object.entries(sp)) {
    const one = Array.isArray(v) ? v[0] : v
    if (typeof one === "string") raw[k] = one
  }

  if (!hasServerSupabaseEnv()) return <ConsentShell problem="Sign-in is not configured on this server." />

  const check = await checkAuthorizeRequest(raw)
  if (!check.ok) {
    if (check.fatal) return <ConsentShell problem={check.message} />
    redirect(check.redirect)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const here = `${CONSENT_PATH}?${new URLSearchParams(raw).toString()}`
    redirect(`/staff-login?next=${encodeURIComponent(here)}`)
  }

  const { profile } = await getProfileByUserId(supabase, user.id)
  const blocked = !profile || isInactiveProfile(profile) ? "inactive" : !mcpSignInAllowed(profile.role) ? "role" : null

  return (
    <ConsentUI
      app={clientDisplayName(check.client)}
      backHost={new URL(check.params.redirect_uri).host}
      name={profile?.fullname?.trim() || user.email || "you"}
      roleLabel={roleToLabel(profile?.role)}
      items={consentItems(profile?.role)}
      eventsOffer={!blocked && eventsScopeAllowed(profile?.role)}
      params={{ ...check.params, response_type: "code" }}
      blocked={blocked}
    />
  )
}
