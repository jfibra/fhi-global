import "server-only"

import { Circle, Document, Image, Page, Svg, Text, View } from "@react-pdf/renderer"
import { BODY, Chip, Donut, Empty, FAINT, GOLD, GOLD_DEEP, GOLD_SOFT, HBars, INK, LINE, MUTED, NAVY, Rank, Section, StatRow, Strong, SubTitle, Table, Two, VBars, aed, int, s, short } from "@/lib/company-report/pdf-kit"
import { REQUIREMENT_HINTS, REQUIREMENT_KEYS, REQUIREMENT_LABELS, REQUIREMENT_NOTE, REQUIREMENT_OWNERS } from "./labels"
import type { MemberRow, TeamReport } from "./data"
import type { TeamInsights } from "./insights"

/**
 * The Team Performance Report as an A4 PDF (boss, 2026-11-05): a navy cover
 * with the team, the headline tiles, what it takes to double sales and the
 * takeaways, then numbered sections — sales, new vs existing agents,
 * recruitment & activation, who sold and who went quiet, the path to 2× over
 * the next three months, the ten strategies and a page of commitments for the
 * team leader to sign. Drawn on the same kit as the company report
 * (lib/company-report/pdf-kit.tsx).
 */

/**
 * The PDF font (Outfit) has no arrow glyph — "Invite → Team" printed as "Invite 'Team". The screen font
 * does, so the texts keep their arrows and the document turns them into ">" on the way in. Applied to
 * the requirement wording and to the whole analysis (the model writes arrows too).
 */
const arrows = (t: string) => t.replace(/\s*→\s*/g, " > ")
const pdfSafeInsights = (i: TeamInsights): TeamInsights => ({
  ...i,
  headline: arrows(i.headline),
  takeaways: i.takeaways.map(arrows),
  cohortAnalysis: arrows(i.cohortAnalysis),
  nextQuarter: i.nextQuarter.map((q) => ({ ...q, focus: arrows(q.focus), target: arrows(q.target) })),
  strategies: i.strategies.map((st) => ({ ...st, title: arrows(st.title), why: arrows(st.why), how: arrows(st.how), metric: arrows(st.metric) })),
})

export type TeamReportImages = { whiteLogo: Buffer | null; navyLogo: Buffer | null; teamLogo: Buffer | null }

