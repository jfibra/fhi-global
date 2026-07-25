"use client"

import { Toaster } from "sonner"
import { usePathname } from "next/navigation"
import { isKnownRoleSlug } from "@/lib/app-roles"

/**
 * Route-aware sonner Toaster. Dashboard (role-prefixed) routes show toasts in
 * the bottom-right; public pages (homepage, listings, etc.) use top-center.
 * Mirrors proxy.ts's dashboard-route detection.
 */
export function AppToaster() {
  const pathname = usePathname() ?? ""
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? ""
  const inDashboard = pathname === "/dashboard" || isKnownRoleSlug(firstSegment)

  return <Toaster position={inDashboard ? "bottom-right" : "top-center"} richColors />
}
