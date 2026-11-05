import "server-only"

import { REQUIREMENT_LABELS, type Lever, type Requirement, type TeamReport } from "./data"

/**
 * FHI Assistant's analysis for the Team Performance Report: the headline,
 * the takeaways, the new-vs-existing reading, a month-by-month plan for the
 * next quarter and the ten strategies to double the team's sales. The facts
 * are computed here from the report itself (`signals`); the model (the same
 * OpenAI account as FHI Assistant, its advice model) only turns those facts
 * into plain advice and is told to cite nothing else. When the key is
 * missing, the call fails or the answer doesn't parse, rule-based advice
 * built from the same facts is used — the report never ships without its
 * analysis. The PDF is rendered from the SAME analysis the page showed
 * (`sanitizeInsights` on what the page posts back), so the model runs once
 * per report and the document says what the screen said.
 */

export type Strategy = { title: string; why: string; how: string; owner: string; metric: string; impact: "High" | "Medium" | "Quick win" }
export type MonthPlan = { month: string; focus: string; target: string }
export type TeamInsights = {
  headline: string
  takeaways: string[]
  cohortAnalysis: string
  nextQuarter: MonthPlan[]
  strategies: Strategy[]
  source: "ai" | "rules"
}

const OWNERS = ["Team leader", "Unit managers", "Agents", "Admin & operations", "Recruiters"] as const
const IMPACTS = ["High", "Medium", "Quick win"] as const
const STRATEGIES = 10

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const pct = (part: number, whole: number) => {
  if (whole <= 0) return "0%"
  const p = (part / whole) * 100
  return part > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`
}
const plural = (n: number, word: string, words = `${word}s`) => `${n.toLocaleString("en-AE")} ${n === 1 ? word : words}`
const hasDigit = (s: string) => /\d/.test(s)

/** The three calendar months after the span — the span's end month counts when the span stops mid-month. */
export function nextMonths(toExclusive: string): string[] {
  const d = new Date(`${toExclusive.slice(0, 7)}-01T00:00:00Z`)
  return [0, 1, 2].map((i) => {
    const m = new Date(d)
    m.setUTCMonth(d.getUTCMonth() + i)
    return m.toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" })
  })
}

// ─── Facts ───────────────────────────────────────────────────────────────────

/** Every fact the advice may use — plain numbers with their meaning, at most five names per list. */
export function signals(r: TeamReport): Record<string, unknown> {
  const S = r.sales
  const C = r.cohorts
  const R = r.recruitment
  const A = r.activity
  const T = r.targets
  const cohort = (c: typeof C.new) => ({
    members: c.members,
    active: c.active,
    with_selling_role: c.sellingRole,
    sellers: c.sellers,
    validated_deals: c.deals,
    validated_value_aed: c.value,
    share_of_team_value: pct(c.value, S.validated.value),
    value_per_seller_aed: c.perSeller,
    value_per_member_aed: c.perMember,
    pending_deals: c.pendingDeals,
  })
  const person = (m: TeamReport["activity"]["sellers"][number]) => `${m.name} (${m.cohort === "new" ? "new" : "existing"}${m.subteam ? `, ${m.subteam}` : ""})`
  return {
    team: {
      name: r.team.name,
      leaders: r.team.leaders,
      subteams: r.team.subteams,
      members_total: r.members.total,
      active_members: r.members.active,
      waiting_for_approval: r.members.pending,
      with_selling_role: r.members.sellingRole,
      ready_to_sell: r.members.ready,
      tenure: Object.fromEntries(r.members.tenureBands.map((b) => [b.label, b.value])),
    },
    period: { dates: r.period.label, months: Math.round(r.period.months * 10) / 10, compared_with: r.period.versus },
    sales: {
      validated_deals: S.validated.deals,
      validated_value_aed: S.validated.value,
      change_vs_previous: S.change,
      previous_deals: S.previous.deals,
      previous_value_aed: S.previous.value,
      pending_deals: S.pending.deals,
      pending_value_aed: S.pending.value,
      rejected: S.rejected,
      average_deal_aed: S.avgDeal,
      shared_deals: S.sharedDeals,
      all_time_validated_deals: S.allTime.deals,
      all_time_validated_value_aed: S.allTime.value,
      by_month: S.byMonth.map((b) => `${b.label}: ${aed(b.value)}`),
      top_projects: S.topProjects.slice(0, 5).map((p) => `${p.name}${p.developer ? ` (${p.developer})` : ""}: ${plural(p.deals, "deal")}, ${aed(p.value)}`),
      top_developers: S.topDevelopers.slice(0, 3).map((d) => `${d.name}: ${plural(d.deals, "deal")}, ${aed(d.value)}`),
    },
    new_vs_existing: {
      definition: "NEW = FHI account created inside the period; EXISTING = created before it",
      new_agents: cohort(C.new),
      existing_agents: cohort(C.existing),
    },
    recruitment: {
      recruited_in_period: R.recruited,
      via_team_invite_links: R.viaTeamInvite,
      recruited_previous_period: R.previous,
      change_vs_previous: R.change,
      funnel: Object.fromEntries(R.funnel.map((f) => [f.label, f.value])),
      requirements: Object.values(REQUIREMENT_LABELS),
      recruits_missing_each_requirement: Object.fromEntries(R.missing.map((m) => [m.label, m.value])),
      not_ready_total: R.notReadyTotal,
      not_ready_examples: R.notReady.slice(0, 5).map((m) => `${m.name} (invited by ${m.invitedBy?.name ?? "nobody"}): missing ${m.missing.map((k) => REQUIREMENT_LABELS[k].toLowerCase()).join(", ")}`),
      recruits_by_account_role: Object.fromEntries(R.byAccountRole.map((b) => [b.label, b.value])),
      recruiters_with_recruits_waiting: R.recruiters
        .filter((g) => g.waitingApproval + g.waitingRole + g.profileOrPhoto > 0)
        .slice(0, 5)
        .map((g) => `${g.name}${g.onTeam ? "" : " (outside the team)"}: ${plural(g.recruits, "recruit")}, ${g.waitingApproval} waiting for Approve, ${g.waitingRole} without a selling role, ${g.profileOrPhoto} missing profile or photo`),
      ready_but_no_sale_total: R.readyNotSellingTotal,
      ready_but_no_sale_examples: R.readyNotSelling.slice(0, 5).map((m) => m.name),
    },
    activity: {
      members_who_sold: A.sellersTotal,
      top_sellers: A.sellers.slice(0, 5).map((m) => `${person(m)}: ${plural(m.deals, "deal")}, ${aed(m.value)}`),
      quiet_existing_sellers: A.quietTotal,
      quiet_means: "no validated deal AND no deal waiting for validation in the period; a partner on a shared deal is credited their share, so partners count as sellers, never as quiet",
      sellers_with_a_deal_waiting_for_validation: A.waitingValidationTotal,
      never_sold: A.neverSold,
      quiet_examples: A.quiet.slice(0, 5).map((m) => `${m.name}: last validated ${m.lastValidated ?? "never"}`),
    },
    recruits_not_on_the_team_list: r.outsideTeam
      ? `${plural(r.outsideTeam.total, "recruit")} of ${r.outsideTeam.recruiters.join(" & ")} are in the invite network but were never added to the team, so Team Sales, the leaderboards and this report do not count them: ${r.outsideTeam.active} approved, ${r.outsideTeam.pending} waiting for Approve, ${r.outsideTeam.withoutSellingRole} without a selling role (an admin can add them to the team)`
      : "none",
    path_to_2x: {
      basis: T.basis === "period" ? "the period's own pace" : T.basis === "previous" ? "the pace of the period before (no validated sale in the period)" : "no validated sales in either period — first deals are the target",
      monthly_run_rate_aed: T.monthlyRunRate,
      last_90_days_run_rate_aed: T.last90dRunRate,
      target_per_month_aed: T.targetMonthly,
      target_3_months_aed: T.target3m,
      gap_to_close_3_months_aed: T.gap3m,
      deals_per_month_now: T.dealsPerMonth,
      deals_needed_in_3_months: T.dealsNeeded3m,
      deals_at_current_pace_3_months: T.dealsNow3m,
      extra_deals_per_month: T.extraDealsPerMonth,
      extra_deals_needed_3_months: T.extraDeals3m,
      groups_who_could_close_the_gap: T.levers.map((l) => `${l.title}: ${plural(l.people, "person", "people")}; the gap alone takes a deal from ${Math.min(l.needed, l.people)} of them (${Math.round(Math.min(1, l.share) * 100)}%)${l.share > 1 ? " — not enough on their own" : ""}`),
      next_months: nextMonths(r.period.to),
    },
  }
}

// ─── Rules ───────────────────────────────────────────────────────────────────

/** The same analysis without the model — always available, every "why" carries a number. */
export function ruleInsights(r: TeamReport): TeamInsights {
  const S = r.sales
  const C = r.cohorts
  const R = r.recruitment
  const A = r.activity
  const T = r.targets
  const months = nextMonths(r.period.to)
  const team = r.team.name
  const top = S.topProjects[0]
  const topDev = S.topDevelopers[0]
  const recruitsPerMonth = Math.round((R.recruited / Math.max(r.period.months, 0.25)) * 10) / 10
  const topMissing = [...R.missing].sort((a, b) => b.value - a.value)[0]

  const headline =
    T.basis === "period"
      ? `${team} closed ${plural(S.validated.deals, "validated deal")} worth ${aed(S.validated.value)} in ${r.period.label}${S.change ? ` (${S.change} vs ${r.period.versus})` : ""}. Doubling that means ${aed(T.targetMonthly)} a month for the next three months — about ${plural(T.dealsNeeded3m, "deal")} at the team's average of ${aed(S.avgDeal)}.`
      : T.basis === "previous"
        ? `${team} recorded no validated sale in ${r.period.label}; ${r.period.versus} brought ${aed(S.previous.value)}. The next three months need ${aed(T.targetMonthly)} a month to reach double that pace.`
        : `${team} has no validated sales in ${r.period.label} or ${r.period.versus}. The first target is ${plural(T.dealsNeeded3m, "first deal")} in the next three months — one from each ready member who has never recorded a sale.`

  const takeaways = [
    S.validated.deals
      ? `${plural(S.validated.deals, "validated deal")} worth ${aed(S.validated.value)}, against ${S.previous.deals} (${aed(S.previous.value)}) ${r.period.versus}; average deal ${aed(S.avgDeal)}.`
      : `No validated deals in ${r.period.label}, against ${S.previous.deals} (${aed(S.previous.value)}) ${r.period.versus}.`,
    `New agents (${C.new.members}) brought ${aed(C.new.value)} — ${pct(C.new.value, S.validated.value)} of the value — from ${plural(C.new.sellers, "seller")}; existing agents (${C.existing.members}) brought ${aed(C.existing.value)} from ${plural(C.existing.sellers, "seller")}.`,
    `${plural(R.recruited, "recruit")} joined (${R.viaTeamInvite} through the team's invite links; ${R.previous} ${r.period.versus}): ${R.funnel[1].value} approved, ${R.funnel[2].value} finished every requirement, ${R.funnel[3].value} recorded a sale.`,
    `${A.sellersTotal} of ${r.members.active} active members sold; ${plural(A.quietTotal, "existing seller")} went quiet (${A.neverSold} have never sold)${A.waitingValidationTotal ? `; ${plural(A.waitingValidationTotal, "more member")} ha${A.waitingValidationTotal === 1 ? "s" : "ve"} a deal waiting for validation and ${A.waitingValidationTotal === 1 ? "is" : "are"} not counted as quiet` : ""}.`,
    ...(S.pending.deals ? [`${plural(S.pending.deals, "deal")} worth ${aed(S.pending.value)} are still waiting for validation.`] : []),
  ].slice(0, 5)

  const cohortAnalysis = [
    `New agents are ${pct(C.new.members, r.members.total)} of the team (${C.new.members} of ${r.members.total}) and brought ${pct(C.new.value, S.validated.value)} of the validated value (${aed(C.new.value)} from ${plural(C.new.deals, "deal")}); existing agents brought ${pct(C.existing.value, S.validated.value)} (${aed(C.existing.value)} from ${plural(C.existing.deals, "deal")}).`,
    `Each selling new agent averaged ${aed(C.new.perSeller)} against ${aed(C.existing.perSeller)} for a selling existing agent; per member the new cohort is worth ${aed(C.new.perMember)} and the existing cohort ${aed(C.existing.perMember)}.`,
    `The gap is activation: ${R.readyNotSellingTotal} recruits are ready but have not recorded a sale and ${R.notReadyTotal} are not yet ready${topMissing && topMissing.value ? ` (most often ${topMissing.label.toLowerCase()}, ${topMissing.value})` : ""}, while ${A.quietTotal} existing sellers sold nothing in the period.`,
  ].join(" ")

  const target = T.basis === "none" ? plural(Math.max(1, Math.ceil(T.dealsNeeded3m / 3)), "first deal") : aed(T.targetMonthly)
  const m1 = [
    R.readyNotSellingTotal ? `a first deal from the ${R.readyNotSellingTotal} ready recruits` : "",
    R.notReadyTotal ? `every requirement finished for the ${R.notReadyTotal} recruits who are not ready` : "",
    S.pending.deals ? `the ${plural(S.pending.deals, "pending deal")} chased to validation` : "",
  ].filter(Boolean)
  const nextQuarter: MonthPlan[] = [
    { month: months[0], focus: m1.length ? `Activation: ${m1.join(", ")}.` : "Activation: every member with a selling role names a prospect and books a viewing date.", target },
    { month: months[1], focus: `Momentum: ${A.quietTotal ? `the ${A.quietTotal} quiet existing sellers back with one named prospect each` : "every seller keeps one live prospect"}${top ? `, and a team push on ${top.name} (${plural(top.deals, "deal")} in the period)` : ""}.`, target },
    { month: months[2], focus: `Scale: ${A.sellersTotal ? `a second deal from each of the ${A.sellersTotal} sellers` : "the first sellers close a second deal"}, shared deals pairing new and existing agents, and recruits who finish onboarding within a week of joining.`, target },
  ]

  // How much of a group would have to close one deal to cover the gap alone.
  const L = (title: string) => T.levers.find((l) => l.title === title)
  const gapLine = (l: Lever | undefined) => (l ? `the gap needs ${plural(T.extraDeals3m, "more deal")}, so a deal from ${Math.min(l.needed, l.people)} of them (${Math.round(Math.min(1, l.share) * 100)}%) would cover it` : "")
  const leverScore = (l: Lever | undefined) => (l ? 100 * (1 - Math.min(1, l.share)) : 0)
  const backlog = R.readyNotSellingTotal + R.notReadyTotal
  const lowYield = R.recruited > 0 && backlog > R.recruited / 2
  const wasWere = S.sharedDeals === 1 ? "was" : "were"
  // Recruits of the period that are missing one requirement; only the recruiter can fix approval and role.
  const missingN = (k: Requirement) => R.missing.find((m) => m.label === REQUIREMENT_LABELS[k])?.value ?? 0
  const waiter = R.recruiters.find((g) => g.waitingApproval > 0)

  type Candidate = Strategy & { score: number; when: boolean }
  const candidates: Candidate[] = [
    {
      title: "First deals for the ready recruits",
      why: `${plural(R.readyNotSellingTotal, "recruit")} finished every requirement but have not recorded a sale; ${gapLine(L("Activate the ready recruits"))}.`,
      how: `Pair each ready recruit with an existing seller for 30 days, hand them three live units${top ? ` in ${top.name}` : ""} to present, and book their first client viewing in week 1.`,
      owner: "Team leader", metric: "First deals recorded per week", impact: "High",
      score: leverScore(L("Activate the ready recruits")), when: R.readyNotSellingTotal > 0,
    },
    {
      title: "Finish the recruits' requirements",
      why: `${plural(R.notReadyTotal, "recruit")} are not yet ready to sell: ${missingN("selling_role")} still have no selling role (the Team invite link registers everyone as Member) and ${missingN("approved")} wait for Approve.`,
      how: "Send each recruiter their own list: on Invite → Team they set the role dropdown to Agent and press Approve, then chase the profile and photo on WhatsApp every 3 days.",
      owner: "Recruiters", metric: "Recruits ready to sell", impact: "Quick win",
      score: leverScore(L("Finish the recruits' requirements")) + 5, when: R.notReadyTotal > 0,
    },
    {
      title: "Add the missing recruits to the team",
      why: r.outsideTeam ? `${plural(r.outsideTeam.total, "recruit")} of ${r.outsideTeam.recruiters.join(" & ")} are not on the team list yet (${r.outsideTeam.active} approved, ${r.outsideTeam.pending} waiting for Approve), so Team Sales, the leaderboards and this report do not count them.` : "",
      how: "Ask an admin to add them in Teams > Add member, and press Approve on the ones still waiting in Invite > Team, so their progress and first sales are counted.",
      owner: "Admin & operations", metric: "Recruits not on the team list", impact: "High",
      score: 36, when: !!r.outsideTeam && r.outsideTeam.total > 0,
    },
    {
      title: "Wake the quiet sellers",
      why: `${plural(A.quietTotal, "existing seller")} had no validated deal in ${r.period.label}; ${A.neverSold} have never sold; ${gapLine(L("Wake the quiet sellers"))}.`,
      how: "Call every quiet seller this week, agree one named prospect and one project each, and review them in a 15-minute Monday pipeline call.",
      owner: "Team leader", metric: "Quiet sellers with a live prospect", impact: "High",
      score: leverScore(L("Wake the quiet sellers")), when: A.quietTotal > 0,
    },
    {
      title: "One more deal from every seller",
      why: `${plural(A.sellersTotal, "member")} sold in the period; one extra deal each is ${A.sellersTotal} of the ${T.extraDeals3m} more deals the next three months need.`,
      how: "Ask every seller for three referrals from their last buyer within 14 days of validation, log them on the team board and follow up within 48 hours.",
      owner: "Agents", metric: "Referrals logged per seller", impact: "Medium",
      score: leverScore(L("One more deal from every seller")), when: A.sellersTotal > 0,
    },
    {
      title: "Run the 2× scoreboard every week",
      why: `Doubling needs ${aed(T.targetMonthly)} a month — about ${plural(T.dealsNeeded3m, "deal")} in three months against ${T.dealsNow3m} at today's pace.`,
      how: "Publish the monthly target, the deals closed and the deals still needed on the team chat every Monday, and celebrate every validated deal the same day.",
      owner: "Team leader", metric: "Deals closed vs deals needed, weekly", impact: "High",
      score: 55, when: true,
    },
    {
      title: "Validate the pending deals",
      why: `${plural(S.pending.deals, "deal")} worth ${aed(S.pending.value)} are waiting for validation.`,
      how: "Chase the missing documents on every pending sale this week; only validated sales count on the leaderboard and release commission.",
      owner: "Admin & operations", metric: "Pending deals older than 7 days", impact: "Quick win",
      score: 50, when: S.pending.deals > 0,
    },
    {
      title: "Clear the approval queue",
      why: `${plural(missingN("approved"), "recruit")} of this period still wait for the recruiter who invited them to press Approve${waiter ? `; ${waiter.name} has the most (${waiter.waitingApproval})` : ""}.`,
      how: "Every recruiter opens Invite → Team (and Global Partners) and presses Approve on each pending recruit within 24 hours of joining; the leader checks the recruiters table every Monday.",
      owner: "Recruiters", metric: "Recruits waiting more than 24 hours for Approve", impact: "Quick win",
      score: 45, when: missingN("approved") > 0,
    },
    {
      title: top ? `Double down on ${top.name}` : "Pick one project to push",
      why: top ? `${top.name} brought ${plural(top.deals, "deal")} worth ${aed(top.value)} — ${pct(top.value, S.validated.value)} of the period's value.` : `No project stood out: ${plural(S.validated.deals, "validated deal")} in the period.`,
      how: top ? `Hold a team viewing day or webinar on ${top.name} this month, give every ready recruit its unit list and payment plan, and post it on the team's websites and reels.` : "Pick one launching project, hold a team briefing on it and give every ready member its unit list and payment plan.",
      owner: "Unit managers", metric: top ? `Viewings booked for ${top.name}` : "Viewings booked for the chosen project", impact: "Medium",
      score: 40, when: true,
    },
    {
      title: "Hold a weekly pipeline call",
      why: `${plural(r.members.active, "active member")}, but only ${A.sellersTotal} sold in ${r.period.label}.`,
      how: "Run a 30-minute call every Monday: each seller names their top three prospects, the next step and its date; the leader unblocks one deal per person.",
      owner: "Team leader", metric: "Prospects with a dated next step", impact: "High",
      score: 38, when: true,
    },
    {
      title: "Give every seller a monthly target",
      why: `Doubling needs ${aed(T.targetMonthly)} a month, and ${plural(r.members.sellingRole, "member")} hold a selling role.`,
      how: "Split the monthly target into one deal-sized goal per selling member, write it next to their name on the scoreboard and review it with each of them every month.",
      owner: "Unit managers", metric: "Selling members on target", impact: "Medium",
      score: 34, when: true,
    },
    {
      title: "Pair new agents with existing sellers",
      why: `${plural(S.sharedDeals, "deal")} ${wasWere} shared in the period; new agents brought ${pct(C.new.value, S.validated.value)} of the value from ${plural(C.new.sellers, "seller")} against ${plural(C.existing.sellers, "existing seller")}.`,
      how: "Give each new agent an existing agent as a mentor, and record joint deals as shared sales with an A2A agreement so both are credited their share.",
      owner: "Team leader", metric: "Shared deals with a new agent", impact: "Medium",
      score: 30, when: C.new.members > 0,
    },
    {
      title: "Role-play the first client call",
      why: `${plural(R.recruited, "recruit")} joined but ${R.funnel[3]?.value ?? 0} recorded a sale.`,
      how: "Run a 45-minute call-practice session every week — enquiry call, project pitch, viewing booking — and have each recruit book one real viewing before the next session.",
      owner: "Unit managers", metric: "Recruits who booked a viewing", impact: "Medium",
      score: 28, when: true,
    },
    {
      title: "Run the subteams as a league",
      why: `${team} has ${plural(r.team.subteams, "subteam")}; every subteam's sales count for the team.`,
      how: "Rank the subteams monthly on validated deals and first deals from recruits, and let the winning subteam lead the next viewing day.",
      owner: "Unit managers", metric: "Deals per subteam per month", impact: "Medium",
      score: 24, when: r.team.subteams > 0,
    },
    {
      title: "Stop sales being rejected",
      why: `${plural(S.rejected, "sale")} ${S.rejected === 1 ? "was" : "were"} rejected in ${r.period.label}.`,
      how: "Review each rejection reason with the agent, re-submit with complete documents, and brief the team on the proof-of-transaction checklist.",
      owner: "Unit managers", metric: "Rejected sales per month", impact: "Quick win",
      score: 22, when: S.rejected > 0,
    },
    {
      title: topDev ? `Ask ${topDev.name} for the next launch` : "Work the developers' launches",
      why: topDev ? `${topDev.name} delivered ${plural(topDev.deals, "deal")} worth ${aed(topDev.value)} for the team in the period.` : `${plural(S.topDevelopers.length, "developer")} appear in the period's validated sales.`,
      how: topDev ? `Ask ${topDev.name} for launch allocations and a sales kit, and host a launch night for the team's clients within the month.` : "Ask the developers the team sells for launch allocations and host a launch night for the team's clients.",
      owner: "Team leader", metric: "Launch units reserved by the team", impact: "Medium",
      score: 20, when: true,
    },
    lowYield
      ? {
          title: "Recruit for quality, not volume",
          why: `${plural(R.recruited, "recruit")} joined but only ${R.funnel[3]?.value ?? 0} recorded a sale, and ${plural(backlog, "recruit")} are still waiting to become sellers.`,
          how: "Until the backlog is cleared, ask members to bring only recruits who will attend the next training and finish every requirement within 7 days of joining.",
          owner: "Recruiters", metric: "Recruits ready within 7 days of joining", impact: "Medium",
          score: 18, when: true,
        }
      : {
          title: "Recruit at double the pace",
          why: `${plural(R.recruited, "recruit")} joined in ${r.period.label} — about ${recruitsPerMonth} a month; a recruit who registers through a member's invite link joins the team automatically.`,
          how: `Set a target of ${Math.max(1, Math.ceil(recruitsPerMonth * 2))} recruits a month, have every member share their invite link weekly, and review the new sign-ups every Friday.`,
          owner: "Recruiters", metric: "Recruits per week via invite links", impact: "Medium",
          score: 18, when: true,
        },
    {
      title: "Answer every lead within the hour",
      why: `${plural(A.sellersTotal, "member")} of ${r.members.sellingRole} with a selling role closed a deal in ${r.period.label}.`,
      how: "Have every ready member run their Buyers Link and website, answer each enquiry within an hour, and post three project reels a week.",
      owner: "Agents", metric: "Enquiries answered within an hour", impact: "Medium",
      score: 16, when: true,
    },
    {
      title: "Celebrate every validated deal the same day",
      why: `${plural(S.validated.deals, "validated deal")} in ${r.period.label}; a visible win is the cheapest way to get the next one.`,
      how: "Post each validated deal with the agent's name and the project on the team chat the same day, and bring the week's closers on stage at the next FHI event.",
      owner: "Team leader", metric: "Validated deals celebrated within 24 hours", impact: "Quick win",
      score: 8, when: true,
    },
  ]
  const strategies = candidates
    .filter((c) => c.when && hasDigit(c.why))
    .sort((a, b) => b.score - a.score)
    .slice(0, STRATEGIES)
    .map((c): Strategy => ({ title: c.title, why: c.why, how: c.how, owner: c.owner, metric: c.metric, impact: c.impact }))
  return { headline, takeaways, cohortAnalysis, nextQuarter, strategies, source: "rules" }
}

