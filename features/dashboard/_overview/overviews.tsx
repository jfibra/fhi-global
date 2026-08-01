"use client"

import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole, roleToLabel } from "@/lib/auth"
import { isAdminStaffRole, normalizeAppRole } from "@/lib/app-roles"
import { SalesPipelineOverview } from "@/components/dashboard/sales-pipeline-overview"
import { SecretaryLikeOverview } from "@/components/dashboard/secretary-like-overview"
import { MemberOverview as MemberOverviewCard } from "@/components/dashboard/member-overview"
import { AdminDashboardContent } from "./_dashboard"
import { EditorDashboardContent } from "./editor-overview"
import { TopSalesBoard } from "./top-sales-board"

export { DeveloperOverview } from "./developer-overview"

const SECRETARY_INTRO =
  "Company-wide visibility into sales, support for IT and operations, and your business card. Attach documents to deals that are under review or marked invalid so agents can complete validation."
const TEAM_SECRETARY_INTRO =
  "Follow team deals in sales reports, add paperwork while a sale is under review or marked invalid, and use support for admin or IT. Your business card holds your public profile."

/**
 * Wraps an overview with the company leaderboard underneath.
 *
 * Every internal role gets it — the point is that agents and members see who
 * is leading. Developers (external partners) and editors (content only) don't.
 */
function WithTopSales({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const { role } = useAuth()
  // Rows link to the agent's sales drill-in, which is gated to super_admin and
  // admin — for anyone else the link would land on a page that ignores it.
  const agentHrefBase = isAdminStaffRole(role) ? `${getDashboardRouteByRole(role)}/sales` : null

  // Board first so it's the first thing seen, no scrolling required.
  //
  // No horizontal padding here: every overview's root is a bare space-y stack
  // and the shell's <main> supplies the page padding. Adding any would indent
  // the board relative to the content below it.
  return (
    <div className="space-y-8">
      <TopSalesBoard currentUserId={userId} agentHrefBase={agentHrefBase} />
      {children}
    </div>
  )
}

/** admin + super_admin overview. */
export function AdminOverview() {
  const { user, profile, role } = useAuth()
  const r = normalizeAppRole(role)
  return (
    <WithTopSales userId={user?.id}>
      <AdminDashboardContent
        roleValue={r}
        roleLabel={roleToLabel(r)}
        userName={profile?.fullname ?? user?.email ?? "Admin"}
        userId={user?.id ?? ""}
      />
    </WithTopSales>
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
    <WithTopSales userId={user?.id}>
      <SalesPipelineOverview
        displayName={profile?.fullname ?? user?.email ?? "User"}
        userId={user?.id}
      />
    </WithTopSales>
  )
}

/** secretary overview. */
export function SecretaryOverview() {
  const { user, profile, role } = useAuth()
  return (
    <WithTopSales userId={user?.id}>
      <SecretaryLikeOverview
        displayName={profile?.fullname ?? user?.email ?? "User"}
        businessCardHref={`${getDashboardRouteByRole(role)}/business-card`}
        intro={SECRETARY_INTRO}
      />
    </WithTopSales>
  )
}

/** team secretary overview. */
export function TeamSecretaryOverview() {
  const { user, profile, role } = useAuth()
  return (
    <WithTopSales userId={user?.id}>
      <SecretaryLikeOverview
        displayName={profile?.fullname ?? user?.email ?? "User"}
        businessCardHref={`${getDashboardRouteByRole(role)}/business-card`}
        intro={TEAM_SECRETARY_INTRO}
      />
    </WithTopSales>
  )
}

/** member overview. */
export function MemberOverview() {
  const { user, profile } = useAuth()
  return (
    <WithTopSales userId={user?.id}>
      <MemberOverviewCard displayName={profile?.fullname ?? user?.email ?? "User"} />
    </WithTopSales>
  )
}
