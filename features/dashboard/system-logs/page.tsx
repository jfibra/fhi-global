"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { SystemLogsClient } from "@/components/dashboard/system-logs/system-logs-client"

export default function SystemLogsPage() {
  const { profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  // Any admin-staff role that can reach this page may clear logs.
  return <SystemLogsClient currentRole={profile?.role ?? "admin"} canClear />
}
