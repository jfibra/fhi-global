import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { canAccessSupportRole, isSupportAdmin } from "@/lib/support-service"
import { TicketDetails } from "./ticket-details"

export const dynamic = "force-dynamic"

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, fullname")
    .eq("id", user.id)
    .single()

  const roleValue = String(profile?.role ?? "").toLowerCase().trim()
  if (!profile || !canAccessSupportRole(roleValue)) {
    redirect("/dashboard")
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("id, reported_by")
    .eq("id", id)
    .single()

  if (error || !ticket) notFound()

  if (!isSupportAdmin(roleValue) && ticket.reported_by !== profile.id) {
    redirect("/dashboard/support")
  }

  return (
    <DashboardShell
      role={roleValue}
      roleLabel={roleToLabel(roleValue)}
      roleColor={getRoleColor(roleValue)}
      userName={profile.fullname || user.email || "User"}
    >
      <TicketDetails ticketId={id} currentUserId={profile.id} currentRole={roleValue} />
    </DashboardShell>
  )
}
