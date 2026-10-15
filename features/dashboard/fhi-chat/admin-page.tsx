"use client"

import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"
import FhiChatPage from "./page"

/** The admin FHI Assistant (defaults of the shared chat) with a link to the agents' usage page and the company-report PDF. */
export default function AdminFhiChatPage() {
  const { role } = useAuth()
  return <FhiChatPage headerLink={{ href: `${getDashboardRouteByRole(role)}/fhi-chat/usage`, label: "Agents' usage" }} pdfReport="/api/admin/reports/company" />
}
