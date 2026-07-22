"use client"

import { MemberOverview } from "@/components/dashboard/member-overview"
import { useAuth } from "@/context/auth-context"

export default function MemberDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return <MemberOverview displayName={displayName} />
}
