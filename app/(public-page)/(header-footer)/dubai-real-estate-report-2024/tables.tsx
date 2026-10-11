import { ArrowDownRight, ArrowUpRight } from "lucide-react"

/**
 * The data tables of /dubai-real-estate-report-2024. Every value is copied
 * from DLD's Dubai Real Estate Annual Report 2024 (report page in brackets);
 * the only arithmetic is the ×-multiples in the price table, labelled as ours.
 */

export type Cell = string | { v: string; tone?: "up" | "down" | "muted" | "strong"; bar?: number; sub?: string }
export type Row = { cells: Cell[]; total?: boolean } | { group: string }

function Change({ v, tone, dark = false }: { v: string; tone: "up" | "down"; dark?: boolean }) {
  const Icon = tone === "up" ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${tone === "up" ? (dark ? "text-[#7fe3a5]" : "text-[#0f7a4f]") : dark ? "text-[#ff9b91]" : "text-[#b3261e]"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {v}
    </span>
  )
}

function CellView({ c, first, dark = false }: { c: Cell; first: boolean; dark?: boolean }) {
  if (typeof c === "string") return <>{c}</>
  return (
    <span className="block">
      {c.tone === "up" || c.tone === "down" ? (
        <Change v={c.v} tone={c.tone} dark={dark} />
      ) : (
        <span className={c.tone === "muted" ? "text-[#9ca3af]" : c.tone === "strong" ? "font-bold text-[#0d1117]" : undefined}>{c.v}</span>
      )}
      {c.sub && <span className={`block text-[11px] font-normal ${dark ? "text-white/45" : "text-[#9ca3af]"} ${first ? "" : "mt-0.5"}`}>{c.sub}</span>}
      {c.bar != null && (
        <span className={`mt-1.5 block h-[3px] ${dark ? "bg-white/12" : "bg-[#eef0f3]"} ${first ? "" : "ml-auto"} w-full max-w-[120px]`} aria-hidden="true">
          <span className="wf-line block h-full bg-[#d6b357]" style={{ width: `${Math.max(3, c.bar * 100)}%` }} />
        </span>
      )}
    </span>
  )
}

/**
 * A square, hairline data table in the public theme: numbers right-aligned and
 * tabular, the first column sticks on phones while the rest scrolls inside the
 * box (the page itself never scrolls sideways).
 */
