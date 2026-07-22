"use client"

import { useParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ContactDetailClient } from "./contact-detail-client"

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  if (!allowed) return null

  return <ContactDetailClient id={id} />
}
