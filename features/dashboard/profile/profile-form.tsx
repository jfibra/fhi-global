"use client"

import { Check, AlertCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ProfileSidebar } from "./profile-sidebar"
import { ProfileTabs } from "./profile-tabs"

export type DashboardProfile = {
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

function toSafeString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function getProfileCompletion(profile: DashboardProfile) {
  const metadata = profile.metadata ?? {}
  const checks = [
    profile.fname,
    profile.lname,
    profile.fullname,
    profile.timezone,
    profile.birthday,
    profile.gender,
    profile.profile_url,
    // The mobile number is stored under metadata.phone_number (set by the
    // profile form and /complete-profile), not metadata.phone — checking the
    // wrong key left a filled-in phone permanently uncounted.
    toSafeString(metadata.phone_number),
    toSafeString(metadata.bio),
    toSafeString(metadata.linkedin),
  ]

  const completed = checks.filter((value) => Boolean(value && String(value).trim())).length
  return Math.round((completed / checks.length) * 100)
}

export function ProfileForm({
  initialProfile,
  user,
}: {
  initialProfile: DashboardProfile
  user: {
    id: string
    email: string
  }
}) {
  const [profile, setProfile] = useState<DashboardProfile>(initialProfile)
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const completion = useMemo(() => getProfileCompletion(profile), [profile])

  const saveProfileUrl = async (profileUrl: string | null) => {
    const supabase = createClient()

    const previous = profile
    setProfile((prev) => ({ ...prev, profile_url: profileUrl }))

    const { error } = await supabase
      .from("profiles")
      .update({ profile_url: profileUrl })
      .eq("id", profile.id)

    if (error) {
      setProfile(previous)
      setBanner({ type: "error", message: error.message || "Failed to update profile photo." })
      return
    }

    setBanner({ type: "success", message: "Profile photo updated." })
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`border px-4 py-3.5 text-sm flex items-center gap-3 ${
            banner.type === "success"
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-rose-50 border-rose-100 text-rose-700"
          }`}
        >
          <div className="bg-white p-1 rounded-full flex-shrink-0">
            {banner.type === "success" ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-rose-600" />
            )}
          </div>
          <span className="font-medium">{banner.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <ProfileSidebar
          profile={profile}
          email={user.email}
          completion={completion}
          avatarBusy={avatarBusy}
          onAvatarBusyChange={setAvatarBusy}
          onAvatarUploaded={(url) => {
            void saveProfileUrl(url)
          }}
          onAvatarRemoved={() => {
            void saveProfileUrl(null)
          }}
          onError={(message) => setBanner({ type: "error", message })}
        />

        <ProfileTabs
          profile={profile}
          onProfileChange={setProfile}
          onSuccess={(message) => setBanner({ type: "success", message })}
          onError={(message) => setBanner({ type: "error", message })}
        />
      </div>
    </div>
  )
}
