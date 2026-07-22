import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionIdentity } from "@/lib/server-identity"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"
import { TicketDetails } from "./ticket-details"

export const dynamic = "force-dynamic"

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const identity = await getSessionIdentity()

  if (!identity) redirect("/login")
  const { userId, email, profile } = identity

  const roleValue = String(profile.role ?? "").toLowerCase().trim()
  if (!canAccessSupportRole(roleValue)) {
    redirect("/dashboard")
  }

  const supabase = await createClient()

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("id, reported_by")
    .eq("id", id)
    .single()

  if (error || !ticket) notFound()

  if (!isSupportAdmin(roleValue) && ticket.reported_by !== userId) {
    redirect("/dashboard/support")
  }

  return (
    <>
      <TicketDetails ticketId={id} currentUserId={userId} currentRole={roleValue} />
    </>
  )
}
