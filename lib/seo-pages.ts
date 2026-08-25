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
  /** guide kind: matches projects.location/name to pick the page photo from
   *  our own portfolio; pages with no match fall back to the Dubai pool. */
  imageQuery?: string
  /** guide kind: the quick-facts strip. */
  facts?: { label: string; value: string }[]
  /** guide kind: heading over the facts strip (defaults to
   *  "Why invest in {label}" — info guides override it). */
  factsHeading?: string
  /** guide kind: body sections. */
  sections?: { heading: string; body: string }[]
  /** Rendered as a visible FAQ block AND FAQPage structured data — the two
   *  must always carry the same wording. */
  faqs?: { q: string; a: string }[]
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
    related: [
      "new-projects-in-dubai",
      "how-to-buy-off-plan-property-in-dubai",
      "off-plan-projects-in-uae",
      "ready-properties-in-dubai",
    ],
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
]

// ─── Property-type, budget and area-inventory searches ──────────────────────
// The second wave: exact-match pages for what buyers actually type. Same
// engine as PROJECT_PAGES; each entry was checked against live inventory
// before shipping (an SEO page over an empty grid is a doorway page).

const TYPE_AND_AREA_PAGES: SeoPage[] = [
  {
    slug: "apartments-for-sale-in-dubai",
    label: "Apartments for Sale in Dubai",
    title: "Apartments for Sale in Dubai — New & Off-Plan Prices",
    h1: "Apartments for Sale in Dubai",
    description:
      "Apartments for sale in Dubai — studios to four-bedroom residences in new and off-plan projects, with developer prices and payment plans.",
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
    title: "Villas for Sale in Dubai — New & Off-Plan Villa Projects",
    h1: "Villas for Sale in Dubai",
    description:
      "Villas for sale in Dubai — standalone and community villas in new and off-plan projects, with developer prices, plot sizes and payment plans.",
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
    title: "Townhouses for Sale in Dubai — Family Communities & Prices",
    h1: "Townhouses for Sale in Dubai",
    description:
      "Townhouses for sale in Dubai — three and four-bedroom family homes in gated communities, with developer prices and construction-linked payment plans.",
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
    title: "Penthouses for Sale in Dubai — Luxury Sky Residences",
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
    title: "Properties Under AED 1 Million in Dubai — Affordable Projects",
    h1: "Properties Under AED 1M in Dubai",
    description:
      "Dubai properties under AED 1 million — studios, apartments and affordable projects with payment plans, curated from live developer inventory.",
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
    title: "Golden Visa Properties in Dubai — AED 2M+ Investments",
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
    title: "New Projects in Jumeirah Village Circle (JVC) — Prices & Plans",
    h1: "New Projects in Jumeirah Village Circle",
    description:
      "Every JVC project on our books — new launches and under-construction towers in Jumeirah Village Circle with developer prices and payment plans.",
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
    title: "New Projects in Business Bay — Canal Towers & Branded Residences",
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
    title: "New Projects in Dubailand — Family Communities & Payment Plans",
    h1: "New Projects in Dubailand",
    description:
      "New and off-plan projects in Dubailand — townhouse districts and value apartments in Dubai's biggest family belt, with developer payment plans.",
    intro: [
      "Dubailand is where Dubai builds room to grow: self-contained family communities with pools, parks and schools inside the gates, at the widest price-to-space ratio in the city. The launch calendar here never stops, which is exactly what keeps pricing honest.",
      "These are the Dubailand projects live on our books. The variable that deserves your attention in this belt is delivery track record — it varies more here than anywhere else, and it's the first thing we check before recommending a project.",
    ],
    kind: "projects",
    filter: { cityLike: "dubai", locationLike: "dubailand" },
    related: ["dubailand", "townhouses-for-sale-in-dubai", "properties-under-1m-in-dubai", "new-projects-in-dubai"],
  },
  {
    slug: "projects-in-jumeirah-village-triangle",
    label: "Projects in JVT",
    title: "New Projects in Jumeirah Village Triangle (JVT) — Prices & Plans",
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
]

// ─── Handover-year searches ──────────────────────────────────────────────────
// Investors shop by delivery date ("projects handover 2027 dubai"). Backed by
// delivery_quarter / expected_completion_date; counts checked before shipping.

const HANDOVER_INTRO: Record<string, [string, string]> = {
  "2026": [
    "Handover in 2026 means the finish line is in sight: construction is in its final stretches, most of the payment plan is already behind the original buyers, and what's left on the market skews toward assignments and the developer's last units. These are the Dubai projects scheduled to hand over in 2026.",
    "Buying this close to completion trades the longest payment plans for near-term certainty — you can see what you're getting, and rent starts flowing within months rather than years.",
  ],
  "2027": [
    "2027 is the current sweet spot of Dubai's off-plan market: far enough out for a genuine construction-linked payment plan, close enough that the wait is measured in a couple of years. This page tracks every project on our books delivering in 2027.",
    "Mid-build projects also carry the clearest signal — you can see how construction is actually progressing before you commit, not just the render.",
  ],
  "2028": [
    "Projects handing over in 2028 are today's launches and early-construction communities — which is exactly where launch pricing and the friendliest payment plans live. These are the 2028 deliveries we cover in Dubai.",
    "The longer runway suits investors paying from cash flow: instalments spread across three years, with the balance often payable at or after handover.",
  ],
  "2029": [
    "A 2029 handover is the earliest entry Dubai currently offers: brand-new launches at first-release pricing, with the longest payment plans in the market. These are the projects scheduled to deliver in 2029.",
    "Early entry earns the widest unit choice — the best stacks, views and floor plates go in the first releases — in exchange for patience and faith in the developer's track record. We help with the second part.",
  ],
}

const HANDOVER_PAGES: SeoPage[] = (["2026", "2027", "2028", "2029"] as const).map((year, i, years) => ({
  slug: `dubai-projects-handover-${year}`,
  label: `Handover ${year}`,
  title: `Dubai Projects Handing Over in ${year} — Off-Plan by Delivery Date`,
  h1: `Dubai Projects Handing Over in ${year}`,
  description: `Off-plan projects in Dubai with handover scheduled for ${year} — developer prices, payment plans and construction status, updated from live inventory.`,
  intro: [...HANDOVER_INTRO[year]],
  kind: "projects" as const,
  filter: { cityLike: "dubai", handoverYear: year },
  related: [
    ...years.filter((y) => y !== year).slice(0, 2).map((y) => `dubai-projects-handover-${y}`),
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
    title: "Dubai Golden Visa Through Property — The 2M Investor Guide",
    h1: "The Dubai Golden Visa Through Property Investment",
    description:
      "How to get the UAE's 10-year Golden Visa by buying property in Dubai — the AED 2M threshold, what qualifies, the process, and family sponsorship.",
    intro: [
      "The UAE Golden Visa is a 10-year renewable residency granted, among other routes, to property investors: buy real estate worth AED 2 million or more and you can apply — no employer, no local sponsor, and no minimum stay requirement to keep it valid.",
      "For most international buyers this is the highest-leverage feature of the Dubai market: the same capital that buys the home also secures long-term residency for the whole family. This guide covers what qualifies, the process, and the practical questions we answer daily.",
    ],
    kind: "guide",
    imageQuery: "downtown",
    factsHeading: "The Golden Visa at a glance",
    facts: [
      { label: "Investment threshold", value: "AED 2 million in property — single or combined holdings" },
      { label: "Visa length", value: "10 years, renewable while you hold the qualifying investment" },
      { label: "Family", value: "Sponsor your spouse, children and support staff under your visa" },
      { label: "Off-plan", value: "Eligible when bought from approved developers" },
      { label: "Mortgages", value: "Financed purchases can qualify, subject to equity requirements" },
      { label: "Stay requirement", value: "No minimum days in the UAE to keep the visa valid" },
    ],
    sections: [
      {
        heading: "How the process works",
        body: "Once your qualifying property is registered with the Dubai Land Department, you apply through the DLD's Cube office or the official channels: title deed (or Oqood for off-plan), passport, photographs, medical fitness test and Emirates ID biometrics. Approvals routinely come through in under two weeks, and our team walks clients through each step after the purchase completes.",
      },
      {
        heading: "What property qualifies",
        body: "Residential property worth AED 2 million or more at purchase, held in your name. Current practice accepts combined properties adding up past the threshold, off-plan purchases from approved developers, and mortgaged homes subject to the equity and bank-letter rules in force at application time — the fine print evolves, so we confirm the current requirements before every application.",
      },
      {
        heading: "Why investors use it",
        body: "Stability is the honest answer. The visa decouples your residency from employment, lets your family live, study and bank in the UAE long-term, and removes the renewal anxiety of shorter permits. Selling the qualifying property ends the basis of the visa, so most holders treat it as a long-hold asset — which suits Dubai's rental market just fine.",
      },
    ],
    faqs: [
      {
        q: "What is the minimum property investment for a UAE Golden Visa?",
        a: "AED 2 million. The value can sit in a single property or be combined across several, based on Dubai Land Department registered values.",
      },
      {
        q: "Can I get a Golden Visa with an off-plan property?",
        a: "Yes — off-plan purchases from approved developers qualify, using the Oqood registration in place of a title deed.",
      },
      {
        q: "Do I lose the visa if I sell the property?",
        a: "The visa is tied to holding a qualifying investment. Selling below the threshold ends that basis, so plan to hold — or replace — the qualifying asset for as long as you want the residency.",
      },
      {
        q: "Can my family get residency too?",
        a: "Yes. Golden Visa holders sponsor their spouse and children (with no age cap for unmarried children under current rules), so one qualifying purchase settles the household.",
      },
    ],
    related: ["golden-visa-properties-in-dubai", "can-foreigners-buy-property-in-dubai", "dubai-property-buying-costs"],
  },
  {
    slug: "how-to-buy-off-plan-property-in-dubai",
    label: "How to Buy Off-Plan",
    title: "How to Buy Off-Plan Property in Dubai — Step-by-Step Guide",
    h1: "How to Buy Off-Plan Property in Dubai",
    description:
      "The complete off-plan buying process in Dubai: booking, SPA and Oqood registration, escrow protection, payment plans and handover — step by step.",
    intro: [
      "Off-plan is how most investors enter Dubai: you buy at today's price while the project is under construction, pay in instalments linked to build progress, and take handover of a brand-new home. The process is more regulated — and more protected — than most first-time buyers expect.",
      "This guide walks the full journey from shortlist to keys. Read it once and the project pages on this site will make complete sense: every price, plan and handover date you see slots into the steps below.",
    ],
    kind: "guide",
    factsHeading: "The process at a glance",
    facts: [
      { label: "1 · Reserve", value: "Booking form + deposit, typically 5–20% of the price" },
      { label: "2 · Contract", value: "Sign the SPA; the sale registers with DLD as an Oqood" },
      { label: "3 · Pay in stages", value: "Construction-linked instalments on the developer's plan" },
      { label: "4 · Protected funds", value: "Payments sit in a RERA-regulated project escrow account" },
      { label: "5 · Fees", value: "4% DLD registration plus admin fees, usually at contract" },
      { label: "6 · Handover", value: "Snag the unit, settle the balance, receive keys and title" },
    ],
    sections: [
      {
        heading: "From shortlist to contract",
        body: "Once you choose a unit, the developer issues a booking form against a deposit and drafts the Sale and Purchase Agreement. Read the SPA for three things: the payment schedule, the anticipated completion date with its grace period, and the compensation clause for late handover. The sale is then registered with the Dubai Land Department as an Oqood — your official record of ownership until the title deed issues at completion.",
      },
      {
        heading: "Why escrow makes off-plan safe",
        body: "Dubai requires every off-plan project to run a RERA-supervised escrow account. Your instalments go into that account — not the developer's pocket — and funds release only as independent engineers certify construction milestones. If a project stalls, the money is ring-fenced. It is the single biggest reason Dubai's off-plan market matured past its early reputation.",
      },
      {
        heading: "Choosing the right project",
        body: "Three filters do most of the work: the developer's delivery track record (ask for their handed-over projects, not their renders), the location's rental demand today (not the masterplan's promise), and a payment plan you can carry comfortably if your circumstances change. We apply all three before any project reaches our recommendations.",
      },
    ],
    faqs: [
      {
        q: "How much deposit do I need for off-plan in Dubai?",
        a: "Booking amounts typically run 5–20% of the purchase price, followed by construction-linked instalments. The 4% DLD fee is usually payable around contract signing.",
      },
      {
        q: "What happens if the developer delays handover?",
        a: "SPAs include an anticipated completion date plus a grace period (commonly up to 12 months). Beyond it, buyers are generally entitled to compensation as set out in the contract, and RERA oversees stalled projects.",
      },
      {
        q: "Can I resell before the project completes?",
        a: "Yes — assignments are normal in Dubai. Most developers permit resale once 30–40% of the price is paid, against an NOC fee.",
      },
      {
        q: "Do foreigners get the same protections?",
        a: "Identical. Escrow, Oqood registration and RERA oversight apply to every buyer regardless of nationality or residency.",
      },
    ],
    related: ["off-plan-projects-in-dubai", "dubai-property-buying-costs", "new-projects-in-dubai"],
  },
  {
    slug: "dubai-property-buying-costs",
    label: "Buying Costs Explained",
    title: "Dubai Property Buying Costs — Fees, Charges & What to Budget",
    h1: "Dubai Property Buying Costs, Explained",
    description:
      "Every cost of buying property in Dubai: the 4% DLD fee, trustee and agent fees, mortgage costs and ongoing service charges — with rules of thumb.",
    intro: [
      "Dubai's headline advantage is what it doesn't charge: no annual property tax, no capital gains tax, no stamp duty beyond a one-time transfer fee. But there are real one-time costs at purchase, and glossing over them is how first-time buyers end up surprised at the trustee office.",
      "The honest rule of thumb: budget 6–8% on top of the purchase price for a ready property bought with a mortgage, less for cash, and closer to 4–5% for off-plan direct from a developer. Here is where every dirham goes.",
    ],
    kind: "guide",
    factsHeading: "The costs at a glance",
    facts: [
      { label: "DLD transfer fee", value: "4% of the price + AED 580 admin — the big one" },
      { label: "Trustee office", value: "≈ AED 4,000 + VAT (AED 2,000 below 500K)" },
      { label: "Agent commission", value: "Typically 2% + VAT on resale; developer sales cost you nothing" },
      { label: "Mortgage registration", value: "0.25% of the loan + AED 290, plus bank arrangement fees" },
      { label: "Valuation", value: "≈ AED 2,500–3,500 when financing" },
      { label: "Developer NOC", value: "AED 500–5,000 on resales within a project" },
    ],
    sections: [
      {
        heading: "One-time costs at purchase",
        body: "The Dubai Land Department takes 4% of the purchase price at transfer, plus small admin fees. Add the trustee office fee, your agent's commission on resales, and — if you finance — the bank's arrangement fee (commonly up to 1% of the loan), the 0.25% mortgage registration and a valuation. Off-plan buyers pay the same 4% DLD (as the Oqood fee) but usually no agent commission, since developers pay the broker.",
      },
      {
        heading: "Ongoing costs owners actually pay",
        body: "Service charges are the number to respect: they fund the building's upkeep and run anywhere from roughly AED 10 to 30+ per square foot per year depending on the community and its amenities. Add DEWA (utilities), district cooling where applicable, and home insurance. There is no annual property tax — the service charge is effectively Dubai's substitute, so always check it before you buy, not after.",
      },
      {
        heading: "Where buyers overspend",
        body: "Two places: paying agent commission on a new launch a developer would have sold them commission-free, and underestimating service charges on amenity-heavy towers. Both are checkable in minutes — the first by coming to the developer's broker directly (that's us), the second by asking for the current OA budget before signing.",
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
    ],
    related: ["how-to-buy-off-plan-property-in-dubai", "ready-properties-in-dubai", "dubai-golden-visa-property-guide"],
  },
  {
    slug: "can-foreigners-buy-property-in-dubai",
    label: "Foreign Buyer Guide",
    title: "Can Foreigners Buy Property in Dubai? — Ownership Rules 2026",
    h1: "Can Foreigners Buy Property in Dubai?",
    description:
      "Yes — foreigners can own Dubai property 100% freehold in designated zones, with no residency required. The rules, the zones and the process.",
    intro: [
      "Yes — and more completely than in almost any comparable market. Since 2002, foreign nationals can buy, own, sell and lease property in Dubai's designated freehold zones with 100% ownership, a government-issued title deed, and no requirement to live in — or even visit — the UAE.",
      "Practically every district an international buyer has heard of is freehold: Dubai Marina, Downtown, Palm Jumeirah, JVC, Business Bay, Dubai Hills and dozens more. This guide covers how ownership works, how overseas buyers complete purchases remotely, and the financing available to non-residents.",
    ],
    kind: "guide",
    imageQuery: "marina",
    factsHeading: "Foreign ownership at a glance",
    facts: [
      { label: "Ownership", value: "100% freehold in designated zones — full title in your name" },
      { label: "Residency", value: "Not required to buy, own or sell" },
      { label: "Visa path", value: "AED 2M+ property qualifies you for the 10-year Golden Visa" },
      { label: "The zones", value: "Marina, Downtown, Palm, JVC, Business Bay + 40 more districts" },
      { label: "Financing", value: "UAE banks lend to non-residents, typically 50–60% of value" },
      { label: "Inheritance", value: "A DIFC Wills registration protects non-Muslim succession wishes" },
    ],
    sections: [
      {
        heading: "How freehold works for foreigners",
        body: "Inside the designated zones, a foreign buyer's ownership is identical to a UAE national's: a title deed issued by the Dubai Land Department, the right to sell, lease, mortgage or pass on the property, and no time limit on the holding. Outside those zones, ownership for foreigners is generally via long leasehold — but in practice the freehold map covers virtually everywhere international buyers actually look.",
      },
      {
        heading: "Buying from abroad",
        body: "Remote purchases are routine: reservation and contracts are signed digitally, funds move by bank transfer into regulated accounts (escrow for off-plan, trustee-managed transfer for ready), and a power of attorney can stand in for you at the transfer appointment. A passport is the only document a cash buyer strictly needs to get started.",
      },
      {
        heading: "Financing as a non-resident",
        body: "UAE banks lend to non-residents on completed property, typically at 50–60% loan-to-value with rates linked to EIBOR; residents reach 75–80%. Off-plan purchases are usually carried on the developer's payment plan instead — which is interest-free by construction — and refinanced after handover if desired.",
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
        a: "Yes — property worth AED 750,000+ can support a renewable 2-year residence visa, and AED 2 million+ qualifies you to apply for the 10-year Golden Visa.",
      },
      {
        q: "Can non-residents get a UAE mortgage?",
        a: "Yes, on completed properties — typically up to 50–60% of the value for non-residents, subject to the bank's income checks.",
      },
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

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug)
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
    ["marina", ["dubai-marina"]],
    ["downtown", ["downtown-dubai"]],
    ["palm jumeirah", ["palm-jumeirah"]],
    ["creek", ["dubai-creek-harbour"]],
    ["hills estate", ["dubai-hills-estate"]],
    ["jumeirah beach residence", ["jumeirah-beach-residence"]],
    ["arabian ranches", ["arabian-ranches"]],
    ["furjan", ["al-furjan"]],
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
  if (price != null && price >= 2_000_000) add("golden-visa-properties-in-dubai")

  // Status and city.
  if (city.includes("abu dhabi")) add("new-projects-in-abu-dhabi")
  else if (p.status === "completed") add("ready-properties-in-dubai")
  else add("off-plan-projects-in-dubai")
  if (city.includes("dubai")) add("new-projects-in-dubai")

  return out.slice(0, 6)
}
