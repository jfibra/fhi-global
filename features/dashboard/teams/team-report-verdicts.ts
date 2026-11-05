// The section list of the Team Performance Report and what each section's verdict says. One pure
// function, so the left timeline and the section headers can never disagree. A verdict is a FACT
// ("103 not ready · 0 sold") plus a tone — never an adjective alone, and never colour alone: the
// tone also has a word and an icon where it is drawn.

import type { TeamReport } from "@/lib/team-report/data"
import type { TeamInsights } from "@/lib/team-report/insights"

export type Tone = "good" | "watch" | "urgent" | "neutral"
export type Verdict = { fact: string; tone: Tone }
export type SectionKey = "overview" | "sales" | "cohorts" | "recruits" | "sellers" | "plan" | "strategies"

/** Rail and header order. `n` is empty for the overview (the rail draws a target icon instead). */
export const SECTIONS: ReadonlyArray<{ key: SectionKey; n: string; title: string; subtitle: string }> = [
  { key: "overview", n: "", title: "Overview", subtitle: "The goal, the numbers and what to do this week" },
  { key: "sales", n: "01", title: "Sales", subtitle: "What the team sold, month by month" },
  { key: "cohorts", n: "02", title: "New vs existing agents", subtitle: "Who is bringing the sales" },
  { key: "recruits", n: "03", title: "Recruitment & activation", subtitle: "From joining to the first sale" },
  { key: "sellers", n: "04", title: "Who sold, who went quiet", subtitle: "Sellers and the members who closed nothing" },
  { key: "plan", n: "05", title: "Next 3 months: plan to double", subtitle: "The pace needed and who can close the gap" },
  { key: "strategies", n: "06", title: "Ten strategies", subtitle: "What to do, in order of impact" },
]

export const TONE: Record<Tone, { word: string; dot: string; pill: string }> = {
  good: { word: "Good", dot: "#15803d", pill: "bg-[#e8f5ec] text-[#14532d]" },
  watch: { word: "Needs attention", dot: "#b45309", pill: "bg-[#fdf3d8] text-[#713f12]" },
  urgent: { word: "Urgent", dot: "#b91c1c", pill: "bg-[#fdecec] text-[#7f1d1d]" },
  neutral: { word: "For information", dot: "#6b7280", pill: "bg-[#eef1f5] text-[#1f2937]" },
}

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function sectionVerdicts(r: TeamReport, ins: TeamInsights | null): Record<SectionKey, Verdict> {
  const S = r.sales
  const C = r.cohorts
  const R = r.recruitment
  const A = r.activity
  const T = r.targets

  const overview: Verdict =
    T.basis === "none"
      ? { fact: `Goal: ${plural(T.dealsNeeded3m, "first deal")}`, tone: "neutral" }
      : { fact: `Goal: AED ${compact(T.targetMonthly)} a month`, tone: "neutral" }

  let sales: Verdict
  if (S.validated.value === 0) sales = { fact: S.previous.value ? "No sales this period" : "No validated sales yet", tone: "urgent" }
  else if (S.previous.value === 0) sales = { fact: `${plural(S.validated.deals, "deal")} · none before`, tone: "good" }
  else {
    // The deal count sits beside the percentage because the numbers are small (3 deals is not a trend).
    const pct = Math.round(((S.validated.value - S.previous.value) / S.previous.value) * 100)
    sales = { fact: `${pct > 0 ? "+" : ""}${pct}% · ${plural(S.validated.deals, "deal")}`, tone: pct >= 5 ? "good" : pct > -30 ? "watch" : "urgent" }
  }

  const share = S.validated.value ? Math.round((C.new.value / S.validated.value) * 100) : 0
  const cohorts: Verdict =
    C.new.members === 0
      ? { fact: "No new agents", tone: "neutral" }
      : { fact: `${share}% from new agents`, tone: share >= 20 ? "good" : share === 0 ? "watch" : "neutral" }

  const ready = R.funnel[2]?.value ?? 0
  const recorded = R.funnel[3]?.value ?? 0
  let recruits: Verdict
  if (R.recruited === 0) recruits = { fact: "No new recruits", tone: "neutral" }
  else if (R.recruited < 5) recruits = { fact: plural(R.recruited, "new recruit"), tone: "neutral" }
  else
    recruits = {
      fact: `${R.notReadyTotal} not ready · ${recorded} sold`,
      tone: ready / R.recruited < 0.25 || recorded === 0 ? "urgent" : ready / R.recruited < 0.6 ? "watch" : "good",
    }

  const pool = A.sellersTotal + A.quietTotal
  const sellers: Verdict =
    pool === 0
      ? { fact: "No selling members", tone: "neutral" }
      : A.quietTotal === 0
        ? { fact: "Everyone sold", tone: "good" }
        : { fact: `${A.quietTotal} of ${pool} quiet`, tone: A.quietTotal / pool > 0.5 ? "urgent" : A.quietTotal / pool > 0.25 ? "watch" : "good" }

  // "One more deal each" is enough only when the extra deals fit inside the people who already sell.
  const plan: Verdict =
    T.basis === "none"
      ? { fact: plural(T.dealsNeeded3m, "first deal"), tone: "watch" }
      : T.extraDeals3m === 0
        ? { fact: "Already on pace", tone: "good" }
        : { fact: `${plural(T.extraDeals3m, "more deal")} needed`, tone: T.extraDeals3m > A.sellersTotal ? "watch" : "good" }

  const strategies: Verdict = ins ? { fact: "3 to start this week", tone: "neutral" } : { fact: "Being written…", tone: "neutral" }

  return { overview, sales, cohorts, recruits, sellers, plan, strategies }
}
