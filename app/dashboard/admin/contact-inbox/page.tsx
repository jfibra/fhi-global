import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { ContactInboxShell } from "./contact-inbox-shell"
import { ContactInboxClient } from "./contact-inbox-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function ContactInboxPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  const { email, profile } = identity
  if (!isAdminStaffRole(profile.role)) redirect("/dashboard")

  const role = String(profile.role ?? "").toLowerCase().trim()

  return (
    <ContactInboxShell role={role} userName={profile.fullname || email || "User"}>
      <ContactInboxClient />
    </ContactInboxShell>
  )
}
