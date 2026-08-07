"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthProvider } from "@/context/auth-context"
import { DashboardShell } from "@/components/dashboard/shell"
import { ProfilePhotoGate } from "@/components/dashboard/profile-photo-gate"
import { PageLoader } from "@/components/ui/PageLoader"
import { getProfileByUserId, googleAvatarUrl, hasProfilePhoto, isInactiveProfile, type AppProfile, type AppUser } from "@/lib/auth"
import { isAdminStaffRole, isKnownAppRoleId } from "@/lib/app-roles"
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
  const [session, setSession] = useState<{ user: AppUser; profile: AppProfile } | null>(null)

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
      // If there's no saved photo yet but the user signed in with Google, adopt
      // their Google avatar as the profile photo (persist best-effort so it
      // displays everywhere and sticks) rather than forcing them to upload one
      // they effectively already have. Only ever fills an empty profile_url —
      // never overwrites an existing photo.
      let resolved = profile
      if (!hasProfilePhoto(profile.profile_url)) {
        const gAvatar = googleAvatarUrl(user.user_metadata)
        if (gAvatar) {
          resolved = { ...profile, profile_url: gAvatar }
          void supabase.from("profiles").update({ profile_url: gAvatar }).eq("id", user.id)
        }
      }
      setSession({ user: { id: user.id, email: user.email ?? null }, profile: resolved })
    })()
    return () => {
      active = false
    }
  }, [router])

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
  // is satisfied by ANY saved photo (an uploaded headshot or the Google avatar
  // adopted above), so it only appears for accounts with no photo at all — e.g.
  // email/password sign-ups. (isUploadedProfilePhoto, the stricter "real upload"
  // rule, still governs spots where headshot quality specifically matters.)
  const needsPhoto = !hasProfilePhoto(session.profile.profile_url)

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
    </AuthProvider>
  )
}
