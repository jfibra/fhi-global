"use client"

import { useParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { LeadDetailClient } from "./lead-detail-client"

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return <LeadDetailClient id={id} />
}
