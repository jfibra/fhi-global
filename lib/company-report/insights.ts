import "server-only"

import type { CompanyReport } from "./data"

/**
 * Takeaways and recommendations for the company report. The facts are
 * computed here from the report itself (`signals`); the model (same OpenAI
 * account as FHI Assistant) only turns those facts into plain advice and is
 * told to cite nothing else. When the key is missing, the call fails or the
 * answer doesn't parse, rule-based advice built from the same signals is
 * used — the PDF never ships without its last section.
 */

export type Recommendation = {
  title: string
  finding: string
  action: string
  owner: string
  impact: "High" | "Medium" | "Quick win"
}
export type Insights = { takeaways: string[]; recommendations: Recommendation[]; source: "ai" | "rules" }

const OWNERS = ["CEO", "Team leaders", "Admin & operations", "Marketing", "Recruitment"] as const
const IMPACTS = ["High", "Medium", "Quick win"] as const
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "0%")

/** Every fact the advice may use — plain numbers with their meaning. */
export function signals(r: CompanyReport): Record<string, unknown> {
  const p = r.pipeline
  const w = r.website
  return {
    period: { name: r.period.kind, dates: r.period.label, compared_with: r.period.versus },
    sales: {
      validated_deals: r.sales.validated.deals,
      validated_value_aed: r.sales.validated.value,
      previous_deals: r.sales.previous.deals,
      previous_value_aed: r.sales.previous.value,
      pending_deals: r.sales.pending.deals,
      rejected: r.sales.rejected,
      all_time_validated_deals: r.sales.allTime.deals,
      all_time_validated_value_aed: r.sales.allTime.value,
      top_agents: r.sales.topAgents.slice(0, 3).map((a) => `${a.name}: ${a.deals} deals, ${aed(a.value)}`),
      top_developers: r.sales.topDevelopers.slice(0, 3).map((d) => `${d.name}: ${d.deals} deals`),
    },
    sellers: {
      active_selling_accounts: p.sellingActive,
      sold_in_period: p.soldInPeriod,
      sold_share: pct(p.soldInPeriod, p.sellingActive),
      never_sold_at_all: p.neverSold,
      quiet_by_role: Object.fromEntries(p.quietByRole.map((q) => [q.label, q.value])),
    },
    pipeline: {
      awaiting_validation: p.awaiting,
      stale_over_days: { days: p.staleDays, count: p.stale },
      average_days_to_validate: p.validationDays,
      commission_status_counts: Object.fromEntries(p.commissions.map((c) => [c.label, c.value])),
    },
    teams: {
      formal_teams: r.teams.formal.map((t) => `${t.name} (led by ${t.leaders}): ${t.members} members, ${t.soldAllTime} have ever sold, ${t.dealsPeriod} deals this period`),
      selling_accounts_in_no_team: r.teams.noTeam.count,
      biggest_networks: r.teams.networks.slice(0, 6).map((n) => `${n.name}: ${n.network} people (${n.direct} direct), ${n.joined} joined this period, ${n.sellers} sold this period, ${aed(n.value)}`),
    },
    recruitment: {
      new_accounts: r.recruitment.total,
      previous_period: r.recruitment.previous,
      recruited_by_someone: r.recruitment.recruited,
      direct_signups: r.recruitment.direct,
      waiting_for_approval: r.recruitment.waiting,
      by_role: Object.fromEntries(r.recruitment.byRole.map((b) => [b.label, b.value])),
      top_recruiters: r.recruitment.topRecruiters.slice(0, 3).map((t) => `${t.name}: ${t.recruits}`),
    },
    leads: {
      total: r.leads.total,
      previous_period: r.leads.previous,
      unanswered: r.leads.unanswered,
      by_source: Object.fromEntries(r.leads.sources.map((s) => [s.label, s.total])),
      whatsapp_clicks_on_site: r.leads.whatsappClicks,
      inquiry_forms_submitted: r.leads.inquiriesSubmitted,
    },
    website: w
      ? {
          visitors: w.visitors,
          previous_period: w.previous,
          change: w.change,
          trend: w.trend,
          engagement_rate_percent: w.engagement,
          mobile_share: pct(w.devices.find((d) => /mobile/i.test(d.label))?.value ?? 0, w.devices.reduce((a, d) => a + d.value, 0)),
          top_sources: w.sources.slice(0, 3).map((s) => `${s.label}: ${s.value} sessions`),
          top_pages: w.topPages.slice(0, 3).map((t) => `${t.path}: ${t.views} views`),
        }
      : "not available",
  }
}

