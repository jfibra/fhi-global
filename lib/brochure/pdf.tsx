import "server-only"

import { Document, Image, Page, Text, View } from "@react-pdf/renderer"
import type { Brochure } from "./data"
import { BODY, FAINT, GOLD, GOLD_DEEP, GOLD_SOFT, INK, LINE, MUTED, NAVY, PAPER } from "@/lib/company-report/pdf-kit"
export { registerReportFonts } from "@/lib/company-report/pdf-kit"

/**
 * The one-page project brochure an agent sends a client (lib/brochure/data.ts
 * gathers the facts): the project's photo under the FHI mark, its name and
 * developer on a navy band, four headline tiles, the units and prices, the
 * payment plan as steps, highlights, amenities and what's nearby — and the
 * agent's own contact card with a QR code, so the client lands on THEIR page
 * or THEIR WhatsApp. Same palette and fonts as the company report (pdf-kit).
 */

export type BrochureImages = { hero: Buffer | null; agent: Buffer | null; whiteLogo: Buffer | null; navyLogo: Buffer | null; qr: Buffer | null }

const Label = ({ children }: { children: string }) => <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 0.9, color: FAINT, textTransform: "uppercase" }}>{children}</Text>
const H = ({ children }: { children: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
    <View style={{ width: 14, height: 1.5, backgroundColor: GOLD, marginRight: 6 }} />
    <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.4, color: NAVY, textTransform: "uppercase" }}>{children}</Text>
  </View>
)
const Bullet = ({ children }: { children: string }) => (
  <View style={{ flexDirection: "row", marginBottom: 3 }}>
    <Text style={{ fontSize: 8.5, color: GOLD_DEEP, width: 9 }}>•</Text>
    <Text style={{ flex: 1, fontSize: 8.5, color: BODY, lineHeight: 1.35 }}>{children}</Text>
  </View>
)

