"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"
import { TicketDetails } from "./ticket-details"

export default function SupportTicketDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const router = useRouter()
  const { user, role } = useAuth()
  const roleValue = (role ?? "").toLowerCase().trim()
  const userId = user?.id ?? ""

  const [state, setState] = useState<"loading" | "ok">("loading")

  useEffect(() => {
    if (!canAccessSupportRole(roleValue)) {
      router.replace("/dashboard")
      return
    }
    if (!id || !userId) return
    let active = true
    createClient()
      .from("support_tickets")
      .select("id, reported_by")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        // Not found, or a non-admin trying to open someone else's ticket → back to the list.
        if (error || !data) {
          router.replace("/dashboard/support")
          return
        }
        if (!isSupportAdmin(roleValue) && data.reported_by !== userId) {
          router.replace("/dashboard/support")
          return
        }
        setState("ok")
      })
    return () => {
      active = false
    }
  }, [id, userId, roleValue, router])

  if (state !== "ok") {
    return (
      <div className="p-6">
        <div className="h-48 rounded-2xl bg-black/5 animate-pulse" />
      </div>
    )
  }

  return <TicketDetails ticketId={id} currentUserId={userId} currentRole={roleValue} />
}
