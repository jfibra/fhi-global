"use client"

// The Team Performance Report body, drawn for readers aged 40+: every section opens with its verdict
// and ONE chart, then the numbers, then the names; long lists show their top five and offer the rest;
// each number has its unit written next to it. The sections are found by the left timeline through
// their `data-section` attribute. `ins` is null while FHI Assistant is still writing the analysis —
// the figures are already on screen, the analysis places show a skeleton of the same height.

import { StatTiles } from "@/features/dashboard/fhi-chat/charts"
import type { TeamReport } from "@/lib/team-report/data"
import type { Strategy, TeamInsights } from "@/lib/team-report/insights"
import { MonthBars, PaceBullet, RankedBars, ShowAll, SplitBar, StackedMonths } from "./team-report-charts"
import { RecruitsSection } from "./team-report-recruits"
import { Block, ImpactChip, Label, Notice, People, Skeleton, Writing, aedShort, dealsText, fmtDay, monthName, num, pct, poss, roleLine, tile } from "./team-report-ui"
import { SECTIONS, type SectionKey, type Verdict } from "./team-report-verdicts"

const meta = (key: SectionKey) => SECTIONS.find((s) => s.key === key)!
const NAVY = "#001f3f"
const GOLD = "#d6b357"

/** `note` = why the standard analysis was used instead of the AI one (a leader over their daily limit or the month's budget). */
type Props = { r: TeamReport; ins: TeamInsights | null; note: string | null; writing: boolean; verdicts: Record<SectionKey, Verdict> }

