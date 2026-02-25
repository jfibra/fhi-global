import { redirect } from "next/navigation"
import { AuthProvider } from "@/context/auth-context"
import { ensureProfileForUser, isInactiveProfile, type AppUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { profile } = await ensureProfileForUser(supabase, {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  })

  if (!profile) {
    await supabase.auth.signOut()
    redirect("/")
  }

  if (isInactiveProfile(profile)) {
    redirect("/account-inactive")
  }

  const appUser: AppUser = {
    id: user.id,
    email: user.email,
  }

  return (
    <AuthProvider user={appUser} profile={profile}>
      {children}
    </AuthProvider>
  )
}
