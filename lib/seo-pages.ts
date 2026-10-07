/**
 * SEO landing pages — the "popular searches" pages the big Dubai portals rank
 * with (fhiglobal.ae/new-projects-in-dubai, fhiglobal.ae/dubai-marina, …).
 * Served by the root [slug] route: a slug is looked up as a developer first,
 * then here.
 *
 * Two kinds:
 *   "projects" — a curated intro over a live, server-rendered project grid.
 *                Backed by real inventory (120 published projects carry
 *                images); that's the entry ticket, because a landing page
 *                over an empty result set is a doorway page and drags the
 *                whole domain down.
 *   "guide"    — a static area/info page (Dubai Marina, Downtown, …): what
 *                the area is, who lives there, why people buy there. No
 *                database dependency, so these stand even while listing
 *                volume is small — but every guide's copy is written for its
 *                area specifically. Swapping the area name in boilerplate is
 *                the other kind of doorway page.
 *
 * The catalog is deliberately hand-curated constants, not a DB table: the
 * footer renders these links on every public page, and copy this central to
 * SEO should go through review, not appear the moment a row is inserted.
 * When listings volume grows, "apartments-for-sale-in-dubai-marina"-style
 * entries can join as a listings-backed kind.
 *
 * Optional page fields, by purpose:
 *   sort        — "newest" (newest ADDED first) or "handover" (soonest delivery first,
 *                 handovers already past last): the server-side order of a projects grid.
 *   layout      — "emirate-hub": a UAE-wide page grouped under one heading per emirate.
 *   guideType   — "buyer" for the process guides (Golden Visa, off-plan, costs, foreigners);
 *                 unset = an area guide.
 *   reviewer / reviewedAt / sources — a licensed person's review of a buyer guide. The
 *                 "Reviewed by" line, the Sources list and the WebPage + Article JSON-LD render
 *                 ONLY when reviewer AND reviewedAt are both set. Never put a placeholder or an
 *                 unlicensed name here, and bump reviewedAt on every human re-review.
 *   marketData  — a hand-entered, sourced, dated table for an area guide (the type forces the
 *                 source and the date) until DLD aggregates are wired in.
 *   sections[]  — a section may carry a one-sentence `answer` shown first in bold, `body` as one
 *                 string or several paragraphs, and a `table`.
 *
 * This module must stay import-free: the footer reads it on every public page, and the
 * catalogue can be audited with a one-line `node` import.
 */

export type SeoSource = { label: string; url: string }

/** A fact table rendered by SeoDataTable: real <table> semantics, optional source and date. */
export type SeoTable = {
  caption: string
  columns: string[]
  rows: string[][]
  source?: SeoSource
  asOf?: string
}

export type SeoSection = {
  heading: string
  /** One sentence that answers the heading outright — shown first, in bold. */
  answer?: string
  body: string | string[]
  table?: SeoTable
}

export type SeoReviewer = { name: string; role?: string; brn?: string }

export type SeoSort = "newest" | "handover"

export type SeoPageFilter = {
  /** Case-insensitive substring match on projects.city (values are messy —
   *  "Abu Dhabi " with a trailing space exists). Omit for portfolio-wide. */
  cityLike?: string
  /** projects.status values to include. Omit for all. */
  statuses?: string[]
  /** Case-insensitive substring match on the project's property_types.name
   *  ("apartment", "villa", …) via an inner join. */
  propertyTypeLike?: string
  /** Case-insensitive substring match on projects.location OR community —
   *  the area-inventory pages ("projects in JVC"). */
  locationLike?: string
  /** launch_price_from bounds in AED. priceMax pages also apply the realistic
   *  floor, so placeholder rows can't fill a "budget" page. */
  priceMin?: number
  priceMax?: number
  /** Handover year ("2027") — matches the delivery_quarter text or the
   *  expected_completion_date year. */
  handoverYear?: string
}

export type SeoPage = {
  /** Root-level URL segment: fhiglobal.ae/<slug> */
  slug: string
  /** Short link text, used in the footer and in related-searches rows. */
  label: string
  title: string
  h1: string
  description: string
  /** Intro paragraphs rendered under the H1 — real copy, crawlable. */
  intro: string[]
  kind: "projects" | "guide"
  /** projects kind: which projects fill the grid. */
  filter?: SeoPageFilter
  /** guide kind WITHOUT an inventoryFilter (the buyer guides): a neighbourhood word matched on
   *  projects.location/community to pick an illustrative portfolio photo. Area guides (with an
   *  inventoryFilter) take their photo from their own inventory; the Dubai pool is the last resort. */
  imageQuery?: string
  /** guide kind: which of our projects sit in this area. When at least three
   *  match, the guide renders a live stats strip and project grid — the area
   *  guides used to be the only pages on the site that showed no inventory and
   *  linked to no project, which left the project pages with almost no
   *  internal links. Guides whose area has fewer than three projects simply
   *  render without the block rather than fake a listing page. */
  inventoryFilter?: SeoPageFilter
  /** guide kind: the quick-facts strip. */
  facts?: { label: string; value: string }[]
  /** guide kind: heading over the facts strip (defaults to
   *  "Why invest in {label}" — info guides override it). */
  factsHeading?: string
  /** guide kind: body sections. */
  sections?: SeoSection[]
  /** Rendered as a visible FAQ block AND FAQPage structured data — the two
   *  must always carry the same wording. */
  faqs?: { q: string; a: string }[]
  /** Slugs from this catalog to cross-link at the bottom. */
  related: string[]
  /** YYYY-MM-DD this page's copy last changed in a way worth re-crawling. Feeds the
   *  sitemap <lastmod> only — set it when the copy is edited. Unset = no lastmod
   *  (an honest "unknown" beats a date that was never true). */
  updated?: string
  /** projects kind: server-side order of the grid. Unset = the inventory query's own order. */
  sort?: SeoSort
  /** projects kind: "emirate-hub" groups a UAE-wide grid under one heading per emirate. */
  layout?: "emirate-hub"
  /** guide kind: "buyer" = a process guide; unset = an area guide. */
  guideType?: "buyer"
  /** guide kind: who reviewed the copy, and when (YYYY-MM-DD) — see the header comment. */
  reviewer?: SeoReviewer
  reviewedAt?: string
  /** guide kind: the sources the copy rests on, listed under the guide. */
  sources?: SeoSource[]
  /** guide kind: a sourced, dated table of market figures for the area. */
  marketData?: SeoTable & { source: SeoSource; asOf: string }
}

// Non-UAE one-offs in the projects table (a project in Istanbul, one in
// Egypt's Mostakbal City). UAE-wide pages exclude them so the page's claim
// stays true.
export const NON_UAE_CITIES = ["istanbul", "mostakbal"]

// The handover-year pages (dubai-projects-handover-<year>) and every list that links them.
const HANDOVER_YEARS = ["2026", "2027", "2028", "2029", "2030"] as const
type HandoverYear = (typeof HANDOVER_YEARS)[number]

// `updated` for the pages whose title, description or copy was last rewritten together
// (the 2026-10-06 SEO pass) — feeds the sitemap <lastmod>. Bump a page's own `updated`
// when only that page changes.
const COPY_UPDATED = "2026-10-06"

// ─── Project-backed searches ─────────────────────────────────────────────────

const PROJECT_PAGES: SeoPage[] = [
  {
    slug: "new-projects-in-dubai",
    label: "New Projects in Dubai",
    title: "New Projects in Dubai — Latest Launches",
    updated: COPY_UPDATED,
    h1: "New Projects in Dubai",
    description:
      "Browse new and pre-launch residential projects in Dubai — launch prices and handover dates from developers like Samana, Azizi and Reportage.",
    intro: [
      "Dubai's developers release new communities every month, and launch week is when the best units and the friendliest payment plans are on the table. This page tracks the projects currently open for booking across Dubai — apartments, townhouses and branded residences — with launch pricing where the developer has published it.",
      "The newest additions are listed first. Every project below links to its full profile: location, gallery, price range and the developer behind it. If you want a shortlist matched to your budget instead, send us an enquiry and a consultant will come back the same business day.",
    ],
    kind: "projects",
    // Launches only, newest ADDED first (there is no launch-date column). This used to be every
    // Dubai project — the same grid as the off-plan page. If it ever falls under ~12 projects,
    // widen the statuses again.
    filter: { cityLike: "dubai", statuses: ["pre_launch", "launch"] },
    sort: "newest",
    faqs: [
      {
        q: "What is the minimum price for a new project in Dubai?",
        a: "Entry pricing changes with each launch, but studios and one-bedroom apartments in new Dubai communities regularly start between AED 500,000 and AED 800,000, with premium districts starting higher. Each project card on this page shows its current starting price.",
      },
      {
        q: "Do new launches come with payment plans?",
        a: "Almost always. Developers typically split the price into construction-linked instalments — a booking amount, staged payments during the build, and a final portion at or after handover. The exact split differs per project and is shown on each project page.",
      },
      {
        q: "Can I buy a new project in Dubai from abroad?",
        a: "Yes. Foreign buyers can own property 100% in Dubai's designated freehold zones, and the reservation, contract and payments can all be completed remotely. Our consultants handle the process end to end.",
      },
    ],
    related: [
      "off-plan-projects-in-dubai",
      "apartments-for-sale-in-dubai",
      "properties-under-1m-in-dubai",
      "new-projects-in-abu-dhabi",
    ],
  },
  {
    slug: "off-plan-projects-in-dubai",
    label: "Off-Plan Projects in Dubai",
    title: "Off-Plan Projects in Dubai — Prices & Handover",
    updated: COPY_UPDATED,
    h1: "Off-Plan Projects in Dubai",
    description:
      "Off-plan property in Dubai: current launches and under-construction projects with developer starting prices, construction status and handover timelines.",
    intro: [
      "Off-plan is how most investors enter the Dubai market: you buy at today's price on a construction-linked payment plan, and the developer carries the build. The projects below are at launch or under construction right now, which is where the widest unit choice and the longest plans are found.",
      "Projects are ordered by handover date, soonest first. FHI Global works directly with the developers, so the prices and plans you see on each project page are the developer's own — no mark-up, and our consultation costs you nothing.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", statuses: ["launch", "under_construction"] },
    sort: "handover",
    faqs: [
      {
        q: "Is buying off-plan in Dubai safe?",
        a: "Off-plan payments in Dubai are protected by RERA-regulated escrow accounts: your instalments go into a project-specific account the developer can only draw from as construction milestones are certified. Buying from established, RERA-registered developers adds a further layer of security.",
      },
      {
        q: "How much do I need to book an off-plan property?",
        a: "Most Dubai launches ask for a booking amount of 5–20% of the price, followed by construction-linked instalments. The 4% DLD registration fee is usually due around contract signing.",
      },
      {
        q: "Can I sell an off-plan property before handover?",
        a: "Yes — this is called an assignment or resale. Most developers allow it once a set percentage of the price (commonly 30–40%) has been paid, subject to their NOC.",
      },
    ],
    // The topical hub for the handover-year pages.
    related: [
      "new-projects-in-dubai",
      "how-to-buy-off-plan-property-in-dubai",
      "off-plan-projects-in-uae",
      "ready-properties-in-dubai",
      ...HANDOVER_YEARS.map((y) => `dubai-projects-handover-${y}`),
    ],
  },
  {
    slug: "ready-properties-in-dubai",
    label: "Ready Properties in Dubai",
    title: "Ready Properties in Dubai — Completed Projects",
    updated: COPY_UPDATED,
    h1: "Ready Properties in Dubai",
    description:
      "Completed, handed-over projects in Dubai — move in or rent out immediately. Compare ready communities and current availability with FHI Global.",
    intro: [
      "Ready property trades certainty for the discount of off-plan: what you view is what you get, and it can be lived in — or earning rent — from day one. These Dubai projects are completed and handed over, with resale and developer stock moving through them.",
      "If you're weighing ready against off-plan, the honest answer is it depends on your horizon; ask us and we'll run both numbers for your budget.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", statuses: ["completed"] },
    faqs: [
      {
        q: "What are the extra costs when buying a ready property in Dubai?",
        a: "Budget roughly 6–8% on top of the price: the 4% DLD transfer fee, trustee office fee, agent commission (typically 2% + VAT), and mortgage fees if you finance. Dubai has no annual property tax.",
      },
      {
        q: "How fast can a ready property purchase complete?",
        a: "A cash purchase of a ready unit can complete in as little as one to two weeks once terms are agreed; mortgage purchases usually take four to eight weeks including valuation and bank approvals.",
      },
      {
        q: "Ready or off-plan — which is the better investment?",
        a: "Ready property earns rent from day one and carries no construction risk; off-plan usually enters cheaper with a staged payment plan. The right answer depends on your horizon and cash flow — our consultants run both numbers side by side for free.",
      },
    ],
    related: [
      "new-projects-in-dubai",
      "off-plan-projects-in-dubai",
      "dubai-property-buying-costs",
      "new-projects-in-uae",
    ],
  },
  {
    slug: "new-projects-in-abu-dhabi",
    label: "New Projects in Abu Dhabi",
    title: "New Projects in Abu Dhabi — Launches & Prices",
    updated: COPY_UPDATED,
    h1: "New Projects in Abu Dhabi",
    description:
      "New residential projects in Abu Dhabi — current launches with developer pricing and handover dates, from Reportage and other active developers.",
    intro: [
      "Abu Dhabi's market runs quieter than Dubai's, and that's precisely its appeal: entry prices are lower, service charges gentler, and communities like Al Reem and Masdar keep delivering steady rental demand. These are the projects currently selling in the capital.",
      "Each card opens the full project profile — location, gallery, price range and developer. For a side-by-side with comparable Dubai launches, our consultants do that daily.",
    ],
    kind: "projects",
    filter: { cityLike: "abu dhabi" },
    related: ["new-projects-in-uae", "new-projects-in-dubai", "off-plan-projects-in-uae"],
  },
  {
    slug: "off-plan-projects-in-uae",
    label: "Off-Plan Projects in UAE",
    title: "Off-Plan Projects in the UAE — By Emirate",
    updated: COPY_UPDATED,
    h1: "Off-Plan Projects in the UAE",
    description:
      "Off-plan projects across the UAE by emirate — launches and under-construction communities in Dubai, Abu Dhabi and beyond, with starting prices.",
    intro: [
      "This is the wide view: every launch and under-construction project on our books across the Emirates, grouped by emirate. Start with the emirate you are weighing, open its full list, then drill into a project page for the plan.",
      "Inventory updates as developers release phases, so this page is worth a bookmark if you're timing an entry.",
    ],
    kind: "projects",
    filter: { statuses: ["launch", "under_construction"] },
    layout: "emirate-hub",
    related: ["off-plan-projects-in-dubai", "new-projects-in-dubai", "new-projects-in-abu-dhabi"],
  },
  {
    slug: "new-projects-in-uae",
    label: "New Projects in UAE",
    title: "New Projects in the UAE — Every Emirate",
    updated: COPY_UPDATED,
    h1: "New Projects in the UAE",
    description:
      "The full FHI Global portfolio across the UAE, by emirate — new launches, under-construction and ready communities from every developer we work with.",
    intro: [
      "Everything we cover, grouped by emirate: launches, projects mid-build and completed communities across Dubai, Abu Dhabi and the northern emirates. Start here if you're mapping the market before narrowing down.",
      "For a filtered view — by developer, by status, by price band — the projects browser has the full controls.",
    ],
    kind: "projects",
    filter: {},
    layout: "emirate-hub",
    related: ["new-projects-in-dubai", "new-projects-in-abu-dhabi", "off-plan-projects-in-uae"],
  },
]

