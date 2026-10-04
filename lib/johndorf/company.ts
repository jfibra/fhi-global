/**
 * Johndorf Ventures Corporation — the facts the presentation's landing page
 * (/johndorf/home) shows. Every line comes from Johndorf's own site
 * (sitedev.johndorfventures.com: About Us, Our Projects, Residential, Buyer's
 * Guide, the 2025 news posts) or the press (BusinessWorld, SunStar, Manila
 * Standard, Metro Cebu, Philstar Property, Filipinohomes), read 2026-10-04.
 * Photos are Johndorf's own or the press's (credited where shown), saved under
 * public/johndorf/site/. Nothing here is invented — keep it that way.
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

/** The five cities on the footprint map (city-centre coordinates). */
export const FOOTPRINT: { city: string; region: string; lat: number; lng: number; label: "left" | "right" }[] = [
  { city: "Cebu", region: "Central Visayas", lat: 10.3157, lng: 123.8854, label: "left" },
  { city: "Butuan", region: "Caraga", lat: 8.9475, lng: 125.5406, label: "right" },
  { city: "Cagayan de Oro", region: "Northern Mindanao", lat: 8.4542, lng: 124.6319, label: "left" },
  { city: "Iligan", region: "Northern Mindanao · where it began", lat: 8.228, lng: 124.2452, label: "left" },
  { city: "Davao", region: "Davao Region", lat: 7.1907, lng: 125.4553, label: "right" },
]

/** Each step's photo is a real Johndorf place, captioned with what it is (not a photo of the year itself). */
export const TIMELINE = [
  { year: "1986", title: "Founded in Iligan", text: "A home-grown company started by the Lim family in Iligan City.", image: "/johndorf/site/villa-castena.jpg", caption: "Villa Castena · Iligan City" },
  { year: "Then", title: "Into Cagayan de Oro", text: "Its first project there: the PN ROA Low-Cost Housing Subdivision.", image: "/johndorf/site/arvesa.jpg", caption: "Arvesa Village · Cagayan de Oro" },
  { year: "2001", title: "Growing with CDO", text: "The city's infrastructure push opened the way for more Johndorf communities.", image: "/johndorf/site/tierranava-lumbia.jpg", caption: "TierraNava Lumbia · Cagayan de Oro" },
  { year: "Cebu", title: "Branches in Cebu", text: "Trusted for workmanship, Johndorf became one of the region's leading developers.", image: "/johndorf/site/tierranava-carcar.jpg", caption: "TierraNava Carcar · Cebu" },
  { year: "2013+", title: "On to Davao", text: "Expansion into one of Mindanao's most progressive cities.", image: "/johndorf/site/family.jpg", caption: "Homes for every Filipino family" },
  { year: "2025", title: "Johndorf Tower & the world", text: "Its own LEED Gold office tower in Cebu Business Park, and a global debut in Bangkok.", image: "/johndorf/site/tower.jpg", caption: "Johndorf Tower · Cebu Business Park" },
]

