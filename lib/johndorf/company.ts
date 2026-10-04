/**
 * Johndorf Ventures Corporation — the facts the presentation's landing page
 * (/johndorf/home) shows. Every line comes from Johndorf's own site
 * (sitedev.johndorfventures.com: About Us, Our Projects, Residential, Buyer's
 * Guide, the 2025 news posts) or the press it cites (BusinessWorld, SunStar),
 * read 2026-10-04. Photos are Johndorf's own, saved under public/johndorf/site/.
 * Nothing here is invented — keep it that way when adding to it.
 */

export const COMPANY = {
  name: "Johndorf Ventures Corporation",
  tagline: "Always there",
  founded: 1986,
  origin: "Founded in Iligan City by the Lim family",
  mission:
    "To be the leader in providing better living for every Filipino through affordable, quality homes and livable communities.",
  hq: ["19th Floor Johndorf Tower, Mindanao Ave.", "Cebu Business Park, Cebu City 6000"],
  website: "https://sitedev.johndorfventures.com/",
}

export const STATS = [
  { value: 40, suffix: "", label: "Years of building homes" },
  { value: 50, suffix: "+", label: "Communities" },
  { value: 5, suffix: "", label: "Cities in Visayas & Mindanao" },
  { value: 5, suffix: "", label: "PropertyGuru trophies, 2025" },
]

export const CITIES = ["Cebu", "Cagayan de Oro", "Davao", "Iligan", "Butuan"]

export const TIMELINE = [
  { year: "1986", title: "Founded in Iligan", text: "A home-grown company started by the Lim family in Iligan City." },
  { year: "Then", title: "Into Cagayan de Oro", text: "Its first project there: the PN ROA Low-Cost Housing Subdivision." },
  { year: "2001", title: "Growing with CDO", text: "The city's infrastructure push opened the way for more Johndorf communities." },
  { year: "Cebu", title: "Branches in Cebu", text: "Trusted for workmanship, Johndorf became one of the region's leading developers." },
  { year: "2013+", title: "On to Davao", text: "Expansion into one of Mindanao's most progressive cities." },
  { year: "2025", title: "Johndorf Tower & the world", text: "Its own LEED Gold office tower in Cebu Business Park, and a global debut in Bangkok." },
]

export const FLAGSHIPS = [
  {
    id: "palmava",
    name: "Palmava",
    place: "Poblacion, Cordova, Cebu",
    image: "/johndorf/site/palmava.jpg",
    /** The render carries its own logo bottom-left — keep it out from under the caption. */
    focus: "100% 50%",
    kicker: "The new flagship",
    text: "Johndorf's mid-to-high-end vertical development — introduced to more than 900 agents at the Asian Real Estate Summit 2025 in Bangkok.",
    facts: ["Mid-to-high-end", "For OFWs & investors", "Vertical living"],
  },
  {
    id: "tower",
    name: "Johndorf Tower",
    place: "Cebu Business Park",
    image: "/johndorf/site/tower-inauguration.jpg",
    kicker: "Best CBD Development",
    text: "21 storeys of LEED Gold-certified workspace across from Ayala Center Cebu — and Johndorf's corporate home.",
    facts: ["21 storeys", "LEED Gold", "16,000+ sqm"],
  },
  {
    id: "plumera",
    name: "Plumera Mactan",
    place: "Basak, Lapu-Lapu City",
    image: "/johndorf/site/plumera.jpg",
    kicker: "Best Affordable Condo, Metro Cebu",
    text: "22 buildings by the sea, 15 minutes from Mactan–Cebu International Airport, with a clubhouse and pool.",
    facts: ["22 buildings", "96 units each", "15 min to airport"],
  },
]

export type Region = "Cebu" | "Cagayan de Oro" | "Iligan"

