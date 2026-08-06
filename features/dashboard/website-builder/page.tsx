"use client"

import { useAuth } from "@/context/auth-context"
import { canUseWebsiteBuilder } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { WebsiteBuilderClient } from "./website-builder-client"

export default function WebsiteBuilderPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(canUseWebsiteBuilder(role))
  if (!allowed) return null
  return <WebsiteBuilderClient />
}
