"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { PurchasesTable } from "./purchases-table"

export default function PurchasesPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <PurchasesTable
      currentUserId={user?.id ?? ""}
      currentRole={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
    />
  )
}
