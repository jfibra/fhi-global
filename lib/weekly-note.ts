import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { goalHeadline, goalProgress, readGoal } from "@/lib/agent-goal"
import { ROLE_DASHBOARD_MAP, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { dueLabel, listReminders, shiftDay } from "@/lib/assistant-notes"
import { dubaiMonthStart, recordAssistantUsage } from "@/lib/assistant-usage"
import { BUYER_LEAD_COLUMNS, leadGrade, type BuyerLead } from "@/lib/buyer-links"
import { leaderTeamId, ownTestMatcher, teamRoster } from "@/lib/fhi-agent-chat-tools"
import { AED, fetchAllSales, inRange, nameMaps, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import { sendWeeklyNoteEmail } from "@/lib/mailer"
import { SITE_URL } from "@/lib/seo"
import { STUCK_DAYS, stuckDeals } from "@/lib/stuck-deals"

/**
 * The weekly coaching note (boss via Juliecor, 2026-11-13): every Monday
 * morning each active agent and team leader gets an email with last week's
 * figures — validated and pending deals, new leads, leads not yet contacted,
 * the goal's pace, deals waiting long for validation, the reminders of the
 * coming week and, for a team leader, the team's week — and ONE tip for this
 * week. The figures are the same ones their FHI Assistant gives (same
 * helpers, same rules), computed without the model. The tip is written by
 * the chat model only for people who had a deal or a lead last week, under
 * its own small budget (WEEKLY_NOTE_MONTHLY_CAP_USD, audience "weekly_note"
 * in assistant_usage); everyone else, and anyone when the model is off or
 * the budget spent, gets the rule-based tip from the same facts.
 *
 * Who gets it: active accounts with an assistant role (agents, team
 * leaders) that were active in the last 90 days — signed in, asked the
 * assistant, had a deal or a lead — unless they stopped the notes
 * (profiles.metadata.assistant_weekly_note = "off", the link in the email).
 * Sent by app/api/cron/assistant-notes.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const WEEKLY_NOTE_AUDIENCE = "weekly_note"
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
export const weeklyNoteMonthlyCapUsd = () => num(process.env.WEEKLY_NOTE_MONTHLY_CAP_USD, 10)
const MODEL = () => process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"
/** Someone with no sign-in, question, deal or lead in this many days is not written to. */
const ACTIVE_DAYS = 90

export const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const weekStart = (today: string) => shiftDay(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
const dubaiMidnight = (iso: string) => `${iso}T00:00:00+04:00`
export const isMondayInDubai = (today = dubaiToday()) => new Date(`${today}T00:00:00Z`).getUTCDay() === 1
const dayLabel = (iso: string, withYear = false) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
/** "3 – 9 Nov 2026" for the week [from, to). */
export const weekLabel = (from: string, to: string) => `${dayLabel(from)} – ${dayLabel(shiftDay(to, -1), true)}`
/** The week the note is about: last Monday to Sunday, in Dubai. */
export const lastWeek = (today = dubaiToday()) => {
  const to = weekStart(today)
  const from = shiftDay(to, -7)
  return { from, to, label: weekLabel(from, to) }
}
const firstName = (name: string | null) => {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? ""
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "there"
}
const siteBase = () => SITE_URL.replace(/\/$/, "")
export const assistantUrlFor = (role: string | null) => `${siteBase()}/dashboard${ROLE_DASHBOARD_MAP[role ?? ""] ?? "/agent"}/fhi-chat`

// ─── The stop link ───────────────────────────────────────────────────────────

/** A token only our server can make: the stop link needs no login and must not let anyone switch someone else's notes off. */
export function weeklyNoteToken(userId: string): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return null
  return createHmac("sha256", secret).update(`weekly-note:${userId}`).digest("hex").slice(0, 40)
}
export function weeklyNoteTokenOk(userId: string, token: string | null): boolean {
  const want = weeklyNoteToken(userId)
  if (!want || !token || token.length !== want.length) return false
  return timingSafeEqual(Buffer.from(want), Buffer.from(token))
}
export const weeklyNoteStopUrl = (userId: string) => {
  const t = weeklyNoteToken(userId)
  return t ? `${siteBase()}/api/assistant/weekly-note?u=${userId}&t=${t}&on=0` : null
}

// ─── Who gets it ─────────────────────────────────────────────────────────────

export type WeeklyNoteRecipient = { userId: string; name: string | null; role: string; email: string }

export async function weeklyNoteRecipients(admin: Admin, today = dubaiToday()): Promise<{ recipients: WeeklyNoteRecipient[]; skipped: Record<string, number> }> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, fullname, role, metadata")
    .in("role", [...ROLES_AGENT_ASSISTANT])
    .eq("status", "active")
    .not("is_deleted", "is", true)
    .limit(5000)
  if (error) throw new Error(error.message)

  // Emails and last sign-ins live in auth.users.
  const auth = new Map<string, { email: string | null; lastSignIn: string | null }>()
  for (let page = 1; page <= 25; page++) {
    const { data, error: authError } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (authError) throw new Error(authError.message)
    for (const u of data.users) auth.set(u.id, { email: u.email?.trim() || null, lastSignIn: u.last_sign_in_at ?? null })
    if (data.users.length < 200) break
  }

  // Active lately: a deal credited to them, a lead, a question to the assistant, or a sign-in.
  const since = shiftDay(today, -ACTIVE_DAYS)
  const active = new Set<string>()
  const sinceMs = Date.parse(dubaiMidnight(since))
  for (const s of await fetchAllSales(admin)) if (inRange(s, since, null) || Date.parse(s.created_at) >= sinceMs) for (const c of saleCredits(s)) active.add(c.agentId)
  const [leads, asked] = await Promise.all([
    admin.from("buyer_link_leads").select("agent_id").gte("created_at", dubaiMidnight(since)).limit(5000),
    admin.from("assistant_usage").select("user_id").gte("asked_at", dubaiMidnight(since)).limit(5000),
  ])
  for (const l of (leads.data ?? []) as { agent_id: string }[]) active.add(l.agent_id)
  for (const a of (asked.data ?? []) as { user_id: string }[]) active.add(a.user_id)

  const recipients: WeeklyNoteRecipient[] = []
  const skipped: Record<string, number> = { no_email: 0, stopped: 0, inactive_90_days: 0 }
  for (const p of (profiles ?? []) as Array<{ id: string; fullname: string | null; role: string; metadata: Record<string, unknown> | null }>) {
    const a = auth.get(p.id)
    if (!a?.email) skipped.no_email++
    else if (p.metadata?.assistant_weekly_note === "off") skipped.stopped++
    else if (!active.has(p.id) && !(a.lastSignIn && Date.parse(a.lastSignIn) >= sinceMs)) skipped.inactive_90_days++
    else recipients.push({ userId: p.id, name: p.fullname, role: p.role, email: a.email })
  }
  recipients.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
  return { recipients, skipped }
}

// ─── The note ────────────────────────────────────────────────────────────────

export type WeeklyNote = {
  userId: string
  /** First name for the greeting. */
  name: string
  fullName: string | null
  role: string
  email: string
  week: { from: string; to: string; label: string }
  /** Deals of the week by business date, the person's share of shared deals. */
  sales: { validated: number; validatedValue: number; pending: number; pendingValue: number }
  /** Pending deals that have waited STUCK_DAYS or more since recorded. */
  stuck: Array<{ project: string; price: number; days: number }>
  leads: { fresh: number; priority: number; toFollowUp: number }
  goal: { label: string; goalTarget: string; headline: string; percent: number; daysLeft: number; pacePerWeek: number | null; done: boolean } | null
  /** Open reminders due by the end of the coming week, overdue ones first. */
  reminders: Array<{ body: string; client: string | null; dueOn: string; when: string }>
  team: { name: string; members: number; validated: number; validatedValue: number; pending: number; stuck: Array<{ member: string; project: string; days: number }>; stuckTotal: number } | null
  tip: { text: string; source: "ai" | "rules" }
  links: { assistant: string; stop: string | null }
}

export async function buildWeeklyNote(admin: Admin, r: WeeklyNoteRecipient, ctx: { today: string; sales: SaleRow[] }): Promise<WeeklyNote> {
  const week = lastWeek(ctx.today)
  const mine = (s: SaleRow) => saleCredits(s).find((c) => c.agentId === r.userId)
  const status = (s: SaleRow) => s.validation_status ?? "pending"
  const inWeek = ctx.sales.filter((s) => mine(s) && inRange(s, week.from, week.to))
  const sum = (rows: SaleRow[]) => rows.reduce((a, s) => a + (mine(s)?.value ?? 0), 0)
  const validated = inWeek.filter((s) => status(s) === "validated")
  const pending = inWeek.filter((s) => status(s) === "pending")

  const stuck = stuckDeals(ctx.sales, [r.userId], ctx.today).slice(0, 5)
  const isLeader = r.role === "team_leader"
  const teamId = isLeader ? await leaderTeamId(admin, r.userId) : null
  const roster = teamId ? await teamRoster(admin, teamId) : null
  const memberIds = new Set(roster?.live.map((m) => m.user_id) ?? [])
  const teamStuck = roster ? stuckDeals(ctx.sales, memberIds, ctx.today) : []
  const names = await nameMaps(admin, [...stuck, ...teamStuck.slice(0, 5)].map((d) => d.sale))

  const { data: leadRows, error } = await admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).eq("agent_id", r.userId).gte("created_at", dubaiMidnight(shiftDay(ctx.today, -30))).limit(1000)
  if (error) throw new Error(error.message)
  const isOwnTest = ownTestMatcher(r.email, r.name)
  const leads = ((leadRows ?? []) as unknown as BuyerLead[]).filter((b) => !isOwnTest(b))
  const fresh = leads.filter((b) => b.created_at >= dubaiMidnight(week.from) && b.created_at < dubaiMidnight(week.to))

  const g = await readGoal(admin, r.userId)
  const p = g ? await goalProgress(admin, r.userId, g, ctx.sales) : null

  // Reminders are a side section: a failed read (the table missing in an older database) must not cost the person their note.
  const open = await listReminders(admin, r.userId, "open", ctx.today, 50).catch(() => [])
  const horizon = shiftDay(ctx.today, 7)

  let team: WeeklyNote["team"] = null
  if (roster && teamId) {
    const teamWeek = ctx.sales.filter((s) => inRange(s, week.from, week.to) && saleCredits(s).some((c) => memberIds.has(c.agentId)))
    const teamValue = (rows: SaleRow[]) => rows.reduce((a, s) => a + saleCredits(s).filter((c) => memberIds.has(c.agentId)).reduce((b, c) => b + c.value, 0), 0)
    const memberName = (id: string) => roster.live.find((m) => m.user_id === id)?.profiles?.fullname ?? names.agent.get(id)?.name ?? "a member"
    team = {
      name: roster.allTeams.find((t) => t.id === teamId)?.name ?? "Your team",
      members: roster.live.length,
      validated: teamWeek.filter((s) => status(s) === "validated").length,
      validatedValue: teamValue(teamWeek.filter((s) => status(s) === "validated")),
      pending: teamWeek.filter((s) => status(s) === "pending").length,
      stuck: teamStuck.slice(0, 5).map((d) => ({ member: d.agentIds.map(memberName).join(" & "), project: names.proj.get(d.sale.project_id)?.name ?? "a project", days: d.days })),
      stuckTotal: teamStuck.length,
    }
  }

  const note: WeeklyNote = {
    userId: r.userId,
    name: firstName(r.name),
    fullName: r.name,
    role: r.role,
    email: r.email,
    week,
    sales: { validated: validated.length, validatedValue: sum(validated), pending: pending.length, pendingValue: sum(pending) },
    stuck: stuck.map((d) => ({ project: names.proj.get(d.sale.project_id)?.name ?? "a project", price: Number(d.sale.contract_price ?? 0), days: d.days })),
    leads: { fresh: fresh.length, priority: fresh.filter((b) => b.kind !== "seller" && leadGrade(b) === "priority").length, toFollowUp: leads.filter((b) => !b.contacted_at).length },
    goal: g && p ? { label: g.label, goalTarget: g.deals ? `${g.deals} deal${g.deals === 1 ? "" : "s"}` : AED(g.value ?? 0), headline: goalHeadline(p), percent: p.percent, daysLeft: p.days_left, pacePerWeek: p.pace_deals_per_week, done: p.done } : null,
    reminders: open.filter((x) => (x.due_on ?? "") <= horizon).map((x) => ({ body: x.body, client: x.client_name, dueOn: x.due_on ?? ctx.today, when: dueLabel(x.due_on ?? ctx.today, ctx.today) })),
    team,
    tip: { text: "", source: "rules" },
    links: { assistant: assistantUrlFor(r.role), stop: weeklyNoteStopUrl(r.userId) },
  }
  note.tip = { text: ruleTip(note), source: "rules" }
  return note
}

