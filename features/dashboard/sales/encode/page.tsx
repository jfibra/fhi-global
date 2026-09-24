"use client"

import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { toTitleCase } from "../sale-ui"
import { EncodeSaleClient } from "./encode-client"

export default function EncodeSalePage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role) || isSalesPipelineRole(role))
  if (!allowed) return null

  const phone = profile?.metadata?.phone_number
  const avatar = profile?.profile_url?.trim() ?? ""

  return (
    <EncodeSaleClient
      currentUserId={user?.id ?? ""}
      currentRole={(role ?? "").toLowerCase().trim()}
      currentUserName={
        toTitleCase(profile?.fullname || [profile?.fname, profile?.lname].filter(Boolean).join(" ")) ||
        user?.email ||
        ""
      }
      currentUserEmail={user?.email ?? null}
      currentUserPhone={typeof phone === "string" && phone.trim() ? phone.trim() : null}
      currentUserAvatar={/^https?:\/\//.test(avatar) ? avatar : null}
    />
  )
}
