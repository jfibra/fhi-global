"use client"

import { useAuth } from "@/context/auth-context"
import { isSalesPipelineRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { FeedbackBoard } from "./feedback-board"

/** Customer Feedback — agents/TLs/UMs collect and read their own reviews. */
export default function FeedbackPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(isSalesPipelineRole(role))
  if (!allowed || !user) return null

  return (
    <FeedbackBoard
      agentId={user.id}
      agentName={profile?.fullname || user.email || "Advisor"}
    />
  )
}