export function DataTable({
  caption,
  head,
  rows,
  note,
  minWidth = 0,
  dark = false,
}: {
  caption: string
  head: string[]
  rows: Row[]
  note?: string
  minWidth?: number
  dark?: boolean
}) {
  const border = dark ? "border-white/12" : "border-[#e5e8ec]"
  const rowBorder = dark ? "border-white/10" : "border-[#eef0f3]"
  // One solid colour for the box and the sticky first column, so it never shows as a darker strip.
  const firstBg = dark ? "bg-[#0b1d31]" : "bg-white"
  return (
    <figure className="wf-fade min-w-0" style={{ ["--d" as string]: "250ms" }}>
      {minWidth > 0 && (
        <p className={`mb-2 text-right text-[11px] font-semibold sm:hidden ${dark ? "text-white/45" : "text-[#9ca3af]"}`}>Swipe to see all columns →</p>
      )}
      <div className={`max-w-full overflow-x-auto border ${border} ${firstBg}`}>
        <table className="w-full border-collapse text-left text-[13px] sm:text-[13.5px]" style={minWidth > 0 ? { minWidth } : undefined}>
          <caption className={`border-b ${border} px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? "text-white/55" : "text-[#9ca3af]"} sm:px-5`}>
            {caption}
          </caption>
          <thead>
            <tr className={`border-b ${border}`}>
              {head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] sm:px-5 ${dark ? "text-[#f0d89b]" : "text-[#b8913f]"} ${i === 0 ? `sticky left-0 z-[1] ${firstBg} text-left` : "text-right"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) =>
              "group" in r ? (
                <tr key={`g${ri}`} className={`border-b ${rowBorder}`}>
                  <th
                    colSpan={head.length}
                    scope="colgroup"
                    className={`px-3 pb-2 pt-4 text-left text-[11px] font-bold uppercase tracking-[0.14em] sm:px-5 ${dark ? "text-white/45" : "text-[#6b7280]"}`}
                  >
                    {r.group}
                  </th>
                </tr>
              ) : (
                <tr
                  key={`r${ri}`}
                  className={`border-b ${rowBorder} last:border-b-0 transition-colors ${dark ? "hover:bg-white/[0.04]" : "hover:bg-[#fafbfc]"} ${r.total ? (dark ? "bg-[#112842]" : "bg-[#faf7ee]") : ""}`}
                >
                  {r.cells.map((c, ci) =>
                    ci === 0 ? (
                      <th
                        key={ci}
                        scope="row"
                        className={`sticky left-0 z-[1] px-3 py-3 text-left font-semibold sm:px-5 ${r.total ? (dark ? "bg-[#112842]" : "bg-[#faf7ee]") : firstBg} ${dark ? "text-white" : "text-[#0d1117]"}`}
                      >
                        <CellView c={c} first dark={dark} />
                      </th>
                    ) : (
                      <td key={ci} className={`px-3 py-3 text-right tabular-nums sm:px-5 ${r.total ? "font-bold" : ""} ${dark ? "text-white/85" : "text-[#374151]"}`}>
                        <CellView c={c} first={false} dark={dark} />
                      </td>
                    ),
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {note && <figcaption className={`mt-2.5 text-[12px] leading-relaxed ${dark ? "text-white/45" : "text-[#9ca3af]"}`}>{note}</figcaption>}
    </figure>
  )
}

const up = (v: string): Cell => ({ v, tone: "up" })
const down = (v: string): Cell => ({ v, tone: "down" })

// ─── 01 · transactions, 2024 vs 2023, AED bn (pp. 11–16) ────────────────────
export const TRANSACTIONS_TABLE: Row[] = [
  { group: "By property type" },
  { cells: ["Apartments & units", "231.88", "318.18", up("37.2%")] },
  { cells: ["Land", "253.09", "234.56", down("7.3%")] },
  { cells: ["Villas", "93.76", "126.32", up("34.7%")] },
  { cells: ["Whole buildings", "53.40", "81.94", up("53.5%")] },
  { cells: ["All transactions", "632.13", "760.99", up("20.4%")], total: true },
  { group: "Ready, off-plan or land" },
  { cells: ["Ready (existing)", "218.56", "295.82", up("35.4%")] },
  { cells: ["Off-plan", "160.48", "230.61", up("43.7%")] },
  { cells: ["Vacant land", "253.09", "234.56", down("7.3%")] },
  { group: "By kind of transaction" },
  { cells: ["Sales", "410.2", "522.4", up("27.4%")] },
  { cells: ["Mortgages", "189.6", "187.3", down("1.2%")] },
  { cells: ["Gifts (within families)", "32.3", "51.3", up("59.0%")] },
]

// ─── 02 · price per sq m by usage, 2007 vs 2024 (pp. 19–20) ─────────────────
export const PRICE_USAGE_TABLE: Row[] = [
  { group: "Residential" },
  { cells: ["Apartments", "6,922", "19,138", { v: "×2.8", tone: "strong" }] },
  { cells: ["Villas", "3,577", "14,617", { v: "×4.1", tone: "strong" }] },
  { group: "Commercial" },
  { cells: ["Offices & retail units", "10,870", "18,566", { v: "×1.7", tone: "strong" }] },
  { cells: ["Commercial villas", "5,728", "14,100", { v: "×2.5", tone: "strong" }] },
]

// ─── 03 · investment performance by segment (pp. 22–25) ─────────────────────
const seg = (v: string, ch: string): Cell => ({ v, sub: ch })
export const SEGMENTS_TABLE: Row[] = [
  { cells: ["Apartments & units", seg("AED 269.6bn", "+32%"), seg("128K", "+47%"), seg("55K", "+50%"), seg("91.2K", "+53%"), seg("36.8K", "+57%")] },
  { cells: ["Villas", seg("AED 89.2bn", "+35%"), seg("22.3K", "+26%"), seg("3.5K", "+54%"), seg("12.1K", "+20%"), seg("10.2K", "+34%")] },
  { cells: ["Ready (existing)", seg("AED 297.5bn", "+18%"), seg("67.1K", "+16%"), seg("11.5K", "+1%"), seg("41.8K", "+10%"), seg("25.4K", "+27%")] },
  { cells: [{ v: "Off-plan", tone: "strong" }, seg("AED 227.5bn", "+43%"), seg("98.5K", "+64%"), seg("50.5K", "+62%"), seg("69.8K", "+61%"), seg("28.8K", "+72%")], total: true },
]

// ─── 03 · new vs repeat investors (pp. 41–42) ───────────────────────────────
export const INVESTOR_TYPES_TABLE: Row[] = [
  { cells: ["First-time investors", "108,451", up("37.8%"), "AED 266.7bn", "69%", "50.8%"] },
  { cells: ["Repeat investors", "49,587", up("47.9%"), "AED 258.3bn", "31%", "49.2%"] },
]

// ─── 04 · top 20 communities by extra investment vs 2023 (pp. 27–28) ────────
// Value uplift from the report's top-20 chart (AED bn); buyer uplift from its
// top-20 investor chart — "—" where a community is only on the value chart.
const COMMUNITIES: Array<[string, number, string, string?]> = [
  ["Madinat Al Mataar", 11.7, "4,726", "Airport district"],
  ["Bukadra", 10.7, "4,354"],
  ["Wadi Al Safa 5", 10.6, "4,423"],
  ["Dubai Investment Park Second", 9.3, "1,718"],
  ["Wadi Al Safa 7", 8.7, "1,834"],
  ["Business Bay", 8.5, "2,265"],
  ["Palm Deira", 7.9, "1,422"],
  ["Madinat Dubai Almelaheyah", 6.9, "3,249"],
  ["Al Yufrah 1", 6.8, "1,429"],
  ["Ras Al Khor Industrial First", 6.5, "2,638"],
  ["Hadaeq Sheikh Mohammed Bin Rashid", 6.3, "1,696", "MBR City"],
  ["Madinat Hind 4", 6.3, "3,668"],
  ["Al Barsha South Fourth", 5.3, "2,918"],
  ["Me'Aisem Second", 5.0, "—"],
  ["Al Yelayiss 1", 4.5, "—"],
  ["Zaabeel First", 3.9, "1,261"],
  ["Jabal Ali First", 3.6, "2,780"],
  ["Nad Al Shiba First", 3.0, "—"],
  ["Al Barsha South Second", 3.0, "1,716"],
  ["Wadi Al Safa 4", 2.9, "1,604"],
]
const communityRow = ([name, value, buyers, hint]: (typeof COMMUNITIES)[number], i: number): Row => ({
  cells: [
    { v: `${String(i + 1).padStart(2, "0")}  ${name}`, sub: hint },
    { v: `+AED ${value.toFixed(1)}bn`, bar: value / COMMUNITIES[0][1] },
    buyers === "—" ? { v: "—", tone: "muted" } : `+${buyers}`,
  ],
})
export const COMMUNITIES_TOP: Row[] = COMMUNITIES.slice(0, 10).map(communityRow)
export const COMMUNITIES_REST: Row[] = COMMUNITIES.slice(10).map((c, i) => communityRow(c, i + 10))

// ─── 05 · realised profits 2021–2024, AED bn (pp. 35–40) ────────────────────
export const PROFITS_TABLE: Row[] = [
  { cells: [{ v: "Bought ready, sold on", sub: "Best entry year: 2021 (AED 13.97bn)" }, "24.76", "8.77", { v: "33.54", tone: "strong" }] },
  { cells: [{ v: "Bought off-plan, sold after handover", sub: "Apartments out-earned villas 2.5 to 1" }, "1.96", "4.95", { v: "6.91", tone: "strong" }] },
  { cells: [{ v: "Off-plan resales", sub: "During construction or on delivery · best entry year 2022 (AED 2.37bn)" }, "1.85", "3.99", { v: "5.85", tone: "strong" }] },
]

// ─── 06 · luxury price per sq m, 2024 (pp. 49, 51) ──────────────────────────
export const LUXURY_APARTMENTS_TABLE: Row[] = [
  { cells: ["Island 2", { v: "113,550", bar: 1 }] },
  { cells: ["Me'Aisem First", { v: "99,524", bar: 99524 / 113550 }] },
  { cells: ["Nad Al Shiba 1", { v: "54,706", bar: 54706 / 113550 }] },
  { cells: ["Jumeirah Second", { v: "53,160", bar: 53160 / 113550 }] },
  { cells: ["Marsa Dubai (Dubai Marina)", { v: "49,905", bar: 49905 / 113550 }] },
]
export const LUXURY_VILLAS_TABLE: Row[] = [
  { cells: ["Island 2", { v: "71,411", bar: 1 }] },
  { cells: ["Palm Jumeirah", { v: "50,158", bar: 50158 / 71411 }] },
  { cells: ["Jumeirah First", { v: "32,747", bar: 32747 / 71411 }] },
  { cells: ["Me'Aisem First", { v: "28,383", bar: 28383 / 71411 }] },
  { cells: ["Wadi Al Safa 3", { v: "28,351", bar: 28351 / 71411 }] },
]

// ─── 06 · rents per sq ft and top rental communities (pp. 57–59) ────────────
export const RENTS_TABLE: Row[] = [
  { group: "Average rent · AED per sq ft" },
  { cells: ["Residential villas", "37.3", "44.6", up("19.6%")] },
  { cells: ["Commercial villas", "23.2", "22.8", down("1.7%")] },
  { cells: ["Residential apartments", "95.2", "77.3", down("18.8%")] },
  { cells: ["Offices & retail units", "156.7", "170.4", up("8.7%")] },
]
export const RENT_COMMUNITIES_TABLE: Row[] = [
  { cells: ["Business Bay", "AED 3.54bn", up("23.4%")] },
  { cells: ["Burj Khalifa (Downtown)", "AED 3.45bn", up("16.4%")] },
  { cells: ["Marsa Dubai (Dubai Marina)", "AED 3.40bn", up("2.2%")] },
  { cells: ["Al Thanyah Fifth", "AED 2.23bn", up("13.1%")] },
  { cells: ["Al Barsha First", "AED 2.11bn", up("4.5%")] },
]
