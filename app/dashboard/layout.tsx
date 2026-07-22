import { redirect } from "next/navigation"
import { AuthProvider } from "@/context/auth-context"
import { DashboardShell } from "@/components/dashboard/shell"
import { isInactiveProfile, type AppUser } from "@/lib/auth"
import { getSessionIdentity } from "@/lib/server-identity"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // proxy.ts already verified the session for /dashboard/* and forwarded it;
  // getSessionIdentity falls back to a full Supabase check if needed.
  const identity = await getSessionIdentity()

  if (!identity) {
    redirect("/login")
  }

  const { userId, email, profile } = identity

  if (isInactiveProfile(profile)) {
    redirect("/account-inactive")
  }

  const appUser: AppUser = {
    id: userId,
    email,
  }

  // The shell (sidebar + top header) is rendered ONCE here so it persists across
  // navigation between /dashboard/* pages — React keeps the layout mounted, so the
  // sidebar/header never re-render (collapse state and scroll are preserved).
  // It derives role/label/color/name from the profile via AuthProvider context.
  return (
    <AuthProvider user={appUser} profile={profile}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