// ─── The tip ─────────────────────────────────────────────────────────────────

/** One concrete thing to do this week, from the facts — no model. Most urgent first. */
export function ruleTip(n: WeeklyNote): string {
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`
  if (n.stuck.length) {
    const d = n.stuck[0]
    return `Your deal on ${d.project} has waited ${d.days} days for validation. Ask the office today which document the file is missing — only a validated deal counts on the boards and towards your goal.`
  }
  if (n.leads.toFollowUp) return `${plural(n.leads.toFollowUp, "lead")} of the last 30 days ${n.leads.toFollowUp === 1 ? "is" : "are"} not marked contacted. Message each on WhatsApp today and mark them contacted — the first agent to reply usually keeps the client.`
  if (n.team && n.team.stuckTotal) {
    const d = n.team.stuck[0]
    return `${plural(n.team.stuckTotal, "deal")} in your team ${n.team.stuckTotal === 1 ? "has" : "have"} waited over ${STUCK_DAYS} days for validation — ${d.member}'s on ${d.project} the longest (${d.days} days). Check with each member what the office still needs.`
  }
  if (n.goal && !n.goal.done && n.goal.pacePerWeek) return `Your goal (${n.goal.label}) stands at ${n.goal.headline} with ${plural(n.goal.daysLeft, "day")} left — that needs about ${n.goal.pacePerWeek} validated deal${n.goal.pacePerWeek === 1 ? "" : "s"} a week. Pick two projects to pitch this week and book the viewings today.`
  if (n.sales.validated) return `Well done on ${plural(n.sales.validated, "validated deal")} last week. While the experience is fresh, ask each client for a review and one referral — a referred buyer is the easiest sale you will make this month.`
  if (n.leads.fresh) return `You received ${plural(n.leads.fresh, "new lead")} last week${n.leads.priority ? `, ${n.leads.priority} priority` : ""}. Send each a brochure from FHI Assistant and propose a viewing time in your first message.`
  if (n.sales.pending) return `${plural(n.sales.pending, "deal")} of yours from last week ${n.sales.pending === 1 ? "is" : "are"} waiting for validation. Make sure every document is with the office this week so it counts on the boards.`
  if (n.team) return `A quiet week for the team. Ask FHI Assistant "who in my team needs help" and call the two people at the top of that list today.`
  return `No deal or lead last week. Share your Buyers Link on WhatsApp Status today and send one project brochure to five past clients — ask FHI Assistant to make it.`
}

