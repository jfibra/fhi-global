/**
 * The questions offered under the latest answer (boss via Juliecor,
 * 2026-10-20). People tap the suggestion buttons far more than they type —
 * 13 of the first 14 agent questions were suggestions word for word — so
 * after every answer the chat offers the natural next questions, picked from
 * the tools that answer used, the period it was about and the first name or
 * project it showed. Rule-based on purpose: instant, free, and every button
 * is a question the assistant can answer.
 */

type Ctx = {
  /** "this month", "last quarter"… — the period the question named (default this year). */
  period: string
  /** The period just before it, when "compare" makes sense. */
  previous: string | null
  /** People the answer named (tools' _names), best first, the asker left out. */
  people: string[]
  /** Projects the answer showed as cards. */
  projects: string[]
  teamLeader: boolean
}

type Rule = (c: Ctx) => Array<string | null | false | undefined>

const PERIODS: Array<{ re: RegExp; label: string; previous: string | null }> = [
  { re: /\btoday\b/i, label: "today", previous: "yesterday" },
  { re: /\byesterday\b/i, label: "yesterday", previous: null },
  { re: /\bthis week\b/i, label: "this week", previous: "last week" },
  { re: /\blast week\b/i, label: "last week", previous: null },
  { re: /\bthis month\b/i, label: "this month", previous: "last month" },
  { re: /\blast month\b/i, label: "last month", previous: null },
  { re: /\bthis quarter\b/i, label: "this quarter", previous: "last quarter" },
  { re: /\blast quarter\b/i, label: "last quarter", previous: null },
  { re: /\bthis year\b/i, label: "this year", previous: "last year" },
  { re: /\blast year\b/i, label: "last year", previous: null },
  { re: /\ball[- ]time\b/i, label: "all time", previous: null },
]

/** Tools whose answers have a period worth comparing. */
const PERIOD_TOOLS = new Set(["my_sales", "my_team", "sales_summary", "top_agents", "top_developers", "top_teams"])

const AGENT_RULES: Record<string, Rule> = {
  my_sales: (c) => ["Anything of mine waiting for validation?", `Where do I rank ${c.period}?`, "How can I sell more?"],
  top_sales_board: (c) => [`How are my sales ${c.period}?`, "How can I sell more?"],
  person_sales: (c) => [`Where do I rank ${c.period}?`, `How are my sales ${c.period}?`],
  my_team: (c) => [
    c.people[0] && `Show ${c.people[0]}'s deals ${c.period}`,
    `Who in my team hasn't sold ${c.period}?`,
    "Anything of my team waiting for validation?",
    "Who joined my team this week?",
  ],
  my_leads: () => ["Who should I call first?", "How do I get more leads?"],
  my_listings: () => ["Which of my listings are still drafts?", "How do I get more leads?"],
  my_website: () => ["Which of my listings are live?", "How do I get more leads?"],
  my_reviews: () => ["How do I get more client reviews?"],
  my_recruits: (c) => [c.teamLeader ? "Who joined my team this week?" : "Which of my recruits have sold?", "How do I activate my recruits?"],
  my_events: () => ["Who registered for my event today?", "How many seats are left?"],
  find_projects: (c) => [c.projects[0] && `Payment plan of ${c.projects[0]}`, c.projects[0] && `Tell me everything about ${c.projects[0]}`, "Any ready projects in the same area?"],
  project_details: (c) => [c.projects[0] && `Payment plan of ${c.projects[0]}`, "Show similar projects in the same area"],
  news_overview: () => ["What's the most read news this week?"],
}

const ADMIN_RULES: Record<string, Rule> = {
  sales_summary: (c) => [`Who were the top agents ${c.period}?`, `Top developers ${c.period}`, "Anything waiting for validation?"],
  top_agents: (c) => [c.people[0] && `Show ${c.people[0]}'s sales record`, `Top developers ${c.period}`, `Who hasn't sold ${c.period}?`],
  top_developers: (c) => [`Who were the top agents ${c.period}?`, `How are our sales ${c.period}?`],
  top_teams: (c) => ["Show every team in detail", `Who were the top agents ${c.period}?`],
  teams_detail: (c) => [`Which teams sold the most ${c.period}?`],
  sales_pipeline: () => ["Who hasn't sold this quarter?", "How are our sales this month?"],
  recent_sales: () => ["Anything waiting for validation?", "Who were the top agents this month?"],
  agent_sales: (c) => [c.people[0] && `Who did ${c.people[0]} recruit?`, c.people[0] && `Show ${c.people[0]}'s network`],
  agent_recruits: (c) => [c.people[0] && `Show ${c.people[0]}'s sales record`],
  agent_network: (c) => [c.people[0] && `Show ${c.people[0]}'s sales record`],
  new_accounts: () => ["Who is waiting for approval?", "Who are the top recruiters this month?"],
  leads_overview: () => ["Which leads haven't been answered yet?", "Where do our leads come from this month?"],
  website_traffic: () => ["What are people searching for on the website?", "Which pages get the most visitors this month?"],
  search_keywords: () => ["How is the website traffic this month?"],
  activity_feed: () => ["Any new leads today?", "How are our sales this month?"],
  support_tickets: () => ["Which support tickets are unassigned?"],
  upcoming_birthdays: () => ["Make a birthday poster for today's celebrants"],
  events_overview: () => ["Who registered for our latest event?"],
  event_attendees: () => ["How many seats are left?"],
  data_health: () => ["Which projects have no payment plan?", "Any duplicate listings?"],
  find_projects: AGENT_RULES.find_projects,
  project_details: AGENT_RULES.project_details,
  news_overview: AGENT_RULES.news_overview,
}

/** "Cris Enrico Antonio Gudia" → "Cris Gudia": fits a button on a phone, and the tools match names loosely. */
const shortName = (name: string) => {
  const w = name.trim().split(/\s+/)
  return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(" ")
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Up to three follow-ups for the answer to `question`. `asked` holds every
 * question of the conversation so far — those are never offered again.
 */
export function followUpsFor(input: {
  audience: "admin" | "agent"
  teamLeader: boolean
  question: string
  used: string[]
  names: string[]
  projects: string[]
  asked: string[]
  selfName: string | null
}): string[] {
  const p = PERIODS.find((x) => x.re.test(input.question))
  const self = norm(input.selfName ?? "")
  const ctx: Ctx = {
    period: p?.label ?? "this year",
    previous: p?.previous ?? null,
    people: input.names.filter((n) => n && norm(n) !== self && !norm(n).endsWith(" you")).map(shortName),
    projects: input.projects,
    teamLeader: input.teamLeader,
  }
  const rules = input.audience === "admin" ? ADMIN_RULES : AGENT_RULES
  const out: string[] = []
  // A period answer leads with the comparison — the next thing people ask.
  if (ctx.previous && !/\b(compar|vs\.?|versus)\b/i.test(input.question) && input.used.some((u) => PERIOD_TOOLS.has(u))) {
    out.push(`Compare it with ${ctx.previous}`)
  }
  for (const tool of input.used) for (const q of rules[tool]?.(ctx) ?? []) if (q) out.push(q)
  const seen = new Set(input.asked.map(norm))
  const unique: string[] = []
  for (const q of out) {
    const k = norm(q)
    if (!seen.has(k)) {
      seen.add(k)
      unique.push(q)
    }
  }
  return unique.slice(0, 3)
}
