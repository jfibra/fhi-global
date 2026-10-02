"use client"

import { useAuth } from "@/context/auth-context"
import { canViewDocumentLibrary } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { DocumentsClient } from "./documents-client"

export default function DocumentsPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(canViewDocumentLibrary(role))
  if (!allowed) return null

  return <DocumentsClient />
}
