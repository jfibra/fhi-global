"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthProvider } from "@/context/auth-context"
import { DashboardShell } from "@/components/dashboard/shell"
import { ProfilePhotoGate } from "@/components/dashboard/profile-photo-gate"
import { PartnerInfoGate } from "@/components/dashboard/partner-info-gate"
import { BRN_REQUIRED_PARAM, PROFILE_SAVED_EVENT, isProfilePath, needsBrnAnswer, type ProfileSavedDetail } from "@/lib/brn-required"
import { AssistantTeaserPopup } from "@/components/dashboard/assistant-teaser-popup"
import { partnerInfoMetadata } from "@/lib/partner-signup"
import { PageLoader } from "@/components/ui/PageLoader"
import { getDashboardRouteByRole, getProfileByUserId, isInactiveProfile, isUploadedProfilePhoto, type AppProfile, type AppUser } from "@/lib/auth"
import { ROLES_AGENT_ASSISTANT, isAdminStaffRole, isKnownAppRoleId, roleInList } from "@/lib/app-roles"
import { readViewAsCookie } from "@/lib/view-as"

/**
 * Client-side session provisioning for the dashboard.
 *
 * proxy.ts (middleware) is the real server-side auth boundary — it verifies the
 * session on every /dashboard/* request and redirects unauthenticated / inactive
 * users before this component ever renders. This gate simply resolves the user +
 * profile IN THE BROWSER (once, on mount) and feeds AuthProvider, so the dashboard
 * layout no longer needs to be a force-dynamic server component reading the session
 * per render. That keeps the route tree static/prefetchable → navigation between
 * pages is instant (no per-click server round-trip). Data stays RLS-protected.
 *
 * The children (pages) are only mounted once the session is resolved, so their
 * useAuth() always sees a populated profile — no null-profile flash.
 */
