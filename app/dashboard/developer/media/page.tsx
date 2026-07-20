import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionIdentity } from "@/lib/server-identity"
import { DeveloperMediaClient } from "./developer-media-client"

export const dynamic = "force-dynamic"

export default async function DeveloperMediaPage() {
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
      .select("id, name, slug")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
    developer = data
  }

  return (
    <DeveloperMediaClient
      userId={userId}
      userName={profile.fullname || email || "Developer"}
      developerId={developerId ?? null}
      developerName={developer?.name ?? null}
      developerSlug={developer?.slug ?? null}
    />
  )
}
