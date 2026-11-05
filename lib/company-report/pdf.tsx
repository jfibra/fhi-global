import "server-only"

import { Circle, Document, Image, Page, Svg, Text, View } from "@react-pdf/renderer"
import type { CompanyReport } from "./data"
import type { Insights } from "./insights"
import { BODY, Chip, DOWN, Donut, Empty, FAINT, GOLD, GOLD_DEEP, GOLD_SOFT, HBars, INK, LINE, LineChart, MUTED, NAVY, Rank, Section, ShareBar, StatRow, Strong, SubTitle, Table, Two, VBars, aed, int, s, short } from "./pdf-kit"
export { registerReportFonts } from "./pdf-kit"

/**
 * The company performance report as an A4 PDF (boss via Juliecor,
 * 2026-10-15): a navy cover with the headline tiles, the takeaways and the
 * sales-by-day chart, then numbered sections — teams & leader networks,
 * sales, pipeline, recruitment, leads & website — with tables and charts,
 * and the recommendations last. The drawing blocks live in ./pdf-kit (shared
 * with the team performance report).
 */

// ─── Document ────────────────────────────────────────────────────────────────

export type ReportImages = { whiteLogo: Buffer | null; navyLogo: Buffer | null }

export function CompanyReportDocument({ r, insights, images }: { r: CompanyReport; insights: Insights; images: ReportImages }) {
  const S = r.sales
  const P = r.pipeline
  const W = r.website
  const maxAgent = Math.max(1, ...S.topAgents.map((a) => a.value))
  const maxNet = Math.max(1, ...r.teams.networks.map((n) => n.network))

  const header = (
    <View fixed style={{ position: "absolute", top: 22, left: 36, right: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 8 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      {images.navyLogo ? <Image src={{ data: images.navyLogo, format: "png" }} style={{ width: 66, height: 27, borderRadius: 3 }} /> : <Text style={{ fontWeight: 700, color: NAVY }}>FHI Global Property</Text>}
      <Text style={{ fontSize: 7.5, color: MUTED }}>
        <Text style={{ fontWeight: 700, color: NAVY }}>Company performance</Text> · {r.period.kind} · {r.period.label}
      </Text>
    </View>
  )
  const footer = (
    <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
      <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for internal use · Generated {r.generatedAt} (Dubai)</Text>
      <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )

  return (
    <Document title={`FHI Global — ${r.period.kind} — ${r.period.label}`} author="FHI Assistant" subject="Company performance report" creator="fhiglobal.ae">
      {/* ── Cover: the period, the headline tiles, the takeaways, sales by day ── */}
      <Page size="A4" style={s.cover}>
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 36, paddingTop: 30, paddingBottom: 28, position: "relative" }}>
          <Svg width={260} height={220} style={{ position: "absolute", top: -60, right: -70 }}>
            <Circle cx={150} cy={110} r={100} stroke={GOLD} strokeOpacity={0.28} strokeWidth={1} fill="none" />
            <Circle cx={185} cy={85} r={100} stroke={GOLD} strokeOpacity={0.16} strokeWidth={1} fill="none" />
          </Svg>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.whiteLogo ? <Image src={{ data: images.whiteLogo, format: "png" }} style={{ width: 112, height: 41 }} /> : <Text style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>FHI Global Property</Text>}
            <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: GOLD_SOFT }}>CONFIDENTIAL · INTERNAL</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 34 }}>
            <View style={{ width: 26, height: 1.5, backgroundColor: GOLD, marginRight: 8 }} />
            <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2.4, color: GOLD_SOFT }}>{r.period.kind.toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 30, fontWeight: 700, color: "#ffffff", marginTop: 6, lineHeight: 1.05 }}>Company performance</Text>
          <Text style={{ fontSize: 17, fontWeight: 600, color: GOLD_SOFT, marginTop: 4 }}>{r.period.label}</Text>
          <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.62)", marginTop: 10 }}>
            Prepared for the CEO · Generated {r.generatedAt} (Dubai) · Changes compare with {r.period.versus}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 36, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {r.kpis.map((k) => (
              <View key={k.label} style={{ width: "25%", padding: 4 }}>
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

          <View style={{ marginTop: 12, backgroundColor: "#f4f6fa", borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 6, padding: 12 }}>
            <Text style={{ ...s.eyebrow, color: GOLD_DEEP }}>At a glance</Text>
            {insights.takeaways.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginTop: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: GOLD_DEEP, width: 14 }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.35 }}>{t}</Text>
              </View>
            ))}
          </View>

          <View style={{ ...s.card, marginTop: 12 }}>
            <SubTitle right={S.byDay.some((b) => b.inPeriod === false) ? "Navy: this period · Grey: days before, for context" : undefined}>Validated sales by day (AED)</SubTitle>
            {S.byDay.some((b) => b.value > 0) ? <VBars bars={S.byDay} height={96} /> : <Empty>No validated sales in these days.</Empty>}
          </View>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            {["Teams & leaders", "Sales", "Pipeline", "Recruitment", "Leads & website", "Recommendations"].map((t, i) => (
              <View key={t} style={{ flex: 1, borderTopWidth: 2, borderTopColor: i === 5 ? GOLD : NAVY, paddingTop: 4, marginRight: i < 5 ? 6 : 0 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: i === 5 ? GOLD_DEEP : NAVY }}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <View fixed style={{ position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }}>
          <Text style={{ fontSize: 7, color: FAINT }}>FHI Global Property · Confidential — for internal use</Text>
          <Text style={{ fontSize: 7, color: FAINT }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── The sections ── */}
      <Page size="A4" style={s.page}>
        {header}
        {footer}

        <Section n="01" title="Teams & leaders" subtitle="How each team and each leader's network is doing — sales are validated and credited per share.">
          {r.teams.formal.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <SubTitle>Formal teams</SubTitle>
              <Table
                rows={r.teams.formal}
                cols={[
                  { label: "Team", width: 24, render: (t) => <View><Strong>{t.name}</Strong><Text style={{ fontSize: 7, color: MUTED }}>Led by {t.leaders || "—"}</Text></View> },
                  { label: "Members", width: 12, align: "right", render: (t) => `${int(t.members)}` },
                  { label: "Active", width: 11, align: "right", render: (t) => `${int(t.active)}` },
                  { label: "Ever sold", width: 13, align: "right", render: (t) => `${t.soldAllTime} (${t.members ? Math.round((100 * t.soldAllTime) / t.members) : 0}%)` },
                  { label: "This period", width: 20, align: "right", render: (t) => <Strong color={NAVY}>{t.dealsPeriod ? `${t.dealsPeriod} · ${aed(t.valuePeriod)}` : "—"}</Strong> },
                  { label: "All time", width: 20, align: "right", render: (t) => `${t.dealsAllTime} · AED ${short(t.valueAllTime)}` },
                ]}
              />
            </View>
          )}
          <SubTitle right="A network includes the networks under it, so leaders overlap.">Biggest leader networks</SubTitle>
          {r.teams.networks.length ? (
            <Table
              rows={r.teams.networks}
              cols={[
                { label: "#", width: 5, render: (_, i) => <Rank i={i} /> },
                { label: "Leader", width: 25, render: (n) => <View><Strong>{n.name}</Strong><Text style={{ fontSize: 7, color: MUTED }}>{n.direct} direct recruits</Text></View> },
                { label: "Network", width: 18, render: (n) => <View style={{ width: "92%" }}><Text style={{ fontSize: 8.5, color: INK, marginBottom: 2 }}>{int(n.network)} people</Text><ShareBar value={n.network} max={maxNet} color={NAVY} /></View> },
                { label: "Joined", width: 9, align: "right", render: (n) => (n.joined ? `+${n.joined}` : "—") },
                { label: "Sold", width: 13, align: "right", render: (n) => `${n.sellers} of ${n.active}` },
                { label: "Deals", width: 8, align: "right", render: (n) => (n.deals ? String(n.deals) : "—") },
                { label: "Network sales", width: 22, align: "right", render: (n) => <Strong color={n.value ? NAVY : FAINT}>{n.value ? aed(n.value) : "—"}</Strong> },
              ]}
            />
          ) : (
            <Empty>No recruiter networks yet.</Empty>
          )}
          {r.teams.noTeam.count > 0 && (
            <View style={{ flexDirection: "row", marginTop: 10, backgroundColor: "#fffaf0", borderRadius: 6, padding: 9, borderLeftWidth: 3, borderLeftColor: GOLD }}>
              <Text style={{ fontSize: 8.5, color: INK, flex: 1 }}>
                <Text style={{ fontWeight: 700 }}>{int(r.teams.noTeam.count)} selling accounts are in no team</Text> — {r.teams.noTeam.byRole.map((b) => `${b.value} ${b.label.toLowerCase()}${b.value === 1 ? "" : "s"}`).join(", ")}. Nobody coaches them and their sales don&apos;t roll up to a leader.
              </Text>
            </View>
          )}
        </Section>

        <Section n="02" title="Sales" subtitle={`Validated sales in the period, compared with ${r.period.versus}.`}>
          <StatRow
            items={[
              { label: "Validated value", value: `AED ${short(S.validated.value)}`, change: r.kpis[0]?.change ?? null, hint: `vs AED ${short(S.previous.value)}` },
              { label: "Validated deals", value: String(S.validated.deals), change: r.kpis[1]?.change ?? null, hint: `vs ${S.previous.deals}` },
              { label: "Pending", value: String(S.pending.deals), hint: S.pending.deals ? `AED ${short(S.pending.value)}` : "nothing waiting" },
              { label: "All time", value: `AED ${short(S.allTime.value)}`, hint: `${S.allTime.deals} validated deals` },
            ]}
          />
          <SubTitle>Top agents</SubTitle>
          {S.topAgents.length ? (
            <Table
              rows={S.topAgents}
              cols={[
                { label: "#", width: 6, render: (_, i) => <Rank i={i} /> },
                { label: "Agent", width: 36, render: (a) => <Strong>{a.name}</Strong> },
                { label: "Deals", width: 10, align: "right", render: (a) => String(a.deals) },
                { label: "Share of value", width: 26, render: (a) => <View style={{ flexDirection: "row", alignItems: "center", width: "100%", paddingLeft: 8 }}><View style={{ flex: 1 }}><ShareBar value={a.value} max={maxAgent} /></View><Text style={{ width: 26, fontSize: 7.5, color: MUTED, textAlign: "right" }}>{Math.round(a.share * 100)}%</Text></View> },
                { label: "Value", width: 22, align: "right", render: (a) => <Strong color={NAVY}>{aed(a.value)}</Strong> },
              ]}
            />
          ) : (
            <Empty>No validated sales in this period.</Empty>
          )}
          {(S.topDevelopers.length > 0 || S.topProjects.length > 0) && (
            <View style={{ marginTop: 12 }}>
              <Two
                left={
                  <View>
                    <SubTitle>Top developers</SubTitle>
                    <HBars rows={S.topDevelopers.map((d) => ({ label: `${d.name} · ${d.deals} deal${d.deals === 1 ? "" : "s"}`, value: d.value, display: `AED ${short(d.value)}` }))} />
                  </View>
                }
                right={
                  <View>
                    <SubTitle>Top projects</SubTitle>
                    <HBars rows={S.topProjects.map((p) => ({ label: `${p.name} · ${p.deals} deal${p.deals === 1 ? "" : "s"}`, value: p.value, display: `AED ${short(p.value)}` }))} />
                  </View>
                }
              />
            </View>
          )}
          {S.partnerDeals > 0 && <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>{S.partnerDeals} of the period&apos;s deals were shared between agents; each agent is credited their share, company totals count the sale once.</Text>}
        </Section>

        <Section n="03" title="Pipeline & activity" subtitle="Sales waiting for validation, commission status and who is selling — as of today.">
          <StatRow
            items={[
              { label: "Awaiting validation", value: String(P.awaiting), hint: P.awaiting ? `AED ${short(P.awaitingValue)}` : "all clear" },
              { label: `Waiting > ${P.staleDays} days`, value: String(P.stale), hint: "oldest first below" },
              { label: "Days to validate", value: P.validationDays === null ? "—" : String(P.validationDays), hint: "average, submitted to validated" },
              { label: "Sold this period", value: `${P.soldInPeriod} / ${P.sellingActive}`, hint: `${P.neverSold} have never sold` },
            ]}
          />
          {P.oldest.length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <SubTitle>Waiting for validation — chase these first</SubTitle>
              <Table
                rows={P.oldest}
                cols={[
                  { label: "Agent", width: 32, render: (o) => <Strong>{o.agent}</Strong> },
                  { label: "Project", width: 34, render: (o) => o.project },
                  { label: "Value", width: 20, align: "right", render: (o) => aed(o.value) },
                  { label: "Days", width: 14, align: "right", render: (o) => <Strong color={o.days > P.staleDays ? DOWN.fg : INK}>{String(o.days)}</Strong> },
                ]}
              />
            </View>
          )}
          <View wrap={false}>
          <Two
            left={
              <View style={s.card}>
                <SubTitle>Quiet selling accounts by role</SubTitle>
                {P.quietByRole.length ? <HBars rows={P.quietByRole} color="#8aa4c2" /> : <Empty>Everyone sold this period.</Empty>}
              </View>
            }
            right={
              <View style={s.card}>
                <SubTitle>Commission status (validated sales)</SubTitle>
                <Donut rows={P.commissions} />
              </View>
            }
          />
          </View>
        </Section>

        <Section n="04" title="Recruitment" subtitle={`New accounts in the period, compared with ${r.period.versus}.`}>
          <StatRow
            items={[
              { label: "New accounts", value: int(r.recruitment.total), change: r.recruitment.change, hint: `vs ${r.recruitment.previous}` },
              { label: "Recruited", value: int(r.recruitment.recruited), hint: "registered under someone" },
              { label: "Direct sign-ups", value: int(r.recruitment.direct), hint: "from the website" },
              { label: "Waiting approval", value: int(r.recruitment.waiting), hint: "status pending" },
            ]}
          />
          <View wrap={false}>
          <Two
            left={
              <View style={s.card}>
                <SubTitle>New accounts by role</SubTitle>
                <Donut rows={r.recruitment.byRole} />
              </View>
            }
            right={
              <View style={s.card}>
                <SubTitle>Top recruiters this period</SubTitle>
                {r.recruitment.topRecruiters.length ? <HBars rows={r.recruitment.topRecruiters.map((t) => ({ label: t.name, value: t.recruits }))} /> : <Empty>No recruits this period.</Empty>}
              </View>
            }
          />
          </View>
          <View style={{ ...s.card, marginTop: 10 }} wrap={false}>
            <SubTitle right="Navy: this period · Grey: days before">Sign-ups by day</SubTitle>
            <VBars bars={r.recruitment.byDay} height={70} format={int} />
          </View>
        </Section>

        <Section n="05" title="Leads & website" subtitle="Every way a prospect reached FHI, and who visited fhiglobal.ae.">
          <SubTitle>Leads by source</SubTitle>
          <Table
            rows={[...r.leads.sources, { label: "All leads", total: r.leads.total, previous: r.leads.previous, change: r.leads.change }]}
            cols={[
              { label: "Source", width: 40, render: (l) => (l.label === "All leads" ? <Strong>All leads</Strong> : l.label) },
              { label: "This period", width: 20, align: "right", render: (l) => <Strong color={NAVY}>{int(l.total)}</Strong> },
              { label: "Before", width: 20, align: "right", render: (l) => int(l.previous) },
              { label: "Change", width: 20, align: "right", render: (l) => (l.change ? <Chip change={l.change} /> : "—") },
            ]}
          />
          <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 5, marginBottom: 10 }}>
            {r.leads.unanswered ? `${r.leads.unanswered} still waiting for a reply. ` : "Nothing waiting for a reply. "}
            Website buttons: {int(r.leads.whatsappClicks)} WhatsApp clicks, {int(r.leads.inquiriesSubmitted)} inquiry forms submitted.
          </Text>
          {W ? (
            <View>
              <StatRow
                items={[
                  { label: "Visitors", value: int(W.visitors), change: W.change, hint: `vs ${int(W.previous)}` },
                  { label: "Sessions", value: int(W.sessions) },
                  { label: "Page views", value: int(W.pageViews) },
                  { label: "Time on site", value: W.avgTime ?? "—", hint: W.engagement !== null ? `${W.engagement}% engaged` : null },
                ]}
              />
              <View wrap={false}>
                <Two
                  left={
                    <View style={s.card}>
                      <SubTitle right={W.trend ?? undefined}>Visitors by day</SubTitle>
                      <LineChart points={W.byDay} width={232} />
                    </View>
                  }
                  right={
                    <View style={s.card}>
                      <SubTitle>Traffic sources (sessions)</SubTitle>
                      <HBars rows={W.sources} />
                    </View>
                  }
                />
              </View>
              <View style={{ marginTop: 10 }} wrap={false}>
                <Two
                  left={
                    <View style={s.card}>
                      <SubTitle>Devices</SubTitle>
                      <Donut rows={W.devices} size={74} />
                    </View>
                  }
                  right={
                    <View style={s.card}>
                      <SubTitle>Most viewed pages</SubTitle>
                      {W.topPages.map((p, i) => (
                        <View key={p.path} style={{ flexDirection: "row", marginBottom: 3 }}>
                          <Text style={{ width: 12, fontSize: 7.5, color: FAINT }}>{i + 1}</Text>
                          <Text style={{ flex: 1, fontSize: 7.5, color: INK, marginRight: 6 }}>{p.path.length > 46 ? `${p.path.slice(0, 45)}…` : p.path}</Text>
                          <Text style={{ fontSize: 7.5, fontWeight: 700, color: NAVY }}>{int(p.views)}</Text>
                        </View>
                      ))}
                    </View>
                  }
                />
              </View>
            </View>
          ) : (
            <Empty>Website analytics were not available when this report was generated.</Empty>
          )}
        </Section>

        <View break />
        <Section n="06" title="Recommendations" subtitle="What to do in the next two weeks to make the company more productive.">
          {insights.recommendations.map((rec, i) => (
            <View key={i} wrap={false} style={{ flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 11, marginBottom: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ color: GOLD_SOFT, fontSize: 10, fontWeight: 700 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: NAVY, flex: 1 }}>{rec.title}</Text>
                  <Text style={{ fontSize: 7, fontWeight: 700, color: rec.impact === "High" ? "#ffffff" : NAVY, backgroundColor: rec.impact === "High" ? NAVY : rec.impact === "Quick win" ? "#fdf3d8" : "#eef1f5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    {rec.impact.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: FAINT, marginTop: 1 }}>WHAT WE SEE</Text>
                  <Text style={{ flex: 1, fontSize: 8.8, color: BODY, lineHeight: 1.35 }}>{rec.finding}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ width: 62, fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: GOLD_DEEP, marginTop: 1 }}>WHAT TO DO</Text>
                  <Text style={{ flex: 1, fontSize: 8.8, color: INK, fontWeight: 600, lineHeight: 1.35 }}>{rec.action}</Text>
                </View>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 4 }}>Owner: {rec.owner}</Text>
              </View>
            </View>
          ))}
          <Text style={{ fontSize: 7.5, color: FAINT, marginTop: 2 }}>
            {insights.source === "ai"
              ? "Recommendations are drafted by FHI Assistant from the figures in this report only — review them before acting."
              : "Recommendations are generated from the figures in this report by fixed rules."}
          </Text>
        </Section>
      </Page>
    </Document>
  )
}
