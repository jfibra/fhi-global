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
    key: "sales-top",
    name: "Top sellers",
    path: "/api/external/sales/top",
    summary: "The leaderboards exactly as the dashboards show them: top agents, developers, projects or teams.",
    returns:
      "A ranked list for the period: rank, id, name, picture, deals and value in AED. Validated sales only; a shared deal credits each agent their share; a developer or project counts every sale once in full; a team is its members plus its subteams, with subteams listed apart.",
    params: [
      { name: "by", meaning: "agents (default), developers, projects or teams." },
      { name: "from, to", meaning: "YYYY-MM-DD, inclusive, by business date. Leave both out for all time." },
      { name: "developer", meaning: "A developer id or slug; narrows the agents or projects board." },
      { name: "project", meaning: "A project id or slug; narrows the agents board." },
      { name: "limit", meaning: "How many rows, up to 100. Default 10." },
    ],
    examples: [
      { label: "Top agents this year", query: "by=agents&from=2026-01-01&to=2026-12-31" },
      { label: "Top developers, all time", query: "by=developers&limit=10" },
      { label: "Top teams this year", query: "by=teams&from=2026-01-01&to=2026-12-31" },
    ],
    notes: ["Same rules as FHI's Top Sales board and the FHI Assistant, so every surface quotes the same numbers."],
  },
  {
    key: "sales-summary",
    name: "Sales summary",
    path: "/api/external/sales/summary",
    summary: "The period figures the boss's reports give: validated and pending, the period before, and the month-by-month picture.",
    returns:
      "For the period: validated deals and value, pending deals and value, other statuses, the equal-length period just before with the percentage change, and a breakdown by month, quarter or year. Company figures count every sale once in full; an agent's figures count their share.",
    params: [
      { name: "from, to", meaning: "YYYY-MM-DD, inclusive, by business date. Leave both out for all time (the breakdown then shows the last 12 months)." },
      { name: "group", meaning: "month (default), quarter or year for the breakdown." },
      { name: "developer, project", meaning: "A developer or project id or slug; narrows the figures." },
      { name: "agent", meaning: "A profile id or email; that agent's figures, at their share of each deal." },
    ],
    examples: [
      { label: "This year by month", query: "from=2026-01-01&to=2026-12-31&group=month" },
      { label: "Last 12 months, all time view", query: "group=month" },
      { label: "One developer this year", query: "from=2026-01-01&to=2026-12-31&developer=azizi-developments" },
    ],
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
  {
    key: "projects",
    name: "Projects",
    path: "/api/external/projects",
    summary: "The live projects, with their developer, prices, dates and unit types. Same rules as the public site.",
    returns:
      "Each project: name, public page, stage, developer, where it is (community, location, city, coordinates), the honest starting price plus the launch price range, payment plan, dates (launch, construction start, expected completion, handover and its quarter), size (buildings, units, floors), expected ROI and rental yield, ownership, every unit type with bedrooms, size and price range, photo and video.",
    params: [
      { name: "developer", meaning: "A developer id or slug." },
      { name: "stage", meaning: "pre_launch, launch, under_construction or completed." },
      { name: "area", meaning: "Words to match in the community, sub-community, location or city." },
      { name: "handover", meaning: "A year; projects handing over that year." },
      { name: "q", meaning: "Words to match in the name." },
      { name: "id, slug", meaning: "One project." },
      { name: "since", meaning: "An ISO timestamp; only rows changed since then, for syncing." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50. Sorted by name." },
    ],
    examples: [
      { label: "Handing over in 2027", query: "handover=2027&limit=20" },
      { label: "Everything by one developer", query: "developer=binghatti-developers" },
      { label: "Projects in JVC", query: "area=jumeirah%20village%20circle" },
    ],
    notes: ["price.from is the floor the site itself shows: the headline price unless the unit table proves it is a placeholder.", "Test projects and unpublished ones are never returned."],
  },
  {
    key: "developers",
    name: "Developers",
    path: "/api/external/developers",
    summary: "The developers FHI works with, and how many live projects each has.",
    returns: "Each developer: name, slug, public page, logo, description, website and business contact, verified flag, rating, and the count of live projects.",
    params: [
      { name: "q", meaning: "Words to match in the name." },
      { name: "id, slug", meaning: "One developer." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50. Sorted by name." },
    ],
    examples: [
      { label: "All developers", query: "limit=100" },
      { label: "Search by name", query: "q=emaar" },
    ],
    notes: ["developers[].id matches projects[].developer.id and sales[].developer.id."],
  },
  {
    key: "teams",
    name: "Teams",
    path: "/api/external/teams",
    summary: "Each team with its leader, members, subteams and validated sales.",
    returns:
      "Each team: name, logo, type, parent and subteams, the leader, member counts (own and with subteams), validated deals and value for the period, and with include=members the full member list with role, role in team and when they joined.",
    params: [
      { name: "q, id, slug", meaning: "Find a team by name words, id or slug." },
      { name: "status", meaning: "active (default) or all." },
      { name: "from, to", meaning: "YYYY-MM-DD, inclusive; the period for the sales figures. Omit for all time." },
      { name: "include", meaning: "members — adds the member list (up to 1000, subteams included)." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50. By name." },
    ],
    examples: [
      { label: "All teams with this year's sales", query: "from=2026-01-01&to=2026-12-31" },
      { label: "One team with its members", query: "q=mcg&include=members" },
    ],
    notes: ["A team's sales include its subteams at any depth, counted once per team, like the Teams page and the top-teams board."],
  },
  {
    key: "merchants",
    name: "Merchants",
    path: "/api/external/merchants",
    summary: "The Merchant Partnership Programme: every merchant with its code, agreement, agent, QR scans and closed deals.",
    returns:
      "Each merchant: business name and kind, address, status, the one-year agreement's dates, the agent who signed it, the signatory's contact, the customer voucher, the QR address and where it forwards, whether the four documents are in, scans this month and in all, validated deals this month and in all, and the incentives due (AED 100 per deal to the merchant and to the agent). With include=deals, the period figures, the statement and the newest rentals. Bank details are never returned.",
    params: [
      { name: "status", meaning: "accepted (default), submitted, onboarding, declined, ended or all." },
      { name: "agent", meaning: "A profile id; the merchants that agent signed." },
      { name: "code", meaning: "One merchant by its code, like M-4K7Q." },
      { name: "id, q", meaning: "One merchant by id, or words to match in the name or code." },
      { name: "include", meaning: "deals — adds the figures and the newest rentals (50 merchants at most)." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50. Newest first." },
    ],
    examples: [
      { label: "Active merchants with their deals", query: "status=accepted&include=deals" },
      { label: "One merchant by code", query: "code=M-4K7Q&include=deals" },
      { label: "Everything, every status", query: "status=all&limit=100" },
    ],
    notes: ["merchants[].contact.account_id is the merchant's FHI login, the id the users endpoint gives rentsouq.ae for auto-login.", "The QR opens fhiglobal.ae/m/<code>, which counts the scan and forwards to rentsouq.ae with ?ref=<code>."],
  },
  {
    key: "events",
    name: "Events",
    path: "/api/external/events",
    summary: "Company events and agents' events: dates, venue, host, where they are shown, and registrations.",
    returns:
      "Each event: title, public link, status, whether registration is open, every day with its date and start time, venue with coordinates, the host (FHI or the agent), where it is shown (fhiglobal.ae and/or the agent's website), total registrations, views and QR scans, photo and description. With include=days, each day's seat limit, taken and left.",
    params: [
      { name: "when", meaning: "upcoming (default), past or all. An event is past once its last day has started." },
      { name: "from, to", meaning: "YYYY-MM-DD; by the first day." },
      { name: "status", meaning: "published (default), draft or all." },
      { name: "host", meaning: "company, agents or all (default)." },
      { name: "agent", meaning: "A profile id; that agent's events." },
      { name: "q, id, slug", meaning: "Find an event by title words, id or slug." },
      { name: "include", meaning: "days — adds per-day seats (50 events at most)." },
      { name: "page, limit", meaning: "Paging. limit up to 100, default 50." },
    ],
    examples: [
      { label: "Upcoming events with seats", query: "when=upcoming&include=days" },
      { label: "Past events, latest first", query: "when=past&limit=10" },
      { label: "Company events only", query: "host=company&when=all" },
    ],
  },
]
