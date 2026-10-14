import { ImageResponse } from "next/og"
import { rankSellers, type MyTeamResponse } from "@/lib/my-team"
import { ogJpeg, ogPicture } from "@/lib/og-picture"

/**
 * The "Top Sellers" poster for My Team (boss via Juliecor, 2026-10-14): a
 * 1080×1350 picture (the portrait size Facebook, Instagram and WhatsApp show
 * uncropped) — the team's logo, the period, a podium of the top three with
 * photos, the next two, and the team total. Ranked by rankSellers(), the same
 * rule as the page's podium. The caller (app/api/my-team/share-image) decides
 * whose team may be drawn; every response here is `private, no-store`.
 */

const W = 1080
const H = 1350
const PRIVATE = { "cache-control": "private, no-store" }

const NAVY = "#001f3f"
const GOLD = "#d6b357"
const GOLD_SOFT = "#f0d89b"
const METALS = [
  { ring: "#d6b357", plinth: "linear-gradient(180deg, #ecd48e 0%, #c9a449 100%)", num: "#ffffff", h: 150 },
  { ring: "#c5ccd6", plinth: "linear-gradient(180deg, #eef1f5 0%, #b9c2cf 100%)", num: "#5c6b7a", h: 110 },
  { ring: "#d9b48f", plinth: "linear-gradient(180deg, #ecc9a4 0%, #b98250 100%)", num: "#ffffff", h: 80 },
]

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")

/** Outfit from the site's own /public/fonts (the certificate renderer's files), cached per process. */
const assetCache = new Map<string, Promise<ArrayBuffer>>()
function asset(url: string): Promise<ArrayBuffer> {
  let p = assetCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    p.catch(() => assetCache.delete(url))
    assetCache.set(url, p)
  }
  return p
}

function Face({ src, name, size, ring }: { src: string | null; name: string; size: number; ring: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size / 2, border: `${Math.round(size / 26)}px solid ${ring}`, objectFit: "cover" }} />
  ) : (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size / 2, border: `${Math.round(size / 26)}px solid ${ring}`, background: "#0b3a68", color: "#ffffff", fontSize: Math.round(size / 2.8), fontWeight: 700 }}>
      {initials(name) || "?"}
    </div>
  )
}

