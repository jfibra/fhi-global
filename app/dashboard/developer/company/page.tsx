import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionIdentity } from "@/lib/server-identity"
import { CompanyClient } from "./company-client"

export const dynamic = "force-dynamic"

export default async function DeveloperCompanyPage() {
  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  if (profile.role !== "developer") {
    redirect("/dashboard/developer")
  }

  const developerId = profile.metadata?.developer_id as string | undefined

  let developer = null
  if (developerId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("developers")
      .select("*")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
    developer = data
  }

  return (
    <CompanyClient
      userId={userId}
      userName={profile.fullname || email || "Developer"}
      developer={developer}
    />
  )
}