export const PROJECTS: {
  name: string
  place: string
  region: Region
  image: string
  status?: "Ongoing" | "Completed"
  /** Opens the clickable site plan (/johndorf/dashboard). */
  interactive?: true
}[] = [
  { name: "Montierra", place: "Cagayan de Oro", region: "Cagayan de Oro", image: "/johndorf/site/montierra.jpg", interactive: true },
  { name: "Costa Liya", place: "Suba-Basbas, Lapu-Lapu City", region: "Cebu", image: "/johndorf/site/costa-liya.jpg" },
  { name: "Arvesa Village", place: "Lumbia, Cagayan de Oro", region: "Cagayan de Oro", image: "/johndorf/site/arvesa.jpg" },
  { name: "TierraNava Carcar", place: "Poblacion I, Carcar City", region: "Cebu", image: "/johndorf/site/tierranava-carcar.jpg", status: "Completed" },
  { name: "Villa Castena", place: "Dalipuga, Iligan City", region: "Iligan", image: "/johndorf/site/villa-castena.jpg", status: "Ongoing" },
  { name: "Navona Lumbia", place: "Lumbia, Cagayan de Oro", region: "Cagayan de Oro", image: "/johndorf/site/navona-lumbia.jpg" },
  { name: "TierraNava Lumbia", place: "Lumbia, Cagayan de Oro", region: "Cagayan de Oro", image: "/johndorf/site/tierranava-lumbia.jpg", status: "Ongoing" },
  { name: "TierraNava Opol", place: "Opol, Misamis Oriental", region: "Cagayan de Oro", image: "/johndorf/site/tierranava-opol.jpg", status: "Ongoing" },
  { name: "TierraNava Tagoloan", place: "Tagoloan, Misamis Oriental", region: "Cagayan de Oro", image: "/johndorf/site/tierranava-tagoloan.jpg", status: "Ongoing" },
  { name: "Pich 4B", place: "Opol, Misamis Oriental", region: "Cagayan de Oro", image: "/johndorf/site/pich-4b.jpg" },
  { name: "Plumera Mactan", place: "Basak, Lapu-Lapu City", region: "Cebu", image: "/johndorf/site/plumera.jpg", status: "Ongoing" },
  { name: "Palmava", place: "Cordova, Cebu", region: "Cebu", image: "/johndorf/site/palmava.jpg" },
]

export const AWARDS = [
  {
    body: "PropertyGuru Philippines Property Awards",
    year: "2025",
    headline: "5 trophies · 2 citations",
    items: [
      { project: "Johndorf Tower", wins: ["Best CBD Development", "Best Office Development"], commended: ["Best BPO Office Development", "Best Green Commercial Development"] },
      { project: "Plumera Mactan", wins: ["Best Affordable Condo Development (Metro Cebu)", "Best Connectivity Condo Development", "Best Affordable Condo Architectural Design"], commended: [] },
    ],
  },
]

export const RECOGNITION = {
  title: "Top 4 Developer in the Philippines",
  by: "Filipino Homes · National Real Estate Convention",
  date: "October 19, 2025 · Waterfront Cebu City Hotel & Casino",
  image: "/johndorf/site/award-plaque.jpg",
}

export const VALUES = ["Commitment", "Customer-Centric", "Innovation", "Leadership", "Excellence", "Respect"] as const

export const LEADERS = [
  { name: "Richard Lim", role: "Chief Executive Officer" },
  { name: "Norma Lim", role: "Executive Vice President & Treasurer" },
  { name: "Abi Lim", role: "AVP, Business Development" },
  { name: "Francis Icamen", role: "AVP, Sales & Marketing" },
]

export const BUYING = {
  steps: ["Select a property and unit type", "Reserve the unit", "Complete and manage it in the Customer Portal"],
  financing: ["Pag-IBIG (HDMF)", "Bank financing", "Spot cash"],
  turnover: ["Unit completion", "Property Management acceptance", "Owner inspection", "Repairs", "Final inspection", "Turnover"],
}

export const NEWS = [
  { date: "December 18, 2025", title: "Cebu City, Johndorf explore collaboration in urban programs", image: "/johndorf/site/cebu-city.jpg", href: "https://sitedev.johndorfventures.com/2025/12/18/cebu-city-johndorf-explore-collaboration-in-urban-programs/" },
  { date: "November 12, 2025", title: "Filipino Homes cites Johndorf as Top 4 Developer in 2025", image: "/johndorf/site/award-stage.jpg", href: "https://sitedev.johndorfventures.com/2025/11/12/filipino-homes-cites-johndorf-as-top-4-developer-in-2025/" },
  { date: "September 16, 2025", title: "Johndorf Ventures wins big for Johndorf Tower, Plumera Mactan", image: "/johndorf/site/tower-inauguration.jpg", href: "https://sitedev.johndorfventures.com/2025/09/16/johndorf-ventures-wins-big-for-johndorf-tower-plumera-mactan/" },
  { date: "August 15, 2025", title: "Johndorf makes global debut with new project in Thai summit", image: "/johndorf/site/ares-bangkok.jpg", href: "https://sitedev.johndorfventures.com/2025/08/15/johndorf-makes-global-debut-with-new-project-in-thai-summit/" },
]

export const HERO_SLIDES = [
  { src: "/johndorf/site/tierranava-carcar.jpg", caption: "TierraNava Carcar · Cebu" },
  { src: "/johndorf/site/palmava.jpg", caption: "Palmava · Cordova, Cebu" },
  { src: "/johndorf/site/costa-liya.jpg", caption: "Costa Liya · Lapu-Lapu City" },
  { src: "/johndorf/site/montierra.jpg", caption: "Montierra · Cagayan de Oro" },
  { src: "/johndorf/site/villa-castena.jpg", caption: "Villa Castena · Iligan" },
]