type ModelUsage = { promptTokens: number; completionTokens: number }

/** Only people with a deal or a lead last week get a model-written tip; the rest keep the rule. */
export const aiTipEligible = (n: WeeklyNote) => n.sales.validated + n.sales.pending + n.leads.fresh > 0

const TIP_SYSTEM = `You write ONE coaching tip for a property agent at FHI Global, a Dubai real estate brokerage, from THEIR OWN figures for last week (FACTS). Rules: at most two sentences and 60 words; plain warm English, no markdown, no emoji; name one concrete action for THIS week and tie it to a figure in FACTS; use only the figures given — never invent a number, price, commission or client; never mention other agents. Priorities: a deal waiting long for validation (tell them to ask the office what the file is missing) first, then leads not yet contacted, then the goal. In goal, needed_per_week is the PACE still required, not the target — never call it their goal. Answer as JSON: {"tip": "..."}.`

export async function aiTip(n: WeeklyNote): Promise<{ text: string; usage: ModelUsage; model: string } | { text: null; usage: ModelUsage; model: string }> {
  const usage: ModelUsage = { promptTokens: 0, completionTokens: 0 }
  const model = MODEL()
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return { text: null, usage, model }
  const facts = {
    role: n.role,
    week: n.week.label,
    validated_deals: n.sales.validated,
    validated_value: AED(n.sales.validatedValue),
    pending_deals: n.sales.pending,
    deals_waiting_long: n.stuck.map((d) => `${d.project}: ${d.days} days`),
    new_leads: n.leads.fresh,
    priority_leads: n.leads.priority,
    leads_not_contacted_last_30_days: n.leads.toFollowUp,
    goal: n.goal ? { target: `${n.goal.goalTarget} ${n.goal.label}`, done_so_far: n.goal.headline, days_left: n.goal.daysLeft, ...(n.goal.pacePerWeek && !n.goal.done ? { needed_per_week: n.goal.pacePerWeek } : {}), reached: n.goal.done } : "none set",
    reminders_this_week: n.reminders.length,
    team: n.team ? { name: n.team.name, members: n.team.members, validated_deals: n.team.validated, pending_deals: n.team.pending, deals_waiting_long: n.team.stuckTotal } : undefined,
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TIP_SYSTEM },
          { role: "user", content: `FACTS:\n${JSON.stringify(facts)}` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { text: null, usage, model }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }
    usage.promptTokens = Number(json.usage?.prompt_tokens) || 0
    usage.completionTokens = Number(json.usage?.completion_tokens) || 0
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { tip?: unknown }
    const text = typeof parsed.tip === "string" ? parsed.tip.replace(/\*\*|`|#/g, "").replace(/\s+/g, " ").trim() : ""
    return text.length >= 20 && text.length <= 400 ? { text, usage, model } : { text: null, usage, model }
  } catch {
    return { text: null, usage, model }
  }
}

/** The month's spend of the weekly-note audience against its cap; a failed check means no model this run. */
async function aiBudgetLeft(admin: Admin): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("assistant_usage_spend", { p_audience: WEEKLY_NOTE_AUDIENCE, p_from: dubaiMonthStart().toISOString() })
    if (error) throw new Error(error.message)
    return Number(data ?? 0) < weeklyNoteMonthlyCapUsd()
  } catch {
    return false
  }
}

// ─── The run ─────────────────────────────────────────────────────────────────

export type WeeklyNoteRun = {
  week: string
  recipients: number
  skipped: Record<string, number>
  sent: string[]
  failed: string[]
  ai_tips: number
  dry: boolean
}

/**
 * Builds and emails every note. `only` limits the run to those user ids (a
 * first send to the boss, a test); `dry` lists who would get one and sends
 * nothing. A failed build or send never stops the others.
 */
export async function sendWeeklyNotes(opts: { admin?: Admin; today?: string; dry?: boolean; only?: string[] | null }): Promise<WeeklyNoteRun> {
  const admin = opts.admin ?? createAdminSupabase()
  const today = opts.today ?? dubaiToday()
  const week = lastWeek(today)
  const { recipients: all, skipped } = await weeklyNoteRecipients(admin, today)
  const recipients = opts.only?.length ? all.filter((r) => opts.only!.includes(r.userId)) : all
  const run: WeeklyNoteRun = { week: week.label, recipients: recipients.length, skipped, sent: [], failed: [], ai_tips: 0, dry: Boolean(opts.dry) }
  if (opts.dry || !recipients.length) return run

  const sales = await fetchAllSales(admin)
  let aiAllowed = await aiBudgetLeft(admin)
  const queue = [...recipients]
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      try {
        const note = await buildWeeklyNote(admin, r, { today, sales })
        if (aiAllowed && aiTipEligible(note)) {
          const tip = await aiTip(note)
          await recordAssistantUsage(admin, { audience: WEEKLY_NOTE_AUDIENCE, userId: r.userId, role: r.role, question: `Weekly coaching note ${week.from}`, tools: ["weekly_note"], model: tip.model, promptTokens: tip.usage.promptTokens, completionTokens: tip.usage.completionTokens, ok: tip.text !== null })
          if (tip.text) {
            note.tip = { text: tip.text, source: "ai" }
            run.ai_tips++
          }
          // Re-check the cap now and then so a long run cannot overshoot it by much.
          if (run.ai_tips % 25 === 0) aiAllowed = await aiBudgetLeft(admin)
        }
        await sendWeeklyNoteEmail(note)
        run.sent.push(r.email)
      } catch {
        run.failed.push(r.email)
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return run
}

/** One person's note without sending — the cron's ?preview. */
export async function previewWeeklyNote(admin: Admin, userId: string, today = dubaiToday()): Promise<WeeklyNote | null> {
  const { data: p } = await admin.from("profiles").select("id, fullname, role").eq("id", userId).maybeSingle<{ id: string; fullname: string | null; role: string }>()
  if (!p) return null
  const email = await admin.auth.admin.getUserById(userId).then((r) => r.data?.user?.email?.trim() ?? "").catch(() => "")
  const note = await buildWeeklyNote(admin, { userId: p.id, name: p.fullname, role: p.role, email }, { today, sales: await fetchAllSales(admin) })
  if (aiTipEligible(note) && (await aiBudgetLeft(admin))) {
    const tip = await aiTip(note)
    await recordAssistantUsage(admin, { audience: WEEKLY_NOTE_AUDIENCE, userId, role: p.role, question: `Weekly coaching note ${note.week.from} (preview)`, tools: ["weekly_note"], model: tip.model, promptTokens: tip.usage.promptTokens, completionTokens: tip.usage.completionTokens, ok: tip.text !== null })
    if (tip.text) note.tip = { text: tip.text, source: "ai" }
  }
  return note
}