const SYSTEM = `You are a senior sales-operations advisor writing the closing section of an internal performance report for the CEO of FHI Global Property, a Dubai real estate brokerage that sells off-plan and ready property through a large network of agents and Global Partners recruited by referral (leaders recruit people, who recruit more).

You receive FACTS as JSON. Write:
1. "takeaways": 3 or 4 one-sentence headlines of what happened in the period, most important first.
2. "recommendations": 5 or 6 concrete actions that would make the company more productive.

Rules:
- Use ONLY the numbers in FACTS. Every takeaway and every "finding" must quote at least one number from FACTS exactly as given. Never invent figures, percentages, names, numeric targets or causes — an action says what to do, not a made-up goal like "by 50%".
- FACTS.draft_recommendations are rule-based findings already checked against the data. Use them as your starting point: keep the important ones, merge or sharpen them, order by impact, and add others only when FACTS support them.
- Never make an action vaguer than its draft. Good actions name who does what, how often and where (e.g. "Give each team leader the list of their never-sold members and run a weekly first-deal session"), not generic phrases like "implement a training programme" or "enhance support".
- Be specific and practical for this business: activating recruits into first sales, team-leader coaching, approval and validation speed, lead follow-up, marketing that converts visits into inquiries, data hygiene (e.g. commission statuses never updated).
- A zero is a finding (e.g. no inquiry forms submitted while WhatsApp clicks exist), not a reason to stay silent. State it plainly ("No validated deals this week, against 1 the week before") — no filler such as "maintaining a total of 0".
- "action" is what to do in the next 2 weeks, starting with a verb, max 30 words.
- "owner" must be one of: ${OWNERS.join(", ")}.
- "impact" must be one of: ${IMPACTS.join(", ")}.
- Plain text, no markdown, no emojis. Short sentences. British/UAE business English.

Return JSON: {"takeaways": string[], "recommendations": [{"title": string (max 7 words), "finding": string, "action": string, "owner": string, "impact": string}]}`

export async function buildInsights(r: CompanyReport): Promise<Insights> {
  const rules = ruleInsights(r)
  const facts = { ...signals(r), draft_recommendations: rules.recommendations.map(({ title, finding, action, owner }) => ({ title, finding, action, owner })) }
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      })
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { takeaways?: unknown; recommendations?: unknown }
        const takeaways = (Array.isArray(parsed.takeaways) ? parsed.takeaways : []).filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 4)
        const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
          .map((x) => x as Record<string, unknown>)
          .filter((x) => typeof x.title === "string" && typeof x.finding === "string" && typeof x.action === "string")
          .map((x) => ({
            title: String(x.title).trim(),
            finding: String(x.finding).trim(),
            action: String(x.action).trim(),
            owner: (OWNERS as readonly string[]).includes(String(x.owner)) ? String(x.owner) : "CEO",
            impact: ((IMPACTS as readonly string[]).includes(String(x.impact)) ? String(x.impact) : "Medium") as Recommendation["impact"],
          }))
          .slice(0, 6)
        if (takeaways.length >= 2 && recommendations.length >= 3) return { takeaways, recommendations, source: "ai" }
      }
    } catch {
      // fall through to the rules
    }
  }
  return rules
}

