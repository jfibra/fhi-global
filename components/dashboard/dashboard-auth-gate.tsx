"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthProvider } from "@/context/auth-context"
import { DashboardShell } from "@/components/dashboard/shell"
import { ProfilePhotoGate } from "@/components/dashboard/profile-photo-gate"
import { PageLoader } from "@/components/ui/PageLoader"
import { getProfileByUserId, isInactiveProfile, isUploadedProfilePhoto, type AppProfile, type AppUser } from "@/lib/auth"

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
      setSession({ user: { id: user.id, email: user.email ?? null }, profile })
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
  // handles the written details but deliberately doesn't require the photo.
  // isUploadedProfilePhoto also rejects the Google avatar OAuth copies onto
  // profiles: a 96px Gmail thumbnail isn't the professional headshot the
  // directory and business cards need.
  const needsPhoto = !isUploadedProfilePhoto(session.profile.profile_url)

  return (
    <AuthProvider user={session.user} profile={session.profile}>
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