const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—")
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", year: "2-digit", timeZone: "UTC" })
const pct = (part: number, whole: number) => {
  if (whole <= 0) return "0%"
  const p = (part / whole) * 100
  return part > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`
}
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
const roleText = (role: string | null) => (role ?? "member").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "T"
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const teamReportFileName = (name: string, from: string, to: string) => `fhi-team-${slugOf(name) || "team"}-${from}-${to}.pdf`

/** Recruited → approved → ready → recorded → validated, each bar against the number recruited. */
function Funnel({ steps }: { steps: TeamReport["recruitment"]["funnel"] }) {
  const max = Math.max(1, steps[0]?.value ?? 1)
  return (
    <View>
      {steps.map((st, i) => (
        <View key={st.label} wrap={false} style={{ marginBottom: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, color: INK }}>
              {st.label} <Text style={{ fontSize: 7, fontWeight: 400, color: MUTED }}>{st.hint}</Text>
            </Text>
            <Text style={{ fontSize: 8.5, fontWeight: 700, color: NAVY }}>
              {int(st.value)} · {pct(st.value, max)}
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: "#eef0f3", borderRadius: 3, marginTop: 2 }}>
            <View style={{ width: `${Math.max(1.5, (100 * st.value) / max)}%`, height: 6, backgroundColor: i === steps.length - 1 ? GOLD : NAVY, borderRadius: 3 }} />
          </View>
        </View>
      ))}
    </View>
  )
}

const Callout = ({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "navy" }) => (
  <View wrap={false} style={{ backgroundColor: tone === "gold" ? "#fffaf0" : "#f4f6fa", borderLeftWidth: 3, borderLeftColor: tone === "gold" ? GOLD : NAVY, borderRadius: 6, padding: 10, marginTop: 8 }}>{children}</View>
)

const memberCell = (m: MemberRow) => (
  <View>
    <Strong>{m.name}</Strong>
    <Text style={{ fontSize: 7, color: MUTED }}>{[m.roleInTeam, m.subteam].filter(Boolean).join(" · ") || "Member"}</Text>
  </View>
)

/** A recruit with the person who has to approve them: only the direct inviter can press Approve and set the role. */
const recruitCell = (m: MemberRow) => (
  <View>
    <Strong>{m.name}</Strong>
    <Text style={{ fontSize: 7, color: MUTED }}>{m.invitedBy ? `Invited by ${m.invitedBy.name}${m.invitedBy.onTeam ? "" : " (outside the team)"}` : "Signed up without an invite link"}</Text>
  </View>
)

const CohortTag = ({ cohort }: { cohort: MemberRow["cohort"] }) => (
  <Text style={{ fontSize: 7, fontWeight: 700, color: cohort === "new" ? "#ffffff" : NAVY, backgroundColor: cohort === "new" ? NAVY : "#eef1f5", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>{cohort === "new" ? "NEW" : "EXISTING"}</Text>
)

export function TeamReportDocument({ r, insights: rawInsights, images }: { r: TeamReport; insights: TeamInsights; images: TeamReportImages }) {
  const insights = pdfSafeInsights(rawInsights)
  const S = r.sales
  const C = r.cohorts
  const R = r.recruitment
  const A = r.activity
  const T = r.targets
  const teamName = r.team.name
  const leaders = r.team.leaders.length ? r.team.leaders.join(" & ") : "the team leaders"
  const maxSeller = Math.max(1, ...A.sellers.map((m) => m.value))
  const readyNew = R.funnel[2]?.value ?? 0
  const easiest = [...T.levers].sort((x, y) => x.share - y.share)[0]
  const validatedNew = R.funnel[4]?.value ?? 0

  const header = (
    <View fixed style={{ position: "absolute", top: 22, left: 36, right: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {images.navyLogo ? <Image src={{ data: images.navyLogo, format: "png" }} style={{ width: 66, height: 27, borderRadius: 3 }} /> : <Text style={{ fontWeight: 700, color: NAVY }}>FHI Global Property</Text>}
      <Text style={{ fontSize: 7.5, color: MUTED }}>
        <Text style={{ fontWeight: 700, color: NAVY }}>{teamName}</Text> · Team Performance Report · {r.period.label}
      </Text>
    </View>
  )
  const footer = (
    <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
      <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for the team leader and management · Generated {r.generatedAt} (Dubai)</Text>
      <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )

  const basisNote =
    T.basis === "period"
      ? `Baseline: the team's own pace in ${r.period.label}.`
      : T.basis === "previous"
        ? `No validated sale in ${r.period.label}, so the baseline is the pace of ${r.period.versus}.`
        : `No validated sales in ${r.period.label} or ${r.period.versus}, so the target is first deals.`

  return (
    <Document title={`FHI Global — Team Performance Report — ${teamName} — ${r.period.label}`} author="FHI Assistant" subject="Team performance report" creator="fhiglobal.ae">
      {/* ── Cover ── */}
      <Page size="A4" style={s.cover}>
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 30, paddingBottom: 26, position: "relative" }}>
          <Svg width={260} height={220} style={{ position: "absolute", top: -60, right: -70 }}>
            <Circle cx={150} cy={110} r={100} stroke={GOLD} strokeOpacity={0.28} strokeWidth={1} fill="none" />
            <Circle cx={185} cy={85} r={100} stroke={GOLD} strokeOpacity={0.16} strokeWidth={1} fill="none" />
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.whiteLogo ? <Image src={{ data: images.whiteLogo, format: "png" }} style={{ width: 112, height: 41 }} /> : <Text style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>FHI Global Property</Text>}
            <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: GOLD_SOFT }}>CONFIDENTIAL · TEAM LEADERS</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 30 }}>
            <View style={{ width: 26, height: 1.5, backgroundColor: GOLD, marginRight: 8 }} />
            <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2.4, color: GOLD_SOFT }}>TEAM PERFORMANCE REPORT</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            {images.teamLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
              <Image src={{ data: images.teamLogo, format: "png" }} style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: "#ffffff", marginRight: 12, objectFit: "contain" }} />
            ) : (
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{initials(teamName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", lineHeight: 1.05 }}>{teamName}</Text>
              <Text style={{ fontSize: 15, fontWeight: 600, color: GOLD_SOFT, marginTop: 3 }}>{r.period.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.62)", marginTop: 10 }}>
            Prepared for {leaders} · {r.members.total} members{r.team.subteams ? ` · ${r.team.subteams} subteam${r.team.subteams === 1 ? "" : "s"}` : ""} · Generated {r.generatedAt} (Dubai) · Changes compare with {r.period.versus}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 36, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {r.kpis.map((k) => (
              <View key={k.label} style={{ width: "33.33%", padding: 4 }}>
                <View style={{ ...s.card, padding: 10, minHeight: 66 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.9, color: FAINT, textTransform: "uppercase" }}>{k.label}</Text>
                    <Chip change={k.change} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 5 }}>{k.value}</Text>
                  {k.hint ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>{k.hint}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 10, backgroundColor: NAVY, borderRadius: 8, padding: 14 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_SOFT }}>The goal: double the sales</Text>
            <Text style={{ fontSize: 11.5, fontWeight: 600, color: "#ffffff", lineHeight: 1.35, marginTop: 5 }}>{insights.headline}</Text>
            <View style={{ flexDirection: "row", marginTop: 10 }}>
              {[
                { l: "Today's pace", v: T.basis === "none" ? "—" : `${aed(T.monthlyRunRate)} / month` },
                { l: "Target pace", v: T.basis === "none" ? `${int(T.dealsNeeded3m)} first deals` : `${aed(T.targetMonthly)} / month` },
                { l: "Next three months", v: T.basis === "none" ? "first deals" : aed(T.target3m) },
              ].map((t, i) => (
                <View key={t.l} style={{ flex: 1, borderTopWidth: 1.5, borderTopColor: i === 2 ? GOLD : "rgba(255,255,255,0.25)", paddingTop: 4, marginRight: i < 2 ? 8 : 0 }}>
                  <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.8, color: GOLD_SOFT, textTransform: "uppercase" }}>{t.l}</Text>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>{t.v}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 10, backgroundColor: "#f4f6fa", borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 6, padding: 12 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>At a glance</Text>
            {insights.takeaways.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginTop: 5 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: GOLD_DEEP, width: 14 }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9.2, color: INK, lineHeight: 1.35 }}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", marginTop: 10 }}>
            {["Sales", "New vs existing", "Recruitment", "Who sold", "Next 3 months", "10 strategies", "Commitments"].map((t, i) => (
              <View key={t} style={{ flex: 1, borderTopWidth: 2, borderTopColor: i >= 4 ? GOLD : NAVY, paddingTop: 4, marginRight: i < 6 ? 5 : 0 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: i >= 4 ? GOLD_DEEP : NAVY }}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
          <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for the team leader and management</Text>
          <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── The sections ── */}
      <Page size="A4" style={s.page}>
        {header}
        {footer}

        <Section n="01" title="Sales" subtitle={`What ${teamName} sold in ${r.period.label}, compared with ${r.period.versus}.`}>
          <StatRow
            items={[
              { label: "Validated value", value: `AED ${short(S.validated.value)}`, change: S.change, hint: `vs AED ${short(S.previous.value)}` },
              { label: "Validated deals", value: String(S.validated.deals), change: r.kpis[1]?.change ?? null, hint: `vs ${S.previous.deals}` },
              { label: "Average deal", value: S.avgDeal ? `AED ${short(S.avgDeal)}` : "—", hint: "validated, team share" },
              { label: "Pending", value: String(S.pending.deals), hint: S.pending.deals ? `AED ${short(S.pending.value)} waiting` : "nothing waiting" },
            ]}
          />
          {S.byMonth.length >= 2 && (
            <View style={{ ...s.card, marginBottom: 10 }} wrap={false}>
              <SubTitle right={`All time: ${S.allTime.deals} deals · AED ${short(S.allTime.value)}`}>Validated sales by month (AED)</SubTitle>
              {S.byMonth.some((b) => b.value > 0) ? <VBars bars={S.byMonth} height={84} dateLabels={false} /> : <Empty>No validated sales in these months.</Empty>}
            </View>
          )}
          {(S.topProjects.length > 0 || S.topDevelopers.length > 0) && (
            <Two
              left={
                <View>
                  <SubTitle>Top projects</SubTitle>
                  <HBars rows={S.topProjects.slice(0, 6).map((p) => ({ label: `${p.name} · ${p.deals} deal${p.deals === 1 ? "" : "s"}`, value: p.value, display: `AED ${short(p.value)}` }))} />
                </View>
              }
              right={
                <View>
                  <SubTitle>Top developers</SubTitle>
                  <HBars rows={S.topDevelopers.map((d) => ({ label: `${d.name} · ${d.deals} deal${d.deals === 1 ? "" : "s"}`, value: d.value, display: `AED ${short(d.value)}` }))} />
                </View>
              }
            />
          )}
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>
            Validated sales are the headline, as on every leaderboard; a shared deal credits each member their share and counts once for the team{S.sharedDeals ? ` (${S.sharedDeals} shared in this period)` : ""}. A sale&apos;s date is its reservation date, else when it was recorded.{S.rejected ? ` ${S.rejected} sale${S.rejected === 1 ? " was" : "s were"} rejected.` : ""}
          </Text>
        </Section>

        <Section n="02" title="New agents vs existing agents" subtitle="Who is carrying the sales — agents recruited in this period, or the ones who were already here.">
          <Two
            left={
              <View style={s.card}>
                <SubTitle>Share of validated value</SubTitle>
                <Donut
                  size={92}
                  centre={`${pct(C.new.value, S.validated.value)} new`}
                  rows={[
                    { label: `New (${C.new.members})`, value: C.new.value, display: `AED ${short(C.new.value)}` },
                    { label: `Existing (${C.existing.members})`, value: C.existing.value, display: `AED ${short(C.existing.value)}` },
                  ]}
                />
              </View>
            }
            right={
              <View style={s.card}>
                <SubTitle>How long members have been with FHI</SubTitle>
                <HBars rows={r.members.tenureBands} color="#8aa4c2" />
              </View>
            }
          />
          <View style={{ marginTop: 10 }} wrap={false}>
            <Table
              rows={[
                { m: "Members on the team", n: int(C.new.members), t: int(C.existing.members) },
                { m: "Active accounts", n: int(C.new.active), t: int(C.existing.active) },
                { m: "With a selling role", n: int(C.new.sellingRole), t: int(C.existing.sellingRole) },
                { m: "Members who sold", n: int(C.new.sellers), t: int(C.existing.sellers) },
                { m: "Validated deals", n: int(C.new.deals), t: int(C.existing.deals) },
                { m: "Validated value", n: aed(C.new.value), t: aed(C.existing.value) },
                { m: "Share of the team's value", n: pct(C.new.value, S.validated.value), t: pct(C.existing.value, S.validated.value) },
                { m: "Value per selling member", n: aed(C.new.perSeller), t: aed(C.existing.perSeller) },
                { m: "Value per member", n: aed(C.new.perMember), t: aed(C.existing.perMember) },
                { m: "Pending deals", n: C.new.pendingDeals ? `${C.new.pendingDeals} · AED ${short(C.new.pendingValue)}` : "—", t: C.existing.pendingDeals ? `${C.existing.pendingDeals} · AED ${short(C.existing.pendingValue)}` : "—" },
              ]}
              cols={[
                { label: "KPI contribution", width: 40, render: (x) => <Strong>{x.m}</Strong> },
                { label: "New agents", width: 30, align: "right", render: (x) => <Strong color={NAVY}>{x.n}</Strong> },
                { label: "Existing agents", width: 30, align: "right", render: (x) => x.t },
              ]}
            />
          </View>
          {C.byMonth.length >= 2 && C.byMonth.some((m) => m.newValue + m.existingValue > 0) && (
            <View style={{ marginTop: 10 }}>
              <SubTitle>Month by month</SubTitle>
              <Table
                rows={C.byMonth}
                cols={[
                  { label: "Month", width: 28, render: (m) => <Strong>{monthName(m.month)}</Strong> },
                  { label: "New agents", width: 36, align: "right", render: (m) => (m.newValue ? aed(m.newValue) : "—") },
                  { label: "Existing agents", width: 36, align: "right", render: (m) => (m.existingValue ? aed(m.existingValue) : "—") },
                ]}
              />
            </View>
          )}
          <Callout tone="navy">
            <Text style={{ ...s.eyebrow, color: NAVY }}>FHI Assistant&apos;s reading</Text>
            <Text style={{ fontSize: 9.2, color: INK, lineHeight: 1.4, marginTop: 4 }}>{insights.cohortAnalysis}</Text>
          </Callout>
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>
            New = the member&apos;s FHI account was created inside {r.period.label}; existing = created before it. An older account added to the team counts as existing.
          </Text>
        </Section>

        <Section n="03" title="Recruitment & activation" subtitle="Who joined, and how far each recruit got — a recruit can only record a sale once every requirement below is done, and the recruiter who invited them does two of the four.">
          <StatRow
            items={[
              { label: "New recruits", value: int(R.recruited), change: R.change, hint: `vs ${R.previous} ${r.period.versus}` },
              { label: "Via team invite links", value: int(R.viaTeamInvite), hint: "registered under a team member" },
              { label: "Ready to sell", value: `${readyNew} of ${R.recruited}`, hint: "finished every requirement" },
              { label: "Validated a first sale", value: `${validatedNew} of ${R.recruited}`, hint: "counts on the leaderboard" },
            ]}
          />
          {r.outsideTeam && (
            <View wrap={false} style={{ backgroundColor: "#fff5f5", borderLeftWidth: 3, borderLeftColor: "#b91c1c", borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <Text style={{ ...s.eyebrow, color: "#991b1b" }}>Not on the team list yet</Text>
              <Text style={{ fontSize: 9, color: INK, lineHeight: 1.4, marginTop: 4 }}>
                <Text style={{ fontWeight: 700 }}>{r.outsideTeam.total} recruit{r.outsideTeam.total === 1 ? "" : "s"}</Text> of {r.outsideTeam.recruiters.join(" & ")} are in the invite network but were never added to the team ({r.outsideTeam.active} approved, {r.outsideTeam.pending} waiting for Approve, {r.outsideTeam.withoutSellingRole} without a selling role). Team Sales, the leaderboards and this report do not count them yet, and any sales they make are not included. An admin can add them in Teams &gt; Add member.
              </Text>
            </View>
          )}
          <View wrap={false}>
            <Two
              left={
                <View style={s.card}>
                  <SubTitle>Activation funnel — recruits of this period</SubTitle>
                  {R.recruited ? <Funnel steps={R.funnel} /> : <Empty>No recruits joined in this period.</Empty>}
                </View>
              }
              right={
                <View style={s.card}>
                  <SubTitle>Recruits still missing…</SubTitle>
                  {R.recruited ? <HBars rows={R.missing} color="#8aa4c2" /> : <Empty>Nothing to show.</Empty>}
                </View>
              }
            />
          </View>
          <Callout>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>How we count &quot;finished all the requirements&quot; — and who does each one</Text>
            {REQUIREMENT_KEYS.map((k, i) => (
              <View key={k} style={{ flexDirection: "row", marginTop: 5 }}>
                <Text style={{ width: 14, fontSize: 8.5, fontWeight: 700, color: GOLD_DEEP }}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8.5, color: INK }}>
                    <Text style={{ fontWeight: 700 }}>{REQUIREMENT_LABELS[k]}</Text> — {REQUIREMENT_HINTS[k]}
                  </Text>
                  <Text style={{ fontSize: 7.5, fontWeight: 700, color: REQUIREMENT_OWNERS[k].who === "recruiter" ? NAVY : MUTED, marginTop: 1 }}>
                    {REQUIREMENT_OWNERS[k].whoLabel} · {arrows(REQUIREMENT_OWNERS[k].where)}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 5 }}>{arrows(REQUIREMENT_NOTE)}</Text>
          </Callout>
          {R.recruiters.some((g) => g.waitingApproval + g.waitingRole > 0) && (
            <View style={{ marginTop: 10 }} wrap={false}>
              <SubTitle right="Only the recruiter can press Approve and set the role">Who has recruits waiting</SubTitle>
              <Table
                rows={R.recruiters.filter((g) => g.waitingApproval + g.waitingRole + g.profileOrPhoto > 0).slice(0, 8)}
                cols={[
                  { label: "Recruiter", width: 38, render: (g) => <View><Strong>{g.name}</Strong>{g.onTeam ? null : <Text style={{ fontSize: 7, color: MUTED }}>outside the team</Text>}</View> },
                  { label: "Recruits", width: 12, align: "right", render: (g) => String(g.recruits) },
                  { label: "Waiting for Approve", width: 18, align: "right", render: (g) => (g.waitingApproval ? <Strong color={NAVY}>{String(g.waitingApproval)}</Strong> : "—") },
                  { label: "No selling role", width: 17, align: "right", render: (g) => (g.waitingRole ? <Strong color={NAVY}>{String(g.waitingRole)}</Strong> : "—") },
                  { label: "Profile / photo", width: 15, align: "right", render: (g) => (g.profileOrPhoto ? String(g.profileOrPhoto) : "—") },
                ]}
              />
            </View>
          )}
          {R.notReady.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <SubTitle right={R.notReadyTotal > 10 ? `Showing 10 of ${R.notReadyTotal}` : `${R.notReadyTotal} recruit${R.notReadyTotal === 1 ? "" : "s"}`}>Not ready yet — finish these first</SubTitle>
              <Table
                rows={R.notReady.slice(0, 10)}
                cols={[
                  { label: "Recruit", width: 34, render: recruitCell },
                  { label: "Joined", width: 18, render: (m) => day(m.joined) },
                  { label: "Still missing", width: 48, render: (m) => m.missing.map((k) => REQUIREMENT_LABELS[k]).join(" · ") },
                ]}
              />
            </View>
          )}
          {R.readyNotSelling.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <SubTitle right={R.readyNotSellingTotal > 8 ? `Showing 8 of ${R.readyNotSellingTotal}` : `${R.readyNotSellingTotal} recruit${R.readyNotSellingTotal === 1 ? "" : "s"}`}>Ready, but no sale recorded — get them their first deal</SubTitle>
              <Table
                rows={R.readyNotSelling.slice(0, 8)}
                cols={[
                  { label: "Recruit", width: 40, render: recruitCell },
                  { label: "Joined", width: 20, render: (m) => day(m.joined) },
                  { label: "Account role", width: 40, render: (m) => roleText(m.accountRole) },
                ]}
              />
            </View>
          )}
        </Section>

        <Section n="04" title="Who sold, who went quiet" subtitle="Validated sales per member in the period, and the existing sellers who closed nothing.">
          {A.sellers.length ? (
            <View>
              <SubTitle right={A.sellersTotal > A.sellers.length ? `Top ${A.sellers.length} of ${A.sellersTotal}` : `${A.sellersTotal} member${A.sellersTotal === 1 ? "" : "s"}`}>Members who sold</SubTitle>
              <Table
                rows={A.sellers}
                cols={[
                  { label: "#", width: 6, render: (_, i) => <Rank i={i} /> },
                  { label: "Member", width: 34, render: memberCell },
                  { label: "Group", width: 13, render: (m) => <CohortTag cohort={m.cohort} /> },
                  { label: "Deals", width: 9, align: "right", render: (m) => String(m.deals) },
                  { label: "Share", width: 10, align: "right", render: (m) => pct(m.value, S.validated.value) },
                  { label: "Validated value", width: 28, align: "right", render: (m) => <View style={{ alignItems: "flex-end", width: "100%" }}><Strong color={NAVY}>{aed(m.value)}</Strong><View style={{ width: "100%", height: 3, backgroundColor: "#eef0f3", borderRadius: 1.5, marginTop: 2 }}><View style={{ width: `${Math.max(3, (100 * m.value) / maxSeller)}%`, height: 3, backgroundColor: GOLD, borderRadius: 1.5 }} /></View></View> },
                ]}
              />
            </View>
          ) : (
            <Empty>Nobody on the team has a validated sale in this period.</Empty>
          )}
          <View style={{ marginTop: 12 }}>
            <SubTitle right={A.quietTotal > 8 ? `Showing 8 of ${A.quietTotal}` : undefined}>Gone quiet — existing sellers with no validated deal</SubTitle>
            {A.quiet.length ? (
              <Table
                rows={A.quiet.slice(0, 8)}
                cols={[
                  { label: "Member", width: 38, render: memberCell },
                  { label: "Joined", width: 20, render: (m) => day(m.joined) },
                  { label: "Last validated sale", width: 26, render: (m) => (m.lastValidated ? day(m.lastValidated) : "Never") },
                  { label: "Pending", width: 16, align: "right", render: (m) => (m.pendingDeals ? `${m.pendingDeals}` : "—") },
                ]}
              />
            ) : (
              <Empty>Every active existing seller closed a deal in this period.</Empty>
            )}
            {A.quietTotal > 0 && <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 5 }}>{A.quietTotal} quiet seller{A.quietTotal === 1 ? "" : "s"}, {A.neverSold} of them never sold. Active accounts with a selling role only; members without one are not counted.</Text>}
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>
              Quiet means no validated deal and no deal waiting for validation in the period. A partner on a shared deal is credited their share, so partners appear under &quot;Members who sold&quot;, never here.
              {A.waitingValidationTotal > 0 ? ` ${A.waitingValidationTotal} more member${A.waitingValidationTotal === 1 ? " has" : "s have"} a deal still waiting for validation and ${A.waitingValidationTotal === 1 ? "is" : "are"} not counted as quiet.` : ""}
            </Text>
          </View>
        </Section>

        <View break />
        <Section n="05" title="The next three months: the path to 2×" subtitle={`${insights.nextQuarter.map((m) => m.month).join(" · ")} — what doubling ${poss(teamName)} sales takes.`}>
          <StatRow
            items={[
              { label: "Pace now", value: T.basis === "none" ? "—" : `AED ${short(T.monthlyRunRate)}`, hint: T.basis === "none" ? "no validated sales yet" : `per month · ${T.dealsPerMonth} deal${T.dealsPerMonth === 1 ? "" : "s"}` },
              { label: "Target pace", value: T.basis === "none" ? "First deals" : `AED ${short(T.targetMonthly)}`, hint: T.basis === "none" ? "one from each ready member" : "per month — double" },
              { label: "Three-month target", value: T.basis === "none" ? "—" : `AED ${short(T.target3m)}`, hint: T.basis === "none" ? undefined : `vs AED ${short(T.baseline3m)} at today's pace` },
              { label: "Deals needed", value: String(T.dealsNeeded3m), hint: T.basis === "none" ? "first deals" : `vs ${T.dealsNow3m} at today's pace` },
            ]}
          />
          <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 8 }}>
            {basisNote}
            {T.last90dRunRate !== null ? ` The last 90 days ran at AED ${short(T.last90dRunRate)} a month.` : ""}
            {T.extraDealsPerMonth > 0 && T.basis !== "none" ? ` That is ${T.extraDealsPerMonth} more deal${T.extraDealsPerMonth === 1 ? "" : "s"} every month at the team's average of ${aed(S.avgDeal)}.` : ""}
          </Text>
          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            {insights.nextQuarter.map((m, i) => (
              <View key={m.month} wrap={false} style={{ flex: 1, ...s.card, marginRight: i < 2 ? 8 : 0, borderTopWidth: 3, borderTopColor: i === 2 ? GOLD : NAVY }}>
                <Text style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: FAINT, textTransform: "uppercase" }}>Month {i + 1}</Text>
                <Text style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginTop: 2 }}>{m.month}</Text>
                <Text style={{ fontSize: 8.5, color: INK, lineHeight: 1.35, marginTop: 5 }}>{m.focus}</Text>
                <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.7, color: GOLD_DEEP, marginTop: 6 }}>TARGET</Text>
                <Text style={{ fontSize: 9.5, fontWeight: 700, color: NAVY }}>{m.target}</Text>
              </View>
            ))}
          </View>
          {T.levers.length > 0 && T.extraDeals3m > 0 && (
            <View wrap={false}>
              <SubTitle>{`Who can close the gap — ${T.extraDeals3m} more deal${T.extraDeals3m === 1 ? "" : "s"} in three months`}</SubTitle>
              <Table
                rows={T.levers}
                cols={[
                  { label: "Group", width: 50, render: (l) => <View><Strong>{l.title}</Strong><Text style={{ fontSize: 7, color: MUTED }}>{l.detail}</Text></View> },
                  { label: "People", width: 12, align: "right", render: (l) => String(l.people) },
                  { label: "A deal from…", width: 38, align: "right", render: (l) => (l.share > 1 ? <Text style={{ fontSize: 8.5, color: MUTED }}>not enough alone</Text> : <Strong color={NAVY}>{`${l.needed} of ${l.people} · ${Math.round(l.share * 100)}%`}</Strong>) },
                ]}
              />
              <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 5 }}>
                Plain arithmetic: how many people in each group would have to close one validated deal, at the team&apos;s average of {aed(S.avgDeal)}, to cover the gap on their own. No conversion rate is assumed.
                {easiest && easiest.share <= 1 ? ` The easiest start: ${easiest.title.toLowerCase()} — ${easiest.needed} of ${easiest.people}.` : ""}
              </Text>
            </View>
          )}
        </Section>

        <View break />
        <Section n="06" title="Ten strategies to double the sales" subtitle={`Ordered by impact, each tied to a figure in this report — start with the first three this week.`}>
          {insights.strategies.map((st, i) => (
            <View key={i} wrap={false} style={{ flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 10, marginBottom: 7 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: i < 3 ? GOLD : NAVY, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ color: i < 3 ? NAVY : GOLD_SOFT, fontSize: 10, fontWeight: 700 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, flex: 1 }}>{st.title}</Text>
                  <Text style={{ fontSize: 7, fontWeight: 700, color: st.impact === "High" ? "#ffffff" : NAVY, backgroundColor: st.impact === "High" ? NAVY : st.impact === "Quick win" ? "#fdf3d8" : "#eef1f5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>{st.impact.toUpperCase()}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: FAINT, marginTop: 1 }}>WHAT WE SEE</Text>
                  <Text style={{ flex: 1, fontSize: 8.6, color: BODY, lineHeight: 1.35 }}>{st.why}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 3 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: GOLD_DEEP, marginTop: 1 }}>WHAT TO DO</Text>
                  <Text style={{ flex: 1, fontSize: 8.6, color: INK, fontWeight: 600, lineHeight: 1.35 }}>{st.how}</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>Owner: {st.owner}{st.metric ? ` · Measure: ${st.metric}` : ""}</Text>
              </View>
            </View>
          ))}
          <Text style={{ fontSize: 7.5, color: FAINT, marginTop: 2 }}>
            {insights.source === "ai"
              ? "The analysis is written by FHI Assistant from the figures in this report only — review it before acting."
              : "The analysis is generated from the figures in this report by fixed rules."}
          </Text>
        </Section>

        <View break />
        <Section n="07" title="Our commitments" subtitle={`Written and signed by ${leaders} — review at the end of ${insights.nextQuarter[0]?.month ?? "the first month"}.`}>
          <View style={{ ...s.card, padding: 16 }}>
            <Text style={{ fontSize: 10.5, fontWeight: 700, color: NAVY }}>To double {poss(teamName)} sales in the next three months we will:</Text>
            {[1, 2, 3].map((n) => (
              <View key={n} style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 22 }}>
                <Text style={{ width: 22, fontSize: 12, fontWeight: 700, color: GOLD_DEEP }}>{n}</Text>
                <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#c5ccd6", height: 14 }} />
              </View>
            ))}
            <View style={{ flexDirection: "row", marginTop: 30 }}>
              <View style={{ flex: 1, marginRight: 24 }}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: "#c5ccd6", height: 20 }} />
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>Team leader — signature and date</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 1, borderBottomColor: "#c5ccd6", height: 20 }} />
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>FHI management — signature and date</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {[
              { l: "Month 1 review", v: insights.nextQuarter[0]?.month ?? "" },
              { l: "Month 2 review", v: insights.nextQuarter[1]?.month ?? "" },
              { l: "Month 3 review", v: insights.nextQuarter[2]?.month ?? "" },
            ].map((x, i) => (
              <View key={x.l} style={{ flex: 1, backgroundColor: "#f6f7f9", borderRadius: 6, padding: 9, marginRight: i < 2 ? 8 : 0 }}>
                <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.8, color: FAINT, textTransform: "uppercase" }}>{x.l}</Text>
                <Text style={{ fontSize: 10, fontWeight: 700, color: NAVY, marginTop: 2 }}>{x.v}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>Target {T.basis === "none" ? "first deals" : aed(T.targetMonthly)}</Text>
                <View style={{ borderBottomWidth: 1, borderBottomColor: "#c5ccd6", height: 14 }} />
                <Text style={{ fontSize: 6.8, color: FAINT, marginTop: 2 }}>Actual</Text>
              </View>
            ))}
          </View>
        </Section>
      </Page>
    </Document>
  )
}
