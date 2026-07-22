"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { TaxEntitiesTable } from "./tax-entities-table"

export default function TaxEntitiesPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <TaxEntitiesTable
      currentRole={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
    />
  )
}