// ─── Model ───────────────────────────────────────────────────────────────────

const SYSTEM = `You are FHI Assistant, writing the analysis section of a Team Performance Report for the TEAM LEADER of one team at FHI Global Property, a Dubai real estate brokerage that sells off-plan and ready property through a large network of agents and Global Partners recruited by referral (members recruit people through invite links; a recruit joins the recruiter's team). How a recruit becomes able to sell: they register through the recruiter's invite link (the Team link registers everyone as Member, which cannot sell; the separate Global Partner link registers a Global Partner, which is a selling role), then ONLY the recruiter who invited them presses Approve on their Invite page and changes the role dropdown to Agent, and the recruit completes their own profile and photo. Admins validate sales and can also activate an account, but approving recruits and setting their role is the recruiter's job, so never tell the team leader to ask an admin to approve someone or to give a role. The report's purpose is to get the team to DOUBLE its validated sales over the next three months, and its design should make the leader want to act.

You receive FACTS as JSON. Write, addressed to the team leader:
1. "headline": one sentence — what the period delivered and what doubling needs (quote the monthly target).
2. "takeaways": 4 or 5 one-sentence findings about the period, most important first.
3. "cohort_analysis": 3 or 4 sentences comparing the NEW agents (FHI accounts created in the period) with the EXISTING agents — share of validated value, deals, sellers, value per seller — and what that means for the team.
4. "next_quarter": exactly 3 items, one per month in FACTS.path_to_2x.next_months in order, each {"month", "focus": one sentence on what the team concentrates on that month, "target": the money or deals target for that month, from FACTS}.
5. "strategies": exactly 10 strategies to double the team's sales, ordered by impact, each {"title": max 7 words, "why": the finding — must quote at least one number from FACTS, "how": what to do, who, when and where, starting with a verb, max 35 words, "owner", "metric": what to measure weekly, max 12 words, "impact"}.

Rules:
- Use ONLY the numbers in FACTS. Every takeaway, the cohort analysis and every "why" must quote at least one number from FACTS exactly as given. Never invent figures, percentages, names, numeric targets or causes — the targets are the ones in FACTS.path_to_2x.
- FACTS.draft_strategies are rule-based strategies already checked against the data. Use them as your starting point: keep the important ones, merge or sharpen them, order by impact, and add others only when FACTS support them.
- Never make a "how" vaguer than its draft. Good actions name who does what, how often and where (e.g. "Pair each ready recruit with an existing seller for 30 days and book their first viewing in week 1"), not generic phrases like "improve training" or "enhance motivation".
- Be specific and practical for this business: first deals for recruits, getting recruits approved and moved from Member to Agent by their recruiters (FACTS.recruitment.recruiters_with_recruits_waiting says who has recruits waiting; quote those names only from FACTS) and finishing their profile and photo, waking quiet sellers, shared deals pairing an existing and a new agent (recorded with an A2A agreement), project launches and viewing days, Buyers Link and website leads, FHI events, referral recruiting through invite links, chasing pending sales to validation.
- FACTS.recruits_not_on_the_team_list, when it is not "none", says some recruits are in the invite network but not on the team list: say so plainly, that those recruits are not counted anywhere yet, and that an admin has to add them — never invent their sales or readiness. FACTS.activity.sellers_with_a_deal_waiting_for_validation are NOT quiet sellers: a deal waiting for validation is a deal, and a partner on a shared deal is credited their share.
- A zero is a finding (e.g. no recruit has recorded a sale yet), not a reason to stay silent. State it plainly — no filler.
- "owner" must be one of: ${OWNERS.join(", ")} ("Recruiters" = the members who invited the recruits; "Admin & operations" = validating sales only).
- "impact" must be one of: ${IMPACTS.join(", ")}.
- Plain text, no markdown, no emojis. Short sentences. British/UAE business English. Amounts as "AED 1,234,567".

Return JSON: {"headline": string, "takeaways": string[], "cohort_analysis": string, "next_quarter": [{"month": string, "focus": string, "target": string}], "strategies": [{"title": string, "why": string, "how": string, "owner": string, "metric": string, "impact": string}]}`

