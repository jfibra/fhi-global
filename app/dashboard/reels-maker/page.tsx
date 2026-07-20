import { redirect } from "next/navigation"
import { isInactiveProfile } from "@/lib/auth"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { ReelsMakerClient } from "./reels-maker-client"

export const dynamic = "force-dynamic"

export default async function ReelsMakerPage({
  searchParams,
}: {
  searchParams?: Promise<{ listing?: string | string[] }>
}) {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Sales pipeline roles create reels for their listings; admins can use it too.
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    redirect("/dashboard")
  }

  // Deep link from My listings / Quick Actions: ?listing=<id> preselects the listing.
  const sp = searchParams ? await searchParams : {}
  const listingParam = typeof sp.listing === "string" ? sp.listing : Array.isArray(sp.listing) ? sp.listing[0] : null

  return (
    <ReelsMakerClient
      userId={userId}
      userName={profile.fullname ?? email ?? "User"}
      currentRole={profile.role ?? "agent"}
      initialListingId={listingParam}
    />
  )
}
