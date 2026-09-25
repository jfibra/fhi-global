import { redirect } from "next/navigation"
import { getDashboardRouteByRole, isInactiveProfile } from "@/lib/auth"
import { canManageEvents, canUseEventsArea } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { agentWebsite } from "@/lib/events/access"
import { EventsClient } from "./events-client"

export const dynamic = "force-dynamic"

export default async function EventsAdminPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/staff-login")
  const { profile } = identity
  if (isInactiveProfile(profile)) redirect("/account-inactive")

  // Admin staff manage every event (company + agents'); Website Builder users
  // only their own, which appear on their website (see ROLES_EVENT_OWNERS).
  if (!canUseEventsArea(profile.role)) {
    redirect("/dashboard")
  }

  if (canManageEvents(profile.role)) {
    return <EventsClient scope="all" />
  }

  // An agent's events live on their website — without one there's nowhere to
  // publish them, so the page leads them to the Website Builder first.
  const website = await agentWebsite(createAdminSupabase(), profile.id)
  return (
    <EventsClient
      scope="own"
      website={website}
      websiteBuilderHref={`${getDashboardRouteByRole(profile.role)}/website-builder`}
    />
  )
}
