import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProfileByUserId, isInactiveProfile } from "@/lib/auth"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { ReelsMakerClient } from "./reels-maker-client"

export const dynamic = "force-dynamic"

export default async function ReelsMakerPage({
  searchParams,
}: {
  searchParams?: Promise<{ listing?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { profile } = await getProfileByUserId(supabase, user.id)
  if (!profile) redirect("/login")
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Sales pipeline roles create reels for their listings; admins can use it too.
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  const sp = searchParams ? await searchParams : {}
  const listingParam = typeof sp.listing === "string" ? sp.listing : Array.isArray(sp.listing) ? sp.listing[0] : null

  return (
    <ReelsMakerClient
      userId={user.id}
      userName={profile.fullname ?? user.email ?? "User"}
      currentRole={profile.role ?? "agent"}
      initialListingId={listingParam}
    />
  )
}
