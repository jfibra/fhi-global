"use client"

import { SalesPipelineOverview } from "@/components/dashboard/sales-pipeline-overview"
import { useAuth } from "@/context/auth-context"

export default function AgentDashboard() {
  const { user, profile } = useAuth()
  const displayName = profile?.fullname ?? user?.email ?? "User"

  return <SalesPipelineOverview displayName={displayName} userId={user?.id} />
}
