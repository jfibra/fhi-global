import "server-only"

import type { AgentReport } from "./data"

/**
 * FHI Assistant's coaching for My Performance Report: a headline, three to
 * five takeaways, five recommendations for the next 30 days and one focus
 * for next month. The facts are computed here from the report (`signals`);
 * the advice model only turns them into plain words and is told to cite
 * nothing else — never another agent's figures beyond the board's rank and
 * deal count. When the key is missing, the call fails or the answer doesn't
 * parse, the rule-based coaching from the same facts is used — a report
 * never ships without its coaching.
 */

export type Recommendation = { title: string; why: string; how: string; metric: string }
export type AgentInsights = {
  headline: string
  takeaways: string[]
  recommendations: Recommendation[]
  nextMonth: { focus: string; target: string }
  source: "ai" | "rules"
}

const RECOMMENDATIONS = 5
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const plural = (n: number, word: string, words = `${word}s`) => `${n.toLocaleString("en-AE")} ${n === 1 ? word : words}`

/** Every fact the coaching may use — plain numbers with their meaning. */
export function signals(r: AgentReport): Record<string, unknown> {
  const S = r.sales
  return {
    person: { name: r.person.name, role: r.person.roleLabel, team: r.person.team, joined_fhi: r.person.joined, website: r.person.website ? "live" : r.website.has ? "draft, not published" : "none" },
    period: { dates: r.period.label, months: Math.round(r.period.months * 10) / 10, compared_with: r.period.versus },
    sales: {
      validated_deals: S.validated.deals,
      validated_value_aed: S.validated.value,
      change_vs_previous_value: S.change,
      change_vs_previous_deals: S.dealsChange,
      previous_deals: S.previous.deals,
      previous_value_aed: S.previous.value,
      pending_deals_waiting_for_validation: S.pending.deals,
      pending_value_aed: S.pending.value,
      rejected: S.rejected,
      average_deal_aed: S.avgDeal,
      shared_deals: S.sharedDeals,
      all_time_validated_deals: S.allTime.deals,
      all_time_validated_value_aed: S.allTime.value,
      by_month: S.byMonth.map((b) => `${b.label}: ${plural(b.deals, "deal")}, ${aed(b.value)}`),
      top_projects: S.topProjects.map((p) => `${p.name}${p.developer ? ` (${p.developer})` : ""}: ${plural(p.deals, "deal")}, ${aed(p.value)}`),
    },
    top_sales_board: { rank: r.board.rank, agents_on_board: r.board.of, note: "other agents appear only as a rank — their amounts are private" },
    leads: {
      briefs_from_buyers_and_sellers_link: r.leads.total,
      buyers: r.leads.buyers,
      sellers: r.leads.sellers,
      previous_period: r.leads.previous,
      change_vs_previous: r.leads.change,
      buyers_by_grade: Object.fromEntries(r.leads.byGrade.map((g) => [g.label, g.value])),
      priority_buyers: r.leads.priority.map((p) => `${p.name}: ${p.budget}, ${p.goal}, ${p.when}`),
      grades_mean: "Priority = ready and funded; Qualified = serious; Nurture = early; Information = browsing",
    },
    listings: r.listings,
    website: { has_website: r.website.has, live: r.website.live, last_updated: r.website.lastUpdated, reviews_shown_on_it: r.website.reviewsShown },
    reviews: { total: r.reviews.total, approved_shown_on_website: r.reviews.approved, waiting_for_admin_approval: r.reviews.waiting, average_rating_of_5: r.reviews.average, would_recommend_percent: r.reviews.recommendPct },
    events: { total: r.events.total, in_period: r.events.inPeriod, registrations_all_time: r.events.registrations, registrations_in_period: r.events.registrationsInPeriod, page_views: r.events.views, qr_scans: r.events.qrScans },
    recruits: { total: r.recruits.total, joined_in_period: r.recruits.joinedInPeriod, active: r.recruits.active, waiting_for_approval: r.recruits.pending, selling: r.recruits.selling, validated_deals_between_them: r.recruits.dealsBetween },
  }
}

