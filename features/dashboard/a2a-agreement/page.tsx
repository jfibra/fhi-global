"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { A2AClient } from "./a2a-client"

/**
 * A2A Collaboration Agreement. The sales ladder uses it for their own deals;
 * admin staff get it too (Agent Resource) so they can prepare one on an
 * agent's behalf.
 */
export default function A2AAgreementPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role) || isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <A2AClient
      defaultParty={{
        fullName: profile?.fullname ?? "",
        agency: "FHI Global Property",
        email: user?.email ?? "",
      }}
    />
  )
}
