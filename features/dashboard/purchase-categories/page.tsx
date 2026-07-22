"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { PurchaseCategoriesTable } from "./purchase-categories-table"

export default function PurchaseCategoriesPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <PurchaseCategoriesTable
      currentUserId={profile?.id ?? ""}
      currentRole={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
    />
  )
}
