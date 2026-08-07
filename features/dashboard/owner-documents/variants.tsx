"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { OwnerDocumentsClient } from "./owner-documents-client"

/**
 * Owner document requests (NOC / Trakheesi intake). Open to the sales pipeline
 * (agent, team leader, unit manager) and admin staff. Agents see their own
 * requests (RLS); admins see all (staff read policy in migration 039).
 */
export function OwnerDocuments() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role) || isAdminStaffRole(role))
  if (!allowed) return null

  return <OwnerDocumentsClient />
}