export function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<{ user: AppUser; profile: AppProfile } | null>(null)

  // The profile page saves on its own; it tells us what it saved so the BRN
  // redirect below stops without a reload.
  useEffect(() => {
    const onSaved = (e: Event) => {
      const { metadata } = (e as CustomEvent<ProfileSavedDetail>).detail ?? {}
      setSession((prev) => (prev ? { ...prev, profile: { ...prev.profile, metadata: metadata ?? {} } } : prev))
    }
    window.addEventListener(PROFILE_SAVED_EVENT, onSaved)
    return () => window.removeEventListener(PROFILE_SAVED_EVENT, onSaved)
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        // proxy.ts should have already redirected; this is a belt-and-suspenders fallback.
        router.replace("/")
        return
      }
      const { profile } = await getProfileByUserId(supabase, user.id)
      if (!active) return
      if (!profile) {
        router.replace("/")
        return
      }
      if (isInactiveProfile(profile)) {
        router.replace("/account-inactive")
        return
      }
      setSession({ user: { id: user.id, email: user.email ?? null }, profile })
    })()
    return () => {
      active = false
    }
  }, [router])

  // BRN not answered yet → their own profile page (any role's /…/profile shows
  // their own profile), with a flag so it scrolls to the BRN field.
  useEffect(() => {
    if (!session || isProfilePath(pathname)) return
    if (!isUploadedProfilePhoto(session.profile.profile_url) || !needsBrnAnswer(session.profile.metadata)) return
    router.replace(`${getDashboardRouteByRole(session.profile.role)}/profile?${BRN_REQUIRED_PARAM}=required`)
  }, [session, pathname, router])

  if (!session) {
    return <PageLoader />
  }

  // Mounted here rather than per-page so it covers every dashboard route with
  // one instance, on the resolved profile this gate already has. The shell
  // still renders underneath: the gate is an overlay, so signing out or the
  // page behind it never gets torn down mid-upload.
  //
  // This modal is THE photo enforcement for all roles — /complete-profile
  // handles the written details but deliberately doesn't require the photo. It
  // asks for a photo the person UPLOADED (isUploadedProfilePhoto, stored on S3):
  // a Google picture doesn't count, because for Google accounts without a real
  // photo it's a letter avatar ("MS") that can't be told apart by its link, and
  // the directory / business cards need a real headshot. A Google picture
  // already on the profile stays there for display until they upload.
  const needsPhoto = !isUploadedProfilePhoto(session.profile.profile_url)

  const meta = (session.profile.metadata ?? {}) as Record<string, unknown>

  // Next, the RERA BRN (lib/brn-required.ts): until the person saves a BRN the
  // Dubai Land Department register has, or ticks "I'm not a broker", every
  // dashboard page sends them to their profile page, where the BRN field is
  // highlighted. After the photo — the photo pop-up shows over any page.
  const needsBrn = !needsPhoto && needsBrnAnswer(meta)
  const afterSetup = !needsPhoto && !needsBrn
  // Hold the page while the redirect above runs.
  if (needsBrn && !isProfilePath(pathname)) return <PageLoader />
  // A Global Partner who joined before the invite asked where they live answers
  // it once here (lib/partner-signup.ts) — after the photo, never two at once.
  // Their real role only: an admin viewing as a partner isn't asked.
  const needsPartnerInfo =
    session.profile.role === "global_partner" && !(typeof meta.residence_country === "string" && meta.residence_country)

  // Everyone with an FHI Assistant — agents, team leaders and admin staff — sees its teaser once per account
  // (their real role, so it opens their own assistant), after the photo gate.
  const showsTeaser =
    (roleInList(session.profile.role, ROLES_AGENT_ASSISTANT) || isAdminStaffRole(session.profile.role)) &&
    typeof meta.assistant_teaser_seen_at !== "string"

  // Admin "view as role": honor the view-as cookie only for a real admin-staff
  // account (mirrors proxy.ts). Everyone else sees their real role.
  const cookieRole = readViewAsCookie()
  const viewAsRole =
    isAdminStaffRole(session.profile.role) && isKnownAppRoleId(cookieRole) && cookieRole !== session.profile.role
      ? cookieRole
      : null

  return (
    <AuthProvider user={session.user} profile={session.profile} viewAsRole={viewAsRole}>
      <DashboardShell>{children}</DashboardShell>
      {needsPhoto && (
        <ProfilePhotoGate
          userId={session.user.id}
          displayName={
            session.profile.fullname
            ?? [session.profile.fname, session.profile.lname].filter(Boolean).join(" ")
          }
          onSaved={(url) =>
            setSession((prev) => (prev ? { ...prev, profile: { ...prev.profile, profile_url: url } } : prev))
          }
        />
      )}
      {afterSetup && needsPartnerInfo && (
        <PartnerInfoGate
          displayName={
            session.profile.fullname
            ?? [session.profile.fname, session.profile.lname].filter(Boolean).join(" ")
          }
          whatsappCode={typeof meta.whatsapp_country_code === "string" ? meta.whatsapp_country_code : null}
          whatsappNumber={typeof meta.whatsapp_number === "string" ? meta.whatsapp_number : null}
          onSaved={(info) =>
            setSession((prev) =>
              prev
                ? { ...prev, profile: { ...prev.profile, metadata: { ...(prev.profile.metadata ?? {}), ...partnerInfoMetadata(info) } } }
                : prev,
            )
          }
        />
      )}
      {afterSetup && showsTeaser && (
        <AssistantTeaserPopup
          firstName={(session.profile.fname ?? session.profile.fullname ?? "").trim().split(/\s+/)[0] ?? ""}
          chatHref={`${getDashboardRouteByRole(session.profile.role)}/fhi-chat`}
          onDone={() =>
            setSession((prev) =>
              prev
                ? { ...prev, profile: { ...prev.profile, metadata: { ...(prev.profile.metadata ?? {}), assistant_teaser_seen_at: new Date().toISOString() } } }
                : prev,
            )
          }
        />
      )}
    </AuthProvider>
  )
}