// ─── Dubai area guides ───────────────────────────────────────────────────────
// Static info pages, competitor-style ("Buy Properties in Dubai Marina" links
// on the big portals land on pages like these). Each one is written for its
// area — the facts and the trade-offs differ, and that difference is what
// makes them index-worthy rather than doorway spam.

const AREA_GUIDES: SeoPage[] = [
  {
    slug: "dubai-marina",
    imageQuery: "marina",
    label: "Dubai Marina",
    title: "Dubai Marina Area Guide — Living & Buying",
    updated: COPY_UPDATED,
    h1: "Dubai Marina",
    description:
      "Dubai Marina area guide: waterfront high-rise living, rental demand, and what to know before buying or renting an apartment on the Marina.",
    intro: [
      "Dubai Marina is the city's postcard: a three-kilometre man-made marina ringed by residential towers, with the promenade, the yachts and JBR beach a walk away. It is one of the most liquid apartment markets in Dubai — units trade often, tenants queue year-round, and the tram and two Metro stations carry the commute.",
      "The area is fully built out, so buying here means resale stock in established towers rather than off-plan. That cuts both ways: no construction risk and immediate rent, but the building's age and service charges deserve a closer look than the view does.",
      "The Marina's tenant pool is also the deepest in the city — airline crews, consultants, remote founders — and it renews itself every hiring season. For owners that means pricing power in furnished units and short vacancy windows; for residents, a district that never quite sleeps, with padel courts, yacht charters and a seven-kilometre running loop built into daily life.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "marina" },
    facts: [
      { label: "Property mix", value: "High-rise apartments, penthouses, a handful of villas on the water" },
      { label: "Who it suits", value: "Professionals, investors chasing rental yield, weekend-lifestyle buyers" },
      { label: "Getting around", value: "Dubai Tram, DMCC & Sobha Realty Metro stations, Sheikh Zayed Road" },
      { label: "Character", value: "Dense, walkable, waterfront — restaurants and nightlife at street level" },
      { label: "Investment angle", value: "Deep tenant demand and strong furnished/short-let performance keep yields near the top of established Dubai" },
      { label: "Lifestyle & amenities", value: "Marina Walk dining, JBR beach on foot, yacht berths and a seven-kilometre waterfront loop" },
    ],
    sections: [
      {
        heading: "Living in Dubai Marina",
        body: "Day to day, the Marina runs on its promenade: groceries, gyms, cafes and school buses all operate at podium level, and JBR's beach is ten minutes on foot from most towers. Traffic in and out at peak hours is the honest downside — residents learn the tram quickly. Families tend to prefer the quieter inner towers over the walk-side ones.",
      },
      {
        heading: "Buying and renting here",
        body: "Studios and one-beds dominate the market and let fast, which is why the Marina is a fixture in rental-yield conversations. Larger layouts in the older towers price well below newer districts per square foot. When you compare units, weigh the service charge and the tower's chiller arrangement — they move the net yield more than the headline rent does.",
      },
    ],
    faqs: [
      {
        q: "Is Dubai Marina freehold for foreigners?",
        a: "Yes — Dubai Marina is one of Dubai's designated freehold zones, so foreign buyers own outright with a title deed, no residency required.",
      },
      {
        q: "Is Dubai Marina a good investment?",
        a: "It has the deepest tenant pool in the city — professionals, crews and remote workers renew demand every season — so furnished units enjoy pricing power and short vacancy. You trade some yield for the waterfront premium.",
      },
      {
        q: "Can I still buy off-plan in Dubai Marina?",
        a: "Rarely — the Marina is essentially built out, so most purchases are resale in established towers. That means no construction risk and immediate rent, but check building age and service charges closely.",
      },
    ],
    related: ["jumeirah-beach-residence", "palm-jumeirah", "business-bay"],
  },
  {
    slug: "downtown-dubai",
    imageQuery: "downtown",
    label: "Downtown Dubai",
    title: "Downtown Dubai Area Guide — Burj Khalifa Living",
    updated: COPY_UPDATED,
    h1: "Downtown Dubai",
    description:
      "Downtown Dubai area guide: the Burj Khalifa district — prestige apartments, hotel-branded residences, and what ownership there really involves.",
    intro: [
      "Downtown is Dubai's centre of gravity — the Burj Khalifa, the Dubai Mall and the fountains sit in the middle of it, and everything else is arranged around the view. Owning here is owning the address the city advertises with.",
      "It is a prestige market first and a yield market second: entry prices are the city's highest outside Palm Jumeirah's fronds, and buyers are typically end-users, long-hold investors or short-let operators trading on the location.",
      "Emaar built Downtown and still operates most of it, which shows in the maintenance standard and in resale confidence. Supply is essentially fixed — the district is built out — so the market moves on demand alone. When Dubai has a strong year, Downtown usually has a stronger one; when the market cools, the address defends its value better than almost anywhere.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "downtown" },
    facts: [
      { label: "Property mix", value: "Apartments and branded residences; Old Town's low-rise Arabic-style blocks" },
      { label: "Who it suits", value: "End-users, prestige buyers, short-let investors" },
      { label: "Getting around", value: "Burj Khalifa/Dubai Mall Metro, Financial Centre Road, DIFC on foot" },
      { label: "Character", value: "Iconic, busy, tourist-facing — quietest inside Old Town" },
      { label: "Investment angle", value: "Fixed supply in a built-out district — value defends in soft markets and leads in strong ones" },
      { label: "Lifestyle & amenities", value: "Dubai Mall, the Opera and the fountain promenade as the daily neighbourhood" },
    ],
    sections: [
      {
        heading: "Living in Downtown",
        body: "The district is built for spectacle, and living in it means sharing it: New Year's Eve, event weekends and mall traffic are part of the deal. In exchange you get the city's best restaurant bench, DIFC within walking distance, and the fountain view from the right stack. Old Town offers the same address at a calmer register.",
      },
      {
        heading: "Buying and renting here",
        body: "Price per square foot varies enormously with the view line — a Burj-and-fountain stack can carry a premium of a third over the same layout facing inward. Short-term letting performs strongly here, but check the building's policy before underwriting on it; several towers restrict holiday homes.",
      },
    ],
    faqs: [
      {
        q: "Is Downtown Dubai freehold?",
        a: "Yes — Downtown is a designated freehold zone; foreign buyers hold full title. It is also one of the market's most liquid districts to resell in.",
      },
      {
        q: "Why is Downtown Dubai so expensive?",
        a: "The address itself: Burj Khalifa, the fountain and Dubai Mall anchor global demand, supply is essentially fixed, and Emaar's management keeps the district's standard high. Buyers pay for value retention as much as lifestyle.",
      },
      {
        q: "Is Downtown better for living or investment?",
        a: "Both, with a tilt to capital preservation — yields run below the city average, but the address defends its value in soft markets better than almost anywhere in Dubai.",
      },
    ],
    related: ["business-bay", "difc", "dubai-creek-harbour"],
  },
  {
    slug: "business-bay",
    imageQuery: "business bay",
    label: "Business Bay",
    title: "Business Bay Area Guide — Canal-Side Living",
    updated: COPY_UPDATED,
    h1: "Business Bay",
    description:
      "Business Bay area guide: Downtown's neighbour on the canal — newer towers, sharper prices, and one of Dubai's busiest rental markets.",
    intro: [
      "Business Bay is where Downtown's energy meets a more accessible price. The district lines the Dubai Water Canal with mixed office and residential towers, and it has quietly become one of the city's largest rental markets — tenants who work in Downtown or DIFC and want ten minutes to the desk.",
      "For buyers, the Bay is a volume market: plenty of stock, constant handovers, and real negotiating room. The skill is separating the towers built to hold value from the ones built to sell fast.",
      "The Bay has also become Dubai's laboratory for branded living — hotel-flagged residences cluster here, pairing hotel amenities with private ownership. And because the district began as an office masterplan, its road grid and utilities were engineered for more density than it carries today, which is why construction continues without the growing pains older districts feel.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "business bay" },
    facts: [
      { label: "Property mix", value: "New high-rise apartments, serviced and branded residences, canal-front penthouses" },
      { label: "Who it suits", value: "Yield investors, young professionals, first-time Dubai buyers" },
      { label: "Getting around", value: "Business Bay Metro, Al Khail & Sheikh Zayed Roads, Downtown on foot from north towers" },
      { label: "Character", value: "Commercial-residential mix — livelier by day, canal walk in the evening" },
      { label: "Investment angle", value: "Downtown-adjacent rents at Bay entry prices; one-beds turn over fast in sale and let alike" },
      { label: "Lifestyle & amenities", value: "Canal boardwalk runs, rooftop pools and a dining scene closing the gap on Downtown's" },
    ],
    sections: [
      {
        heading: "Living in Business Bay",
        body: "The Bay's north edge is effectively Downtown at a discount — the same restaurants a walk away and the Burj on the skyline. Deeper in, the district gets more commercial; a tower's immediate block matters more here than in most areas. The canal boardwalk has matured into a genuine amenity, with runs, cafes and water taxis.",
      },
      {
        heading: "Buying and renting here",
        body: "One-beds are the district's currency and turnover is fast in both directions, which keeps the market honest on price. Off-plan launches still happen on the remaining plots, so the ready-versus-launch comparison is live here in a way it no longer is in Downtown — often the deciding factor is simply the payment plan.",
      },
    ],
    faqs: [
      {
        q: "Is Business Bay freehold for foreigners?",
        a: "Yes — Business Bay is a designated freehold zone with full foreign ownership and a Dubai Land Department title deed.",
      },
      {
        q: "Is Business Bay cheaper than Downtown?",
        a: "Meaningfully — the Bay delivers a next-door address at a friendlier ticket, which is why investors cross-shop the two. Yields in the Bay typically run higher; Downtown holds the prestige premium.",
      },
      {
        q: "Why are there so many branded residences in Business Bay?",
        a: "The district became Dubai's laboratory for hotel-flagged living — brands pair hotel amenities with private ownership here, and the launch calendar rarely pauses. It adds a premium but also a strong rental story.",
      },
    ],
    related: ["downtown-dubai", "difc", "projects-in-business-bay", "off-plan-projects-in-dubai"],
  },
  {
    slug: "palm-jumeirah",
    imageQuery: "palm",
    label: "Palm Jumeirah",
    title: "Palm Jumeirah Area Guide — Villas & Apartments",
    updated: COPY_UPDATED,
    h1: "Palm Jumeirah",
    description:
      "Palm Jumeirah area guide: frond villas, shoreline apartments and trunk towers — what living and investing on the Palm actually looks like.",
    intro: [
      "The Palm is Dubai's trophy address: a palm-shaped island where every frond villa touches private beach and the apartment buildings along the trunk look back at the Marina skyline. Supply is finite by geography, which is the quiet engine under its prices.",
      "It behaves like three markets in one — frond villas, trunk apartments, and the crescent's hotel-branded residences — and they move differently. Knowing which one you're actually buying into matters more here than anywhere in the city.",
      "The crescent's hotels — Atlantis at the crown — anchor the island's service economy, and residents borrow their beach clubs, spas and restaurants as neighbourhood amenities. Add the Palm West Beach strip and its boardwalk, and the island now has genuine street life to go with its privacy — something it lacked entirely in its first decade.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "palm jumeirah" },
    facts: [
      { label: "Property mix", value: "Beachfront frond villas, trunk apartments, branded residences on the crescent" },
      { label: "Who it suits", value: "Family end-users, ultra-prime buyers, beach-led lifestyle purchases" },
      { label: "Getting around", value: "Palm Monorail, one road in and out via the trunk — plan around peak hours" },
      { label: "Character", value: "Resort-quiet on the fronds, hotel-lively on the crescent" },
      { label: "Investment angle", value: "Supply capped by geography — frond villas are among the city's few genuinely scarce assets" },
      { label: "Lifestyle & amenities", value: "Private beach at home, Palm West Beach street life, hotel beach clubs and spas as neighbourhood amenities" },
    ],
    sections: [
      {
        heading: "Living on the Palm",
        body: "Frond life is private beach, garden and silence — with a single access road as the trade. Trunk apartments live more like a waterfront city district: gyms, cafes and the monorail to Atlantis. Schools and big-box shopping sit off-island, so most Palm households run on two cars.",
      },
      {
        heading: "Buying and renting here",
        body: "Villas on the fronds are among the very few genuinely scarce assets in Dubai — they trade rarely and command it. Trunk apartments offer the same postcode at a fraction of the ticket, and the short-let market for them is deep. On the crescent, branded residences carry hotel service and hotel service charges; read the fine print on both.",
      },
    ],
    faqs: [
      {
        q: "Can foreigners buy on Palm Jumeirah?",
        a: "Yes — the Palm is freehold, and it is one of the districts where international buyers dominate. Villas on the fronds and apartments on the trunk both carry full title.",
      },
      {
        q: "Is Palm Jumeirah a good investment?",
        a: "It behaves like a trophy market: entry prices are among Dubai's highest, supply is fixed by geography, and short-let performance on the beachfront is exceptional. Buyers here optimise for prestige and capital strength over headline yield.",
      },
      {
        q: "Apartments or villas on the Palm — what's the difference?",
        a: "Trunk and crescent apartments offer resort living with hotel amenities at a lower entry; frond villas offer private beaches and the Palm's scarcest asset — land. The two trade almost as separate markets.",
      },
    ],
    related: ["dubai-marina", "jumeirah-beach-residence", "new-projects-in-dubai"],
  },
  {
    slug: "jumeirah-village-circle",
    imageQuery: "jumeirah village",
    label: "Jumeirah Village Circle (JVC)",
    title: "JVC Area Guide — Jumeirah Village Circle",
    updated: COPY_UPDATED,
    h1: "Jumeirah Village Circle (JVC)",
    description:
      "JVC area guide: Dubai's value district — affordable apartments and townhouses, strong yields, and what to check before buying in Jumeirah Village Circle.",
    intro: [
      "JVC is where Dubai's price-to-space equation works best: a central-south location twenty minutes from the Marina and Downtown alike, with apartments and townhouses at entry prices the beachfront districts left behind years ago. That's made it the default first purchase for a generation of Dubai buyers.",
      "It is also the city's busiest construction zone, with new mid-rise launches almost monthly. Yields run high; so does future supply. Both facts belong in the same sentence.",
      "Circle Mall gave the district its retail anchor, and more than thirty pocket parks do the daily work between the schools and nurseries. Developers here compete hard on amenities — rooftop pools, co-working lounges and serious gyms are standard in the newer buildings, at price points where the older districts offer none of it.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "jumeirah village circle" },
    facts: [
      { label: "Property mix", value: "Mid-rise apartments, townhouses, some villas around the circle's gardens" },
      { label: "Who it suits", value: "First-time buyers, yield investors, families on a budget" },
      { label: "Getting around", value: "Al Khail and Hessa Street by car — no Metro yet, so parking ratios matter" },
      { label: "Character", value: "Residential, low-key, park-dotted — amenity clusters vary block to block" },
      { label: "Investment angle", value: "The strongest mainstream gross yields in the city, on the longest developer payment plans" },
      { label: "Lifestyle & amenities", value: "Circle Mall, thirty-plus pocket parks, and rooftop-pool buildings at value prices" },
    ],
    sections: [
      {
        heading: "Living in JVC",
        body: "The circle layout means your experience depends on your block: some sit beside parks and retail clusters, others beside active construction. Community retail has caught up fast, and the district's schools and nurseries keep families in place once they arrive. Car-first living is the default until the promised Metro extension lands.",
      },
      {
        heading: "Buying and renting here",
        body: "This is the strongest gross-yield district in mainstream Dubai, and off-plan payment plans here are among the longest developers offer anywhere. The discipline is developer selection: in a district with this many mid-tier builders, the completed quality gap between the best and the rest is wide. We're candid about which is which.",
      },
    ],
    faqs: [
      {
        q: "Is JVC freehold?",
        a: "Yes — Jumeirah Village Circle is a designated freehold zone, and it is consistently one of Dubai's most-bought districts by international investors.",
      },
      {
        q: "Why is JVC so popular with investors?",
        a: "The arithmetic: a central location between the city's main roads, entry prices well below the coastal districts, and some of the strongest gross rental yields in Dubai. More new projects launch here than anywhere else.",
      },
      {
        q: "What should I check before buying in JVC?",
        a: "The developer, above all — with this much simultaneous construction, delivery track record and service-charge levels separate the towers that hold value from the ones that don't.",
      },
    ],
    related: ["projects-in-jumeirah-village-circle", "dubailand", "al-furjan", "off-plan-projects-in-dubai"],
  },
  {
    slug: "dubai-creek-harbour",
    imageQuery: "creek",
    label: "Dubai Creek Harbour",
    title: "Dubai Creek Harbour Area Guide — New Downtown",
    updated: COPY_UPDATED,
    h1: "Dubai Creek Harbour",
    description:
      "Dubai Creek Harbour area guide: Emaar's waterfront district opposite the wildlife sanctuary — new towers, phased launches and a skyline view of Downtown.",
    intro: [
      "Creek Harbour is Emaar building a second Downtown on the water: a masterplanned district across the creek from the Ras Al Khor flamingo sanctuary, with the old city's skyline on one horizon and the new one on the other. It is still mid-build, which is exactly its appeal to off-plan buyers.",
      "Buying here is a bet on a district maturing on schedule — the developer's record on that is the strongest in the market, and the early phases have already handed over into a functioning waterfront community.",
      "The masterplan is sized for a population larger than some emirates — a reminder that this is a decade-long story, not a finished district. Early buyers are effectively buying Emaar's delivery machine: every handed-over phase adds retail, schools and transport links, and each addition marks up the phases that came before it.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "creek harbour" },
    facts: [
      { label: "Property mix", value: "New apartments and waterfront towers, nearly all Emaar-built" },
      { label: "Who it suits", value: "Off-plan investors, buyers priced out of Downtown, long-horizon holders" },
      { label: "Getting around", value: "Ras Al Khor Road; planned Metro links — today it's a driving district" },
      { label: "Character", value: "New, quiet, waterfront — a district still growing into itself" },
      { label: "Investment angle", value: "Downtown DNA at a discount, with phase-on-phase appreciation as the masterplan builds out" },
      { label: "Lifestyle & amenities", value: "Creek Marina, the promenade and flamingo-sanctuary views — a calmer waterfront than the Marina" },
    ],
    sections: [
      {
        heading: "Living in Creek Harbour",
        body: "Handover-phase residents get a calm, new-everything waterfront: the promenade, Creek Marina and a growing retail spine, with the sanctuary's flamingos as neighbours. What it doesn't yet have is the density of schools and hospitals of the established districts — most households still lean on Downtown or Mirdif for both.",
      },
      {
        heading: "Buying and renting here",
        body: "Launches here carry Downtown DNA at a meaningful discount, on payment plans that regularly stretch past handover. Resale of earlier phases gives a clean read on the trajectory. The comparison worth doing before committing is Creek Harbour off-plan versus Downtown ready — same developer, different decades, and the answer depends on your horizon.",
      },
    ],
    faqs: [
      {
        q: "Is Dubai Creek Harbour freehold?",
        a: "Yes — Creek Harbour is freehold, master-planned and largely developed by Emaar, with full foreign ownership throughout.",
      },
      {
        q: "Is Dubai Creek Harbour finished?",
        a: "It is a district still being delivered in phases — which is exactly its appeal to off-plan buyers: today's prices in a waterfront masterplan designed as a second Downtown, with new launches arriving regularly.",
      },
      {
        q: "Who is Creek Harbour best suited for?",
        a: "Buyers with a medium-to-long horizon: you are buying the masterplan's trajectory. Early residents get a quiet waterfront district; investors get Emaar delivery confidence and a growing rental base.",
      },
    ],
    related: ["downtown-dubai", "new-projects-in-dubai", "off-plan-projects-in-dubai"],
  },
  {
    slug: "dubai-hills-estate",
    imageQuery: "hills",
    label: "Dubai Hills Estate",
    title: "Dubai Hills Estate Area Guide — Family Living",
    updated: COPY_UPDATED,
    h1: "Dubai Hills Estate",
    description:
      "Dubai Hills Estate area guide: Emaar's golf-course district — family villas, the Hills Park, and the strongest school run in new Dubai.",
    intro: [
      "Dubai Hills is the establishment choice of new Dubai: an Emaar masterplan wrapped around an eighteen-hole course, halfway between Downtown and the Marina on Al Khail Road. Villas and townhouses carry the district, with apartment clusters around the mall and park.",
      "It has become the benchmark other family communities price against — schools inside the masterplan, the city's biggest park lawn, and a mall that spared residents the drive to either Downtown or Mall of the Emirates.",
      "The numbers behind the lifestyle hold up too: Dubai Hills Mall trades among the city's busiest, King's College Hospital anchors the healthcare offer, and the district's central seam between Downtown and the Marina makes it one of the few family communities that shortens commutes instead of lengthening them.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "dubai hills" },
    facts: [
      { label: "Property mix", value: "Villas, townhouses, mid-rise apartments around the park and mall" },
      { label: "Who it suits", value: "Families settling long-term, villa upgraders, school-run households" },
      { label: "Getting around", value: "Al Khail Road spine — fifteen minutes to Downtown or the Marina off-peak" },
      { label: "Character", value: "Green, ordered, family-paced — golf course quiet at its centre" },
      { label: "Investment angle", value: "Villa demand consistently outruns supply; golf-line addresses set the district premium" },
      { label: "Schools & family", value: "GEMS schools inside the community, King's College Hospital, and the Hills Park lawn for the weekends" },
    ],
    sections: [
      {
        heading: "Living in Dubai Hills",
        body: "The day runs on the park and the school gates: GEMS schools sit inside the community, the Hills Park absorbs the weekends, and the mall covers the rest. It is deliberately unexciting in the way settled families want — the trade is that nightlife and beach are both a drive away.",
      },
      {
        heading: "Buying and renting here",
        body: "Villa demand consistently outruns supply here, and golf-course-line addresses carry the district's premium. Apartments near the mall let quickly to families waiting for villas. Most stock is now ready or resale; the occasional new phase from Emaar prices confidently, because the district has earned it.",
      },
    ],
    faqs: [
      {
        q: "Is Dubai Hills Estate freehold?",
        a: "Yes — Dubai Hills Estate is freehold, part of the Mohammed bin Rashid City belt, with full foreign ownership across its villas, townhouses and apartments.",
      },
      {
        q: "Is Dubai Hills good for families?",
        a: "It is arguably the city's flagship family district: the golf course and central park, schools inside the community, Dubai Hills Mall, and a location that reaches both Downtown and Marina in about twenty minutes.",
      },
      {
        q: "Is Dubai Hills Estate a good investment?",
        a: "Emaar's delivery record and the district's end-user demand make it one of Dubai's most resilient markets — villas and townhouses especially have shown strong value retention and steady family rental demand.",
      },
    ],
    related: ["arabian-ranches", "jumeirah-village-circle", "new-projects-in-dubai"],
  },
  {
    slug: "jumeirah-beach-residence",
    imageQuery: "beach residence",
    label: "JBR — Jumeirah Beach Residence",
    title: "JBR Area Guide — Beachfront Apartments",
    updated: COPY_UPDATED,
    h1: "Jumeirah Beach Residence (JBR)",
    description:
      "JBR area guide: Dubai's beachfront apartment strip — The Walk, The Beach mall, and what buying into Jumeirah Beach Residence involves.",
    intro: [
      "JBR is the only place in Dubai where a residential tower's ground floor opens straight onto a public beach. The strip of towers along The Walk is beach-town Dubai: holidaymakers below, residents above, and the Marina's towers one street behind.",
      "The buildings are older than the Marina's newest stock, and that's the opportunity — some of the largest sea-view layouts in the city trade here at prices newer beachfront can't match.",
      "The strip's economics are simple: a beach that draws millions of visitors a year, directly beneath a few thousand apartments. That footfall sustains The Walk's retail through every season and keeps short-let occupancy among the city's highest — while the tram and the Marina's Metro stations put the business districts within an easy commute.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "jumeirah beach residence" },
    facts: [
      { label: "Property mix", value: "Large-format apartments in the Rimal, Bahar, Murjan, Sadaf, Amwaj & Shams clusters" },
      { label: "Who it suits", value: "Beach-first buyers, short-let investors, space hunters" },
      { label: "Getting around", value: "Dubai Tram along the strip, Marina Metro stations behind" },
      { label: "Character", value: "Holiday-lively at street level, surprisingly residential upstairs" },
      { label: "Investment angle", value: "Beach footfall sustains one of the city's strongest short-let occupancy bands year-round" },
      { label: "Lifestyle & amenities", value: "The Walk's cafes, The Beach mall and open sea from the larger sea-view layouts" },
    ],
    sections: [
      {
        heading: "Living in JBR",
        body: "You live above a beach resort, with everything that implies: the sea and The Walk's restaurants are an elevator ride away, and so are the crowds, especially in the cooler months. Higher floors buy back the quiet. Residents skew toward people who chose the beach on purpose and treat the bustle as atmosphere.",
      },
      {
        heading: "Buying and renting here",
        body: "JBR is one of Dubai's strongest short-let micro-markets — beach frontage does that — and the large layouts also hold a steady long-let family audience. Because the towers date from the 2000s, unit condition varies widely; a renovated unit against an original one is effectively a different product at a different price.",
      },
    ],
    faqs: [
      {
        q: "Is JBR freehold for foreign buyers?",
        a: "Yes — Jumeirah Beach Residence is freehold; foreigners own outright, and the district's beachfront apartments are perennial favourites with international buyers.",
      },
      {
        q: "Is JBR good for short-term rentals?",
        a: "Among the best in Dubai — The Walk, the beach and year-round tourism keep holiday-let occupancy strong, and many owners run furnished units on short-let licences.",
      },
      {
        q: "What's the difference between JBR and Dubai Marina?",
        a: "They are neighbours that share a lifestyle: JBR is the beachfront row itself — sea views, sand at the doorstep — while the Marina wraps the yacht harbour behind it with more tower choice and price points.",
      },
    ],
    related: ["dubai-marina", "palm-jumeirah", "ready-properties-in-dubai"],
  },
  {
    slug: "arabian-ranches",
    imageQuery: "ranches",
    label: "Arabian Ranches",
    title: "Arabian Ranches Area Guide — Villa Community",
    updated: COPY_UPDATED,
    h1: "Arabian Ranches",
    description:
      "Arabian Ranches area guide: Dubai's most established villa community — mature streets, schools, and the trade-offs of desert-edge family living.",
    intro: [
      "The Ranches is old money by new-Dubai standards: an Emaar villa community from the early 2000s whose trees have had two decades to grow. It set the template every later family masterplan copied — golf course, polo club, community schools, retail village.",
      "Buyers come for the maturity itself. The streets are settled, the neighbours long-term, and the landscaping real rather than rendered. Its younger siblings (Ranches II and III) extend the same formula at newer price points.",
      "The Ranches also benefits from what grew up around it: the polo club, Global Village and Dubailand's newer districts wrap it in amenities that didn't exist when the first villas sold. And two decades of resales give buyers something genuinely rare in Dubai — a real price history, street by street, to negotiate from.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "arabian ranches" },
    facts: [
      { label: "Property mix", value: "Villas and townhouses across gated sub-communities; no apartments" },
      { label: "Who it suits", value: "Settled families, equestrian and golf households, long-term residents" },
      { label: "Getting around", value: "Sheikh Mohammed bin Zayed Road & Umm Suqeim Street — car country" },
      { label: "Character", value: "Suburban, green, quiet — the school run is the rush hour" },
      { label: "Investment angle", value: "Two decades of street-by-street price history and multi-year family tenancies — a stability hold" },
      { label: "Schools & family", value: "JESS Ranches in-community, the polo and golf clubs, and parks that have had twenty years to mature" },
    ],
    sections: [
      {
        heading: "Living in the Ranches",
        body: "Life organises around the community centres and the schools — JESS Ranches is one of the city's most requested — with the polo club and golf course as the weekend anchors. The city is genuinely far: Downtown is half an hour on a good day, and every errand is a drive. Residents call that the point.",
      },
      {
        heading: "Buying and renting here",
        body: "Original Ranches villas trade on plot and position, and the best streets rarely list openly — much of the market moves by word of mouth. As a rental, the community draws multi-year family tenancies with minimal vacancy. It is a hold asset, not a flip: the return here has always been stability.",
      },
    ],
    faqs: [
      {
        q: "Is Arabian Ranches freehold?",
        a: "Yes — Arabian Ranches is freehold, and as one of Dubai's first villa communities it has two decades of resale history behind it.",
      },
      {
        q: "Is Arabian Ranches good for families?",
        a: "It set the template: gated villa streets, parks, pools, schools and a golf club, with a settled community feel newer districts are still growing into.",
      },
      {
        q: "Villas only, or are there apartments?",
        a: "The Ranches is a villa-and-townhouse community by design — buyers who want the same belt with apartment price points usually look at the newer districts around it.",
      },
    ],
    related: ["dubai-hills-estate", "dubailand", "ready-properties-in-dubai"],
  },
  {
    slug: "al-furjan",
    imageQuery: "furjan",
    label: "Al Furjan",
    title: "Al Furjan Area Guide — Villas & Apartments",
    updated: COPY_UPDATED,
    h1: "Al Furjan",
    description:
      "Al Furjan area guide: the metro-connected value district near Ibn Battuta — townhouses, new apartments, and honest pricing in south Dubai.",
    intro: [
      "Al Furjan is the practical choice of south Dubai: a Nakheel district beside Ibn Battuta Mall where the 2021 Metro extension quietly changed the equation — few villa-and-townhouse communities in the city can walk to a train.",
      "It sits in the price band between JVC and the premium masterplans, and its buyer is usually someone doing the arithmetic: Expo City and the Marina employment belts within twenty minutes, a garden, and a mortgage that behaves.",
      "Nakheel's original masterplan left room to breathe — plots and road widths here are more generous than in the newer value districts — and Ibn Battuta's own Metro station, Discovery Gardens and the Gardens bracket the community with infrastructure that is already mature. It is quietly becoming the commuter choice for Expo City's growing workforce.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "furjan" },
    facts: [
      { label: "Property mix", value: "Townhouses and villas in the original phases, newer mid-rise apartments along the spine" },
      { label: "Who it suits", value: "Commuting families, first villa buyers, Metro-dependent tenants" },
      { label: "Getting around", value: "Two Route 2020 Metro stations, Sheikh Zayed Road & Mohammed bin Zayed Road" },
      { label: "Character", value: "Unshowy, functional, improving year on year" },
      { label: "Investment angle", value: "Metro-walkable townhouses are rare in Dubai — that proximity prices into both rent and resale" },
      { label: "Lifestyle & amenities", value: "Ibn Battuta Mall next door, a growing community retail spine, Expo City ten minutes out" },
    ],
    sections: [
      {
        heading: "Living in Al Furjan",
        body: "The district runs on convenience: Ibn Battuta for retail and cinema, the Metro for the Marina and Expo City, and community retail filling in along the main spine. It has none of the postcard glamour of the coast — what it has is a functioning family week with short distances.",
      },
      {
        heading: "Buying and renting here",
        body: "Metro proximity is the dividing line in both rent and resale; check the walking distance, not the map distance. The newer apartment launches target investors on entry price, while the townhouse market is dominated by end-users upgrading out of apartments. Both markets are liquid without being frantic.",
      },
    ],
    faqs: [
      {
        q: "Is Al Furjan freehold?",
        a: "Yes — Al Furjan is a designated freehold zone with full foreign ownership across its villas, townhouses and apartment buildings.",
      },
      {
        q: "Why do buyers choose Al Furjan?",
        a: "The metro is the headline: Route 2020 gave the district its own stations, which few villa-and-townhouse communities can claim — commuting value at family-community prices.",
      },
      {
        q: "Is Al Furjan better for living or investment?",
        a: "It works both ways — end-users get space and connectivity; investors get steady tenant demand from families priced out of the coastal districts, with yields typical of Dubai's value belt.",
      },
    ],
    related: ["jumeirah-village-circle", "dubailand", "off-plan-projects-in-dubai"],
  },
  {
    slug: "difc",
    imageQuery: "difc",
    label: "DIFC",
    title: "DIFC Area Guide — Dubai's Financial Centre",
    updated: COPY_UPDATED,
    h1: "DIFC — Dubai International Financial Centre",
    description:
      "DIFC area guide: apartments inside Dubai's financial free zone — art, fine dining, and the shortest commute in the city for finance professionals.",
    intro: [
      "DIFC is a financial free zone that happens to be one of Dubai's best places to live: the Gate district's towers hold the city's densest concentration of galleries, fine dining and members' clubs, and several thousand residents who walk to work in the institutions next door.",
      "Residential stock is scarce by design — a handful of towers inside the district proper — and scarcity plus the tenant profile has kept it one of the steadiest apartment markets in the city.",
      "The free-zone charter gives DIFC its own courts and a common-law framework, and property inside the district sits under that umbrella — a distinction institutional buyers price in. Gate Avenue's retail spine, the arts cluster and a packed calendar of gallery nights keep the district alive well past office hours.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "difc" },
    facts: [
      { label: "Property mix", value: "Apartments in a small set of towers — Index, Limestone, Central Park and peers" },
      { label: "Who it suits", value: "Finance professionals, art-and-dining loyalists, pied-à-terre buyers" },
      { label: "Getting around", value: "Financial Centre Metro, Gate Avenue on foot, Downtown ten minutes' walk" },
      { label: "Character", value: "Polished, adult, gallery-quiet at weekends" },
      { label: "Investment angle", value: "Institutional tenant covenants and slow-turning stock keep voids short and values steady" },
      { label: "Lifestyle & amenities", value: "Gate Avenue's retail spine, the arts cluster and the city's densest fine-dining bench" },
    ],
    sections: [
      {
        heading: "Living in DIFC",
        body: "The district's rhythm is professional: packed weekday lunches, gallery nights, quiet weekend mornings on Gate Avenue. It suits people whose life already runs through it — the commute from bedroom to trading floor can genuinely be an elevator and a footbridge. Families generally look elsewhere; the district has no schools of its own.",
      },
      {
        heading: "Buying and renting here",
        body: "Tenant demand is effectively institutional — relocating bankers and lawyers on employer budgets — which keeps voids short and covenants strong. Purchase stock turns over slowly; when the well-known towers list, they move fast. Central Park's newer units set the district's current ceiling.",
      },
    ],
    faqs: [
      {
        q: "Can foreigners buy property in DIFC?",
        a: "Yes — DIFC apartments are owned outright by foreign buyers; the district additionally operates its own DIFC legal framework, which many international investors consider a feature.",
      },
      {
        q: "Who rents in DIFC?",
        a: "The finance world next door: professionals from the banks, funds and law firms inside the Centre — a tenant base that is stable, well-paid and walking distance from the towers they rent in.",
      },
      {
        q: "Is DIFC apartment supply large?",
        a: "No — residential stock inside the Centre is deliberately limited, which supports both rents and resale values. New launches around Gate Avenue are infrequent and sell quickly.",
      },
    ],
    related: ["downtown-dubai", "business-bay", "ready-properties-in-dubai"],
  },
  {
    slug: "dubailand",
    imageQuery: "dubailand",
    label: "Dubailand",
    title: "Dubailand Area Guide — Value Communities",
    updated: COPY_UPDATED,
    h1: "Dubailand",
    description:
      "Dubailand area guide: the value belt of south Dubai — townhouse communities, new launches, and the entry prices the coast no longer offers.",
    intro: [
      "Dubailand is less a neighbourhood than a region: the broad inland belt where Dubai builds its value communities — townhouse masterplans, themed districts and a steady stream of new launches at the city's friendliest entry prices.",
      "This is where developers compete on payment plan and handover date rather than postcode prestige, and for a large share of Dubai's end-users it is simply where the affordable family home is.",
      "The belt keeps absorbing Dubai's growth corridors: Academic City's universities, the Al Maktoum airport axis and the Emirates Road logistics spine all pull tenants inward. For investors the arithmetic is entry price against city-average rents — the spread that made JVC famous a cycle ago is now widest out here.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "dubailand" },
    facts: [
      { label: "Property mix", value: "Townhouse communities, mid-rise apartments, occasional villa districts" },
      { label: "Who it suits", value: "Budget-led families, first-time buyers, long-horizon investors" },
      { label: "Getting around", value: "Sheikh Mohammed bin Zayed & Emirates Roads — commutes are real; price them in" },
      { label: "Character", value: "New, spread out, community-by-community — each masterplan is its own world" },
      { label: "Investment angle", value: "The widest price-to-rent spread in the city — JVC's arithmetic, one belt further out" },
      { label: "Schools & family", value: "Self-contained communities with pools, parks and in-gate schools as the standard package" },
    ],
    sections: [
      {
        heading: "Living in Dubailand",
        body: "Each community is self-contained: pools, parks, a retail strip and often a school inside the gates, because the next amenity may be a fifteen-minute drive. The families who settle here budget for two cars and get, in exchange, space that the coastal districts stopped offering a decade ago.",
      },
      {
        heading: "Buying and renting here",
        body: "The launch calendar never stops here, so comparing three active payment plans is normal shopping. Rental demand tracks handovers — early residents of a new community enjoy strong tenant interest from families following the schools in. The variable to respect is delivery track record; in this belt it varies more than anywhere in the city.",
      },
    ],
    faqs: [
      {
        q: "Is Dubailand freehold?",
        a: "Yes — Dubailand's communities are freehold, and the belt hosts some of the most affordable full-ownership family homes in Dubai.",
      },
      {
        q: "Is Dubailand a good place to invest?",
        a: "It offers the widest price-to-space ratio in the city and the strongest launch calendar, which keeps pricing honest. The variable to respect is developer delivery record — it varies more here than anywhere else.",
      },
      {
        q: "How far is Dubailand from the city?",
        a: "Budget real commutes: the communities sit along Sheikh Mohammed bin Zayed and Emirates Roads, roughly 20–35 minutes from the coastal districts by car. In exchange you get space the coast stopped offering a decade ago.",
      },
    ],
    related: ["projects-in-dubailand", "jumeirah-village-circle", "arabian-ranches", "off-plan-projects-in-uae"],
  },
  {
    slug: "al-jaddaf",
    imageQuery: "jaddaf",
    label: "Al Jaddaf",
    title: "Al Jaddaf Area Guide — Living & New Projects",
    updated: COPY_UPDATED,
    h1: "Al Jaddaf",
    description:
      "Al Jaddaf area guide: Creek-side apartments minutes from Downtown and the airport, two Metro stations and one of central Dubai's busiest off-plan pipelines",
    intro: [
      "Al Jaddaf sits on the Bur Dubai bank of Dubai Creek, between Dubai Healthcare City, Ras Al Khor and the water — ten to fifteen minutes from Downtown in one direction and the airport in the other. For decades it was the city's boatyard; today it is one of the densest construction zones in central Dubai, with a creekside promenade, the Mohammed Bin Rashid Library and Jameel Arts Centre as its cultural anchors and Dubai Festival City lit up across the water.",
      "What draws buyers is the arithmetic: a genuinely central address at prices closer to the outer belts than to Downtown. Most of the launches on our books here start between AED 700,000 and AED 850,000 for studios and one-bedroom units, and the district's two Green Line Metro stations — Al Jaddaf and Creek — make it one of the few off-plan hotspots where a tenant can live without a car.",
      "The trade-off is that Al Jaddaf is still being built. Expect cranes, road works and a skyline that changes every quarter until the current wave hands over between 2026 and 2028. Binghatti and Azizi between them account for most of the towers rising here, so developer track record is easier to judge than in more fragmented districts — and it is the first thing we check.",
    ],
    kind: "guide",
    inventoryFilter: { cityLike: "dubai", locationLike: "jaddaf" },
    facts: [
      { label: "Property mix", value: "Mid- and high-rise apartments — studios to three-beds, a handful of penthouses" },
      { label: "Who it suits", value: "Yield-focused investors, first-time buyers priced out of Downtown, medical and airport professionals" },
      { label: "Getting around", value: "Al Jaddaf & Creek Metro stations (Green Line); Al Khail Road to Downtown; Al Garhoud Bridge and Business Bay Crossing over the creek" },
      { label: "Character", value: "Creekside and culture-led, still under construction — a district finding its street life" },
      { label: "Investment angle", value: "Central-Dubai location at mid-market entry prices; rental demand from Dubai Healthcare City and the airport belt" },
      { label: "Lifestyle & amenities", value: "Jaddaf Waterfront promenade, Mohammed Bin Rashid Library, Jameel Arts Centre, Palazzo Versace, Festival City Mall one bridge away" },
    ],
    sections: [
      {
        heading: "Living in Al Jaddaf",
        body: "Daily life runs along the creek and the Metro. Dubai Healthcare City and its clinics are a walk away, Dubai Festival City Mall is one bridge across the water, and Downtown, DIFC and Business Bay are a short drive or a few Metro stops. Supermarkets and cafes are arriving tower by tower rather than all at once — buyers who move in early should expect a district in transition, and tenants who value the commute over nightlife.",
      },
      {
        heading: "Buying and renting here",
        body: "Almost everything for sale in Al Jaddaf is off-plan, which means construction-linked payment plans and launch pricing — but also the need to check the developer's delivery history and the SPA's handover clauses. Studios and one-beds dominate the unit mix; per square foot the district prices well below Downtown and Dubai Creek Harbour for a comparable commute. The two Metro stations underpin tenant demand from DHCC medical staff, airport and airline employees, and Downtown commuters.",
      },
    ],
    faqs: [
      {
        q: "Is Al Jaddaf freehold for foreigners?",
        a: "Yes — Al Jaddaf sits inside Dubai's designated freehold zones, so foreign buyers hold a full title deed with no residency requirement.",
      },
      {
        q: "Is Al Jaddaf a good place to invest?",
        a: "It combines a central-Dubai location — ten to fifteen minutes to Downtown and the airport, two Metro stations — with entry prices well below the neighbouring districts. The trade-off is buying into an area still under construction, so developer track record matters more than the render.",
      },
      {
        q: "Which developers are building in Al Jaddaf?",
        a: "Binghatti and Azizi account for most of the current towers, with several launches each handing over between 2026 and 2028. Our Al Jaddaf projects page lists every one live on our books.",
      },
      {
        q: "How far is Al Jaddaf from Downtown Dubai and the airport?",
        a: "Roughly ten to fifteen minutes by car to either — Downtown via Al Khail Road, Dubai International Airport via Al Garhoud Bridge. Al Jaddaf and Creek Metro stations on the Green Line connect to the rest of the network.",
      },
    ],
    related: ["projects-in-al-jaddaf", "dubai-creek-harbour", "downtown-dubai", "properties-under-1m-in-dubai"],
  },
]

// ─── Property-type, budget and area-inventory searches ──────────────────────
// The second wave: exact-match pages for what buyers actually type. Same
// engine as PROJECT_PAGES; each entry was checked against live inventory
// before shipping (an SEO page over an empty grid is a doorway page).

const TYPE_AND_AREA_PAGES: SeoPage[] = [
  {
    slug: "apartments-for-sale-in-dubai",
    label: "Apartments for Sale in Dubai",
    title: "Apartments for Sale in Dubai — New & Off-Plan",
    updated: COPY_UPDATED,
    h1: "Apartments for Sale in Dubai",
    description:
      "Apartments for sale in Dubai — studios to four-bedroom residences in new and off-plan projects, with developer prices and handover dates.",
    intro: [
      "Apartments are Dubai's core market: the deepest choice, the easiest resale, and the strongest rental demand. This page gathers every apartment project we cover in Dubai — from compact studios in JVC to waterfront residences — each with its developer's own pricing.",
      "Open any card for the full picture: unit types, sizes, payment plan and handover date. If you tell us your budget and whether you're buying to live or to let, we'll send a shortlist the same business day.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", propertyTypeLike: "apartment" },
    faqs: [
      {
        q: "How much does an apartment cost in Dubai?",
        a: "Studios in emerging districts start around AED 500,000, one-bedrooms typically run AED 700,000 to 1.5 million, and prime waterfront or Downtown addresses go well beyond. Every project on this page lists its own starting price.",
      },
      {
        q: "Which areas offer the best value for apartments?",
        a: "Jumeirah Village Circle, Dubailand and Dubai South consistently offer the lowest price per square foot, while Business Bay and Downtown command a premium for location. Value depends on whether you optimise for yield or capital growth.",
      },
      {
        q: "What rental yield do Dubai apartments achieve?",
        a: "Apartments in affordable districts commonly achieve 6–8% gross yields, among the highest of any major global city. Prime areas trade some yield for stronger capital appreciation.",
      },
    ],
    related: ["penthouses-for-sale-in-dubai", "properties-under-1m-in-dubai", "projects-in-jumeirah-village-circle", "new-projects-in-dubai"],
  },
  {
    slug: "villas-for-sale-in-dubai",
    label: "Villas for Sale in Dubai",
    title: "Villas for Sale in Dubai — New & Off-Plan",
    updated: COPY_UPDATED,
    h1: "Villas for Sale in Dubai",
    description:
      "Villas for sale in Dubai — standalone and community villas in new and off-plan projects, with developer prices and handover dates.",
    intro: [
      "Villa living is what Dubai's master-planned communities do best: gated districts with parks, pools and schools inside the fence, and a private garden at the end of the day. These are the villa projects currently on our books in Dubai.",
      "Villa supply is structurally tighter than apartments — communities release in phases and the best plots go first — so if a project below fits, moving early matters more here than anywhere else in the market.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", propertyTypeLike: "villa" },
    related: ["townhouses-for-sale-in-dubai", "arabian-ranches", "dubai-hills-estate", "new-projects-in-dubai"],
  },
  {
    slug: "townhouses-for-sale-in-dubai",
    label: "Townhouses for Sale in Dubai",
    title: "Townhouses for Sale in Dubai — Family Homes",
    updated: COPY_UPDATED,
    h1: "Townhouses for Sale in Dubai",
    description:
      "Townhouses for sale in Dubai — three and four-bedroom family homes in gated communities, with developer prices and handover dates.",
    intro: [
      "The townhouse is Dubai's family workhorse: three or four bedrooms, a small garden, and community amenities — at a price meaningfully below a standalone villa. Most of the action is in the newer belts, where developers launch whole townhouse districts at once.",
      "Every project below shows its developer pricing and payment plan. Told simply: if you need bedrooms and a school run rather than a skyline view, this page is where Dubai gives you the most home per dirham.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", propertyTypeLike: "townhouse" },
    related: ["villas-for-sale-in-dubai", "projects-in-dubailand", "properties-under-1m-in-dubai", "dubailand"],
  },
  {
    slug: "penthouses-for-sale-in-dubai",
    label: "Penthouses for Sale in Dubai",
    title: "Penthouses for Sale in Dubai — Sky Residences",
    updated: COPY_UPDATED,
    h1: "Penthouses for Sale in Dubai",
    description:
      "Penthouses for sale in Dubai — full-floor and duplex sky residences in the city's landmark towers, with developer pricing and handover dates.",
    intro: [
      "The penthouse market is Dubai at its most confident: full-floor plates, private pools, and terraces with the skyline as the fourth wall. Developers release only a handful per tower, and they increasingly sell before the public launch.",
      "These are the projects on our books with penthouse residences available now. For off-market penthouses — a real share of this segment — speak to us directly; the best units rarely appear on a listing page.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", propertyTypeLike: "penthouse" },
    related: ["apartments-for-sale-in-dubai", "golden-visa-properties-in-dubai", "downtown-dubai", "palm-jumeirah"],
  },
  {
    slug: "properties-under-1m-in-dubai",
    label: "Properties Under AED 1M",
    title: "Properties Under AED 1M in Dubai — New Projects",
    updated: COPY_UPDATED,
    h1: "Properties Under AED 1M in Dubai",
    description:
      "Dubai properties under AED 1 million — studios, apartments and affordable projects with developer prices, curated from live inventory.",
    intro: [
      "One million dirhams is Dubai's most-searched budget line, and the market clears it comfortably: whole districts — JVC, Dubailand, Dubai South, Majan — launch projects with studios and one-bedrooms well under it. This page tracks every project on our books with starting prices below AED 1M.",
      "At this budget the levers that matter are payment plan length and service charges, not just the headline price. Both are on each project page, and our consultants will happily stress-test the numbers with you.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", priceMax: 1_000_000 },
    faqs: [
      {
        q: "What can I buy in Dubai for under AED 1 million?",
        a: "Comfortably: studios and one-bedroom apartments across JVC, Dubailand, Dubai South and similar districts, and at the lower end even select two-bedroom units at launch pricing. This page lists live projects with starting prices under AED 1M.",
      },
      {
        q: "Can I get a payment plan under AED 1M?",
        a: "Yes — affordable districts are where developers compete hardest on plans. Construction-linked instalments with 10–20% down are standard, and post-handover plans appear regularly.",
      },
      {
        q: "Is the under-1M segment a good investment?",
        a: "It is Dubai's strongest yield segment: gross rental yields of 6–8% are common because rents in these districts hold up well against entry prices. The trade-off is slower capital growth than prime areas.",
      },
    ],
    related: ["apartments-for-sale-in-dubai", "projects-in-jumeirah-village-circle", "projects-in-dubailand", "off-plan-projects-in-dubai"],
  },
  {
    slug: "golden-visa-properties-in-dubai",
    label: "Golden Visa Properties",
    title: "Golden Visa Properties in Dubai — AED 2M+",
    updated: COPY_UPDATED,
    h1: "Golden Visa Properties in Dubai",
    description:
      "Dubai properties priced from AED 2 million — the investment threshold for the UAE's 10-year Golden Visa. Live projects with developer pricing.",
    intro: [
      "Buy property worth AED 2 million or more in Dubai and you qualify to apply for the UAE's 10-year renewable Golden Visa — residency for you and your family, with no sponsor required. This page gathers the projects on our books whose pricing starts at or above that threshold.",
      "The visa is one of the strongest reasons international buyers choose Dubai over other global markets: the same capital that buys the home also settles the family. Our consultants handle both sides — the property and the visa paperwork that follows it.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", priceMin: 2_000_000 },
    faqs: [
      {
        q: "How much do I need to invest for a Dubai Golden Visa?",
        a: "AED 2 million in property qualifies you to apply for the 10-year Golden Visa. The amount can be a single property or, under current practice, combined across properties.",
      },
      {
        q: "Does off-plan property count for the Golden Visa?",
        a: "Yes — off-plan purchases from approved developers can qualify, and mortgaged properties can too, subject to the equity and bank-letter requirements in force at application time.",
      },
      {
        q: "Who can I sponsor with a Golden Visa?",
        a: "Golden Visa holders can sponsor their spouse, children (with no age cap for unmarried children, under current rules) and support staff — the whole household settles on the back of one qualifying investment.",
      },
    ],
    related: ["dubai-golden-visa-property-guide", "penthouses-for-sale-in-dubai", "downtown-dubai", "palm-jumeirah"],
  },
  {
    slug: "projects-in-jumeirah-village-circle",
    label: "Projects in JVC",
    title: "New Projects in JVC — Jumeirah Village Circle",
    updated: COPY_UPDATED,
    h1: "New Projects in Jumeirah Village Circle",
    description:
      "Every JVC project on our books — new launches and under-construction towers in Jumeirah Village Circle with developer prices and handover dates.",
    intro: [
      "JVC is Dubai's busiest launch pad: more new projects break ground here than in any other district, because the arithmetic works — central location, freehold ownership, and entry prices the coastal districts left behind years ago. These are the JVC projects live on our books right now.",
      "With this much simultaneous supply, developer selection is the whole game in JVC. Delivery track record and service-charge levels separate the towers that hold value from the ones that don't — ask us for the honest comparison before you commit.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "jumeirah village circle" },
    related: ["jumeirah-village-circle", "properties-under-1m-in-dubai", "projects-in-jumeirah-village-triangle", "apartments-for-sale-in-dubai"],
  },
  {
    slug: "projects-in-business-bay",
    label: "Projects in Business Bay",
    title: "New Projects in Business Bay — Canal Towers",
    updated: COPY_UPDATED,
    h1: "New Projects in Business Bay",
    description:
      "New and off-plan projects in Business Bay, Dubai — canal-side towers and branded residences minutes from Downtown, with developer pricing.",
    intro: [
      "Business Bay is Downtown's engine room: the same postcode energy at a friendlier ticket, with the canal boardwalk replacing the fountain views. It has become Dubai's laboratory for branded residences, and the launch calendar here rarely pauses.",
      "The projects below are selling now. Buy here for address and liquidity — the Bay's resale and rental markets are among the deepest in the city, powered by the office towers next door.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "business bay" },
    related: ["business-bay", "downtown-dubai", "apartments-for-sale-in-dubai", "new-projects-in-dubai"],
  },
  {
    slug: "projects-in-dubailand",
    label: "Projects in Dubailand",
    title: "New Projects in Dubailand — Family Communities",
    updated: COPY_UPDATED,
    h1: "New Projects in Dubailand",
    description:
      "New and off-plan projects in Dubailand — townhouse districts and value apartments in Dubai's biggest family belt, with developer prices and handover dates.",
    intro: [
      "Dubailand is where Dubai builds room to grow: self-contained family communities with pools, parks and schools inside the gates, at the widest price-to-space ratio in the city. The launch calendar here never stops, which is exactly what keeps pricing honest.",
      "It is less one neighbourhood than a belt of them. Arjan and Majan supply mid-rise apartments beside Dubai Miracle Garden and the Al Barari fringe; Dubai Land Residence Complex (DLRC) and Liwan run to value studios and one-beds; Wadi Al Safa, Villanova, Rukan and Mudon are townhouse and villa country. Prices on our books span compact apartments from under AED 500,000 to villas above AED 5 million — no other Dubai district covers that range.",
      "These are the Dubailand projects live on our books. The variable that deserves your attention in this belt is delivery track record — it varies more here than anywhere else, and it's the first thing we check before recommending a project.",
      "Two practical notes for buyers: the district is car-first — the Metro does not reach Dubailand, so weigh the drive to Sheikh Mohammed bin Zayed Road and Al Ain Road — and service charges in the gated townhouse communities are typically lower than in tower districts, which shows up in net yield.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "dubailand" },
    faqs: [
      {
        q: "Which areas count as Dubailand?",
        a: "Dubailand is a master-development belt along Sheikh Mohammed bin Zayed and Al Ain Roads. Its main residential districts are Arjan, Majan, Dubai Land Residence Complex (DLRC), Liwan, Wadi Al Safa, Villanova, Rukan and Mudon, with Global Village, IMG Worlds of Adventure and Dubai Miracle Garden as the landmarks.",
      },
      {
        q: "How much do new projects in Dubailand cost?",
        a: "Studios and one-beds in the apartment districts — DLRC, Liwan, Majan, Arjan — start from roughly AED 400,000 to 650,000 in current launches; townhouses and villas in the gated communities run from the low millions upward. Exact prices sit on each project page.",
      },
      {
        q: "Is there a Metro station in Dubailand?",
        a: "Not yet. The belt is served by Sheikh Mohammed bin Zayed Road, Al Ain Road and Emirates Road; the planned Blue Line is scheduled to reach Academic City and Dubai Silicon Oasis on its eastern edge, but most Dubailand communities will remain car-first.",
      },
      {
        q: "Is Dubailand a good area for off-plan investment?",
        a: "For price-to-space and family rental demand, yes — it is where Dubai's mid-market growth lands. The risk to manage is delivery: track records vary more here than anywhere else, so we weigh the developer's completed phases before the payment plan.",
      },
    ],
    related: ["dubailand", "townhouses-for-sale-in-dubai", "properties-under-1m-in-dubai", "new-projects-in-dubai"],
  },
  {
    slug: "projects-in-jumeirah-village-triangle",
    label: "Projects in JVT",
    title: "New Projects in JVT — Jumeirah Village Triangle",
    updated: COPY_UPDATED,
    h1: "New Projects in Jumeirah Village Triangle",
    description:
      "New and off-plan projects in Jumeirah Village Triangle (JVT), Dubai — quieter than JVC with the same central value, developer prices included.",
    intro: [
      "JVT is JVC's quieter sibling: the same central location between Al Khail and Sheikh Mohammed bin Zayed roads, but lower density, more townhouses, and a settled, residential feel. New towers are now joining the district's original villa fabric.",
      "The projects below are live in JVT now. Buyers cross-shop it with JVC on price — the premium for JVT's calm is usually smaller than people expect, which is the quiet opportunity here.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "jumeirah village triangle" },
    related: ["projects-in-jumeirah-village-circle", "townhouses-for-sale-in-dubai", "new-projects-in-dubai", "jumeirah-village-circle"],
  },
  {
    slug: "projects-in-al-jaddaf",
    label: "Projects in Al Jaddaf",
    title: "New Projects in Al Jaddaf — Off-Plan Prices",
    updated: COPY_UPDATED,
    h1: "New Projects in Al Jaddaf",
    description:
      "New and off-plan projects in Al Jaddaf, Dubai — Binghatti and Azizi towers on the Creek, minutes from Downtown and the airport, with developer prices.",
    intro: [
      "Al Jaddaf has quietly become one of the busiest off-plan districts in central Dubai. The creekside strip between Dubai Healthcare City and Ras Al Khor is filling with mid- and high-rise apartment towers, most of them from Binghatti and Azizi, with handovers rolling from 2026 into 2028.",
      "The projects below are live in Al Jaddaf now. Read the price column against the map: these are Downtown-adjacent addresses with Metro access, priced closer to the outer belts. Studio and one-bedroom launches cluster between AED 700,000 and AED 850,000; the premium is for creek views and the newer Jaddaf Waterfront plots.",
      "Because so much of the district delivers in the same two-year window, compare handover dates and payment schedules side by side — a project completing in 2026 buys certainty, a 2028 launch buys the longest plan and the widest unit choice.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "jaddaf" },
    faqs: [
      {
        q: "What is the starting price for off-plan apartments in Al Jaddaf?",
        a: "Most current launches start between AED 700,000 and AED 850,000 for studios and one-bedroom units, with two- and three-bedroom apartments and creek-view units priced above that. Exact figures sit on each project page.",
      },
      {
        q: "When do the Al Jaddaf projects hand over?",
        a: "The current pipeline delivers between 2026 and 2028 — several Binghatti towers in 2026–2027, the larger Azizi communities into 2028. Every project page shows its scheduled quarter.",
      },
      {
        q: "Is Al Jaddaf connected to the Dubai Metro?",
        a: "Yes — Al Jaddaf and Creek stations on the Green Line both serve the district, which is rare among Dubai's off-plan hotspots and a core part of its rental case.",
      },
    ],
    related: ["al-jaddaf", "apartments-for-sale-in-dubai", "properties-under-1m-in-dubai", "dubai-projects-handover-2027"],
  },
]

// ─── Handover-year searches ──────────────────────────────────────────────────
// Investors shop by delivery date ("projects handover 2027 dubai"). Backed by
// delivery_quarter / expected_completion_date. In the 2026-10-06 crawl 14 Dubai projects hand
// over in 2030 and only 2 in 2031, so 2030 has a page and 2031 does not (add a year when it has
// enough projects to fill a grid; HANDOVER_INTRO is typed so a year without copy fails tsc).

const HANDOVER_INTRO: Record<HandoverYear, string[]> = {
  "2026": [
    "Handover in 2026 means the finish line is in sight: construction is in its final stretches, most of the payment plan is already behind the original buyers, and what's left on the market skews toward assignments and the developer's last units. These are the Dubai projects scheduled to hand over in 2026.",
    "Buying this close to completion trades the longest payment plans for near-term certainty — you can see what you're getting, and rent starts flowing within months rather than years.",
  ],
  "2027": [
    "2027 is the current sweet spot of Dubai's off-plan market: far enough out for a genuine construction-linked payment plan, close enough that the wait is measured in a couple of years. This page tracks every project on our books delivering in 2027.",
    "Mid-build projects also carry the clearest signal — you can see how construction is actually progressing before you commit, not just the render.",
    "The 2027 pipeline on our books is mid-market by design: the bulk of launches sit under AED 1 million, concentrated in Dubailand and Majan, Business Bay, Jumeirah Village Circle, Al Furjan and Al Jaddaf, with Binghatti, Samana, Azizi and Reportage taking the largest share of deliveries. Q4 2027 is the single busiest quarter.",
    "For anyone buying in 2026, a 2027 handover typically means 18–24 months of construction-linked instalments, then rent — or a resale in a completed building — from late 2027. Check three things on each project page: the developer's record on earlier phases, whether the plan carries post-handover instalments, and the SPA's grace period, which in Dubai commonly runs six to twelve months past the stated quarter.",
  ],
  "2028": [
    "Projects handing over in 2028 are today's launches and early-construction communities — which is exactly where launch pricing and the friendliest payment plans live. These are the 2028 deliveries we cover in Dubai.",
    "The longer runway suits investors paying from cash flow: instalments spread across three years, with the balance often payable at or after handover.",
  ],
  "2029": [
    "A 2029 handover sits near the far end of Dubai's off-plan calendar: brand-new launches at first-release pricing, with some of the longest payment plans in the market. These are the projects scheduled to deliver in 2029.",
    "Early entry earns the widest unit choice — the best stacks, views and floor plates go in the first releases — in exchange for patience and faith in the developer's track record. We help with the second part.",
  ],
  "2030": [
    "Projects handing over in 2030 sit at the far end of Dubai's off-plan calendar: recent launches whose construction is only beginning, which typically carry the longest instalment schedules a buyer can sign today. These are the 2030 deliveries on our books in Dubai.",
    "The distance cuts both ways. It buys first choice of units and the most gradual payment schedule, and it asks for patience and trust in the developer — so check their record on completed projects, not just the renders, before you reserve.",
  ],
}

// The mechanics of handover are the same every year; buyers searching by
// delivery date ask exactly these questions.
const HANDOVER_FAQS = (year: string): { q: string; a: string }[] => [
  {
    q: `What does "handover in ${year}" actually mean?`,
    a: `The developer expects to complete construction and hand over the keys during ${year}, once the building has its completion certificate and the buyer has paid the instalments due at completion. The quarter shown on each project page is the developer's schedule, not a guarantee.`,
  },
  {
    q: "Can the handover date slip?",
    a: "Yes. Off-plan sale agreements in Dubai typically allow a grace period — commonly six to twelve months — beyond the stated date before the buyer has remedies, and schedules do move. A developer's record on its earlier phases is the most reliable predictor.",
  },
  {
    q: "What do I pay at handover?",
    a: "The completion instalment under your payment plan, the Dubai Land Department title-deed registration (the 4% DLD fee is usually settled at Oqood registration when you buy — check your agreement), utility connection deposits, and the first service-charge period. Any post-handover instalments then continue on schedule.",
  },
  {
    q: "Can I sell an off-plan unit before handover?",
    a: "Usually yes, by assigning the sale agreement to a new buyer once a minimum share of the price — commonly 30–40% — has been paid and the developer issues a no-objection certificate. Each developer sets its own threshold and fee.",
  },
]

const HANDOVER_PAGES: SeoPage[] = HANDOVER_YEARS.map((year) => ({
  slug: `dubai-projects-handover-${year}`,
  label: `Handover ${year}`,
  title: `Dubai Projects Handing Over in ${year} — Off-Plan`,
  updated: COPY_UPDATED,
  h1: `Dubai Projects Handing Over in ${year}`,
  description: `Off-plan projects in Dubai with handover scheduled for ${year} — developer prices, construction status and delivery quarter, updated from live inventory.`,
  intro: [...HANDOVER_INTRO[year]],
  kind: "projects" as const,
  filter: { cityLike: "dubai", handoverYear: year },
  sort: "handover" as const,
  faqs: HANDOVER_FAQS(year),
  // Every year links every sibling year, and the off-plan hub links all of them back.
  related: [
    ...HANDOVER_YEARS.filter((y) => y !== year).map((y) => `dubai-projects-handover-${y}`),
    "off-plan-projects-in-dubai",
    "how-to-buy-off-plan-property-in-dubai",
  ],
}))

// ─── Buyer guides ────────────────────────────────────────────────────────────
// Informational pages answering the questions every Dubai buyer searches
// before committing. Static content on the guide template; each carries
// FAQPage structured data for rich results.

const INFO_GUIDES: SeoPage[] = [
  {
    slug: "dubai-golden-visa-property-guide",
    label: "Golden Visa Property Guide",
    title: "Dubai Golden Visa via Property — AED 2M Guide",
    updated: COPY_UPDATED,
    guideType: "buyer",
    h1: "The Dubai Golden Visa Through Property Investment",
    description:
      "How to get the UAE's 10-year Golden Visa by buying property in Dubai — the AED 2M threshold, what qualifies, the process, and family sponsorship.",
    intro: [
      "The UAE Golden Visa is a 10-year renewable residency, and property investment is one of the ways to qualify: buy real estate worth AED 2 million or more and you can apply without an employer, without a local sponsor and without having to spend a minimum number of days in the country to keep it valid.",
      "For many international buyers that is the most valuable thing about the Dubai market — the same capital that buys the home also secures long-term residency for the whole family. It is also an area where the rules have changed several times since the visa launched in 2019, so this guide separates what is stable (the AED 2 million threshold, the 10-year term, family sponsorship) from what you should confirm with the authorities on the day you apply: equity requirements for mortgaged and off-plan purchases, document lists and processing times.",
    ],
    kind: "guide",
    imageQuery: "downtown",
    factsHeading: "The Golden Visa at a glance",
    facts: [
      { label: "Investment threshold", value: "AED 2 million in property — a single property or several combined" },
      { label: "Visa length", value: "10 years, renewable while you keep the qualifying investment" },
      { label: "Family", value: "Your spouse and children can be sponsored under your visa" },
      { label: "Off-plan", value: "Can qualify when bought from developers approved for the scheme — confirm the paid-up rule" },
      { label: "Mortgages", value: "Financed purchases can qualify — the equity and bank-letter rules change, so confirm first" },
      { label: "Stay requirement", value: "No minimum days in the UAE to keep the visa valid" },
    ],
    sections: [
      {
        heading: "How do you apply for the Golden Visa through property?",
        answer:
          "Complete and register a qualifying purchase with the Dubai Land Department, then apply through the official Golden Visa channels with your title deed (or Oqood for an off-plan unit), passport, photographs and a medical fitness test — a straightforward file can be approved in days to a few weeks.",
        body: [
          "The order matters. Confirm eligibility before you pay, not after: the value that counts is the price registered with the Dubai Land Department, so check that the unit clears AED 2 million on the contract price rather than on a brochure or a pre-discount list price. Once the sale is registered you will hold a title deed for a ready property, or an Oqood — the interim registration — for an off-plan one.",
          "Then you apply. Applicants normally submit through the Dubai Land Department's property-investor services or the federal residency channels, with the registered deed or Oqood, a valid passport and passport-style photographs; once the application is accepted you complete a medical fitness test and Emirates ID biometrics. Whether you apply from inside or outside the country, and the current document checklist, change the exact route — and the authorities update both — so we confirm the live requirements with you before every application rather than relying on a PDF that may be a year old.",
          "Plan for the paperwork around the visa as well: health insurance that meets the emirate's rules for your family, an address for the Emirates ID, and — if you sponsor dependants — their own attested documents, such as marriage and birth certificates, with Arabic translations where required.",
        ],
      },
      {
        heading: "What property qualifies for the Golden Visa?",
        answer:
          "Property registered in your name with a value of at least AED 2 million; the value can be spread across more than one property, and off-plan and mortgaged purchases can qualify under conditions the authorities set.",
        body: [
          "Three points decide most cases. First, the threshold is measured on registered value and on what you own: combining several properties to reach AED 2 million has been accepted, but jointly owned property is assessed by each owner's own share, so one AED 2.5 million apartment bought 50/50 does not, by itself, qualify two people.",
          "Second, off-plan. A project bought from a developer approved for the scheme can support an application on the Oqood registration; what has varied is how much of the price must already be paid when you apply. Third, mortgages. A financed home can qualify, but the minimum equity you must have paid in and the bank's no-objection letter have been adjusted more than once. These two points are exactly where a general web page goes out of date first, so treat anything you read about them — including here — as a prompt to ask, and have the current rule confirmed in writing before you commit.",
          "If you are choosing between projects partly for the visa, look for homes priced comfortably above the line rather than on it: a unit at AED 2,000,000 on paper that is adjusted at registration can slip underneath. Our AED 2M+ projects page lists current options, and a consultant will check each unit's contract price against the threshold before you reserve.",
        ],
      },
      {
        heading: "Why do investors use the property Golden Visa?",
        answer:
          "Because it makes residency independent of an employer: the visa lets a whole family live, study and bank in the UAE for ten years, with no sponsor and no minimum stay.",
        body: [
          "Stability is the honest answer. Employment visas end with the job; a Golden Visa tied to a property does not. Holders can sponsor a spouse and children, and are not required to spend any part of the year in the UAE to keep the residency valid — though a long absence is worth discussing with an adviser if you also care about a UAE tax residency certificate or your banking relationships.",
          "The trade-offs are just as plain. The visa rests on the investment: if you sell the qualifying property, or its value falls below the threshold, the basis for the residency goes with it, so it suits buyers who intend to hold. It is residency, not citizenship, and it does not change your obligations in your home country — tax residency and reporting rules there remain yours to check.",
        ],
      },
      {
        heading: "How long does the Golden Visa take, and what does it cost?",
        answer:
          "Plan on days to a few weeks for a complete application; the government fees are small next to the purchase and change from time to time, so we quote them on the day rather than print a figure that could be wrong.",
        body: [
          "Timing depends on the route and on how complete the file is — missing attestations and unpaid fees are the usual delays. Most of the real cost of a Golden Visa purchase is the purchase itself, so read the buying-costs guide before you budget: the Dubai Land Department's transfer fee alone is 4% of the price.",
        ],
      },
      {
        heading: "Is there a lower-cost investor visa?",
        answer:
          "Dubai has also offered a renewable two-year investor residence for property from AED 750,000; it is a different visa with a shorter term, so check that it is currently available before relying on it.",
        body: [
          "If your budget sits below AED 2 million, a smaller property can still support a shorter residence visa under the property-investor route. We mention it for completeness: the term is shorter, it needs renewing, and the conditions are set by the authorities — so ask for the current position instead of assuming the figure above is unchanged.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the minimum property investment for a UAE Golden Visa?",
        a: "AED 2 million. The value can sit in a single property or be combined across several, based on values registered with the Dubai Land Department.",
      },
      {
        q: "Can I get a Golden Visa with an off-plan property?",
        a: "Yes — off-plan purchases from approved developers can qualify, using the Oqood registration in place of a title deed. Confirm the current paid-up requirement before you rely on it.",
      },
      {
        q: "Can I get a Golden Visa with a mortgage?",
        a: "Possibly. A financed home can qualify, but the equity you must have paid and the documents the bank must provide are conditions the authorities have changed before. Ask for the current rule in writing before you exchange contracts.",
      },
      {
        q: "Do I lose the visa if I sell the property?",
        a: "The visa is tied to holding a qualifying investment. Selling below the threshold ends that basis, so plan to hold — or replace — the qualifying asset for as long as you want the residency.",
      },
      {
        q: "Can my family get residency too?",
        a: "Yes. Golden Visa holders can sponsor a spouse and children, so one qualifying purchase can settle the household. The age rules for children have been relaxed over time — confirm the current limits for your family.",
      },
      {
        q: "Do I have to live in Dubai to keep the Golden Visa?",
        a: "No. Unlike many residence visas, the Golden Visa does not require you to spend a minimum number of days in the UAE to keep it valid.",
      },
      {
        q: "Is the Golden Visa the same as UAE citizenship?",
        a: "No. It is long-term residency. It does not give a UAE passport or change your tax obligations in your home country.",
      },
    ],
    sources: [
      { label: "Dubai Land Department", url: "https://dubailand.gov.ae/en/" },
      { label: "UAE Government Portal — residency and visas", url: "https://u.ae/en" },
      { label: "Federal Authority for Identity, Citizenship, Customs and Port Security (ICP)", url: "https://icp.gov.ae/en/" },
      { label: "General Directorate of Residency and Foreigners Affairs — Dubai (GDRFA)", url: "https://gdrfad.gov.ae/en" },
    ],
    related: ["golden-visa-properties-in-dubai", "can-foreigners-buy-property-in-dubai", "dubai-property-buying-costs"],
  },
  {
    slug: "how-to-buy-off-plan-property-in-dubai",
    label: "How to Buy Off-Plan",
    title: "How to Buy Off-Plan Property in Dubai — 6 Steps",
    updated: COPY_UPDATED,
    guideType: "buyer",
    h1: "How to Buy Off-Plan Property in Dubai",
    description:
      "The complete off-plan buying process in Dubai: booking, SPA and Oqood registration, escrow protection, payment plans and handover — step by step.",
    intro: [
      "Off-plan is how most investors enter the Dubai market: you buy at today's price while the project is still being built, pay in instalments tied to a payment plan, and take handover of a brand-new home. It is also more regulated — and better protected — than most first-time buyers expect, because Dubai requires developers to register their projects, hold buyers' money in a supervised escrow account and record every sale with the Dubai Land Department.",
      "This guide walks the full journey from shortlist to keys: what you sign, what you pay and when, what protects your money, what happens if the date slips, and how to resell before completion. Read it once and the project pages on this site will make complete sense — every price, plan and handover date you see slots into the steps below.",
    ],
    kind: "guide",
    factsHeading: "The process at a glance",
    facts: [
      { label: "1 · Reserve", value: "Booking form + deposit, typically 5–20% of the price" },
      { label: "2 · Contract", value: "Sign the SPA; the sale registers with the Dubai Land Department as an Oqood" },
      { label: "3 · Pay in stages", value: "Instalments on the developer's payment plan" },
      { label: "4 · Protected funds", value: "Payments go into a regulated project escrow account" },
      { label: "5 · Fees", value: "4% DLD registration plus admin fees, usually settled around contract signing" },
      { label: "6 · Handover", value: "Snag the unit, settle the balance, receive keys and title" },
    ],
    sections: [
      {
        heading: "How does an off-plan purchase go from shortlist to contract?",
        answer:
          "You choose a unit, pay a booking deposit, sign the Sale and Purchase Agreement (SPA), and the sale is registered with the Dubai Land Department as an Oqood — your official record of ownership until the title deed issues at completion.",
        body: [
          "Start with the unit, not the brochure: ask for the floor plan, the exact unit number and the price list for that stack, because prices differ by floor and view. The reservation takes a booking form and a deposit — typically 5–20% of the price depending on the developer — and, in most cases, a short window in which to sign the SPA.",
          "Read the SPA for the things that decide the outcome: the payment schedule and what triggers each instalment, the anticipated completion date and its grace period, what happens if the developer is late, your right to assign (resell) the contract and from what payment threshold, and the fees due at registration. The 4% Dubai Land Department registration fee is normally settled around contract signing, so keep that cash ready. If anything is unclear, ask a lawyer — the SPA is a binding contract.",
          "Once registered, the Oqood certificate is your evidence of ownership. It is what a bank, a Golden Visa application or a future buyer will look at until the title deed is issued.",
        ],
      },
      {
        heading: "Why does escrow make off-plan buying safe?",
        answer:
          "Because buyers' instalments go into a project-specific escrow account supervised under Dubai's escrow law, and the developer can draw money out only as independent engineers certify construction milestones.",
        body: [
          "Dubai's escrow law (Law No. 8 of 2007) requires every off-plan project to run an escrow account with a licensed bank, and RERA — the Real Estate Regulatory Agency, part of the Dubai Land Department — oversees developers and project registrations. Your instalments are paid into that account, not into the developer's operating account, and funds are released against certified progress. If a project stalls, what has been collected is ring-fenced for it.",
          "That protection is real, but it protects your money, not your schedule: delays still happen, and the developer's track record remains the best predictor of a smooth delivery. Always pay by bank transfer into the escrow account named in your SPA — never to an individual or to a different account, whatever a salesperson or intermediary says.",
        ],
      },
      {
        heading: "How do you choose the right off-plan project?",
        answer:
          "Weigh the developer's delivery record, the area's rental demand today and a payment plan you could carry comfortably if your circumstances changed — in that order.",
        body: [
          "Ask for completed projects, not renders: when were the developer's previous towers handed over relative to their announced dates, and what do owners there say about build quality and service charges? Look at the location as it is today — walkable amenities, the metro or main roads, whether the neighbourhood already has tenants — rather than the masterplan's promise. And test the payment plan against a bad year: if the next instalment fell due during a period of lower income, could you still meet it?",
          "Then compare like with like. Two projects at similar prices can carry very different service charges, handover dates and post-handover terms. We apply these filters before a project reaches our recommendations, and every project page on this site shows the developer, the delivery quarter and the payment plan we hold on file.",
        ],
      },
      {
        heading: "What happens between booking and handover?",
        answer:
          "You pay each instalment on the schedule in your SPA, keep your contact details current with the developer, and follow construction through the developer's updates.",
        body: [
          "Most plans link instalments to construction milestones or to dates; some include a share due on completion and, in a growing number of launches, a share spread over months or years after handover. Keep every receipt and pay each instalment by its due date: SPAs set out what follows a missed payment, and the consequences can be severe.",
          "Developers send construction updates and many projects publish progress photos; asking for a site visit is also reasonable. If your plans change, remember that you can usually assign the contract to a new buyer once you have paid the share the developer requires, subject to its no-objection certificate (NOC) and fee.",
        ],
      },
      {
        heading: "What happens at handover?",
        answer:
          "You inspect and snag the unit, pay the final instalment and handover charges, receive the keys, and the Oqood converts into a title deed.",
        body: [
          "Before you accept the keys, inspect with a snagging checklist — or a professional snagger — and list every defect in writing; the developer is responsible for fixing defects within the liability period set out in the contract. You will also pay the final instalment, the first service-charge period and utility connection deposits. Then you decide how to use the home: live in it, rent it out or sell.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much deposit do I need for off-plan in Dubai?",
        a: "Booking amounts typically run 5–20% of the purchase price, followed by instalments on the developer's payment plan. The 4% DLD fee is usually payable around contract signing.",
      },
      {
        q: "What happens if the developer delays handover?",
        a: "SPAs include an anticipated completion date plus a grace period (commonly up to 12 months). Beyond it, buyers are generally entitled to the remedies set out in the contract, and RERA oversees stalled projects.",
      },
      {
        q: "Can I resell before the project completes?",
        a: "Yes — assignments are normal in Dubai. Most developers permit resale once 30–40% of the price is paid, against an NOC fee; each developer sets its own threshold.",
      },
      {
        q: "Do foreigners get the same protections?",
        a: "Identical. Escrow, Oqood registration and RERA oversight apply to every buyer regardless of nationality or residency.",
      },
      {
        q: "What is the difference between an Oqood and a title deed?",
        a: "An Oqood is the interim registration of an off-plan sale at the Dubai Land Department. The title deed is issued when the building is complete and the final payments have been made.",
      },
      {
        q: "Is the 4% DLD fee paid at booking or at handover?",
        a: "For off-plan it is normally paid at or soon after you sign the SPA, when the sale is registered — not at handover. Check the timing in your contract, because some developers offer to waive or share the fee as a launch incentive.",
      },
      {
        q: "Can I get a mortgage on an off-plan property?",
        a: "Some banks lend on off-plan, usually at a lower loan-to-value than for completed homes, and many buyers instead carry the developer's payment plan and refinance after handover. Ask the bank before you assume financing will be available.",
      },
    ],
    sources: [
      { label: "Dubai Land Department", url: "https://dubailand.gov.ae/en/" },
      { label: "UAE Government Portal — buying property", url: "https://u.ae/en" },
    ],
    related: ["off-plan-projects-in-dubai", "dubai-property-buying-costs", "new-projects-in-dubai"],
  },
  {
    slug: "dubai-property-buying-costs",
    label: "Buying Costs Explained",
    title: "Dubai Property Buying Costs — Fees & Charges",
    updated: COPY_UPDATED,
    guideType: "buyer",
    h1: "Dubai Property Buying Costs, Explained",
    description:
      "Every cost of buying property in Dubai: the 4% DLD fee, trustee and agent fees, mortgage costs and ongoing service charges — with rules of thumb.",
    intro: [
      "Dubai's headline advantage is what it does not charge: no annual property tax, no capital gains tax and no stamp duty beyond a one-time registration fee. But there are real one-time costs at purchase, and overlooking them is how first-time buyers end up surprised at the trustee office.",
      "The rule of thumb we use with clients: budget about 6–8% on top of the purchase price for a ready property bought with a mortgage, less for a cash purchase, and closer to 4–5% for an off-plan home bought direct from a developer. Below is where every dirham goes, a worked example you can check against our mortgage calculator, and the running costs of ownership that the purchase price does not show.",
    ],
    kind: "guide",
    factsHeading: "The costs at a glance",
    facts: [
      { label: "DLD transfer fee", value: "4% of the price + about AED 580 admin — the big one" },
      { label: "Trustee office", value: "≈ AED 4,000 + VAT (AED 2,000 below 500K)" },
      { label: "Agent commission", value: "Typically 2% + VAT on resale; developer sales cost you nothing" },
      { label: "Mortgage registration", value: "0.25% of the loan + AED 290, plus bank arrangement fees" },
      { label: "Valuation", value: "≈ AED 2,500–3,500 when financing" },
      { label: "Developer NOC", value: "AED 500–5,000 on resales within a project" },
    ],
    sections: [
      {
        heading: "What are the one-time costs when buying in Dubai?",
        answer:
          "The Dubai Land Department takes 4% of the purchase price at transfer, plus a small administrative fee; on top of that come the trustee office fee, your agent's commission on a resale and, if you finance, the bank's charges.",
        body: [
          "For a ready property the main items are: the DLD transfer fee (4% of the price plus an administrative fee of about AED 580), the registration trustee's fee (AED 4,000 plus VAT for most purchases, AED 2,000 plus VAT below AED 500,000), the agent's commission on a resale (usually 2% plus VAT, paid by the buyer) and, where the unit sits in a managed project, the developer's NOC. If you borrow, add the mortgage registration at 0.25% of the loan plus AED 290, a valuation fee, and the bank's arrangement fee — commonly up to 1% of the loan.",
          "An off-plan buyer pays the same 4% (registered with the Oqood) but usually no agent commission, because the developer pays the broker; a few small registration charges apply. That is why off-plan sits nearer 4–5% extra.",
        ],
        table: {
          caption: "Extra cash to budget on top of the purchase price",
          columns: ["Purchase type", "Typical extra cost"],
          rows: [
            ["Ready property with a mortgage", "6–8% of the price"],
            ["Off-plan, direct from a developer", "4–5% of the price"],
            ["Ready property, cash", "Less than a mortgaged purchase"],
          ],
        },
      },
      {
        heading: "What does a worked example look like?",
        answer:
          "On a AED 1,500,000 ready apartment bought with a 20% down payment, fees and charges come to roughly AED 102,570 (about 6.8% of the price), so the cash needed on the day is about AED 402,570 including the deposit.",
        body: [
          "The figures below use the same assumptions as our mortgage calculator — the 4% DLD fee plus AED 580, a trustee fee of AED 4,000 plus VAT, a 2% agent commission plus VAT, mortgage registration and an approximate valuation fee. They leave out the bank's arrangement fee, which varies by lender and could add up to roughly AED 12,000 on a AED 1.2 million loan. Treat the table as a planning estimate: your final figures depend on the transaction and the lender.",
        ],
        table: {
          caption: "Worked example: AED 1,500,000 ready apartment, 20% down payment",
          columns: ["Item", "Amount (AED)"],
          rows: [
            ["Down payment (20%)", "300,000"],
            ["DLD transfer fee (4% + AED 580)", "60,580"],
            ["Trustee office (incl. VAT)", "4,200"],
            ["Agent commission (2% + VAT)", "31,500"],
            ["Mortgage registration (0.25% + AED 290)", "3,290"],
            ["Bank valuation (approx.)", "3,000"],
            ["Total cash needed up front", "402,570"],
          ],
        },
      },
      {
        heading: "What does financing add beyond the mortgage registration fee?",
        answer:
          "Lenders add an arrangement fee, a valuation fee and compulsory insurance on top of the 0.25% registration, and the interest rate, the fixed-rate period and the early-settlement terms decide what the loan really costs.",
        body: [
          "The bank's arrangement fee is commonly up to 1% of the loan, plus VAT, and is sometimes negotiable; the valuation is paid by the borrower; and lenders require life cover on the borrower and building insurance on the property, both renewed each year. Those premiums are small next to the interest, but they belong in your monthly budget.",
          "The rate is the larger cost. UAE mortgages are usually priced at a fixed rate for an initial period — one to five years is common — and then reset to EIBOR plus the bank's margin, so a plan that works at today's payment should still work if the rate rises. Ask about early settlement as well: Central Bank rules limit what a lender may charge to settle a mortgage early, but the charge still decides whether refinancing after the fixed period pays off. Our mortgage calculator shows the repayment and the up-front cash side by side, and a broker can compare lenders for your profile.",
        ],
      },
      {
        heading: "What ongoing costs do Dubai property owners pay?",
        answer:
          "Service charges are the recurring cost to plan around: they fund the building's maintenance and amenities and are set per square foot each year, alongside utilities, district cooling where it applies, and insurance.",
        body: [
          "Service charges vary widely — from the low teens to well over AED 30 per square foot a year, depending on the community and its amenities — and the owners' association sets them annually. There is no annual property tax; the service charge is the nearest equivalent, so ask for the current budget and the last two years' charges before you sign. Add DEWA electricity and water, district cooling fees where a tower is connected to a central chiller (common in several dense districts), and home insurance, which a mortgage lender will require.",
          "If you rent the property out, budget for tenancy registration (Ejari), a property manager's fee if you use one, vacancy between tenants and periodic maintenance. In general, individuals who simply own and rent out property are not taxed on that income in the UAE, but a company or a business activity can be — take advice on structure before you buy.",
        ],
      },
      {
        heading: "Where do buyers overspend?",
        answer:
          "In two places: paying commission on a new launch the developer would have paid for, and underestimating service charges on amenity-heavy towers.",
        body: [
          "The first is checkable in minutes — come to the developer's broker directly, which is what we are: developer sales cost the buyer no agent commission. The second means asking for the current service-charge budget before signing. Others worth a look: ignoring chiller charges, choosing a smaller unit than you need because of a lower price per square foot, and paying a poor exchange rate on a large transfer — compare quotes from your bank and a specialist before moving six or seven figures.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the total cost on top of the price in Dubai?",
        a: "Rule of thumb: 6–8% extra for a mortgaged ready purchase (DLD 4%, trustee, agent, bank fees), around 4–5% for off-plan direct from a developer.",
      },
      {
        q: "Is there an annual property tax in Dubai?",
        a: "No. Dubai charges no annual property tax and no capital gains tax. The recurring cost of ownership is the community service charge plus utilities.",
      },
      {
        q: "Who pays the agent's commission?",
        a: "On resales, the buyer typically pays 2% + VAT. On new developer launches the developer pays the broker — buying through us costs you nothing extra.",
      },
      {
        q: "Is the DLD fee negotiable?",
        a: "The fee itself is 4% of the registered price and is customarily paid by the buyer. In a resale who bears it can be negotiated, and developers sometimes waive or share it as a launch incentive — so ask.",
      },
      {
        q: "Do I pay VAT on a property purchase in Dubai?",
        a: "In the ordinary case the purchase price of residential property is not subject to VAT. VAT at 5% does apply to fees such as the agent's commission and the trustee's charge.",
      },
    ],
    sources: [
      { label: "Dubai Land Department", url: "https://dubailand.gov.ae/en/" },
      { label: "Central Bank of the UAE", url: "https://www.centralbank.ae/en/" },
    ],
    related: ["how-to-buy-off-plan-property-in-dubai", "ready-properties-in-dubai", "dubai-golden-visa-property-guide"],
  },
  {
    slug: "can-foreigners-buy-property-in-dubai",
    label: "Foreign Buyer Guide",
    title: "Can Foreigners Buy Property in Dubai? The Rules",
    updated: COPY_UPDATED,
    guideType: "buyer",
    h1: "Can Foreigners Buy Property in Dubai?",
    description:
      "Yes — foreigners can own Dubai property 100% freehold in designated zones, with no residency required. The rules, the zones and the process.",
    intro: [
      "Yes — and more completely than in almost any comparable market. Since 2002, foreign nationals can buy, own, sell and lease property in Dubai's designated freehold zones with 100% ownership, a government-issued title deed, and no requirement to live in — or even visit — the UAE.",
      "Practically every district an international buyer has heard of is freehold: Dubai Marina, Downtown, Palm Jumeirah, JVC, Business Bay, Dubai Hills and many more. This guide covers how ownership works, how overseas buyers complete purchases remotely, how non-residents finance a purchase, and the checks that keep a foreign buyer on the right side of a regulated process.",
    ],
    kind: "guide",
    imageQuery: "marina",
    factsHeading: "Foreign ownership at a glance",
    facts: [
      { label: "Ownership", value: "100% freehold in designated zones — full title in your name" },
      { label: "Residency", value: "Not required to buy, own or sell" },
      { label: "Visa path", value: "AED 2M+ property can qualify you for the 10-year Golden Visa" },
      { label: "The zones", value: "Marina, Downtown, Palm, JVC, Business Bay and many more districts" },
      { label: "Financing", value: "UAE banks lend to non-residents, typically 50–60% of value" },
      { label: "Inheritance", value: "A DIFC Wills registration protects non-Muslim succession wishes" },
    ],
    sections: [
      {
        heading: "How does freehold ownership work for foreigners?",
        answer:
          "In Dubai's designated freehold areas a foreign buyer owns the property outright: a title deed from the Dubai Land Department in their own name, with the same rights to sell, lease, mortgage or pass it on as a UAE national.",
        body: [
          "Inside the designated zones, ownership is identical to a UAE national's: no local partner, no time limit on the holding, and a title deed registered with the Dubai Land Department. Outside those zones, foreign ownership is generally limited to long leasehold or usufruct terms — which is why it pays to confirm that a project sits in a freehold zone before you reserve. Every project page on this site shows the community, and our consultants confirm the ownership type for you.",
          "Dubai is only one of the emirates. Abu Dhabi has its own regime that lets foreigners own freehold in its designated investment areas, and Sharjah, Ajman and Ras Al Khaimah each set their own rules and zones — if you are looking beyond Dubai, ask us which regime applies to the project you have in mind.",
        ],
      },
      {
        heading: "Can you buy Dubai property from abroad?",
        answer:
          "Yes — reservation, contract and payment can all be completed remotely, and a power of attorney can stand in for you at the transfer.",
        body: [
          "Remote purchases are routine: contracts are signed digitally, funds move by bank transfer into regulated accounts (the project escrow account for off-plan, the registered trustee process for a ready home), and a power of attorney can represent you at the transfer appointment. A passport is the only document a cash buyer strictly needs to get started, although developers and the Dubai Land Department also ask for evidence of the source of funds — so have your bank statements ready.",
          "A few practical checks for an overseas purchase: pay only into the account named in the contract or through the trustee process, never to an individual; use a power of attorney drawn up for the specific transaction and notarised and attested for use in the UAE; keep copies of everything you sign; and, if your home country has exchange controls, talk to your bank early about transfer timing.",
        ],
      },
      {
        heading: "How do non-residents finance a Dubai purchase?",
        answer:
          "UAE banks lend to non-residents on completed property, usually at a lower loan-to-value than for residents; off-plan buyers more often carry the developer's payment plan and refinance after handover.",
        body: [
          "On a completed home, non-residents typically borrow in the region of 50–60% of the value, against 75–80% for a resident's first home, within the Central Bank's loan-to-value limits and each bank's own checks; rates are usually linked to EIBOR plus a margin. Expect to show income evidence, bank statements and a credit report from your home country, and to pay a larger deposit than a resident would — the process is more document-heavy, and a mortgage broker who works with several UAE banks usually saves weeks.",
          "Off-plan purchases are usually carried on the developer's payment plan instead, which carries no interest by construction, and some buyers then refinance with a mortgage at or after handover. Whichever route you take, ask the bank for its terms in writing before you assume financing will be available.",
        ],
      },
      {
        heading: "Which areas of Dubai can foreigners buy in?",
        answer:
          "Most of the districts international buyers search for are freehold — including Dubai Marina, Downtown Dubai, Palm Jumeirah, Business Bay, Jumeirah Village Circle, Dubai Hills Estate and Dubai Creek Harbour.",
        body: [
          "The list of designated areas is maintained by the Dubai Land Department and extended from time to time. Our area guides cover the districts where we currently sell; for any other address, we check the ownership regime before you commit.",
        ],
      },
      {
        heading: "What can go wrong, and how do foreign buyers avoid it?",
        answer:
          "Most problems come from stepping outside a regulated process: check the developer's registration, the project's escrow account, the seller's title and your agent's broker number before you pay anything.",
        body: [
          "For an off-plan project, ask to see the developer's and the project's registration with the Dubai Land Department and the escrow account named in the contract. For a resale, ask for the seller's title deed and have the transaction handled through a registered trustee office. Use a RERA-registered broker — ask for their broker number (BRN) and check it with the Dubai Land Department — and read the contract before you pay any deposit.",
        ],
      },
      {
        heading: "What about wills and inheritance for foreign owners?",
        answer:
          "Non-Muslim owners can register a will for their UAE property so that it passes under the terms they choose rather than under default succession rules.",
        body: [
          "Registering a will for UAE assets — for example with the DIFC Wills Service or the Dubai Courts — is inexpensive next to the value of the property and avoids delay for your family. Take advice from a lawyer who handles UAE succession, because the right route depends on your nationality, religion and where your family lives.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can foreigners own property in Dubai outright?",
        a: "Yes — 100% freehold ownership in designated zones, with a Dubai Land Department title deed in your name. No local partner, no residency requirement, no time limit.",
      },
      {
        q: "Do I need to be in Dubai to buy?",
        a: "No. Contracts sign digitally, payments transfer to regulated accounts, and a power of attorney can complete the transfer for you. Many of our clients buy before they ever visit.",
      },
      {
        q: "Can buying property get me UAE residency?",
        a: "Yes. Property worth AED 2 million or more can qualify you to apply for the 10-year Golden Visa, and shorter investor visas have been available at lower thresholds — confirm the current conditions before you rely on them.",
      },
      {
        q: "Can non-residents get a UAE mortgage?",
        a: "Yes, on completed properties — typically up to 50–60% of the value for non-residents, subject to the bank's income checks.",
      },
      {
        q: "Which documents does a foreign buyer need?",
        a: "A valid passport to start, and evidence of the source of funds for the contract and the transfer. Developers may also ask for proof of address and, for a company purchase, the company's registration documents — your consultant sends the exact list for the project you choose.",
      },
      {
        q: "Is there a minimum price for foreign buyers?",
        a: "There is no minimum purchase price for owning freehold property in Dubai. Minimums only matter for visa eligibility — see the Golden Visa guide.",
      },
      {
        q: "Can I buy Dubai property through a company?",
        a: "Yes, through a UAE or offshore company, subject to the rules of the area and the company's registration. The structure changes your tax and visa position, so take advice first.",
      },
    ],
    sources: [
      { label: "Dubai Land Department", url: "https://dubailand.gov.ae/en/" },
      { label: "UAE Government Portal — buying property", url: "https://u.ae/en" },
      { label: "Central Bank of the UAE", url: "https://www.centralbank.ae/en/" },
    ],
    related: ["dubai-golden-visa-property-guide", "new-projects-in-dubai", "dubai-property-buying-costs"],
  },
]


export const SEO_PAGES: SeoPage[] = [
  ...PROJECT_PAGES,
  ...TYPE_AND_AREA_PAGES,
  ...HANDOVER_PAGES,
  ...INFO_GUIDES,
  ...AREA_GUIDES,
]

/** The footer's grouped rails — the flagship six only; the long tail is
 *  reached through related-links and the sitemap. */
export const SEO_SEARCH_PAGES = PROJECT_PAGES
export const SEO_AREA_GUIDES = AREA_GUIDES
/** The buyer's-process guides (Golden Visa, how to buy off-plan, costs, foreigners). */
export const SEO_BUYER_GUIDES = INFO_GUIDES
/** "Dubai projects handing over in <year>". */
export const SEO_HANDOVER_PAGES = HANDOVER_PAGES
/** Property-type, budget and community inventory pages ("villas for sale in Dubai", "projects in JVC"). */
export const SEO_TYPE_AND_AREA_PAGES = TYPE_AND_AREA_PAGES

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug)
}

/**
 * The buyer guides worth offering on a project page: the Golden Visa guide first when the project
 * may qualify, then the process guide that fits its status (off-plan → how to buy off-plan; ready →
 * skip it), then costs and the foreign-buyer guide.
 */
export function buyerGuidesForProject(p: { status: string | null | undefined; goldenVisa: boolean }): SeoPage[] {
  const slugs = [
    ...(p.goldenVisa ? ["dubai-golden-visa-property-guide"] : []),
    ...(p.status === "completed" ? [] : ["how-to-buy-off-plan-property-in-dubai"]),
    "dubai-property-buying-costs",
    "can-foreigners-buy-property-in-dubai",
  ]
  return slugs.map(getSeoPage).filter((page): page is SeoPage => Boolean(page))
}

/**
 * Contextual SEO links for one project — powers the "Popular searches" block
 * on project detail pages, which funnels the link equity of ~240 project
 * pages into the landing pages. Lives here so it can never drift from the
 * catalog above.
 */
export function relatedSeoPagesForProject(p: {
  city?: string | null
  location?: string | null
  community?: string | null
  propertyType?: string | null
  priceFrom?: number | null
  status?: string | null
  /** The project's handover year ("2027"), when known — links its dubai-projects-handover-<year> page. */
  handoverYear?: string | null
  /** The page's own Golden Visa check (lib/project-seo goldenVisaMayQualify) — links the AED 2M+ landing only when it passes. */
  goldenVisa?: boolean
}): SeoPage[] {
  const out: SeoPage[] = []
  const add = (slug: string) => {
    const page = getSeoPage(slug)
    if (page && !out.some((x) => x.slug === page.slug)) out.push(page)
  }
  const hay = `${p.location ?? ""} ${p.community ?? ""}`.toLowerCase()
  const city = (p.city ?? "").toLowerCase()
  const type = (p.propertyType ?? "").toLowerCase()
  const price = p.priceFrom ?? null

  // Area — the live-inventory page first, then the area guide.
  const AREA_MATCHES: Array<[needle: string, slugs: string[]]> = [
    ["jumeirah village circle", ["projects-in-jumeirah-village-circle", "jumeirah-village-circle"]],
    ["jumeirah village triangle", ["projects-in-jumeirah-village-triangle"]],
    ["business bay", ["projects-in-business-bay", "business-bay"]],
    ["dubailand", ["projects-in-dubailand", "dubailand"]],
    // "Dubai Land Residence Complex" is how the community normaliser spells the Dubailand complexes.
    ["dubai land", ["projects-in-dubailand", "dubailand"]],
    ["marina", ["dubai-marina"]],
    ["downtown", ["downtown-dubai"]],
    ["palm jumeirah", ["palm-jumeirah"]],
    ["creek", ["dubai-creek-harbour"]],
    ["hills estate", ["dubai-hills-estate"]],
    ["jumeirah beach residence", ["jumeirah-beach-residence"]],
    ["arabian ranches", ["arabian-ranches"]],
    ["furjan", ["al-furjan"]],
    ["jaddaf", ["projects-in-al-jaddaf", "al-jaddaf"]],
    ["difc", ["difc"]],
  ]
  for (const [needle, slugs] of AREA_MATCHES) {
    if (hay.includes(needle)) slugs.forEach(add)
  }

  // Property type.
  if (type.includes("apartment")) add("apartments-for-sale-in-dubai")
  else if (type.includes("villa")) add("villas-for-sale-in-dubai")
  else if (type.includes("townhouse")) add("townhouses-for-sale-in-dubai")
  else if (type.includes("penthouse")) add("penthouses-for-sale-in-dubai")

  // Price band (same realistic floor as the budget page itself).
  if (price != null && price >= 50_000 && price <= 1_000_000) add("properties-under-1m-in-dubai")
  if (p.goldenVisa) add("golden-visa-properties-in-dubai")

  // Status and city.
  if (city.includes("abu dhabi")) add("new-projects-in-abu-dhabi")
  else if (p.status === "completed") add("ready-properties-in-dubai")
  else add("off-plan-projects-in-dubai")
  // Its handover-year page (a year without a page is ignored by getSeoPage). Ahead of the generic
  // city link so the cap below can never be the thing that drops it.
  if (city.includes("dubai") && p.handoverYear) add(`dubai-projects-handover-${p.handoverYear}`)
  if (city.includes("dubai")) add("new-projects-in-dubai")

  // Two area pages + type + price + status + handover + city = 7.
  return out.slice(0, 7)
}
