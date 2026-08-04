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
 */

export type SeoPageFilter = {
  /** Case-insensitive substring match on projects.city (values are messy —
   *  "Abu Dhabi " with a trailing space exists). Omit for portfolio-wide. */
  cityLike?: string
  /** projects.status values to include. Omit for all. */
  statuses?: string[]
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
  /** guide kind: matches projects.location/name to pick the page photo from
   *  our own portfolio; pages with no match fall back to the Dubai pool. */
  imageQuery?: string
  /** guide kind: the quick-facts strip. */
  facts?: { label: string; value: string }[]
  /** guide kind: body sections. */
  sections?: { heading: string; body: string }[]
  /** Slugs from this catalog to cross-link at the bottom. */
  related: string[]
}

// Non-UAE one-offs in the projects table (a project in Istanbul, one in
// Egypt's Mostakbal City). UAE-wide pages exclude them so the page's claim
// stays true.
export const NON_UAE_CITIES = ["istanbul", "mostakbal"]

// ─── Project-backed searches ─────────────────────────────────────────────────

const PROJECT_PAGES: SeoPage[] = [
  {
    slug: "new-projects-in-dubai",
    label: "New Projects in Dubai",
    title: "New Projects in Dubai — Latest Launches & Prices",
    h1: "New Projects in Dubai",
    description:
      "Browse the newest residential projects in Dubai — launch prices, payment plans and handover dates from developers like Samana, Azizi and Reportage.",
    intro: [
      "Dubai's developers release new communities every month, and launch week is when the best units and the friendliest payment plans are on the table. This page tracks the projects currently open for booking across Dubai — apartments, townhouses and branded residences — with launch pricing where the developer has published it.",
      "Every project below links to its full profile: location, gallery, price range and the developer behind it. If you want a shortlist matched to your budget instead, send us an enquiry and a consultant will come back the same business day.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai" },
    related: ["off-plan-projects-in-dubai", "ready-properties-in-dubai", "new-projects-in-abu-dhabi"],
  },
  {
    slug: "off-plan-projects-in-dubai",
    label: "Off-Plan Projects in Dubai",
    title: "Off-Plan Projects in Dubai — Payment Plans & Launch Prices",
    h1: "Off-Plan Projects in Dubai",
    description:
      "Off-plan property in Dubai: current launches and under-construction projects with developer payment plans, starting prices and handover timelines.",
    intro: [
      "Off-plan is how most investors enter the Dubai market: you buy at today's price on a construction-linked payment plan, and the developer carries the build. The projects below are at launch or under construction right now, which is where the widest unit choice and the longest plans are found.",
      "FHI Global works directly with the developers, so the prices and plans you see on each project page are the developer's own — no mark-up, and our consultation costs you nothing.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", statuses: ["launch", "under_construction"] },
    related: ["new-projects-in-dubai", "off-plan-projects-in-uae", "ready-properties-in-dubai"],
  },
  {
    slug: "ready-properties-in-dubai",
    label: "Ready Properties in Dubai",
    title: "Ready Properties in Dubai — Completed Projects to Move In Now",
    h1: "Ready Properties in Dubai",
    description:
      "Completed, handed-over projects in Dubai — move in or rent out immediately. Compare ready communities and current availability with FHI Global.",
    intro: [
      "Ready property trades certainty for the discount of off-plan: what you view is what you get, and it can be lived in — or earning rent — from day one. These Dubai projects are completed and handed over, with resale and developer stock moving through them.",
      "If you're weighing ready against off-plan, the honest answer is it depends on your horizon; ask us and we'll run both numbers for your budget.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", statuses: ["completed"] },
    related: ["new-projects-in-dubai", "off-plan-projects-in-dubai", "new-projects-in-uae"],
  },
  {
    slug: "new-projects-in-abu-dhabi",
    label: "New Projects in Abu Dhabi",
    title: "New Projects in Abu Dhabi — Launches, Prices & Payment Plans",
    h1: "New Projects in Abu Dhabi",
    description:
      "New residential projects in Abu Dhabi — current launches with developer pricing and payment plans, from Reportage and other active developers.",
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
    title: "Off-Plan Projects in the UAE — Every Active Launch",
    h1: "Off-Plan Projects in the UAE",
    description:
      "Every off-plan project FHI Global covers across the UAE — launches and under-construction communities with payment plans and starting prices.",
    intro: [
      "This is the wide view: every launch and under-construction project on our books across the Emirates, in one grid. Useful when you care about the numbers more than the neighbourhood — sort by what catches your eye, then drill into the project page for the plan.",
      "Inventory updates as developers release phases, so this page is worth a bookmark if you're timing an entry.",
    ],
    kind: "projects",
    filter: { statuses: ["launch", "under_construction"] },
    related: ["off-plan-projects-in-dubai", "new-projects-in-dubai", "new-projects-in-abu-dhabi"],
  },
  {
    slug: "new-projects-in-uae",
    label: "New Projects in UAE",
    title: "New Projects in the UAE — Full Developer Portfolio",
    h1: "New Projects in the UAE",
    description:
      "The full FHI Global project portfolio across the UAE — new launches, under-construction and ready communities from every developer we work with.",
    intro: [
      "Everything we cover, one page: launches, projects mid-build and completed communities across Dubai, Abu Dhabi and the northern emirates. Start here if you're mapping the market before narrowing down.",
      "For a filtered view — by developer, by status, by price band — the projects browser has the full controls.",
    ],
    kind: "projects",
    filter: {},
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
    title: "Dubai Marina Area Guide — Living, Buying & Renting",
    h1: "Dubai Marina",
    description:
      "Dubai Marina area guide: waterfront high-rise living, rental demand, and what to know before buying or renting an apartment on the Marina.",
    intro: [
      "Dubai Marina is the city's postcard: a three-kilometre man-made marina ringed by residential towers, with the promenade, the yachts and JBR beach a walk away. It is one of the most liquid apartment markets in Dubai — units trade often, tenants queue year-round, and the tram and two Metro stations carry the commute.",
      "The area is fully built out, so buying here means resale stock in established towers rather than off-plan. That cuts both ways: no construction risk and immediate rent, but the building's age and service charges deserve a closer look than the view does.",
      "The Marina's tenant pool is also the deepest in the city — airline crews, consultants, remote founders — and it renews itself every hiring season. For owners that means pricing power in furnished units and short vacancy windows; for residents, a district that never quite sleeps, with padel courts, yacht charters and a seven-kilometre running loop built into daily life.",
    ],
    kind: "guide",
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
    related: ["jumeirah-beach-residence", "palm-jumeirah", "business-bay"],
  },
  {
    slug: "downtown-dubai",
    imageQuery: "downtown",
    label: "Downtown Dubai",
    title: "Downtown Dubai Area Guide — Burj Khalifa District Living",
    h1: "Downtown Dubai",
    description:
      "Downtown Dubai area guide: the Burj Khalifa district — prestige apartments, hotel-branded residences, and what ownership there really involves.",
    intro: [
      "Downtown is Dubai's centre of gravity — the Burj Khalifa, the Dubai Mall and the fountains sit in the middle of it, and everything else is arranged around the view. Owning here is owning the address the city advertises with.",
      "It is a prestige market first and a yield market second: entry prices are the city's highest outside Palm Jumeirah's fronds, and buyers are typically end-users, long-hold investors or short-let operators trading on the location.",
      "Emaar built Downtown and still operates most of it, which shows in the maintenance standard and in resale confidence. Supply is essentially fixed — the district is built out — so the market moves on demand alone. When Dubai has a strong year, Downtown usually has a stronger one; when the market cools, the address defends its value better than almost anywhere.",
    ],
    kind: "guide",
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
    related: ["business-bay", "difc", "dubai-creek-harbour"],
  },
  {
    slug: "business-bay",
    imageQuery: "business bay",
    label: "Business Bay",
    title: "Business Bay Area Guide — Canal-Side Living Next to Downtown",
    h1: "Business Bay",
    description:
      "Business Bay area guide: Downtown's neighbour on the canal — newer towers, sharper prices, and one of Dubai's busiest rental markets.",
    intro: [
      "Business Bay is where Downtown's energy meets a more accessible price. The district lines the Dubai Water Canal with mixed office and residential towers, and it has quietly become one of the city's largest rental markets — tenants who work in Downtown or DIFC and want ten minutes to the desk.",
      "For buyers, the Bay is a volume market: plenty of stock, constant handovers, and real negotiating room. The skill is separating the towers built to hold value from the ones built to sell fast.",
      "The Bay has also become Dubai's laboratory for branded living — hotel-flagged residences cluster here, pairing hotel amenities with private ownership. And because the district began as an office masterplan, its road grid and utilities were engineered for more density than it carries today, which is why construction continues without the growing pains older districts feel.",
    ],
    kind: "guide",
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
    related: ["downtown-dubai", "difc", "off-plan-projects-in-dubai"],
  },
  {
    slug: "palm-jumeirah",
    imageQuery: "palm",
    label: "Palm Jumeirah",
    title: "Palm Jumeirah Area Guide — Villas, Fronds & Shoreline Apartments",
    h1: "Palm Jumeirah",
    description:
      "Palm Jumeirah area guide: frond villas, shoreline apartments and trunk towers — what living and investing on the Palm actually looks like.",
    intro: [
      "The Palm is Dubai's trophy address: a palm-shaped island where every frond villa touches private beach and the apartment buildings along the trunk look back at the Marina skyline. Supply is finite by geography, which is the quiet engine under its prices.",
      "It behaves like three markets in one — frond villas, trunk apartments, and the crescent's hotel-branded residences — and they move differently. Knowing which one you're actually buying into matters more here than anywhere in the city.",
      "The crescent's hotels — Atlantis at the crown — anchor the island's service economy, and residents borrow their beach clubs, spas and restaurants as neighbourhood amenities. Add the Palm West Beach strip and its boardwalk, and the island now has genuine street life to go with its privacy — something it lacked entirely in its first decade.",
    ],
    kind: "guide",
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
    related: ["dubai-marina", "jumeirah-beach-residence", "new-projects-in-dubai"],
  },
  {
    slug: "jumeirah-village-circle",
    imageQuery: "jumeirah village",
    label: "Jumeirah Village Circle (JVC)",
    title: "JVC Area Guide — Jumeirah Village Circle for Buyers & Tenants",
    h1: "Jumeirah Village Circle (JVC)",
    description:
      "JVC area guide: Dubai's value district — affordable apartments and townhouses, strong yields, and what to check before buying in Jumeirah Village Circle.",
    intro: [
      "JVC is where Dubai's price-to-space equation works best: a central-south location twenty minutes from the Marina and Downtown alike, with apartments and townhouses at entry prices the beachfront districts left behind years ago. That's made it the default first purchase for a generation of Dubai buyers.",
      "It is also the city's busiest construction zone, with new mid-rise launches almost monthly. Yields run high; so does future supply. Both facts belong in the same sentence.",
      "Circle Mall gave the district its retail anchor, and more than thirty pocket parks do the daily work between the schools and nurseries. Developers here compete hard on amenities — rooftop pools, co-working lounges and serious gyms are standard in the newer buildings, at price points where the older districts offer none of it.",
    ],
    kind: "guide",
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
    related: ["dubailand", "al-furjan", "off-plan-projects-in-dubai"],
  },
  {
    slug: "dubai-creek-harbour",
    imageQuery: "creek",
    label: "Dubai Creek Harbour",
    title: "Dubai Creek Harbour Area Guide — Emaar's Second Downtown",
    h1: "Dubai Creek Harbour",
    description:
      "Dubai Creek Harbour area guide: Emaar's waterfront district opposite the wildlife sanctuary — new towers, long payment plans and a skyline view of Downtown.",
    intro: [
      "Creek Harbour is Emaar building a second Downtown on the water: a masterplanned district across the creek from the Ras Al Khor flamingo sanctuary, with the old city's skyline on one horizon and the new one on the other. It is still mid-build, which is exactly its appeal to off-plan buyers.",
      "Buying here is a bet on a district maturing on schedule — the developer's record on that is the strongest in the market, and the early phases have already handed over into a functioning waterfront community.",
      "The masterplan is sized for a population larger than some emirates — a reminder that this is a decade-long story, not a finished district. Early buyers are effectively buying Emaar's delivery machine: every handed-over phase adds retail, schools and transport links, and each addition marks up the phases that came before it.",
    ],
    kind: "guide",
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
    related: ["downtown-dubai", "new-projects-in-dubai", "off-plan-projects-in-dubai"],
  },
  {
    slug: "dubai-hills-estate",
    imageQuery: "hills",
    label: "Dubai Hills Estate",
    title: "Dubai Hills Estate Area Guide — Golf-Course Family Living",
    h1: "Dubai Hills Estate",
    description:
      "Dubai Hills Estate area guide: Emaar's golf-course district — family villas, the Hills Park, and the strongest school run in new Dubai.",
    intro: [
      "Dubai Hills is the establishment choice of new Dubai: an Emaar masterplan wrapped around an eighteen-hole course, halfway between Downtown and the Marina on Al Khail Road. Villas and townhouses carry the district, with apartment clusters around the mall and park.",
      "It has become the benchmark other family communities price against — schools inside the masterplan, the city's biggest park lawn, and a mall that spared residents the drive to either Downtown or Mall of the Emirates.",
      "The numbers behind the lifestyle hold up too: Dubai Hills Mall trades among the city's busiest, King's College Hospital anchors the healthcare offer, and the district's central seam between Downtown and the Marina makes it one of the few family communities that shortens commutes instead of lengthening them.",
    ],
    kind: "guide",
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
    related: ["arabian-ranches", "jumeirah-village-circle", "new-projects-in-dubai"],
  },
  {
    slug: "jumeirah-beach-residence",
    imageQuery: "beach residence",
    label: "JBR — Jumeirah Beach Residence",
    title: "JBR Area Guide — Beachfront Apartments on The Walk",
    h1: "Jumeirah Beach Residence (JBR)",
    description:
      "JBR area guide: Dubai's beachfront apartment strip — The Walk, The Beach mall, and what buying into Jumeirah Beach Residence involves.",
    intro: [
      "JBR is the only place in Dubai where a residential tower's ground floor opens straight onto a public beach. The strip of towers along The Walk is beach-town Dubai: holidaymakers below, residents above, and the Marina's towers one street behind.",
      "The buildings are older than the Marina's newest stock, and that's the opportunity — some of the largest sea-view layouts in the city trade here at prices newer beachfront can't match.",
      "The strip's economics are simple: a beach that draws millions of visitors a year, directly beneath a few thousand apartments. That footfall sustains The Walk's retail through every season and keeps short-let occupancy among the city's highest — while the tram and the Marina's Metro stations put the business districts within an easy commute.",
    ],
    kind: "guide",
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
    related: ["dubai-marina", "palm-jumeirah", "ready-properties-in-dubai"],
  },
  {
    slug: "arabian-ranches",
    imageQuery: "ranches",
    label: "Arabian Ranches",
    title: "Arabian Ranches Area Guide — Established Villa Community",
    h1: "Arabian Ranches",
    description:
      "Arabian Ranches area guide: Dubai's most established villa community — mature streets, schools, and the trade-offs of desert-edge family living.",
    intro: [
      "The Ranches is old money by new-Dubai standards: an Emaar villa community from the early 2000s whose trees have had two decades to grow. It set the template every later family masterplan copied — golf course, polo club, community schools, retail village.",
      "Buyers come for the maturity itself. The streets are settled, the neighbours long-term, and the landscaping real rather than rendered. Its younger siblings (Ranches II and III) extend the same formula at newer price points.",
      "The Ranches also benefits from what grew up around it: the polo club, Global Village and Dubailand's newer districts wrap it in amenities that didn't exist when the first villas sold. And two decades of resales give buyers something genuinely rare in Dubai — a real price history, street by street, to negotiate from.",
    ],
    kind: "guide",
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
    related: ["dubai-hills-estate", "dubailand", "ready-properties-in-dubai"],
  },
  {
    slug: "al-furjan",
    imageQuery: "furjan",
    label: "Al Furjan",
    title: "Al Furjan Area Guide — Metro-Connected Villas & Apartments",
    h1: "Al Furjan",
    description:
      "Al Furjan area guide: the metro-connected value district near Ibn Battuta — townhouses, new apartments, and honest pricing in south Dubai.",
    intro: [
      "Al Furjan is the practical choice of south Dubai: a Nakheel district beside Ibn Battuta Mall where the 2021 Metro extension quietly changed the equation — few villa-and-townhouse communities in the city can walk to a train.",
      "It sits in the price band between JVC and the premium masterplans, and its buyer is usually someone doing the arithmetic: Expo City and the Marina employment belts within twenty minutes, a garden, and a mortgage that behaves.",
      "Nakheel's original masterplan left room to breathe — plots and road widths here are more generous than in the newer value districts — and Ibn Battuta's own Metro station, Discovery Gardens and the Gardens bracket the community with infrastructure that is already mature. It is quietly becoming the commuter choice for Expo City's growing workforce.",
    ],
    kind: "guide",
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
    related: ["jumeirah-village-circle", "dubailand", "off-plan-projects-in-dubai"],
  },
  {
    slug: "difc",
    imageQuery: "difc",
    label: "DIFC",
    title: "DIFC Area Guide — Living in Dubai's Financial Centre",
    h1: "DIFC — Dubai International Financial Centre",
    description:
      "DIFC area guide: apartments inside Dubai's financial free zone — art, fine dining, and the shortest commute in the city for finance professionals.",
    intro: [
      "DIFC is a financial free zone that happens to be one of Dubai's best places to live: the Gate district's towers hold the city's densest concentration of galleries, fine dining and members' clubs, and several thousand residents who walk to work in the institutions next door.",
      "Residential stock is scarce by design — a handful of towers inside the district proper — and scarcity plus the tenant profile has kept it one of the steadiest apartment markets in the city.",
      "The free-zone charter gives DIFC its own courts and a common-law framework, and property inside the district sits under that umbrella — a distinction institutional buyers price in. Gate Avenue's retail spine, the arts cluster and a packed calendar of gallery nights keep the district alive well past office hours.",
    ],
    kind: "guide",
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
    related: ["downtown-dubai", "business-bay", "ready-properties-in-dubai"],
  },
  {
    slug: "dubailand",
    imageQuery: "dubailand",
    label: "Dubailand",
    title: "Dubailand Area Guide — Value Communities in Dubai's South",
    h1: "Dubailand",
    description:
      "Dubailand area guide: the value belt of south Dubai — townhouse communities, new launches, and the entry prices the coast no longer offers.",
    intro: [
      "Dubailand is less a neighbourhood than a region: the broad inland belt where Dubai builds its value communities — townhouse masterplans, themed districts and a steady stream of new launches at the city's friendliest entry prices.",
      "This is where developers compete on payment plan and handover date rather than postcode prestige, and for a large share of Dubai's end-users it is simply where the affordable family home is.",
      "The belt keeps absorbing Dubai's growth corridors: Academic City's universities, the Al Maktoum airport axis and the Emirates Road logistics spine all pull tenants inward. For investors the arithmetic is entry price against city-average rents — the spread that made JVC famous a cycle ago is now widest out here.",
    ],
    kind: "guide",
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
    related: ["jumeirah-village-circle", "arabian-ranches", "off-plan-projects-in-uae"],
  },
]

export const SEO_PAGES: SeoPage[] = [...PROJECT_PAGES, ...AREA_GUIDES]

/** The footer's grouped rails. */
export const SEO_SEARCH_PAGES = PROJECT_PAGES
export const SEO_AREA_GUIDES = AREA_GUIDES

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug)
}
