import "server-only"

import { Circle, Document, Image, Page, Svg, Text, View } from "@react-pdf/renderer"
import type { AgentReport } from "./data"
import type { AgentInsights } from "./insights"
import { BODY, Chip, Donut, Empty, FAINT, GOLD, GOLD_DEEP, GOLD_SOFT, HBars, INK, LINE, MUTED, NAVY, Section, StatRow, Strong, SubTitle, Table, Two, VBars, aed, day, int, s, short } from "@/lib/company-report/pdf-kit"
export { registerReportFonts } from "@/lib/company-report/pdf-kit"

/**
 * My Performance Report as an A4 PDF (boss via Juliecor, 2026-11-06): a navy
 * cover with the person, the period, six headline tiles, the coach's
 * headline and takeaways and the sales-by-month chart; then the sections —
 * sales, leads & clients, website & reviews, events & recruits — and the
 * five recommendations with next month's focus. Drawn on the company
 * report's kit (lib/company-report/pdf-kit.tsx), so the three reports look
 * like one family.
 */

export type AgentReportImages = { whiteLogo: Buffer | null; navyLogo: Buffer | null; photo: Buffer | null }

const arrows = (t: string) => t.replace(/\s*→\s*/g, " > ")
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "A"
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const agentReportFileName = (name: string, from: string, toExclusive: string) => `fhi-my-report-${slugOf(name) || "agent"}-${from}-${new Date(Date.parse(`${toExclusive}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)}.pdf`

export function AgentReportDocument({ r, insights, images }: { r: AgentReport; insights: AgentInsights; images: AgentReportImages }) {
  const S = r.sales
  const I: AgentInsights = { ...insights, headline: arrows(insights.headline), takeaways: insights.takeaways.map(arrows), recommendations: insights.recommendations.map((x) => ({ title: arrows(x.title), why: arrows(x.why), how: arrows(x.how), metric: arrows(x.metric) })), nextMonth: { focus: arrows(insights.nextMonth.focus), target: arrows(insights.nextMonth.target) } }
  const header = (
    <View fixed style={{ position: "absolute", top: 22, left: 36, right: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {images.navyLogo ? <Image src={{ data: images.navyLogo, format: "png" }} style={{ width: 66, height: 27, borderRadius: 3 }} /> : <Text style={{ fontWeight: 700, color: NAVY }}>FHI Global Property</Text>}
      <Text style={{ fontSize: 7.5, color: MUTED }}>
        <Text style={{ fontWeight: 700, color: NAVY }}>My Performance Report</Text> · {r.person.name} · {r.period.label}
      </Text>
    </View>
  )
  const footer = (
    <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
      <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Private — prepared for {r.person.name} · Generated {r.generatedAt} (Dubai)</Text>
      <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
  const gradeRows = r.leads.byGrade.map((g) => ({ label: g.label, value: g.value, display: int(g.value) }))

  return (
    <Document title={`My Performance Report — ${r.person.name} — ${r.period.label}`} author="FHI Assistant" subject="Personal performance report" creator="fhiglobal.ae">
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
            <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: GOLD_SOFT }}>PRIVATE · FOR {r.person.name.toUpperCase()}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 26 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.photo ? <Image src={{ data: images.photo, format: "jpg" }} style={{ width: 58, height: 58, borderRadius: 29, objectFit: "cover", borderWidth: 2, borderColor: GOLD }} /> : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: "#0b2a4d", borderWidth: 2, borderColor: GOLD, alignItems: "center", justifyContent: "center" }}><Text style={{ color: GOLD_SOFT, fontWeight: 700, fontSize: 18 }}>{initials(r.person.name)}</Text></View>}
            <View style={{ marginLeft: 14, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 26, height: 1.5, backgroundColor: GOLD, marginRight: 8 }} />
                <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2.4, color: GOLD_SOFT }}>MY PERFORMANCE REPORT</Text>
              </View>
              <Text style={{ fontSize: 26, fontWeight: 700, color: "#ffffff", marginTop: 4, lineHeight: 1.05 }}>{r.person.name}</Text>
              <Text style={{ fontSize: 10, color: GOLD_SOFT, marginTop: 2 }}>{[r.person.roleLabel, r.person.team].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 17, fontWeight: 600, color: "#ffffff", marginTop: 16 }}>{r.period.label}</Text>
          <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.62)", marginTop: 4 }}>
            Generated {r.generatedAt} (Dubai) · Changes compare with {r.period.versus}{r.person.joined ? ` · With FHI since ${r.person.joined}` : ""}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 36, paddingTop: 16 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {r.kpis.map((k) => (
              <View key={k.label} style={{ width: "33.33%", padding: 4 }}>
                <View style={{ ...s.card, padding: 10, minHeight: 62 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.9, color: FAINT, textTransform: "uppercase" }}>{k.label}</Text>
                    <Chip change={k.change} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginTop: 5 }}>{k.value}</Text>
                  {k.hint ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>{k.hint}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 12, backgroundColor: "#f4f6fa", borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 6, padding: 12 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>Your coach says</Text>
            <Text style={{ fontSize: 10.5, fontWeight: 600, color: INK, marginTop: 5, lineHeight: 1.35 }}>{I.headline}</Text>
            {I.takeaways.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginTop: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: GOLD_DEEP, width: 14 }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.35 }}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={{ ...s.card, marginTop: 12 }}>
            <SubTitle right={S.byMonth.length > 1 ? "Your share of every validated deal, by month" : undefined}>Validated sales by month (AED)</SubTitle>
            {S.byMonth.some((b) => b.value > 0) ? <VBars bars={S.byMonth.map((b) => ({ label: b.label, value: b.value }))} height={92} dateLabels={false} /> : <Empty>No validated sales in these months.</Empty>}
          </View>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {["Sales", "Leads & clients", "Website & reviews", "Events & recruits", "Next 30 days"].map((t, i) => (
              <View key={t} style={{ flex: 1, borderTopWidth: 2, borderTopColor: i === 4 ? GOLD : NAVY, paddingTop: 4, marginRight: i < 4 ? 6 : 0 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: i === 4 ? GOLD_DEEP : NAVY }}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
          <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Private — prepared for {r.person.name}</Text>
          <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── Sections ── */}
      <Page size="A4" style={s.page}>
        {header}
        {footer}

        <Section n="01" title="Sales" subtitle={`Validated deals credited to you in ${r.period.label}; a shared deal counts your share.`}>
          <StatRow
            items={[
              { label: "Validated", value: `AED ${short(S.validated.value)}`, hint: `${int(S.validated.deals)} deal${S.validated.deals === 1 ? "" : "s"} · ${aed(S.validated.value)}`, change: S.change },
              { label: "Average deal", value: S.validated.deals ? `AED ${short(S.avgDeal)}` : "–", hint: S.sharedDeals ? `${S.sharedDeals} shared deal${S.sharedDeals === 1 ? "" : "s"}` : null },
              { label: "Pending", value: S.pending.deals ? `AED ${short(S.pending.value)}` : "–", hint: `${int(S.pending.deals)} waiting for validation` },
              { label: "All time", value: `AED ${short(S.allTime.value)}`, hint: `${int(S.allTime.deals)} validated deal${S.allTime.deals === 1 ? "" : "s"}` },
            ]}
          />
          <View style={{ marginTop: 10 }}>
            <Two
              left={
                <View>
                  <SubTitle>Your deals in the period</SubTitle>
                  {S.deals.length === 0 ? (
                    <Empty>No deal recorded in the period.</Empty>
                  ) : (
                    <Table
                      rows={S.deals}
                      cols={[
                        { label: "Date", width: 15, render: (d) => `${day(d.date)} ${d.date.slice(2, 4)}` },
                        { label: "Project", width: 41, render: (d) => <View><Strong>{d.project}</Strong>{d.developer ? <Text style={{ fontSize: 7, color: MUTED }}>{d.developer}</Text> : null}</View> },
                        { label: "Price", width: 28, align: "right", render: (d) => (d.share != null ? <View><Strong color={NAVY}>{aed(d.credited)}</Strong><Text style={{ fontSize: 7, color: MUTED }}>{`your ${Math.round(d.share)}% of ${aed(d.price)}`}</Text></View> : aed(d.price)) },
                        { label: "Status", width: 16, align: "right", render: (d) => d.status },
                      ]}
                    />
                  )}
                </View>
              }
              right={
                <View>
                  <SubTitle>Top projects</SubTitle>
                  {S.topProjects.length === 0 ? <Empty>No validated deal yet.</Empty> : <HBars rows={S.topProjects.map((p) => ({ label: p.name, value: p.value, display: `${aed(p.value)} · ${p.deals}` }))} format={(n) => aed(n)} />}
                  <View style={{ marginTop: 10 }}>
                    <SubTitle>Top Sales board</SubTitle>
                    <Text style={{ fontSize: 9, color: BODY, lineHeight: 1.4 }}>
                      {r.board.rank ? `You are #${r.board.rank} of ${r.board.of} agents on the board for this period with ${int(r.board.deals)} validated deal${r.board.deals === 1 ? "" : "s"}.` : `No validated deal in the period, so you are not on the board yet — ${r.board.of} agents are.`}
                    </Text>
                  </View>
                </View>
              }
            />
          </View>
        </Section>

        <Section n="02" title="Leads & clients" subtitle="The briefs that came through your Buyers Link and Sellers Link, graded as on your Buyers Link page.">
          <Two
            left={
              <View>
                <StatRow
                  items={[
                    { label: "Briefs", value: int(r.leads.total), hint: `vs ${int(r.leads.previous)} ${r.period.versus}`, change: r.leads.change },
                    { label: "Buyers", value: int(r.leads.buyers), hint: `${int(r.leads.sellers)} seller${r.leads.sellers === 1 ? "" : "s"}` },
                    { label: "Priority", value: int(r.leads.byGrade.find((g) => g.label.toLowerCase().startsWith("priority"))?.value ?? 0), hint: "ready and funded" },
                  ]}
                />
                <View style={{ marginTop: 10 }}>
                  <SubTitle>Priority buyers to call first</SubTitle>
                  {r.leads.priority.length === 0 ? (
                    <Empty>No priority buyer in the period.</Empty>
                  ) : (
                    <Table rows={r.leads.priority} cols={[{ label: "Name", width: 34, render: (p) => <Strong>{p.name}</Strong> }, { label: "Budget", width: 26, render: (p) => p.budget }, { label: "Goal", width: 24, render: (p) => p.goal }, { label: "When", width: 16, align: "right", render: (p) => p.when }]} />
                  )}
                </View>
              </View>
            }
            right={
              <View>
                <SubTitle>Buyers by grade</SubTitle>
                {gradeRows.length ? <Donut rows={gradeRows} centre={`${int(r.leads.buyers)} buyers`} /> : <Empty>No buyer brief in the period.</Empty>}
              </View>
            }
          />
        </Section>

        <Section n="03" title="Website & reviews" subtitle="Your pages and what clients wrote about you.">
          <StatRow
            items={[
              { label: "Website", value: r.website.has ? (r.website.live ? "Live" : "Draft") : "None", hint: r.website.url ? r.website.url.replace(/^https?:\/\//, "") : "build it in Website Builder" },
              { label: "Listings", value: int(r.listings.total), hint: `${int(r.listings.published)} live · ${int(r.listings.sale)} sale · ${int(r.listings.rent)} rent` },
              { label: "Client rating", value: r.reviews.average != null ? `${r.reviews.average} / 5` : "–", hint: `${int(r.reviews.total)} review${r.reviews.total === 1 ? "" : "s"}${r.reviews.waiting ? ` · ${r.reviews.waiting} waiting for approval` : ""}` },
              { label: "Would recommend", value: r.reviews.recommendPct != null ? `${r.reviews.recommendPct}%` : "–", hint: `${int(r.reviews.approved)} shown on your website` },
            ]}
          />
          {r.reviews.latest.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <SubTitle>What clients said</SubTitle>
              {r.reviews.latest.map((rv, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: 700, color: GOLD_DEEP, width: 28 }}>{rv.rating != null ? `${rv.rating} ★` : "–"}</Text>
                  <Text style={{ flex: 1, fontSize: 8.5, color: BODY, lineHeight: 1.35 }}>
                    <Text style={{ fontWeight: 700, color: INK }}>{rv.client}: </Text>
                    {rv.didWell ?? "no comment"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section n="04" title="Events & recruits" subtitle="The events you host and the people who joined through your invite link.">
          <StatRow
            items={[
              { label: "Your events", value: int(r.events.total), hint: `${int(r.events.inPeriod)} in the period` },
              { label: "Registrations", value: int(r.events.registrations), hint: `${int(r.events.registrationsInPeriod)} in the period · ${int(r.events.views)} page views` },
              { label: "Recruits", value: int(r.recruits.total), hint: `${int(r.recruits.joinedInPeriod)} joined in the period · ${int(r.recruits.pending)} waiting for approval` },
              { label: "Recruits selling", value: int(r.recruits.selling), hint: `${int(r.recruits.dealsBetween)} validated deal${r.recruits.dealsBetween === 1 ? "" : "s"} between them` },
            ]}
          />
        </Section>

        <Section n="05" title="Next 30 days" subtitle={I.source === "ai" ? "Written by FHI Assistant from your own figures." : "The standard coaching, written from your own figures."}>
          <View style={{ backgroundColor: "#f4f6fa", borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 6, padding: 10, marginBottom: 10 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>{"Next month's focus"}</Text>
            <Text style={{ fontSize: 10, fontWeight: 600, color: INK, marginTop: 4, lineHeight: 1.35 }}>{I.nextMonth.focus}</Text>
            <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>Target: {I.nextMonth.target}</Text>
          </View>
          {I.recommendations.map((rec, i) => (
            <View key={i} wrap={false} style={{ ...s.card, marginBottom: 7, flexDirection: "row" }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: GOLD_DEEP, width: 24 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>{rec.title}</Text>
                <Text style={{ fontSize: 8.5, color: BODY, marginTop: 3, lineHeight: 1.35 }}>
                  <Text style={{ fontWeight: 700, color: INK }}>Why: </Text>{rec.why}
                </Text>
                <Text style={{ fontSize: 8.5, color: BODY, marginTop: 2, lineHeight: 1.35 }}>
                  <Text style={{ fontWeight: 700, color: INK }}>How: </Text>{rec.how}
                </Text>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}>Watch: {rec.metric}</Text>
              </View>
            </View>
          ))}
        </Section>
      </Page>
    </Document>
  )
}