/**
 * Anything claiming to be a TeamInsights (the model's answer, or what the
 * page posts back for the PDF) made whole: strings trimmed, enums checked,
 * strategies without a number dropped and the list padded from the rules
 * to ten. Returns null when the input isn't an object at all.
 */
export function sanitizeInsights(raw: unknown, rules: TeamInsights): TeamInsights | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const str = (v: unknown, max = 600) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  const takeaways = list(o.takeaways).map((t) => str(t)).filter((t): t is string => !!t && hasDigit(t)).slice(0, 5)
  const strategies: Strategy[] = list(o.strategies)
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => !!x)
    .map((x) => ({
      title: str(x.title, 80) ?? "",
      why: str(x.why) ?? "",
      how: str(x.how) ?? "",
      owner: (OWNERS as readonly string[]).includes(String(x.owner)) ? String(x.owner) : "Team leader",
      metric: str(x.metric, 120) ?? "",
      impact: ((IMPACTS as readonly string[]).includes(String(x.impact)) ? String(x.impact) : "Medium") as Strategy["impact"],
    }))
    .filter((s) => s.title && s.why && s.how && hasDigit(s.why))
    .slice(0, STRATEGIES)
  const seen = new Set(strategies.map((s) => s.title.toLowerCase()))
  for (const s of rules.strategies) {
    if (strategies.length >= STRATEGIES) break
    if (seen.has(s.title.toLowerCase())) continue
    strategies.push(s)
    seen.add(s.title.toLowerCase())
  }
  const months = rules.nextQuarter.map((m) => m.month)
  const quarter = list(o.next_quarter ?? o.nextQuarter)
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .map((x, i) => (x ? { month: str(x.month, 40) ?? months[i] ?? "", focus: str(x.focus) ?? "", target: str(x.target, 120) ?? "" } : null))
    .filter((m): m is MonthPlan => !!m && !!m.focus && !!m.target)
    .slice(0, 3)
  const source = o.source === "ai" ? "ai" : "rules"
  return {
    headline: str(o.headline) ?? rules.headline,
    takeaways: takeaways.length >= 2 ? takeaways : rules.takeaways,
    cohortAnalysis: str(o.cohort_analysis ?? o.cohortAnalysis, 1200) ?? rules.cohortAnalysis,
    nextQuarter: quarter.length === 3 ? quarter : rules.nextQuarter,
    strategies,
    source,
  }
}

