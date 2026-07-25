"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { EncodeSaleClient } from "./encode-client"

export default function EncodeSalePage() {
  const { user, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role) || isSalesPipelineRole(role))
  if (!allowed) return null

  return (
    <EncodeSaleClient
      currentUserId={user?.id ?? ""}
      currentRole={(role ?? "").toLowerCase().trim()}
    />
  )
}
