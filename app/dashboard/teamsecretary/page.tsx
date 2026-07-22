"use client"

import { SecretaryLikeOverview } from "@/components/dashboard/secretary-like-overview"
import { useAuth } from "@/context/auth-context"

export default function TeamSecretaryDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return (
    <SecretaryLikeOverview
      displayName={displayName}
      businessCardHref="/dashboard/teamsecretary/business-card"
      intro="Follow team deals in sales reports, add paperwork while a sale is under review or marked invalid, and use support for admin or IT. Your business card holds your public profile."
    />
  )
}
