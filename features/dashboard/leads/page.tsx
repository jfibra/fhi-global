"use client"

import { Suspense } from "react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { LeadsClient } from "./leads-client"

export default function LeadsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  // Suspense: LeadsClient reads the URL (?folder=&open=) via useSearchParams.
  return (
    <Suspense fallback={null}>
      <LeadsClient />
    </Suspense>
  )
}
