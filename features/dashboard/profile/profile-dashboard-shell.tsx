"use client"

import { ProfileForm, type DashboardProfile } from "./profile-form"

export function ProfileDashboardShell({
  profile,
  user,
}: {
  profile: DashboardProfile
  user: {
    id: string
    email: string
  }
}) {
  return <ProfileForm initialProfile={profile} user={user} />
}
