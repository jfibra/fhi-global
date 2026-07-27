"use client"

import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole, roleToLabel } from "@/lib/auth"
import { normalizeAppRole } from "@/lib/app-roles"
import { SalesPipelineOverview } from "@/components/dashboard/sales-pipeline-overview"
import { SecretaryLikeOverview } from "@/components/dashboard/secretary-like-overview"
import { MemberOverview as MemberOverviewCard } from "@/components/dashboard/member-overview"
import { AdminDashboardContent } from "./_dashboard"
import { EditorDashboardContent } from "./editor-overview"

export { DeveloperOverview } from "./developer-overview"

const SECRETARY_INTRO =
  "Company-wide visibility into sales, support for IT and operations, and your business card. Attach documents to deals that are under review or marked invalid so agents can complete validation."
const TEAM_SECRETARY_INTRO =
  "Follow team deals in sales reports, add paperwork while a sale is under review or marked invalid, and use support for admin or IT. Your business card holds your public profile."

/** admin + super_admin overview. */
export function AdminOverview() {
  const { user, profile, role } = useAuth()
  const r = normalizeAppRole(role)
  return (
    <AdminDashboardContent
      roleValue={r}
      roleLabel={roleToLabel(r)}
      userName={profile?.fullname ?? user?.email ?? "Admin"}
      userId={user?.id ?? ""}
    />
  )
}

/** editor overview. */
export function EditorOverview() {
  const { user, profile } = useAuth()
  return (
    <EditorDashboardContent
      userId={user?.id ?? ""}
      userName={profile?.fullname ?? user?.email ?? "Editor"}
    />
  )
}

/** agent / team leader / unit manager overview. */
export function SalesOverview() {
  const { user, profile } = useAuth()
  return (
    <SalesPipelineOverview
      displayName={profile?.fullname ?? user?.email ?? "User"}
      userId={user?.id}
    />
  )
}

/** secretary overview. */
export function SecretaryOverview() {
  const { user, profile, role } = useAuth()
  return (
    <SecretaryLikeOverview
      displayName={profile?.fullname ?? user?.email ?? "User"}
      businessCardHref={`${getDashboardRouteByRole(role)}/business-card`}
      intro={SECRETARY_INTRO}
    />
  )
}

/** team secretary overview. */
export function TeamSecretaryOverview() {
  const { user, profile, role } = useAuth()
  return (
    <SecretaryLikeOverview
      displayName={profile?.fullname ?? user?.email ?? "User"}
      businessCardHref={`${getDashboardRouteByRole(role)}/business-card`}
      intro={TEAM_SECRETARY_INTRO}
    />
  )
}

/** member overview. */
export function MemberOverview() {
  const { user, profile } = useAuth()
  return <MemberOverviewCard displayName={profile?.fullname ?? user?.email ?? "User"} />
}
