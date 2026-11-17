/**
 * The admin "API" page (Juliecor, 2026-11-17): the keyed external endpoints
 * FHI exposes to the company's own systems, listed for the one account that
 * builds against them. Add an endpoint here and it appears on the page.
 * Browser-safe: no secrets, only shapes and examples; the key itself comes
 * from GET /api/admin/api-page.
 */

/** Profile ids that see the API page and its key. Not a role: this is one person's workbench. */
export const API_PAGE_OWNERS: readonly string[] = [
  // Juliecor Repompo (admin)
  "9e151956-7365-4fc3-baff-a5edf6bb10fc",
]

export const canSeeApiPage = (userId: string | null | undefined) => !!userId && API_PAGE_OWNERS.includes(userId)

export type ApiParam = { name: string; meaning: string }
export type ApiExample = { label: string; query: string }
export type ApiEndpoint = {
  key: string
  name: string
  path: string
  summary: string
  /** What each row carries, in words. */
  returns: string
  params: ApiParam[]
  examples: ApiExample[]
  notes?: string[]
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    key: "sales",
    name: "Sales",
    path: "/api/external/sales",
    summary: "The company's recorded sales, newest first. Amounts in AED.",
    returns:
      "Each sale: its business date (reservation date, else the day it was recorded), statuses, contract price, unit, payment plan, developer, project, the agent, every partner with their share and value (credits), the client's name only, and remarks. A summary for the whole filter comes with every page.",
    params: [
      { name: "from, to", meaning: "YYYY-MM-DD, inclusive, by business date." },
      { name: "status", meaning: "validated (default, what the leaderboards count), pending, invalid or all." },
      { name: "agent", meaning: "A profile id or an email. Shared deals where they are a partner are included." },
      { name: "developer", meaning: "A developer id." },
      { name: "project", meaning: "A project id or slug." },
      { name: "since", meaning: "An ISO timestamp; only rows changed since then, for syncing." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50." },
    ],
    examples: [
      { label: "Validated sales this year, 5 per page", query: "from=2026-01-01&to=2026-12-31&limit=5" },
      { label: "Everything on one project", query: "project=damac-riverside&status=all" },
      { label: "Pending deals waiting for validation", query: "status=pending&limit=20" },
    ],
    notes: ["sales[].agent.id and sales[].credits[].id are agents[].id on the Accounts endpoint."],
  },
  {
    key: "agents",
    name: "Accounts",
    path: "/api/external/agents",
    summary: "The agents' accounts with their team and sales totals.",
    returns:
      "Each person: name, email, phone, role, status, when they joined, avatar, their team and role in it, who recruited them, and sales totals counted by share like the leaderboards (validated deals and value, pending deals, last sale date).",
    params: [
      { name: "role", meaning: "agent, team_leader, unit_manager, global_partner, or all. Default: every selling role." },
      { name: "status", meaning: "active (default), pending, inactive, or all." },
      { name: "team", meaning: "A team id; its subteams are included." },
      { name: "q", meaning: "Words to match in the name or email." },
      { name: "id, email", meaning: "One person." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50. Sorted by name." },
    ],
    examples: [
      { label: "Search by name", query: "q=guinto" },
      { label: "Team leaders only", query: "role=team_leader" },
      { label: "First 100 selling accounts", query: "limit=100&page=1" },
    ],
    notes: ["Email is the key to match a person across the other company sites."],
  },
]
