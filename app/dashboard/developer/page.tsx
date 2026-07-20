import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionIdentity } from "@/lib/server-identity"
import { DeveloperDashboardShell } from "./developer-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function DeveloperDashboardPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const supabase = await createClient()

  // Get the developer linked to this user
  const developerId = profile.metadata?.developer_id as string | undefined

  let developer = null
  if (developerId) {
    const { data } = await supabase
      .from("developers")
      .select("id, name, slug, logo_url, is_verified, is_active")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
    developer = data
  }

  return (
    <DeveloperDashboardShell
      userId={userId}
      userName={profile.fullname || email || "Developer"}
      developerId={developerId ?? null}
      developerName={developer?.name ?? null}
      developerSlug={developer?.slug ?? null}
      developerLogoUrl={developer?.logo_url ?? null}
    />
  )
}
