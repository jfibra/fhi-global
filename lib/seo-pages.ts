/**
 * SEO landing pages — the "popular searches" pages the big Dubai portals rank
 * with (fhiglobal.ae/new-projects-in-dubai, …). Served by the root [slug]
 * route: a slug is looked up as a developer first, then here.
 *
 * Every page in this catalog is backed by a real, server-rendered project grid
 * — that's the entry ticket. A landing page over an empty result set is a
 * doorway page: crawlers classify it as thin content and it drags the whole
 * domain down. That's also why the catalog is projects-based (120 published
 * projects carry images) and not listings-based (4 live listings today).
 * When listings volume grows, "apartments-for-sale-in-dubai"-style entries can
 * join with a listings-backed grid.
 *
 * The catalog is deliberately hand-curated constants, not a DB table: the
 * footer renders these links on every public page, and copy this central to
 * SEO should go through review, not appear the moment a row is inserted.
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
  /** Intro paragraphs rendered above the grid — real copy, crawlable. */
  intro: string[]
  filter: SeoPageFilter
  /** Slugs from this catalog to cross-link under the grid. */
  related: string[]
}

// Non-UAE one-offs in the projects table (a project in Istanbul, one in
// Egypt's Mostakbal City). UAE-wide pages exclude them so the page's claim
// stays true.
export const NON_UAE_CITIES = ["istanbul", "mostakbal"]

export const SEO_PAGES: SeoPage[] = [
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
    filter: {},
    related: ["new-projects-in-dubai", "new-projects-in-abu-dhabi", "off-plan-projects-in-uae"],
  },
]

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug)
}