export async function renderTopSellersImage({ team, from, to, label, amounts, origin }: { team: MyTeamResponse; from: string | null; to: string | null; label: string; amounts: boolean; origin: string }): Promise<Response> {
  const ranked = rankSellers(team, from, to)
  const top = ranked.slice(0, 5)
  const totalValue = ranked.reduce((a, r) => a + r.value, 0)
  const totalDeals = team.sales.filter((s) => s.status === "validated" && (!from || s.date >= from) && (!to || s.date < to)).length

  const [regular, semibold, bold, fhiLogo, teamLogo, ...faces] = await Promise.all([
    asset(`${origin}/fonts/Outfit-400.woff`),
    asset(`${origin}/fonts/Outfit-600.woff`),
    asset(`${origin}/fonts/Outfit-700.woff`),
    asset(`${origin}/FHI_Branding_White.png`).then((b) => `data:image/png;base64,${Buffer.from(b).toString("base64")}`).catch(() => null),
    ogPicture(team.team?.logo, 160, 160, "inside", "#ffffff"),
    ...top.map((r, i) => ogPicture(r.member.photo, i === 0 ? 420 : i < 3 ? 340 : 120, i === 0 ? 420 : i < 3 ? 340 : 120)),
  ])

  const teamName = team.team?.name ?? `${team.root.name}'s team`
  const podium = [1, 0, 2].map((rank) => (top[rank] ? { rank, r: top[rank], face: faces[rank] ?? null } : null))
  const rest = top.slice(3).map((r, i) => ({ rank: i + 4, r, face: faces[i + 3] ?? null }))

  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", paddingBottom: 158, background: NAVY, color: "#ffffff", fontFamily: "Outfit", overflow: "hidden" }}>
        {/* Glow and rings */}
        <div style={{ position: "absolute", top: -420, left: -380, width: 1100, height: 1100, borderRadius: 550, backgroundImage: "radial-gradient(circle, rgba(214,179,87,0.26) 0%, rgba(214,179,87,0) 62%)" }} />
        <div style={{ position: "absolute", bottom: -460, right: -420, width: 1100, height: 1100, borderRadius: 550, backgroundImage: "radial-gradient(circle, rgba(111,141,179,0.30) 0%, rgba(111,141,179,0) 62%)" }} />
        <div style={{ position: "absolute", top: -260, right: -220, width: 620, height: 620, borderRadius: 310, border: "2px solid rgba(214,179,87,0.22)" }} />
        <div style={{ position: "absolute", top: -170, right: -110, width: 620, height: 620, borderRadius: 310, border: "2px solid rgba(214,179,87,0.12)" }} />

        {/* Header: the team brand, FHI on the right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "60px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {teamLogo ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 108, height: 108, borderRadius: 54, background: "#ffffff", border: `4px solid ${GOLD}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={teamLogo} alt="" width={78} height={78} style={{ width: 78, height: 78, objectFit: "contain" }} />
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: teamLogo ? 26 : 0 }}>
              <div style={{ display: "flex", fontSize: 42, fontWeight: 700, lineHeight: 1.1 }}>{clip(teamName, 26)}</div>
              <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.62)", marginTop: 6 }}>{clip(`Led by ${team.root.name}`, 40)}</div>
            </div>
          </div>
          {fhiLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fhiLogo} alt="" width={163} height={60} style={{ width: 163, height: 60, objectFit: "contain", opacity: 0.9 }} />
          ) : null}
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 64, height: 3, background: GOLD }} />
            <div style={{ display: "flex", marginLeft: 18, fontSize: 28, fontWeight: 700, letterSpacing: 10, color: GOLD_SOFT }}>TOP SELLERS</div>
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -2 }}>{label}</div>
        </div>

        {/* Podium — the free space goes above it, so it always stands on the footer */}
        <div style={{ display: "flex", flex: 1 }} />
        {podium.some(Boolean) ? (
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "36px 52px 0" }}>
            {podium.map((p, slot) => {
              if (!p) return <div key={slot} style={{ display: "flex", width: 312 }} />
              const m = METALS[p.rank]
              const size = p.rank === 0 ? 210 : 164
              return (
                <div key={slot} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 312, margin: "0 6px" }}>
                  <Face src={p.face} name={p.r.member.name} size={size} ring={m.ring} />
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", textAlign: "center", marginTop: 18, fontSize: 28, fontWeight: 700, lineHeight: 1.15, height: 66, width: 290 }}>{clip(p.r.member.name, 34)}</div>
                  <div style={{ display: "flex", marginTop: 4, fontSize: amounts ? 32 : 36, fontWeight: 700, color: p.rank === 0 ? GOLD_SOFT : "#ffffff" }}>
                    {amounts ? aed(p.r.value) : `${p.r.deals} deal${p.r.deals === 1 ? "" : "s"}`}
                  </div>
                  <div style={{ display: "flex", marginTop: 2, fontSize: 22, color: "rgba(255,255,255,0.58)" }}>{amounts ? `${p.r.deals} deal${p.r.deals === 1 ? "" : "s"}` : " "}</div>
                  <div style={{ display: "flex", justifyContent: "center", width: 300, height: m.h, marginTop: 18, borderRadius: "18px 18px 0 0", backgroundImage: m.plinth }}>
                    <div style={{ display: "flex", marginTop: 10, fontSize: 64, fontWeight: 700, color: m.num, lineHeight: 1 }}>{String(p.rank + 1)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: "flex", padding: "0 64px 260px", fontSize: 36, color: "rgba(255,255,255,0.7)" }}>No validated sales in this period yet.</div>
        )}

        {/* Ranks 4 and 5 */}
        {rest.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", margin: "0 58px", padding: "10px 30px", borderRadius: 24, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
            {rest.map(({ rank, r, face }, i) => (
              <div key={rank} style={{ display: "flex", alignItems: "center", height: 84, borderTop: i ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(255,255,255,0)" }}>
                <div style={{ display: "flex", width: 48, fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.40)" }}>{String(rank)}</div>
                <Face src={face} name={r.member.name} size={58} ring="rgba(255,255,255,0.25)" />
                <div style={{ display: "flex", flex: 1, marginLeft: 20, fontSize: 28, fontWeight: 600 }}>{clip(r.member.name, 30)}</div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{amounts ? aed(r.value) : `${r.deals} deal${r.deals === 1 ? "" : "s"}`}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer: the team total and the site */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 118, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px", background: "rgba(0,0,0,0.28)", borderTop: `3px solid ${GOLD}` }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 5, color: "rgba(255,255,255,0.55)" }}>TEAM TOTAL</div>
            <div style={{ display: "flex", marginTop: 4, fontSize: 34, fontWeight: 700 }}>
              {amounts ? `AED ${short(totalValue)} · ${totalDeals} deal${totalDeals === 1 ? "" : "s"}` : `${totalDeals} deal${totalDeals === 1 ? "" : "s"} · ${ranked.length} seller${ranked.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: GOLD_SOFT }}>fhiglobal.ae</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: PRIVATE,
      fonts: [
        { name: "Outfit", data: regular, weight: 400, style: "normal" },
        { name: "Outfit", data: semibold, weight: 600, style: "normal" },
        { name: "Outfit", data: bold, weight: 700, style: "normal" },
      ],
    },
  )
  // ogJpeg's PNG fallback sets a public short cache — this picture is private either way.
  const out = await ogJpeg(res, 88)
  out.headers.set("cache-control", PRIVATE["cache-control"])
  return out
}