/** The same advice without the model — always available. */
export function ruleInsights(r: CompanyReport): Insights {
  const p = r.pipeline
  const takeaways: string[] = []
  const recs: Recommendation[] = []
  const s = r.sales

  takeaways.push(
    s.validated.deals
      ? `${s.validated.deals} validated deal${s.validated.deals === 1 ? "" : "s"} worth ${aed(s.validated.value)}, against ${s.previous.deals} (${aed(s.previous.value)}) in ${r.period.versus}.`
      : `No validated deals in this period, against ${s.previous.deals} (${aed(s.previous.value)}) in ${r.period.versus}.`,
  )
  takeaways.push(`${r.recruitment.total} new accounts joined (${r.recruitment.recruited} recruited by someone); ${r.recruitment.waiting} are still waiting for approval.`)
  takeaways.push(`${p.soldInPeriod} of ${p.sellingActive} active selling accounts closed a deal; ${p.neverSold} have never sold.`)
  if (r.website) takeaways.push(`The website had ${r.website.visitors.toLocaleString("en-AE")} visitors (${r.website.change ?? "no comparison"} vs ${r.period.versus}) and ${r.leads.total} leads came in.`)

  if (p.sellingActive && p.soldInPeriod / p.sellingActive < 0.1)
    recs.push({ title: "Turn recruits into first sales", finding: `Only ${p.soldInPeriod} of ${p.sellingActive} active selling accounts closed a deal, and ${p.neverSold} have never sold.`, action: "Give every team leader a list of their never-sold members and run a weekly first-deal workshop with a shortlist of easy-to-sell projects.", owner: "Team leaders", impact: "High" })
  if (r.recruitment.waiting > 0)
    recs.push({ title: "Clear the approval queue", finding: `${r.recruitment.waiting} new accounts are waiting for approval.`, action: "Approve or decline pending accounts within 24 hours so recruits can start while they are motivated; check the queue daily in Recruitment.", owner: "Admin & operations", impact: "Quick win" })
  if (r.teams.noTeam.count > 0)
    recs.push({ title: "Give every seller a team", finding: `${r.teams.noTeam.count} selling accounts belong to no team.`, action: "Assign each to their recruiter's team (or a new team for strong recruiters) so someone coaches them and their sales roll up.", owner: "CEO", impact: "Medium" })
  if (r.leads.whatsappClicks > 0 && r.leads.inquiriesSubmitted === 0)
    recs.push({ title: "Capture leads, not just clicks", finding: `${r.leads.whatsappClicks} WhatsApp clicks on the website but ${r.leads.inquiriesSubmitted} inquiry forms submitted.`, action: "Route WhatsApp clicks to a shared number that logs each chat as a lead, and add a one-tap callback form on project pages.", owner: "Marketing", impact: "High" })
  const pendingCommissions = p.commissions.find((c) => /pending/i.test(c.label))?.value ?? 0
  if (pendingCommissions > 0)
    recs.push({ title: "Update commission statuses", finding: `${pendingCommissions} validated sales still show commission status Pending.`, action: "Mark commissions received or paid as they happen, so the pipeline shows real cash still owed by developers.", owner: "Admin & operations", impact: "Quick win" })
  if (p.awaiting > 0)
    recs.push({ title: "Validate sales faster", finding: `${p.awaiting} sales are waiting for validation (${p.stale} for more than ${p.staleDays} days).`, action: "Validate or reject every submitted sale within 3 working days; chase missing documents with the agent the same day.", owner: "Admin & operations", impact: "Medium" })
  if (r.website?.change?.startsWith("-"))
    recs.push({ title: "Keep traffic between campaigns", finding: `Website visitors changed ${r.website.change} vs ${r.period.versus}.`, action: "Schedule always-on project content and posts between event campaigns so traffic and leads don't fall away when ads stop.", owner: "Marketing", impact: "Medium" })
  return { takeaways: takeaways.slice(0, 4), recommendations: recs.slice(0, 6), source: "rules" }
}
