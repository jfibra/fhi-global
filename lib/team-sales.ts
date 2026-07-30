// Shape of the Team Sales payload (GET /api/team/sales-overview), shared by
// the route and the Team Sales dashboard page.

export type TeamSalesMember = {
  id: string
  fullname: string | null
  role: string | null
  profileUrl: string | null
  /** True for the caller's own row (rendered as "You"). */
  isSelf: boolean
  deals: number
  value: number
}

export type TeamSalesMonth = {
  /** 1–12, always all twelve months of the selected year. */
  month: number
  teamDeals: number
  teamValue: number
  myDeals: number
  myValue: number
}

export type TeamSalesOverview = {
  period: { year: number; month: number | null }
  /**
   * Where the member list came from:
   * - "team"     — the caller's active team in team_memberships
   * - "recruits" — no formal team, so the people who registered through the
   *                caller's invite link (profiles.metadata.invited_by)
   * - "none"     — neither exists yet
   */
  scope: "team" | "recruits" | "none"
  /** Null unless scope is "team". */
  teamName: string | null
  /** Active members of the caller's team (caller included), value desc.
   *  Capped for payload size — membersTotal carries the true count. */
  members: TeamSalesMember[]
  membersTotal: number
  teamTotals: { deals: number; value: number }
  personal: { deals: number; value: number }
  /** Full selected year, for the monthly trend chart. */
  trend: TeamSalesMonth[]
}
