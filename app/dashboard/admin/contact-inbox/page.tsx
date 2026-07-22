import { redirect } from "next/navigation"
import { isAdminStaffRole } from "@/lib/app-roles"
import { getSessionIdentity } from "@/lib/server-identity"
import { ContactInboxClient } from "./contact-inbox-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function ContactInboxPage() {
  const identity = await getSessionIdentity()
  if (!identity) redirect("/login")
  if (!isAdminStaffRole(identity.profile.role)) redirect("/dashboard")

  // The dashboard shell (sidebar + header) is rendered once by app/dashboard/layout.tsx.
  return <ContactInboxClient />
}
