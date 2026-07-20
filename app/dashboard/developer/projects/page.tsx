import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionIdentity } from "@/lib/server-identity"
import { DeveloperProjectsClient } from "./developer-projects-client"

export const dynamic = "force-dynamic"

export default async function DeveloperProjectsPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  if (profile.role !== "developer") {
    redirect("/dashboard/developer")
  }

  const supabase = await createClient()

  const developerId = profile.metadata?.developer_id as string | undefined

  let developer = null
  if (developerId) {
    const { data } = await supabase
      .from("developers")
      .select("id, name, slug, logo_url")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
    developer = data
  }

  return (
    <DeveloperProjectsClient
      userId={userId}
      userName={profile.fullname || email || "Developer"}
      developerId={developerId ?? null}
      developerName={developer?.name ?? null}
      developerSlug={developer?.slug ?? null}
    />
  )
}
