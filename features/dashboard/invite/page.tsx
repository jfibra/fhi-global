"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { InviteClient } from "./invite-client"

export default function InvitePage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role) || isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <InviteClient
      userId={user?.id ?? ""}
      userName={profile?.fullname ?? user?.email ?? "User"}
      currentRole={role ?? "agent"}
    />
  )
}
