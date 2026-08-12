"use client"

import { Suspense } from "react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { LeadsClient } from "./leads-client"

export default function LeadsPage() {
  const { role, profile } = useAuth()
  const isAdmin = isAdminStaffRole(role)
  // A personal company mailbox unlocks a scoped Emails view: compose + own
  // Sent folder, sent AS that mailbox. Everyone else on the ladder gets no
  // Emails at all (the sidebar hides it too).
  const hasMailbox = Boolean((profile?.mailbox_address ?? "").trim())
  const allowed = useRequireAllowed(isAdmin || hasMailbox)
  if (!allowed) return null

  // Suspense: LeadsClient reads the URL (?folder=&open=) via useSearchParams.
  return (
    <Suspense fallback={null}>
      <LeadsClient personal={!isAdmin} />
    </Suspense>
  )
}
