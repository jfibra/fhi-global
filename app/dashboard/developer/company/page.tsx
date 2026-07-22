"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Developer } from "@/lib/developer-service"
import { CompanyClient } from "./company-client"

export default function DeveloperCompanyPage() {
  const { user, profile } = useAuth()
  const developerId = (profile?.metadata?.developer_id as string | undefined) ?? null
  const [developer, setDeveloper] = useState<Developer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!developerId) { setLoading(false); return }
    createClient()
      .from("developers")
      .select("*")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
      .then(({ data }) => { if (active) { setDeveloper(data as Developer | null); setLoading(false) } })
    return () => { active = false }
  }, [developerId])

  if (loading) return <div className="p-6"><div className="h-48 rounded-2xl bg-black/5 animate-pulse" /></div>

  return (
    <CompanyClient
      userId={user?.id ?? ""}
      userName={profile?.fullname || user?.email || "Developer"}
      developer={developer}
    />
  )
}
