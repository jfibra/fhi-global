"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { ProfileDashboardShell } from "./profile-dashboard-shell"
import type { DashboardProfile } from "./profile-form"

export default function DashboardProfilePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ""
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    if (!userId) return
    let active = true
    createClient()
      .from("profiles")
      .select(
        "id, role, fname, mname, lname, fullname, birthday, gender, profile_url, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at",
      )
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) {
          setStatus("error")
          return
        }
        setProfile(data as DashboardProfile)
        setStatus("ready")
      })
    return () => {
      active = false
    }
  }, [userId])

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        Profile not found. Please contact your administrator.
      </div>
    )
  }

  if (status === "loading" || !profile) {
    return (
      <div className="p-6">
        <div className="h-48 rounded-2xl bg-black/5 animate-pulse" />
      </div>
    )
  }

  return (
    <ProfileDashboardShell
      profile={profile}
      user={{ id: userId, email: user?.email ?? "" }}
    />
  )
}