/** The same coaching without the model — always available, every "why" carries a number. */
export function ruleInsights(r: AgentReport): AgentInsights {
  const S = r.sales
  const first = r.person.name.split(/\s+/)[0] || "You"
  const top = S.topProjects[0]
  const headline = S.validated.deals
    ? `${first} closed ${plural(S.validated.deals, "validated deal")} worth ${aed(S.validated.value)} in ${r.period.label}${S.change ? ` (${S.change} vs ${r.period.versus})` : ""}${r.board.rank ? `, rank #${r.board.rank} of ${r.board.of} on the Top Sales board` : ""}.`
    : `${first} recorded no validated sale in ${r.period.label}${S.previous.deals ? `; ${r.period.versus} brought ${plural(S.previous.deals, "deal")} worth ${aed(S.previous.value)}` : ""}${S.pending.deals ? `, with ${plural(S.pending.deals, "deal")} still waiting for validation` : ""}.`

  const takeaways = [
    S.validated.deals
      ? `${plural(S.validated.deals, "validated deal")} worth ${aed(S.validated.value)}, average ${aed(S.avgDeal)}${top ? `; ${top.name} led with ${plural(top.deals, "deal")}` : ""}.`
      : `No validated deal in the period, against ${S.previous.deals} ${r.period.versus}.`,
    S.pending.deals ? `${plural(S.pending.deals, "deal")} worth ${aed(S.pending.value)} are waiting for validation — only validated deals count on the board.` : "",
    r.leads.total ? `${plural(r.leads.total, "brief")} came through the Buyers and Sellers Links (${r.leads.change ? `${r.leads.change} vs ${r.period.versus}` : `${r.leads.previous} before`})${r.leads.priority.length ? `, ${r.leads.priority.length} of them priority buyers` : ""}.` : `No brief came through the Buyers Link in the period — the link is not being shared.`,
    r.reviews.total ? `${plural(r.reviews.total, "client review")}, average ${r.reviews.average ?? "–"} / 5${r.reviews.waiting ? `, ${r.reviews.waiting} waiting for admin approval` : ""}.` : "No client review yet — a review on the website is the strongest proof for the next buyer.",
    r.website.has ? (r.website.live ? `The website is live${r.website.lastUpdated ? `, last updated ${r.website.lastUpdated}` : ""}${r.events.total ? `, with ${plural(r.events.total, "event")} and ${plural(r.events.registrations, "registration")}` : ""}.` : "The website is still a draft — nobody can find it.") : "No website yet.",
  ].filter(Boolean).slice(0, 5)

  const recs: Recommendation[] = []
  if (S.pending.deals) recs.push({ title: "Get the pending deals validated", why: `${plural(S.pending.deals, "deal")} worth ${aed(S.pending.value)} are waiting for validation.`, how: "Send the office every missing document this week; a validated deal counts on the board and releases the commission.", metric: "Pending deals older than 7 days" })
  if (r.leads.priority.length) recs.push({ title: "Call the priority buyers first", why: `${plural(r.leads.priority.length, "priority buyer")} are ready and funded (${r.leads.priority.map((p) => p.name).slice(0, 3).join(", ")}).`, how: "WhatsApp each within the hour, book a viewing this week and send them a project brochure from FHI Assistant.", metric: "Priority buyers with a viewing booked" })
  recs.push(r.leads.total < 5
    ? { title: "Share the Buyers Link every day", why: `${plural(r.leads.total, "brief")} in ${r.period.label} — the link brings leads only when it is shared.`, how: "Put the link in your WhatsApp status, Facebook bio and every reel; aim for one share a day and one new brief a week.", metric: "Briefs received per week" }
    : { title: "Convert the briefs you have", why: `${plural(r.leads.total, "brief")} came in; ${r.leads.buyers} are buyers.`, how: "Grade them, reply to every qualified buyer within a day and move each to a viewing or a brochure.", metric: "Briefs with a next step dated" })
  if (top) recs.push({ title: `Double down on ${top.name}`, why: `${top.name} brought ${plural(top.deals, "deal")} worth ${aed(top.value)} — your best project of the period.`, how: "Make its brochure, post a short reel on it, and offer it first to every buyer with a matching budget.", metric: `Viewings booked for ${top.name}` })
  else recs.push({ title: "Pick one project to push", why: "No project stood out in the period.", how: "Choose one launching project with a clear payment plan, learn its units by heart, make its brochure and present it to every lead this month.", metric: "Presentations of the chosen project" })
  if (!r.reviews.total || r.reviews.waiting) recs.push({ title: r.reviews.waiting ? "Get your reviews approved" : "Ask every client for a review", why: r.reviews.waiting ? `${plural(r.reviews.waiting, "review")} are waiting for admin approval before they show on your website.` : "No client review yet; reviews on the website convince the next buyer.", how: r.reviews.waiting ? "Ask an admin to approve them in Customer Feedback this week." : "Send the feedback link to your last three clients today.", metric: "Approved reviews on the website" })
  if (!r.website.live) recs.push({ title: r.website.has ? "Publish your website" : "Build your website", why: r.website.has ? "Your website is a draft, so your brochures' QR codes point to WhatsApp instead of your pages." : "Without a website your brochures and reels have nowhere to send people.", how: "Open Website Builder, finish the About and contact sections and press Publish.", metric: "Website live" })
  if (r.recruits.total && r.recruits.selling < r.recruits.active) recs.push({ title: "Activate your recruits", why: `${r.recruits.selling} of ${r.recruits.active} active recruits have sold.`, how: "Pair each quiet recruit with one live project and one named prospect, and check in every Monday.", metric: "Recruits with a first deal" })
  recs.push({ title: "Run a weekly pipeline review", why: `${plural(S.validated.deals, "deal")} in ${r.period.label}; a dated next step for every prospect is what turns briefs into deals.`, how: "Every Monday list your top five prospects, the next step and its date, and clear one blocker each.", metric: "Prospects with a dated next step" })

  const targetDeals = Math.max(1, Math.ceil((S.validated.deals || S.previous.deals || 1) * 1.25 / Math.max(r.period.months, 1)))
  return {
    headline,
    takeaways,
    recommendations: recs.slice(0, RECOMMENDATIONS),
    nextMonth: { focus: r.leads.priority.length ? `Close the ${plural(r.leads.priority.length, "priority buyer")} and keep the pipeline full.` : S.pending.deals ? "Validate the pending deals and book new viewings." : "One named prospect a day and one viewing a week.", target: `${plural(targetDeals, "validated deal")} next month` },
    source: "rules",
  }
}

