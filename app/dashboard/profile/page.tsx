import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileDashboardShell } from "./profile-dashboard-shell"

export const dynamic = "force-dynamic"

type ProfileRecord = {
  id: string
  role: string | null
  fname: string | null
  mname: string | null
  lname: string | null
  fullname: string | null
  birthday: string | null
  gender: string | null
  profile_url: string | null
  status: string | null
  timezone: string | null
  metadata: Record<string, unknown> | null
  joined_at: string | null
  updated_at: string | null
  is_deleted: boolean | null
  deleted_at: string | null
}

export default async function DashboardProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, role, fname, mname, lname, fullname, birthday, gender, profile_url, status, timezone, metadata, joined_at, updated_at, is_deleted, deleted_at",
    )
    .eq("id", user.id)
    .single<ProfileRecord>()

  if (error || !profile) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        Profile not found. Please contact your administrator.
      </div>
    )
  }

  return (
    <ProfileDashboardShell
      profile={profile}
      user={{
        id: user.id,
        email: user.email ?? "",
      }}
    />
  )
}