export function TeamReportView({ r, ins, note, writing, verdicts }: Props) {
  return (
    <div className="space-y-6">
      <Overview r={r} ins={ins} note={note} writing={writing} />
      <SalesSection r={r} verdict={verdicts.sales} />
      <CohortsSection r={r} ins={ins} verdict={verdicts.cohorts} />
      <RecruitsSection r={r} verdict={verdicts.recruits} />
      <SellersSection r={r} verdict={verdicts.sellers} />
      <PlanSection r={r} ins={ins} verdict={verdicts.plan} />
      <StrategiesSection ins={ins} verdict={verdicts.strategies} />
      <p className="pb-6 text-center text-[15px] text-[#4b5563]">
        <b className="text-[#001f3f]">Export PDF</b> adds a cover and a page of commitments for the team leader to sign. Generated {r.generatedAt} (Dubai).
      </p>
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ r, ins, note, writing }: { r: TeamReport; ins: TeamInsights | null; note: string | null; writing: boolean }) {
  const T = r.targets
  const none = T.basis === "none"
  const pace = [
    { l: "Today's pace", v: none ? "No sales yet" : `${aedShort(T.monthlyRunRate)} / month` },
    { l: "Target pace — double", v: none ? `${num(T.dealsNeeded3m)} first deals` : `${aedShort(T.targetMonthly)} / month` },
    { l: "Next three months", v: none ? "First deals" : aedShort(T.target3m) },
  ]
  return (
    <section data-section="overview" aria-label="Overview" className="scroll-mt-4 space-y-5">
      <div className="overflow-hidden rounded-2xl bg-[#001f3f] p-6 text-white shadow-[0_8px_30px_-12px_rgba(0,31,63,0.55)] sm:p-8">
        <p className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#f0d89b]">The goal: double the sales</p>
        <div className="mt-3 min-h-[84px] max-w-3xl">
          {ins ? <p className="font-['Outfit'] text-[24px] font-semibold leading-snug sm:text-[27px]">{ins.headline}</p> : <Skeleton lines={3} dark />}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {pace.map((p, i) => (
            <div key={p.l} className={`rounded-xl border-t-[3px] bg-white/[0.07] px-4 py-3.5 ${i === 2 ? "border-[#d6b357]" : "border-white/30"}`}>
              <p className="text-[14px] font-bold text-[#f0d89b]">{p.l}</p>
              <p className="mt-1 font-['Outfit'] text-[26px] font-bold leading-tight">{p.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-white/80">
          {r.period.label} · {r.members.total} members{r.team.subteams ? ` · ${r.team.subteams} subteam${r.team.subteams === 1 ? "" : "s"}` : ""}
          {r.team.leaders.length ? ` · led by ${r.team.leaders.join(" & ")}` : ""} · changes compare with {r.period.versus}
        </p>
      </div>

      <StatTiles stats={r.kpis} size="lg" />

      {note && <Notice title="Standard analysis">{note}</Notice>}

      <Actions ins={ins} />

      <div className="rounded-2xl border border-[#dfe3e9] bg-white p-5 sm:p-6">
        <h3 className="font-['Outfit'] text-[22px] font-bold text-[#001f3f]">At a glance</h3>
        <div className="mt-3 min-h-[132px]">
          {ins ? (
            <ol className="space-y-3">
              {ins.takeaways.map((t, i) => (
                <li key={i} className="flex gap-3 text-[16px] leading-snug text-[#0d1117]">
                  <span className="w-5 shrink-0 font-bold text-[#8a6d2a]">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          ) : (
            <Skeleton lines={4} />
          )}
        </div>
        {writing && <div className="mt-2"><Writing /></div>}
      </div>
    </section>
  )
}

/** The first three strategies, in full, where the reader can't miss them. */
function Actions({ ins }: { ins: TeamInsights | null }) {
  return (
    <div className="rounded-2xl border-2 border-[#d6b357] bg-white p-5 sm:p-6">
      <h3 className="font-['Outfit'] text-[24px] font-bold text-[#001f3f]">This week&apos;s three actions</h3>
      <p className="mt-0.5 text-[16px] text-[#4b5563]">The first three of the ten strategies in section 06 — start here.</p>
      <div className="mt-4 min-h-[200px]">
        {ins ? (
          <ol className="space-y-5">
            {ins.strategies.slice(0, 3).map((st, i) => (
              <li key={`${st.title}-${i}`} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d6b357] font-['Outfit'] text-[20px] font-bold text-[#001f3f]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] font-bold leading-snug text-[#001f3f]">{st.title}</p>
                  <p className="mt-1 text-[16px] leading-snug text-[#1f2937]">{st.how}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2.5 text-[14px] text-[#374151]">
                    <ImpactChip impact={st.impact} />
                    Owner: <b>{st.owner}</b>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Skeleton lines={5} />
        )}
      </div>
    </div>
  )
}

// ─── 01 Sales ────────────────────────────────────────────────────────────────

function SalesSection({ r, verdict }: { r: TeamReport; verdict: Verdict }) {
  const S = r.sales
  const T = r.targets
  const m = meta("sales")
  const lastDay = new Date(Date.parse(`${r.period.to}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  const partial = !r.period.to.endsWith("-01")
  const target = T.basis !== "none" && T.targetMonthly > 0 ? { value: T.targetMonthly, label: `Double pace: ${aedShort(T.targetMonthly)} a month` } : null
  return (
    <Block id="sales" n={m.n} title={m.title} subtitle={`What ${r.team.name} sold in ${r.period.label}, compared with ${r.period.versus}.`} verdict={verdict}>
      <StatTiles
        size="lg"
        stats={[
          tile("Validated sales", aedShort(S.validated.value), `before: ${aedShort(S.previous.value)}`, S.change),
          tile("Validated deals", String(S.validated.deals), `before: ${S.previous.deals}`, r.kpis[1]?.change ?? null),
          tile("Average deal", S.avgDeal ? aedShort(S.avgDeal) : "—", "validated, team share"),
          tile("Pending", S.pending.deals ? aedShort(S.pending.value) : "0", `${dealsText(S.pending.deals)} waiting${S.rejected ? ` · ${S.rejected} rejected` : ""}`),
        ]}
      />
      {S.months.length >= 2 && S.months.some((x) => x.value > 0) && (
        <div className="rounded-xl border border-[#dfe3e9] p-5">
          <Label right={target ? "the dashed line is double today's pace" : undefined}>Validated sales by month</Label>
          <MonthBars months={S.months} target={target} />
          {partial && <p className="mt-3 text-[14px] text-[#4b5563]">The last month is not over yet — the report runs to {fmtDay(lastDay)}.</p>}
        </div>
      )}
      {(S.topProjects.length > 0 || S.topDevelopers.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-[#dfe3e9] p-5">
            <Label>Top projects</Label>
            <RankedBars rows={S.topProjects.slice(0, 5).map((p) => ({ label: p.name, value: p.value, display: aedShort(p.value), sub: `${dealsText(p.deals)}${p.developer ? ` · ${p.developer}` : ""}` }))} />
          </div>
          <div className="rounded-xl border border-[#dfe3e9] p-5">
            <Label>Top developers</Label>
            <RankedBars rows={S.topDevelopers.slice(0, 5).map((d) => ({ label: d.name, value: d.value, display: aedShort(d.value), sub: dealsText(d.deals) }))} />
          </div>
        </div>
      )}
      <p className="text-[14px] leading-relaxed text-[#4b5563]">
        Validated sales are the headline, as on every leaderboard. A shared deal credits each member their share and counts once for the team{S.sharedDeals ? ` (${S.sharedDeals} shared in this period)` : ""}. A sale&apos;s date is its reservation date, else when it was recorded. All time: {dealsText(S.allTime.deals)}, {aedShort(S.allTime.value)}.
      </p>
    </Block>
  )
}

// ─── 02 New vs existing ──────────────────────────────────────────────────────

function CohortsSection({ r, ins, verdict }: { r: TeamReport; ins: TeamInsights | null; verdict: Verdict }) {
  const C = r.cohorts
  const S = r.sales
  const m = meta("cohorts")
  const rows: Array<[string, string, string]> = [
    ["Members on the team", num(C.new.members), num(C.existing.members)],
    ["Members who sold", num(C.new.sellers), num(C.existing.sellers)],
    ["Validated deals", num(C.new.deals), num(C.existing.deals)],
    ["Validated value", aedShort(C.new.value), aedShort(C.existing.value)],
    ["Value per selling member", aedShort(C.new.perSeller), aedShort(C.existing.perSeller)],
    ["Share of the team's value", pct(C.new.value, S.validated.value), pct(C.existing.value, S.validated.value)],
    ["Active accounts", num(C.new.active), num(C.existing.active)],
    ["With a selling role", num(C.new.sellingRole), num(C.existing.sellingRole)],
    ["Value per member", aedShort(C.new.perMember), aedShort(C.existing.perMember)],
    ["Pending deals", C.new.pendingDeals ? `${C.new.pendingDeals} · ${aedShort(C.new.pendingValue)}` : "—", C.existing.pendingDeals ? `${C.existing.pendingDeals} · ${aedShort(C.existing.pendingValue)}` : "—"],
  ]
  return (
    <Block id="cohorts" n={m.n} title={m.title} subtitle="Who is carrying the sales — agents recruited in this period, or the ones who were already here." verdict={verdict}>
      <div className="rounded-xl border border-[#dfe3e9] p-5">
        <Label>Who brings the sales</Label>
        <SplitBar
          a={{ label: `New agents (${num(C.new.members)})`, value: C.new.value, display: aedShort(C.new.value), color: NAVY, ink: "#ffffff" }}
          b={{ label: `Existing agents (${num(C.existing.members)})`, value: C.existing.value, display: aedShort(C.existing.value), color: GOLD, ink: NAVY }}
          empty="No validated sales in this period"
        />
      </div>

      <div>
        <Label>Side by side</Label>
        <ShowAll
          rows={rows}
          total={rows.length}
          top={5}
          noun="rows"
          render={(shown) => (
            <div className="overflow-hidden rounded-xl border border-[#dfe3e9]">
              <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr] gap-3 bg-[#f4f6f9] px-4 py-2.5 text-[14px] font-bold text-[#374151]">
                <span>What we count</span>
                <span className="text-right text-[#001f3f]">New agents</span>
                <span className="text-right">Existing agents</span>
              </div>
              <ul className="divide-y divide-[#eef0f3]">
                {shown.map(([label, a, b]) => (
                  <li key={label} className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr] gap-3 px-4 py-3 text-[16px]">
                    <span className="font-semibold text-[#0d1117]">{label}</span>
                    <span className="text-right font-bold tabular-nums text-[#001f3f]">{a}</span>
                    <span className="text-right tabular-nums text-[#1f2937]">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        />
      </div>

      {C.byMonth.length >= 2 && C.byMonth.some((x) => x.newValue > 0) && (
        <div className="rounded-xl border border-[#dfe3e9] p-5">
          <Label>Month by month</Label>
          <StackedMonths months={C.byMonth.map((x) => ({ label: monthName(x.month), a: x.newValue, b: x.existingValue }))} aLabel="New agents" bLabel="Existing agents" />
        </div>
      )}

      <div className="rounded-xl border border-[#dfe3e9] p-5">
        <Label>How long members have been with FHI</Label>
        <RankedBars tone="blue" rows={r.members.tenureBands.map((b) => ({ label: b.label, value: b.value, display: num(b.value) }))} />
      </div>

      <div className="rounded-xl border-l-4 border-[#001f3f] bg-[#f4f6fa] p-5">
        <h4 className="mb-1.5 text-[17px] font-bold text-[#001f3f]">FHI Assistant&apos;s reading</h4>
        <div className="min-h-[96px]">{ins ? <p className="text-[16px] leading-relaxed text-[#0d1117]">{ins.cohortAnalysis}</p> : <Skeleton lines={3} />}</div>
      </div>
      <p className="text-[14px] text-[#4b5563]">New = the member&apos;s FHI account was created inside {r.period.label}; existing = created before it. An older account added to the team counts as existing.</p>
    </Block>
  )
}

// ─── 04 Who sold ─────────────────────────────────────────────────────────────

function SellersSection({ r, verdict }: { r: TeamReport; verdict: Verdict }) {
  const A = r.activity
  const S = r.sales
  const m = meta("sellers")
  const maxSeller = Math.max(1, ...A.sellers.map((x) => x.value))
  return (
    <Block id="sellers" n={m.n} title={m.title} subtitle="Validated sales per member in the period, and the existing sellers who closed nothing." verdict={verdict}>
      <div className="rounded-xl border border-[#dfe3e9] p-5">
        <Label>Members with a selling role</Label>
        <SplitBar
          a={{ label: "Sold in this period", value: A.sellersTotal, display: `${num(A.sellersTotal)} member${A.sellersTotal === 1 ? "" : "s"}`, color: NAVY, ink: "#ffffff" }}
          b={{ label: "Went quiet", value: A.quietTotal, display: `${num(A.quietTotal)} member${A.quietTotal === 1 ? "" : "s"}`, color: GOLD, ink: NAVY }}
          empty="No members with a selling role yet"
        />
      </div>

      <div>
        <Label right={`${num(A.sellersTotal)} member${A.sellersTotal === 1 ? "" : "s"}`}>Members who sold</Label>
        {A.sellers.length ? (
          <ShowAll
            rows={A.sellers}
            total={A.sellers.length}
            noun="sellers"
            render={(rows) => (
              <People
                rows={rows}
                sub={(x) => `${roleLine(x)} · ${dealsText(x.deals)}${x.pendingDeals ? ` · ${x.pendingDeals} pending` : ""}`}
                right={(x) => (
                  <div className="w-44">
                    <p className="font-bold tabular-nums text-[#001f3f]">{aedShort(x.value)} <span className="font-normal text-[#4b5563]">· {pct(x.value, S.validated.value)}</span></p>
                    <div className="mt-1.5 h-2 rounded-full bg-[#e5e8ec]" aria-hidden>
                      <div className="h-2 rounded-full bg-[#d6b357]" style={{ width: `${Math.max(3, (100 * x.value) / maxSeller)}%` }} />
                    </div>
                  </div>
                )}
              />
            )}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-[#c5ccd6] px-4 py-6 text-center text-[16px] text-[#374151]">Nobody on the team has a validated sale in {r.period.label}.</p>
        )}
      </div>

      <div>
        <Label right={A.quietTotal ? `${num(A.quietTotal)} quiet · ${num(A.neverSold)} never sold` : undefined}>Gone quiet — existing sellers with no validated deal</Label>
        {A.quiet.length ? (
          <ShowAll
            rows={A.quiet}
            total={A.quietTotal}
            noun="quiet sellers"
            render={(rows) => (
              <People rows={rows} sub={(x) => `Joined ${fmtDay(x.joined)} · ${roleLine(x)}`} right={(x) => <span className="text-[15px] text-[#374151]">{x.lastValidated ? `Last sale ${fmtDay(x.lastValidated)}` : "Never sold"}</span>} />
            )}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-[#c5ccd6] px-4 py-6 text-center text-[16px] text-[#374151]">Every active existing seller closed a deal in this period.</p>
        )}
        <p className="mt-2 text-[14px] leading-relaxed text-[#4b5563]">
          Quiet means no validated deal and no deal waiting for validation in {r.period.label}. A partner on a shared deal is credited their share, so partners appear under &ldquo;Members who sold&rdquo;, never here. Active accounts with a selling role only; members without one are not counted.
        </p>
      </div>

      {A.waitingValidationTotal > 0 && (
        <div>
          <Label right={`${num(A.waitingValidationTotal)} member${A.waitingValidationTotal === 1 ? "" : "s"}`}>Deal waiting for validation — not counted as quiet</Label>
          <ShowAll
            rows={A.waitingValidation}
            total={A.waitingValidationTotal}
            noun="members"
            render={(rows) => (
              <People rows={rows} sub={(x) => `${roleLine(x)} · joined ${fmtDay(x.joined)}`} right={(x) => <span className="text-[15px] font-semibold text-[#1f2937]">{dealsText(x.pendingDeals)} · {aedShort(x.pendingValue)} pending</span>} />
            )}
          />
        </div>
      )}
    </Block>
  )
}

// ─── 05 The plan ─────────────────────────────────────────────────────────────

function PlanSection({ r, ins, verdict }: { r: TeamReport; ins: TeamInsights | null; verdict: Verdict }) {
  const T = r.targets
  const S = r.sales
  const m = meta("plan")
  const none = T.basis === "none"
  const basisNote =
    T.basis === "period"
      ? `Baseline: the team's own pace in ${r.period.label}.`
      : T.basis === "previous"
        ? `No validated sale in ${r.period.label}, so the baseline is the pace of ${r.period.versus}.`
        : `No validated sales in ${r.period.label} or ${r.period.versus}, so the target is first deals.`
  const levers = [...T.levers].sort((a, b) => a.share - b.share)
  return (
    <Block id="plan" n={m.n} title={m.title} subtitle={`${ins ? ins.nextQuarter.map((x) => x.month).join(" · ") : "The next three months"} — what doubling ${poss(r.team.name)} sales takes.`} verdict={verdict}>
      <div className="rounded-xl border border-[#dfe3e9] p-5">
        <Label>Today&apos;s pace against the target</Label>
        <PaceBullet
          now={T.monthlyRunRate}
          target={T.targetMonthly}
          nowLabel={`${aedShort(T.monthlyRunRate)} / month`}
          targetLabel={`${aedShort(T.targetMonthly)} / month`}
          dealsNow={T.dealsNow3m}
          dealsNeeded={T.dealsNeeded3m}
          basis={T.basis}
        />
        <p className="mt-3 text-[14px] text-[#4b5563]">
          {basisNote}
          {T.last90dRunRate !== null ? ` The last 90 days ran at ${aedShort(T.last90dRunRate)} a month.` : ""}
          {T.extraDealsPerMonth > 0 && !none ? ` That is ${T.extraDealsPerMonth} more deal${T.extraDealsPerMonth === 1 ? "" : "s"} every month at the team's average of ${aedShort(S.avgDeal)}.` : ""}
        </p>
      </div>

      <div className="min-h-[220px]">
        {ins ? (
          <ol className="grid gap-4 md:grid-cols-3">
            {ins.nextQuarter.map((q, i) => (
              <li key={q.month} className={`rounded-xl border border-[#dfe3e9] border-t-[5px] p-5 ${i === 2 ? "border-t-[#d6b357]" : "border-t-[#001f3f]"}`}>
                <p className="text-[14px] font-bold text-[#4b5563]">Month {i + 1}</p>
                <p className="font-['Outfit'] text-[22px] font-bold text-[#001f3f]">{q.month}</p>
                <p className="mt-2 text-[16px] leading-snug text-[#0d1117]">{q.focus}</p>
                <p className="mt-3 text-[14px] font-bold text-[#6b5320]">Target</p>
                <p className="text-[18px] font-bold text-[#001f3f]">{q.target}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Skeleton lines={5} />
        )}
      </div>

      {levers.length > 0 && T.extraDeals3m > 0 && (
        <div>
          <Label>Who can close the gap — {T.extraDeals3m} more deal{T.extraDeals3m === 1 ? "" : "s"} in three months</Label>
          <RankedBars
            tone="blue"
            rows={levers.map((l) => ({
              label: l.title,
              value: Math.min(1, l.share) * 100,
              display: l.share > 1 ? "not enough alone" : `a deal from ${l.needed} of ${l.people} · ${Math.round(l.share * 100)}%`,
              sub: l.detail,
            }))}
          />
          <p className="mt-3 text-[14px] leading-relaxed text-[#4b5563]">
            Easiest first. Plain arithmetic: how many people in each group would have to close one validated deal, at the team&apos;s average of {aedShort(S.avgDeal)}, to cover the gap on their own. No conversion rate is assumed.
          </p>
        </div>
      )}
    </Block>
  )
}

// ─── 06 Strategies ───────────────────────────────────────────────────────────

function StrategyBody({ st }: { st: Strategy }) {
  return (
    <div className="space-y-2 text-[16px] leading-snug">
      <p className="text-[#374151]"><span className="mr-2 text-[13px] font-bold tracking-wide text-[#4b5563]">WHAT WE SEE</span>{st.why}</p>
      <p className="font-semibold text-[#0d1117]"><span className="mr-2 text-[13px] font-bold tracking-wide text-[#8a6d2a]">WHAT TO DO</span>{st.how}</p>
      <p className="text-[14px] text-[#4b5563]">Owner: <b className="text-[#1f2937]">{st.owner}</b>{st.metric ? <> · Measure: {st.metric}</> : null}</p>
    </div>
  )
}

function StrategiesSection({ ins, verdict }: { ins: TeamInsights | null; verdict: Verdict }) {
  const m = meta("strategies")
  return (
    <Block id="strategies" n={m.n} title={m.title} subtitle="Ordered by impact, each tied to a figure in this report — start with the first three this week." verdict={verdict}>
      {ins ? (
        <>
          <ol className="space-y-4">
            {ins.strategies.slice(0, 3).map((st, i) => (
              <li key={`${st.title}-${i}`} className="flex gap-4 rounded-xl border-2 border-[#d6b357] bg-[#fffdf7] p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d6b357] font-['Outfit'] text-[20px] font-bold text-[#001f3f]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-['Outfit'] text-[21px] font-bold leading-snug text-[#001f3f]">{st.title}</p>
                    <ImpactChip impact={st.impact} />
                  </div>
                  <StrategyBody st={st} />
                </div>
              </li>
            ))}
          </ol>
          <div>
            <Label right="open one to read why and how">The other seven</Label>
            <ol className="space-y-2.5">
              {ins.strategies.slice(3).map((st, i) => (
                <li key={`${st.title}-${i}`}>
                  <details className="group rounded-xl border border-[#dfe3e9] bg-white">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f] [&::-webkit-details-marker]:hidden">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#001f3f] font-['Outfit'] text-[16px] font-bold text-[#f0d89b]">{i + 4}</span>
                      <span className="min-w-0 flex-1 text-[17px] font-bold leading-snug text-[#001f3f]">{st.title}</span>
                      <ImpactChip impact={st.impact} />
                      <span className="text-[22px] leading-none text-[#4b5563] transition-transform group-open:rotate-180" aria-hidden>⌄</span>
                    </summary>
                    <div className="border-t border-[#eef0f3] px-4 pb-4 pt-3.5 sm:pl-[68px]">
                      <StrategyBody st={st} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-[14px] text-[#4b5563]">{ins.source === "ai" ? "The analysis is written by FHI Assistant from the figures in this report only — review it before acting." : "The analysis is generated from the figures in this report by fixed rules."}</p>
        </>
      ) : (
        <>
          <Writing />
          <div className="min-h-[260px]"><Skeleton lines={7} /></div>
        </>
      )}
    </Block>
  )
}
