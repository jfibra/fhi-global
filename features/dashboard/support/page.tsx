"use client"

import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"
import { SupportTable } from "./support-table"

export default function SupportPage() {
  const { user, profile, role } = useAuth()
  const roleValue = (role ?? "").toLowerCase().trim()
  const allowed = useRequireAllowed(canAccessSupportRole(roleValue))
  if (!allowed) return null

  return (
    <SupportTable
      currentUserId={user?.id ?? ""}
      currentRole={roleValue}
      userName={profile?.fullname || user?.email || "User"}
      isAdminView={isSupportAdmin(roleValue)}
    />
  )
}