export function BrochureDocument({ b, images }: { b: Brochure; images: BrochureImages }) {
  const P = b.project
  const tiles: Array<{ label: string; value: string; hint?: string | null }> = [
    { label: "From price", value: P.priceFrom ?? "Price on request", hint: P.priceRange && P.priceRange !== P.priceFrom ? P.priceRange : null },
    { label: "Handover", value: P.handover ?? "—", hint: P.status },
    { label: "Homes", value: P.mix ?? (P.propertyTypes.length ? P.propertyTypes.join(", ") : "—"), hint: P.sizes },
    {
      label: "Payment plan",
      value: b.plan.milestones.length >= 2 ? b.plan.milestones.map((m) => `${Math.round(m.percent)}%`).join(" / ") : b.plan.downPayment ? `${Math.round(b.plan.downPayment)}% down payment` : "On request",
      hint: b.plan.milestones.length >= 2 ? b.plan.milestones.map((m) => m.label).filter(Boolean).slice(0, 3).join(" · ") : b.plan.note ? b.plan.note.slice(0, 60) : null,
    },
  ]
  const chips = [P.status, P.offPlan ? "Off-plan" : "Ready", P.freehold ? "Freehold" : null, P.ownership && !P.freehold ? P.ownership : null].filter((c): c is string => Boolean(c))

  return (
    <Document title={`${P.name} — brochure`} author={b.agent.name} subject={`${P.name} by ${P.developer ?? "FHI Global"}`} creator="fhiglobal.ae">
      <Page size="A4" style={{ fontFamily: "Outfit", fontSize: 9, color: BODY, paddingBottom: 36 }}>
        {/* ── Hero ── */}
        <View style={{ height: 232, backgroundColor: NAVY }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {images.hero ? <Image src={{ data: images.hero, format: "jpg" }} style={{ width: "100%", height: 232, objectFit: "cover" }} /> : null}
          <View style={{ position: "absolute", top: 16, left: 30, backgroundColor: "rgba(0,31,63,0.78)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.whiteLogo ? <Image src={{ data: images.whiteLogo, format: "png" }} style={{ width: 82, height: 30 }} /> : <Text style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>FHI Global Property</Text>}
          </View>
          {P.developerVerified ? (
            <View style={{ position: "absolute", top: 16, right: 30, backgroundColor: GOLD, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 }}>
              <Text style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1.2, color: NAVY }}>VERIFIED DEVELOPER</Text>
            </View>
          ) : null}
        </View>
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 30, paddingTop: 12, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1.8, color: GOLD_SOFT, textTransform: "uppercase" }}>{[P.developer, P.area].filter(Boolean).join("  ·  ") || "Dubai"}</Text>
            <Text style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginTop: 3, lineHeight: 1.1 }}>{P.name}</Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            {chips.map((c) => (
              <View key={c} style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4 }}>
                <Text style={{ fontSize: 7, fontWeight: 700, color: "#ffffff" }}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Headline tiles ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 30, marginTop: 12, marginHorizontal: -3 }}>
          {tiles.map((t) => (
            <View key={t.label} style={{ flex: 1, marginHorizontal: 3, borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 8, backgroundColor: "#ffffff", minHeight: 50 }}>
              <Label>{t.label}</Label>
              <Text style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginTop: 3 }}>{t.value}</Text>
              {t.hint ? <Text style={{ fontSize: 6.8, color: MUTED, marginTop: 2 }}>{t.hint}</Text> : null}
            </View>
          ))}
        </View>

        {/* ── Two columns ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 30, marginTop: 12 }}>
          <View style={{ width: "58%", paddingRight: 10 }}>
            <H>Units & prices</H>
            {b.units.length === 0 ? (
              <Text style={{ fontSize: 8.5, color: MUTED }}>Unit prices on request — ask me for the latest availability.</Text>
            ) : (
              <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 7, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", backgroundColor: PAPER, paddingVertical: 5, paddingHorizontal: 8 }}>
                  <Text style={{ width: "40%", fontSize: 6.8, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: 0.8 }}>Type</Text>
                  <Text style={{ width: "14%", fontSize: 6.8, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: 0.8 }}>Beds</Text>
                  <Text style={{ width: "20%", fontSize: 6.8, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: 0.8 }}>Size</Text>
                  <Text style={{ width: "26%", fontSize: 6.8, fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right" }}>From</Text>
                </View>
                {b.units.map((u, i) => (
                  <View key={i} style={{ flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: LINE }}>
                    <Text style={{ width: "40%", fontSize: 8.5, fontWeight: 600, color: INK }}>{u.type}</Text>
                    <Text style={{ width: "14%", fontSize: 8.5, color: BODY }}>{u.beds}</Text>
                    <Text style={{ width: "20%", fontSize: 8.5, color: BODY }}>{u.size ?? "—"}</Text>
                    <Text style={{ width: "26%", fontSize: 8.5, fontWeight: 700, color: NAVY, textAlign: "right" }}>{u.price ?? "On request"}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <H>Payment plan</H>
              {b.plan.milestones.length >= 2 ? (
                <View style={{ flexDirection: "row", marginHorizontal: -2 }}>
                  {b.plan.milestones.slice(0, 5).map((m, i) => (
                    <View key={i} style={{ flex: 1, marginHorizontal: 2, backgroundColor: i === 0 ? NAVY : PAPER, borderRadius: 6, padding: 7 }}>
                      <Text style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? GOLD_SOFT : NAVY }}>{Math.round(m.percent)}%</Text>
                      <Text style={{ fontSize: 6.8, color: i === 0 ? "rgba(255,255,255,0.8)" : MUTED, marginTop: 2 }}>{m.label || `Step ${i + 1}`}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 8.5, color: BODY, lineHeight: 1.4 }}>
                  {b.plan.note ?? (b.plan.downPayment ? `${Math.round(b.plan.downPayment)}% down payment; the schedule is confirmed at booking.` : "Payment terms on request — I'll confirm the current plan with the developer.")}
                </Text>
              )}
              {b.plan.fees.length > 0 ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 4 }}>Plus {b.plan.fees.map((f) => `${Math.round(f.percent)}% ${f.label}`.trim()).join(", ")}.</Text> : null}
            </View>

            {P.description ? (
              <View style={{ marginTop: 12 }}>
                <H>About the project</H>
                <Text style={{ fontSize: 8.5, color: BODY, lineHeight: 1.45 }}>{P.description}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ width: "42%", paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: LINE }}>
            {b.highlights.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <H>Highlights</H>
                {b.highlights.map((h, i) => <Bullet key={i}>{h}</Bullet>)}
              </View>
            ) : null}
            {b.amenities.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <H>Amenities</H>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {b.amenities.map((a) => (
                    <View key={a} style={{ borderWidth: 1, borderColor: LINE, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2.5, marginRight: 3, marginBottom: 3 }}>
                      <Text style={{ fontSize: 7.2, color: BODY }}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {b.nearby.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <H>Nearby</H>
                {b.nearby.map((n, i) => <Bullet key={i}>{n}</Bullet>)}
              </View>
            ) : null}
            {P.totalUnits || P.permit ? (
              <View>
                <H>Facts</H>
                {P.totalUnits ? <Bullet>{`${P.totalUnits.toLocaleString("en-AE")} homes in the project`}</Bullet> : null}
                {P.permit ? <Bullet>{`DLD permit ${P.permit}`}</Bullet> : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* ── The agent ── */}
        <View style={{ marginHorizontal: 30, marginTop: 14, borderWidth: 1, borderColor: LINE, borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff" }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {images.agent ? <Image src={{ data: images.agent, format: "jpg" }} style={{ width: 54, height: 54, borderRadius: 27, objectFit: "cover" }} /> : <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }}><Text style={{ color: GOLD_SOFT, fontWeight: 700, fontSize: 16 }}>{b.agent.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</Text></View>}
          <View style={{ flex: 1, paddingLeft: 10 }}>
            <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 1.2, color: GOLD_DEEP, textTransform: "uppercase" }}>Your consultant</Text>
            <Text style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginTop: 1 }}>{b.agent.name}</Text>
            <Text style={{ fontSize: 7.5, color: MUTED }}>{b.agent.role} · {b.company.name}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 5 }}>
              {b.agent.whatsapp ? <Text style={{ fontSize: 8.5, fontWeight: 600, color: INK, marginRight: 12 }}>WhatsApp {b.agent.whatsapp}</Text> : null}
              {b.agent.phone && b.agent.phone !== b.agent.whatsapp ? <Text style={{ fontSize: 8.5, color: BODY, marginRight: 12 }}>Call {b.agent.phone}</Text> : null}
              {b.agent.email ? <Text style={{ fontSize: 8.5, color: BODY, marginRight: 12 }}>{b.agent.email}</Text> : null}
            </View>
            {b.agent.website ? <Text style={{ fontSize: 7.5, color: NAVY, marginTop: 2 }}>{b.agent.website.replace(/^https?:\/\//, "")}</Text> : null}
          </View>
          {images.qr ? (
            <View style={{ alignItems: "center", width: 78 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
              <Image src={{ data: images.qr, format: "png" }} style={{ width: 62, height: 62 }} />
              <Text style={{ fontSize: 5.8, color: MUTED, textAlign: "center", marginTop: 2 }}>{b.qr.caption}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer ── */}
        <View fixed style={{ position: "absolute", bottom: 14, left: 30, right: 30, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5 }}>
          <Text style={{ fontSize: 6.3, color: FAINT, lineHeight: 1.4 }}>
            {[b.company.legalName, b.company.licence, b.company.phone, b.company.site].filter(Boolean).join(" · ")}. Prices and availability as shown on fhiglobal.ae on {b.generatedOn}; they can change without notice and this brochure is for information only. Project page: {P.page.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
