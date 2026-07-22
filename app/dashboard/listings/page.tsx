"use client"

import { useAuth } from "@/context/auth-context"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { AgentListingsClient } from "./listings-client"

export default function AgentListingsPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role))
  if (!allowed) return null

  return (
    <AgentListingsClient
      userId={user?.id ?? ""}
      userName={profile?.fullname ?? user?.email ?? "User"}
      currentRole={role ?? "agent"}
    />
  )
}
