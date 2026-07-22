"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ReelsMakerClient } from "./reels-maker-client"

function ReelsMakerPageInner() {
  const { user, profile, role } = useAuth()
  const searchParams = useSearchParams()
  const allowed = useRequireAllowed(isSalesPipelineRole(role) || isAdminStaffRole(role))
  if (!allowed) return null

  return (
    <ReelsMakerClient
      userId={user?.id ?? ""}
      userName={profile?.fullname ?? user?.email ?? "User"}
      currentRole={role ?? "agent"}
      initialListingId={searchParams.get("listing")}
    />
  )
}

export default function ReelsMakerPage() {
  return (
    <Suspense fallback={null}>
      <ReelsMakerPageInner />
    </Suspense>
  )
}
