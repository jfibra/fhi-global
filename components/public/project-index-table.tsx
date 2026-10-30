import Link from "next/link"
import { formatProjectPrice } from "@/components/project-card"
import { normalizeCommunity } from "@/lib/communities"
import { EMIRATES, emirateCodeForCity } from "@/lib/emirates"
import { handoverDisplay, handoverLabel, isHandoverOverdue, statusLabel } from "@/lib/project-seo"
import { projectFloorPrice, type SeoGridRow } from "@/lib/seo-inventory"

/**
 * The full list behind a catalogue page as one real <table> (boss via Juliecor, 2026-10-30):
 * every project the page's filter matches — not only the 24 cards — with developer, area,
 * price, handover, status and the day it was listed. Search Console showed the "new projects"
 * pages earning thousands of impressions on page 3: a page that answers "which projects, and
 * what's new?" with a dated, complete list is what ranks for that search, and a crawler reads
 * each project here as a row instead of a card it never scrolled to. Server-rendered, no
 * script. The price follows the page's own "Starting From" rule (never a headline below the
 * cheapest real unit); the handover is the stated quarter, or "under review" once it has passed.
 */

const DUBAI = "Asia/Dubai"

/** "12 Oct 2026" — the day a project was listed, in Dubai time. */
export function listedOn(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: DUBAI })
}

/** "30 October 2026" — the date the page was built, in Dubai time. */
export function builtOn(now: Date): string {
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: DUBAI })
}

/** "2026-10" — the Dubai-time month of a timestamp (null when it is blank or unreadable). */
export function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA", { timeZone: DUBAI }).slice(0, 7)
}

/** "2026-10" and "October" for the month the page is built in, in Dubai time. */
export function currentMonth(now: Date): { key: string; name: string } {
  return {
    key: monthKey(now.toISOString()) as string,
    name: now.toLocaleDateString("en-GB", { month: "long", timeZone: DUBAI }),
  }
}

/** The project's page — the developer route, or the generic one for a project whose developer has no slug (as the card does). */
export function projectHref(p: Pick<SeoGridRow, "slug" | "developers">): string {
  return p.developers?.slug ? `/${p.developers.slug}/${p.slug}` : `/projects/${p.slug}`
}

/** Community first, then the freer location text, then the city — the card's rule. */
export function areaOf(p: SeoGridRow): string | null {
  return [normalizeCommunity(p.community), p.location, p.city].map((v) => v?.trim()).find(Boolean) ?? null
}

const byNewest = (a: SeoGridRow, b: SeoGridRow) => (b.published_at ?? "").localeCompare(a.published_at ?? "")

/**
 * One paragraph for the Recently added block, written from the data at every build: which projects joined
 * this month and what they cost — fresh, specific text on the pages that already earn the impressions, with
 * nobody writing it by hand. It says so plainly when nothing was added, rather than inventing news.
 */
export function launchSummary(rows: readonly SeoGridRow[], now: Date): string {
  const month = currentMonth(now)
  const year = now.toLocaleDateString("en-GB", { year: "numeric", timeZone: DUBAI })
  const added = rows.filter((p) => monthKey(p.published_at) === month.key).sort(byNewest)
  if (added.length === 0) {
    const latest = rows.filter((p) => p.published_at).sort(byNewest)[0]
    const when = latest ? new Date(latest.published_at as string).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: DUBAI }) : null
    return `No projects joined this list in ${month.name} ${year}${when ? `; the latest additions date from ${when}` : ""}.`
  }
  const describe = (p: SeoGridRow) => {
    const floor = projectFloorPrice(p)
    const handover = isHandoverOverdue(p, now) ? null : handoverLabel(p)
    const facts = [
      p.developers?.name,
      areaOf(p),
      floor != null ? `from ${formatProjectPrice(floor, (p.currency ?? "AED").toUpperCase())}` : null,
      handover ? `handover ${handover}` : null,
    ].filter(Boolean)
    return facts.length ? `${p.name} (${facts.join(", ")})` : p.name
  }
  const lead = added.slice(0, 3).map(describe)
  const leadText = lead.length === 1 ? lead[0] : lead.length === 2 ? `${lead[0]} and ${lead[1]}` : `${lead[0]}, ${lead[1]} and ${lead[2]}`
  const floors = added.map(projectFloorPrice).filter((n): n is number => n != null)
  const range =
    floors.length >= 2 && Math.min(...floors) !== Math.max(...floors)
      ? ` Starting prices among the month's additions run from ${formatProjectPrice(Math.min(...floors))} to ${formatProjectPrice(Math.max(...floors))}.`
      : ""
  const n = added.length
  return `In ${month.name} ${year}, ${n} ${n === 1 ? "project" : "projects"} joined this list${n > 3 ? ` — led by ${leadText}` : `: ${leadText}`}.${range}`
}

function emirateOf(p: SeoGridRow): string | null {
  const code = emirateCodeForCity(p.city)
  return EMIRATES.find((e) => e.code === code)?.name ?? null
}

// The list scrolls inside a bounded box (a 346-row hub would otherwise add 20,000 px to a phone page); the
// header row and the project column stay put while it scrolls. Every row is still in the HTML.
const TH = "sticky top-0 z-[2] bg-[#f7f8fa] px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] shadow-[inset_0_-1px_0_#e8eaed]"
const TD = "px-3 py-2.5 align-top text-[#374151]"
/** The project column stays put while a phone scrolls the other columns sideways. */
const STICKY = "sticky left-0 z-[1] bg-white"

export function ProjectIndexTable({
  rows,
  caption,
  showEmirate = false,
  now,
}: {
  rows: readonly SeoGridRow[]
  caption: string
  /** A UAE-wide page says which emirate each row is in. */
  showEmirate?: boolean
  now: Date
}) {
  return (
    <figure>
      <div className="max-h-[75vh] overflow-auto border border-[#e8eaed] bg-white">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <caption className="border-b border-[#e8eaed] bg-[#f7f8fa] px-4 py-3 text-left font-['Outfit'] text-[15px] font-bold text-[#001f3f]">
            {caption}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={`${TH} left-0 z-[3]`}>Project</th>
              <th scope="col" className={TH}>Developer</th>
              {showEmirate && <th scope="col" className={TH}>Emirate</th>}
              <th scope="col" className={TH}>Area</th>
              <th scope="col" className={TH}>From</th>
              <th scope="col" className={TH}>Handover</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Listed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const floor = projectFloorPrice(p)
              return (
                <tr key={p.id} className="border-b border-[#eef0f3] last:border-b-0">
                  <th scope="row" className={`px-3 py-2.5 align-top font-semibold text-[#0d1117] ${STICKY}`}>
                    <Link href={projectHref(p)} className="hover:text-[#b8913f] transition-colors">
                      {p.name}
                    </Link>
                  </th>
                  <td className={TD}>
                    {p.developers?.slug ? (
                      <Link href={`/${p.developers.slug}`} className="hover:text-[#001f3f] transition-colors">
                        {p.developers.name}
                      </Link>
                    ) : (
                      p.developers?.name ?? "—"
                    )}
                  </td>
                  {showEmirate && <td className={TD}>{emirateOf(p) ?? "—"}</td>}
                  <td className={TD}>{areaOf(p) ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{floor != null ? formatProjectPrice(floor, (p.currency ?? "AED").toUpperCase()) : "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{handoverDisplay(p, now) ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{statusLabel(p.status)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{listedOn(p.published_at) ?? "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-xs text-[#6b7280]">
        From = the lowest price currently on sale in the project · Listed = the day the project joined FHI Global · As of {builtOn(now)}
      </figcaption>
    </figure>
  )
}
