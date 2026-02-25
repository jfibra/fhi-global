import { redirect } from "next/navigation"
import { getDashboardRouteByRole, getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function DashboardIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const { profile } = await getProfileByUserId(supabase, user.id)

  if (!profile) {
    redirect("/")
  }

  if (isInactiveProfile(profile)) {
    redirect("/account-inactive")
  }

  redirect(getDashboardRouteByRole(profile.role))
}
