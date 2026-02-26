import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DeveloperDashboardShell } from "./developer-dashboard-shell"

export const dynamic = "force-dynamic"

export default async function DeveloperDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname, profile_url, metadata")
    .eq("id", user.id)
    .single<{
      id: string
      role: string | null
      fullname: string | null
      profile_url: string | null
      metadata: Record<string, unknown> | null
    }>()

  if (!profile) redirect("/login")

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
      userId={user.id}
      userName={profile.fullname || user.email || "Developer"}
      developerId={developerId ?? null}
      developerName={developer?.name ?? null}
      developerSlug={developer?.slug ?? null}
      developerLogoUrl={developer?.logo_url ?? null}
    />
  )
}
