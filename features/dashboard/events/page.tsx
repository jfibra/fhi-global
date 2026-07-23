import { redirect } from "next/navigation"
import { isInactiveProfile } from "@/lib/auth"
import { canManageEvents } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { EventsClient } from "./events-client"

export const dynamic = "force-dynamic"

export default async function EventsAdminPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Event management: admin staff + team leaders (see ROLES_EVENT_MANAGERS).
  if (!canManageEvents(profile.role)) {
    redirect("/dashboard")
  }

  return <EventsClient />
}
