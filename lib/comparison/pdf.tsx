import "server-only"

import { Document, Image, Page, Text, View } from "@react-pdf/renderer"
import type { Comparison } from "./data"
import { BODY, FAINT, GOLD, GOLD_DEEP, GOLD_SOFT, INK, LINE, MUTED, NAVY, PAPER } from "@/lib/company-report/pdf-kit"
export { registerReportFonts } from "@/lib/company-report/pdf-kit"

/**
 * The comparison sheet (lib/comparison/data.ts lines the facts up): one A4
 * landscape page — the projects' photos and names across the top, a row per
 * fact beneath with the winning cell marked in gold, the at-a-glance verdicts,
 * and the agent's own contact card with a QR code. Same palette and fonts as
 * the brochure and the company report (pdf-kit).
 */

export type ComparisonImages = { photos: Array<Buffer | null>; agent: Buffer | null; whiteLogo: Buffer | null; qr: Buffer | null }

const LABEL_W = 92

export function ComparisonDocument({ c, images }: { c: Comparison; images: ComparisonImages }) {
  const n = c.projects.length
  const title = c.projects.map((p) => p.name).join(" vs ")
  return (
    <Document title={`${title} — comparison`} author={c.agent.name} subject={`Project comparison by ${c.agent.name}, FHI Global`} creator="fhiglobal.ae">
      <Page size="A4" orientation="landscape" style={{ fontFamily: "Outfit", fontSize: 8.5, color: BODY, paddingBottom: 30 }}>
        {/* ── Header band ── */}
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 28, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.whiteLogo ? <Image src={{ data: images.whiteLogo, format: "png" }} style={{ width: 66, height: 24, marginRight: 12 }} /> : <Text style={{ color: "#fff", fontWeight: 700, fontSize: 10, marginRight: 12 }}>FHI Global Property</Text>}
            <View>
              <Text style={{ fontSize: 6.8, fontWeight: 700, letterSpacing: 1.6, color: GOLD_SOFT, textTransform: "uppercase" }}>Project comparison</Text>
              <Text style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginTop: 1 }}>{title}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.75)" }}>Prepared by {c.agent.name} · {c.generatedOn}</Text>
        </View>

        {/* ── Project heads ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 28, marginTop: 8 }}>
          <View style={{ width: LABEL_W }} />
          {c.projects.map((p, i) => (
            <View key={p.id} style={{ flex: 1, marginLeft: i === 0 ? 0 : 6, borderWidth: 1, borderColor: LINE, borderRadius: 7, overflow: "hidden", backgroundColor: "#ffffff" }}>
              <View style={{ height: 50, backgroundColor: PAPER }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                {images.photos[i] ? <Image src={{ data: images.photos[i] as Buffer, format: "jpg" }} style={{ width: "100%", height: 50, objectFit: "cover" }} /> : null}
              </View>
              <View style={{ paddingHorizontal: 7, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10.5, fontWeight: 700, color: NAVY }}>{p.name}</Text>
                <Text style={{ fontSize: 6.8, color: MUTED, marginTop: 1 }}>{[p.developer, p.area].filter(Boolean).join(" · ") || "Dubai"}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── The table ── */}
        <View style={{ marginHorizontal: 28, marginTop: 6, borderWidth: 1, borderColor: LINE, borderRadius: 7, overflow: "hidden" }}>
          {c.rows.map((r, ri) => (
            <View key={r.label} style={{ flexDirection: "row", backgroundColor: ri % 2 ? PAPER : "#ffffff", borderTopWidth: ri ? 1 : 0, borderTopColor: LINE }}>
              <View style={{ width: LABEL_W, paddingHorizontal: 8, paddingVertical: r.small ? 2.5 : 3, justifyContent: "center" }}>
                <Text style={{ fontSize: 6.6, fontWeight: 700, letterSpacing: 0.7, color: FAINT, textTransform: "uppercase" }}>{r.label}</Text>
              </View>
              {r.cells.map((cell, ci) => {
                const win = r.best === ci
                return (
                  <View key={ci} style={{ flex: 1, paddingHorizontal: 8, paddingVertical: r.small ? 2.5 : 3, justifyContent: "center", flexDirection: "row", alignItems: "center", borderLeftWidth: 1, borderLeftColor: LINE }}>
                    {win ? <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: GOLD, marginRight: 4 }} /> : null}
                    <Text style={{ flex: 1, fontSize: r.small ? 7 : 8.2, fontWeight: win ? 700 : r.small ? 400 : 600, color: win ? NAVY : r.small ? BODY : INK, lineHeight: 1.3 }}>{cell}</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
        <Text style={{ marginHorizontal: 28, marginTop: 3, fontSize: 6.2, color: FAINT }}>The gold dot marks the project that wins the row: the lowest entry price, the earliest handover, the smallest first payment. “—” means not published.</Text>

        {/* ── Verdicts + agent ── */}
        <View style={{ flexDirection: "row", marginHorizontal: 28, marginTop: 7 }} wrap={false}>
          <View style={{ width: "46%", paddingRight: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <View style={{ width: 14, height: 1.5, backgroundColor: GOLD, marginRight: 6 }} />
              <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.4, color: NAVY, textTransform: "uppercase" }}>At a glance</Text>
            </View>
            {c.verdicts.length ? (
              c.verdicts.map((v, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 2.5 }}>
                  <Text style={{ fontSize: 8.5, color: GOLD_DEEP, width: 9 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 8.5, color: BODY, lineHeight: 1.35 }}>{v}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 8.5, color: MUTED }}>The published facts are too close to call — I&apos;ll walk you through the differences.</Text>
            )}
          </View>
          <View style={{ width: "54%", borderWidth: 1, borderColor: LINE, borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 8, padding: 8, flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {images.agent ? <Image src={{ data: images.agent, format: "jpg" }} style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover" }} /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }}><Text style={{ color: GOLD_SOFT, fontWeight: 700, fontSize: 14 }}>{c.agent.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</Text></View>}
            <View style={{ flex: 1, paddingLeft: 9 }}>
              <Text style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1.2, color: GOLD_DEEP, textTransform: "uppercase" }}>Your consultant</Text>
              <Text style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, marginTop: 1 }}>{c.agent.name}</Text>
              <Text style={{ fontSize: 7, color: MUTED }}>{c.agent.role} · {c.company.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 }}>
                {c.agent.whatsapp ? <Text style={{ fontSize: 8, fontWeight: 600, color: INK, marginRight: 10 }}>WhatsApp {c.agent.whatsapp}</Text> : null}
                {c.agent.phone && c.agent.phone !== c.agent.whatsapp ? <Text style={{ fontSize: 8, color: BODY, marginRight: 10 }}>Call {c.agent.phone}</Text> : null}
                {c.agent.email ? <Text style={{ fontSize: 8, color: BODY, marginRight: 10 }}>{c.agent.email}</Text> : null}
              </View>
              {c.agent.website ? <Text style={{ fontSize: 7, color: NAVY, marginTop: 1 }}>{c.agent.website.replace(/^https?:\/\//, "")}</Text> : null}
            </View>
            {images.qr ? (
              <View style={{ alignItems: "center", width: 66 }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                <Image src={{ data: images.qr, format: "png" }} style={{ width: 52, height: 52 }} />
                <Text style={{ fontSize: 5.6, color: MUTED, textAlign: "center", marginTop: 2 }}>{c.qr.caption}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Footer ── */}
        <View fixed style={{ position: "absolute", bottom: 12, left: 28, right: 28, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 4 }}>
          <Text style={{ fontSize: 6, color: FAINT, lineHeight: 1.4 }}>
            {[c.company.legalName, c.company.licence, c.company.phone, c.company.site].filter(Boolean).join(" · ")}. Prices, payment plans and handover dates as shown on fhiglobal.ae on {c.generatedOn}; they can change without notice and this sheet is for information only. {n} project{n === 1 ? "" : "s"}: {c.projects.map((p) => p.page.replace(/^https?:\/\//, "")).join(" · ")}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