const str = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null)

/** What the model sent back, checked field by field; anything missing falls back to the rules. */
export function sanitizeInsights(raw: unknown, rules: AgentInsights): AgentInsights | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const takeaways = (Array.isArray(o.takeaways) ? o.takeaways : []).map((t) => str(t, 320)).filter((t): t is string => !!t).slice(0, 5)
  const recommendations = (Array.isArray(o.recommendations) ? o.recommendations : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .map((x) => (x ? { title: str(x.title, 80), why: str(x.why, 300), how: str(x.how, 360), metric: str(x.metric, 100) } : null))
    .filter((x): x is Recommendation => !!x && !!x.title && !!x.why && !!x.how && !!x.metric)
    .slice(0, RECOMMENDATIONS)
  const nm = o.next_month && typeof o.next_month === "object" ? (o.next_month as Record<string, unknown>) : o.nextMonth && typeof o.nextMonth === "object" ? (o.nextMonth as Record<string, unknown>) : null
  const nextMonth = nm && str(nm.focus) && str(nm.target, 120) ? { focus: str(nm.focus)!, target: str(nm.target, 120)! } : rules.nextMonth
  return {
    headline: str(o.headline, 400) ?? rules.headline,
    takeaways: takeaways.length >= 2 ? takeaways : rules.takeaways,
    recommendations: recommendations.length >= 3 ? recommendations : rules.recommendations,
    nextMonth,
    source: o.source === "ai" ? "ai" : "rules",
  }
}

const SYSTEM = `You are FHI Assistant, coaching ONE property consultant at FHI Global Property (Dubai) from their own figures. You receive FACTS as JSON — the only numbers you may use. Write in plain, warm, direct English to the person ("you"), no markdown, no bullet characters, no arrows.
Return JSON: {"headline": one sentence with their headline result for the period, "takeaways": [3 to 5 one-sentence facts with numbers], "recommendations": [exactly 5 objects {"title","why","how","metric"} for the next 30 days — "why" cites a figure from FACTS, "how" is concrete (what to do, where in the dashboard, how often), "metric" is what to watch; most impactful first, drafts are in FACTS.draft_recommendations and may be rewritten or replaced], "next_month": {"focus": one sentence, "target": a number-based target such as "3 validated deals"}, "source": "ai"}.
Rules: never invent a number; never mention another agent's amounts (only a rank on the board); never promise commission or income; if a figure is zero say so plainly and give the first step. Dubai property practices you may draw on: WhatsApp follow-up within the hour, sharing the Buyers Link daily, short project reels, brochures from FHI Assistant, client reviews, hosting a small event, coaching recruits to a first deal.`

export type ModelUsage = { model: string; promptTokens: number; completionTokens: number; ok: boolean }

/** `onUsage` hears about every request that reached the model — the budget counts them. */
export async function buildAgentInsights(r: AgentReport, opts: { timeoutMs?: number; onUsage?: (u: ModelUsage) => void } = {}): Promise<AgentInsights> {
  const rules = ruleInsights(r)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return rules
  const facts = { ...signals(r), draft_recommendations: rules.recommendations }
  const model = process.env.OPENAI_ADVICE_MODEL?.trim() || "gpt-4.1"
  let reported = false
  const report = (u: Omit<ModelUsage, "model">) => {
    if (reported) return
    reported = true
    opts.onUsage?.({ model, ...u })
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    })
    if (!res.ok) {
      report({ promptTokens: 0, completionTokens: 0, ok: false })
      return rules
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    report({ promptTokens: Number(json.usage?.prompt_tokens) || 0, completionTokens: Number(json.usage?.completion_tokens) || 0, ok: true })
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>
    const out = sanitizeInsights({ ...parsed, source: "ai" }, rules)
    if (!out || out.recommendations === rules.recommendations || out.takeaways === rules.takeaways) return rules
    return out
  } catch {
    report({ promptTokens: 0, completionTokens: 0, ok: false })
    return rules
  }
}
