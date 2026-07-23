"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthProvider } from "@/context/auth-context"
import { DashboardShell } from "@/components/dashboard/shell"
import { PageLoader } from "@/components/ui/PageLoader"
import { getProfileByUserId, isInactiveProfile, type AppProfile, type AppUser } from "@/lib/auth"

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

  return (
    <AuthProvider user={session.user} profile={session.profile}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
