"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { DeveloperProjectsClient } from "./developer-projects-client"

type DeveloperRow = { id: string; name: string; slug: string }

export function DeveloperProjectsRoute() {
  const { user, profile } = useAuth()
  const developerId = (profile?.metadata?.developer_id as string | undefined) ?? null
  const [developer, setDeveloper] = useState<DeveloperRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!developerId) { setLoading(false); return }
    createClient()
      .from("developers")
      .select("id, name, slug")
      .eq("id", developerId)
      .is("deleted_at", null)
      .single()
      .then(({ data }) => { if (active) { setDeveloper(data as DeveloperRow | null); setLoading(false) } })
    return () => { active = false }
  }, [developerId])

  if (loading) return <div className="p-6"><div className="h-48 rounded-2xl bg-black/5 animate-pulse" /></div>

  return (
    <DeveloperProjectsClient
      userId={user?.id ?? ""}
      userName={profile?.fullname || user?.email || "Developer"}
      developerId={developerId}
      developerName={developer?.name ?? null}
      developerSlug={developer?.slug ?? null}
    />
  )
}