/** FHI Assistant's analysis, or the rules when the model can't be used. `timeoutMs` bounds the model call. */
export type ModelUsage = { model: string; promptTokens: number; completionTokens: number; ok: boolean }

/** `onUsage` hears about every request that reached the model (tokens 0 when none came back) — the leaders' budget counts them. */
export async function buildTeamInsights(r: TeamReport, opts: { timeoutMs?: number; onUsage?: (u: ModelUsage) => void } = {}): Promise<TeamInsights> {
  const rules = ruleInsights(r)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return rules
  const facts = { ...signals(r), draft_strategies: rules.strategies.map(({ title, why, how, owner }) => ({ title, why, how, owner })) }
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
        max_tokens: 2400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 35_000),
    })
    if (!res.ok) {
      report({ promptTokens: 0, completionTokens: 0, ok: false })
      return rules
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    report({ promptTokens: Number(json.usage?.prompt_tokens) || 0, completionTokens: Number(json.usage?.completion_tokens) || 0, ok: true })
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>
    const out = sanitizeInsights({ ...parsed, source: "ai" }, rules)
    // Strategies the model left out are filled from the rules; a reply without takeaways of its own is not used at all.
    if (!out || out.strategies.length < STRATEGIES || out.takeaways === rules.takeaways) return rules
    return out
  } catch {
    report({ promptTokens: 0, completionTokens: 0, ok: false })
    return rules
  }
}
