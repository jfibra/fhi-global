// Shape of the Account 360 payload (GET /api/admin/users/[id]/overview),
// shared by the route and the Account Directory detail view.

export type UserTeam = {
  id: string
  name: string
  slug: string | null
  roleInTeam: string | null
  joinedAt: string | null
  leftAt: string | null
  isActive: boolean
}

export type UserPerson = {
  id: string
  fullname: string | null
  role: string | null
  status: string | null
  profileUrl: string | null
  roleInTeam?: string | null
  joinedAt?: string | null
  /** Deals closed by this person (attached for teammates & recruits). */
  salesCount?: number
  /** Total contract value closed by this person. */
  salesValue?: number
}

/** Aggregated production of a group of people. */
export type SalesTotals = { count: number; value: number }

export type UserSaleRow = {
  id: string
  projectName: string | null
  developerName: string | null
  contractPrice: number
  saleType: string | null
  commissionStatus: string | null
  validationStatus: string | null
  date: string | null
}

export type UserListingRow = {
  id: string
  title: string | null
  status: string | null
  price: number | null
  currency: string | null
  listingKind: string | null
  updatedAt: string | null
}

export type UserOverview = {
  email: string | null
  lastSignInAt: string | null
  teams: UserTeam[]
  /** Listed team members (capped — see teammatesTotal for the true count). */
  teammates: UserPerson[]
  /** True number of active teammates, even when the list above is capped. */
  teammatesTotal: number
  /** Listed recruits (capped — see recruitsTotal for the true count). */
  recruits: UserPerson[]
  /** True number of accounts this user referred. */
  recruitsTotal: number
  /** Referral chain above this account — direct referrer first. */
  upline: UserPerson[]
  /** Production of the people around this account. */
  groupSales: {
    team: SalesTotals
    recruits: SalesTotals
    /** Teammates + recruits (deduped) + this account's own sales. */
    combined: SalesTotals
  }
  sales: {
    count: number
    totalValue: number
    byStatus: Record<string, number>
    recent: UserSaleRow[]
  }
  listings: {
    count: number
    byStatus: Record<string, number>
    recent: UserListingRow[]
  }
  support: { reported: number; assigned: number }
  activityTotal: number
}
