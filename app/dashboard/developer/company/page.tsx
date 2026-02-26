import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CompanyClient } from "./company-client"

export const dynamic = "force-dynamic"

export default async function DeveloperCompanyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname, metadata")
    .eq("id", user.id)
    .single<{
      id: string
      role: string | null
      fullname: string | null
      metadata: Record<string, unknown> | null
    }>()

  if (!profile || profile.role !== "developer") {
    redirect("/dashboard/developer")
  }

  const developerId = profile.metadata?.developer_id as string | undefined

  let developer = null
  if (developerId) {
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
      userId={user.id}
      userName={profile.fullname || user.email || "Developer"}
      developer={developer}
    />
  )
}
