import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { ContactInboxShell } from "../contact-inbox-shell"
import { ContactDetailClient } from "./contact-detail-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { email, profile } = identity
  if (!isAdminStaffRole(profile.role)) redirect("/dashboard")

  const role = String(profile.role ?? "").toLowerCase().trim()
  const { id } = await params

  return (
    <ContactInboxShell role={role} userName={profile.fullname || email || "User"}>
      <ContactDetailClient id={id} />
    </ContactInboxShell>
  )
}