export const FLAGSHIPS = [
  {
    id: "palmava",
    name: "Palmava",
    place: "Poblacion, Cordova, Cebu",
    image: "/johndorf/site/palmava.jpg",
    /** Centre the main tower (the render fades a second one in on the right). */
    focus: "28% 50%",
    kicker: "The new flagship",
    text: "Johndorf's mid-to-high-end vertical development — introduced to more than 900 agents at the Asian Real Estate Summit 2025 in Bangkok.",
    facts: ["Mid-to-high-end", "For OFWs & investors", "Vertical living"],
  },
  {
    id: "tower",
    name: "Johndorf Tower",
    place: "Cebu Business Park",
    image: "/johndorf/site/tower.jpg",
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

/** Award photos, with where each was published. */
export const AWARD_PHOTOS = {
  stage: { src: "/johndorf/site/awards-night.jpg", alt: "Richard Lim and Abi Lim receiving Best CBD Development", caption: "Richard Lim and Abi Lim receive Best CBD Development · Aug 15, 2025, Shangri-La The Fort", credit: "Metro Cebu" },
  sign: { src: "/johndorf/site/tower-winner.jpg", alt: "The PropertyGuru winner's banner at Johndorf Tower", caption: "Winner's banner at the Johndorf Tower entrance", credit: "Filipinohomes" },
}

export const RECOGNITION = {
  title: "Top 4 Developer in the Philippines",
  by: "Filipino Homes · National Real Estate Convention",
  date: "October 19, 2025 · Waterfront Cebu City Hotel & Casino",
  image: "/johndorf/site/award-plaque.jpg",
}

export const VALUES = ["Commitment", "Customer-Centric", "Innovation", "Leadership", "Excellence", "Respect"] as const

/**
 * The Lim family at the Johndorf Tower opening (Feb 2025), left to right exactly
 * as Manila Standard's caption names them. x/y = head position in
 * public/johndorf/site/family-launch.jpg (percent). Titles: that caption, except
 * Richard (Filipinohomes, May 2026) and Norma (Johndorf's own post, Nov 2025).
 */
export const FAMILY_PHOTO = { src: "/johndorf/site/family-launch.jpg", width: 2000, height: 1432, caption: "The Johndorf Tower opening, February 2025", credit: "Manila Standard" }
export const FAMILY = [
  { name: "Genevieve Lim", role: "Manager, Leasing & Commercial", x: 13.3, y: 25 },
  { name: "Frances Dominique Lim", role: "Daughter of Richard & Norma Lim", x: 26, y: 23.5 },
  { name: "Abi Lim", role: "AVP, Business Development", x: 35.8, y: 23 },
  { name: "Norma Lim", role: "EVP & Treasurer", x: 44, y: 24 },
  { name: "Richard Lim", role: "President & CEO", x: 57, y: 21 },
  { name: "Patrick Lim", role: "AVP, Finance & Accounting", x: 68.5, y: 23 },
  { name: "Raymond Lim", role: "AVP, Construction Management", x: 82.3, y: 20 },
]
export const ALSO_LEADING = [{ name: "Francis Icamen", role: "AVP, Sales & Marketing" }]

/** Said at the 13th PropertyGuru Philippines Property Awards (Metro Cebu, Aug 2025). */
export const QUOTES = [
  {
    name: "Richard Lim",
    role: "President & CEO",
    photo: "/johndorf/site/richard-lim.jpg",
    text: "Johndorf has always believed that Cebu deserves developments that combine functionality, sustainability, and accessibility.",
    more: "These awards are a validation of our vision to contribute to the growth of Cebu as a global hub while staying true to our roots as a homegrown developer.",
  },
  {
    name: "Abi Lim",
    role: "AVP, Business Development",
    photo: "/johndorf/site/abi-lim.jpg",
    text: "Plumera Mactan and Johndorf Tower represent how we are broadening our portfolio while keeping the values of quality and affordability.",
    more: "These recognitions challenge us to continue innovating for both the business community and Filipino families seeking better living spaces.",
  },
]
export const QUOTES_SOURCE = "Metro Cebu · August 2025"

export const BUYING = {
  steps: ["Select a property and unit type", "Reserve the unit", "Complete and manage it in the Customer Portal"],
  financing: ["Pag-IBIG (HDMF)", "Bank financing", "Spot cash"],
  turnover: ["Unit completion", "Property Management acceptance", "Owner inspection", "Repairs", "Final inspection", "Turnover"],
}

export const NEWS = [
  { date: "May 15, 2026", title: "Filipinohomes CEO Anthony Leuterio meets Johndorf's Richard and Abi Lim for strategic planning", image: "/johndorf/site/planning-session.jpg", href: "https://filipinohomes.com/news/filipinohomes-ceo-anthony-leuterio-meets-johndorfs-owners-richard-and-abigail-lim-for-strategic-planning-celebrating-a-banner-year-after-five-propertyguru-awards" },
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
