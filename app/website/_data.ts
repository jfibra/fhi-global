// Shared theme + content model for the Website Builder agent-site template.
//
// The template is data-driven: every section takes a `data?: WebsiteData`
// prop and falls back to SAMPLE_DATA, so /website/sample renders the sample
// exactly as before while the dashboard Website Builder editor renders the
// same sections with the agent's own draft. Every sample image is a local
// asset or the already-allowlisted S3 bucket, so nothing trips the CSP.

import {
  Award, BadgeCheck, Briefcase, Building2, Gem, Globe, Handshake, HomeIcon,
  KeyRound, Landmark, Medal, Star, Trophy, TrendingUp, Users,
} from "lucide-react"

export const GOLD = "#c9a24b"
export const GOLD_SOFT = "#d6b357"
export const NAVY = "#0d1b2e"
export const INK = "#0a1628"
export const IVORY = "#faf8f4"

export const script = { fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" }

const S3 = "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com"

export const IMG = {
  hero: "/background/sample-hero.png",
  portrait: "/background/sample-portrait.png",
  skylineC: "/background/dubai.webp",
  skylineA: "/background/home.webp",
  skylineB: "/background/developers.webp",
  galleryBg: "/background/gallery-dubai.jpg",
  featuredBg: "/background/featured-marina.jpg",
  houseA: "/images/house.jpg",
  houseB: "/images/house 2.jpg",
  houseC: "/images/properties.jpg",
  aptA: `${S3}/grbucket/projects/9/images/1br-1.jpg`,
  aptB: `${S3}/grbucket/projects/9/images/1br-3.jpg`,
  aptC: `${S3}/grbucket/projects/9/images/1br-4.jpg`,
}

const LOGO = {
  aldar: `${S3}/FHI_GLOBAL/aldar-development/1785813465953-logo.png`,
  sobha: `${S3}/FHI_GLOBAL/sobha-realty/1785813695666-logo.png`,
  danube: `${S3}/FHI_GLOBAL/danube-properties/1785813896317-logo.png`,
  ellington: `${S3}/FHI_GLOBAL/ellington-properties/1785813947798-logo.png`,
}

/** Fixed template chrome — the navbar is not per-agent editable. */
export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Home", href: "#home" },
  { label: "Projects", href: "#projects" },
  { label: "Buy", href: "#properties" },
  { label: "Rent", href: "#properties" },
  { label: "About", href: "#about" },
  { label: "Service Areas", href: "#areas" },
  { label: "Reviews", href: "#reviews" },
  { label: "Agent Profile", href: "#about" },
]

// ─── Content model ────────────────────────────────────────────────────────────
// Icons are stored as string keys into STAT_ICONS, so drafts stay plain JSON.
// A stat without an icon falls back to its section's positional default.

export const STAT_ICONS = {
  award: Award,
  home: HomeIcon,
  "trending-up": TrendingUp,
  star: Star,
  users: Users,
  building: Building2,
  key: KeyRound,
  medal: Medal,
  trophy: Trophy,
  handshake: Handshake,
  globe: Globe,
  gem: Gem,
  landmark: Landmark,
  briefcase: Briefcase,
  "badge-check": BadgeCheck,
} as const

export type StatIconKey = keyof typeof STAT_ICONS

/** Positional icon defaults for hero stats without an explicit icon. */
export const HERO_STAT_ICON_FALLBACK: StatIconKey[] = ["award", "home", "trending-up", "star"]

/** Positional icon defaults for the market-stats band. */
export const BAND_STAT_ICON_FALLBACK: StatIconKey[] = ["home", "trending-up", "users", "award", "star"]

export type EditableStat = { icon?: StatIconKey; value: string; label: string }

export type Property = {
  /** Set when the card was picked from a real listing in the editor. */
  sourceId?: string
  image: string
  badge: string
  title: string
  location: string
  beds: string
  baths: string
  sqft: string
  price: string
  suffix?: string
}

export type Project = {
  /** Set when the card was picked from a real project in the editor. */
  sourceId?: string
  image: string
  badge: string
  developerName: string
  developerLogo: string
  title: string
  location: string
  units: string
  from: string
}

export type Area = { image: string; label: string }

export type Testimonial = { quote: string; name: string; where: string }

export const GALLERY_CATEGORIES = ["Event Photos", "Certificates", "Awards & Recognition"] as const
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]

export type WebsiteData = {
  agent: {
    name: string
    /** The line under the name — e.g. "International Property Endorser". */
    title: string
    brn: string
    orn: string
    brokerage: string
    phone: string
    whatsapp: string
    email: string
    office: string
  }
  hero: {
    /** Plain part of the headline; newlines become line breaks. */
    headline: string
    /** Headline text color; defaults to the template navy. */
    headlineColor?: string
    /** Rendered right after the headline in its own accent color. */
    headlineAccent: string
    /** Accent text color; defaults to the template gold. */
    headlineAccentColor?: string
    description: string
    /** Description text color; defaults to the template slate. */
    descriptionColor?: string
    image: string
    /** 0–100 strength of a left-side dark gradient behind the headline, so
     *  the copy stays readable on bright photos. 0/undefined = no overlay. */
    overlay?: number
    stats: EditableStat[]
  }
  about: {
    /** Section heading; newlines become line breaks. */
    heading: string
    bio: string
    portrait: string
    views: string
    listings: string
    rating: string
    socials: { facebook: string; instagram: string; linkedin: string; youtube: string }
  }
  projects: Project[]
  properties: Property[]
  bandStats: EditableStat[]
  areas: Area[]
  gallery: Record<GalleryCategory, string[]>
  testimonials: Testimonial[]
  cta: { heading: string; sub: string }
}

// ─── Sample content ───────────────────────────────────────────────────────────

const ABOUT_TEXT =
  "With years of experience in Dubai's dynamic real estate market, I help clients buy, sell, and invest with confidence. My focus is on understanding each client's goals first — whether that's a family home in a quiet community, a high-yield off-plan investment, or a waterfront residence with iconic views. I work closely with Dubai's most trusted developers and keep a close eye on market movements, so my clients always act on current, reliable information. From the first viewing to final handover, I handle the details — negotiations, paperwork, and everything in between — so the journey stays simple and transparent. With years of experience in Dubai's dynamic real estate market, I help clients buy, sell, and invest with confidence. My focus is on understanding each client's goals first — whether that's a family home in a quiet community, a high-yield off-plan investment, or a waterfront residence with iconic views. I work closely with Dubai's most trusted developers and keep a close eye on market movements, so my clients always act on current, reliable information. From the first viewing to final handover, I handle the details — negotiations, paperwork, and everything in between — so the journey stays simple and transparent."

export const SAMPLE_DATA: WebsiteData = {
  agent: {
    name: "Veldora Tempest",
    title: "International Property Endorser",
    brn: "123456",
    orn: "98765",
    brokerage: "Filipino Homes Inc. Dubai",
    phone: "+971 50 123 4567",
    whatsapp: "+971 50 123 4567",
    email: "sample@fhiglobal.ae",
    office: "Business Bay, Dubai, UAE",
  },
  hero: {
    headline: "Guiding You to\nthe",
    headlineAccent: "Right Move.",
    description: "Personalized real estate solutions with integrity, market expertise, and a commitment to your success.",
    image: IMG.hero,
    stats: [
      { value: "8+", label: "Years Experience" },
      { value: "150+", label: "Properties Sold" },
      { value: "AED 500M+", label: "Sales Volume" },
      { value: "TOP 5%", label: "Agent in FHI Global" },
    ],
  },
  about: {
    heading: "Dedicated to Delivering\nExceptional Results",
    bio: ABOUT_TEXT,
    portrait: IMG.portrait,
    views: "12.5K",
    listings: "24",
    rating: "4.9/5",
    socials: { facebook: "", instagram: "", linkedin: "", youtube: "" },
  },
  projects: [
    { image: IMG.skylineA, badge: "Off Plan", developerName: "Aldar", developerLogo: LOGO.aldar, title: "Aldar Beachfront", location: "Dubai Harbour", units: "1 - 4 Bed Apartments", from: "AED 2.1M" },
    { image: IMG.aptC, badge: "Off Plan", developerName: "Sobha", developerLogo: LOGO.sobha, title: "Sobha Hartland II", location: "Mohammed Bin Rashid City", units: "1 - 5 Bed Apartments & Villas", from: "AED 1.6M" },
    { image: IMG.skylineC, badge: "Off Plan", developerName: "Danube", developerLogo: LOGO.danube, title: "Palm Jebel Ali", location: "Palm Jebel Ali", units: "4 - 6 Bed Villas", from: "AED 5.2M" },
    { image: IMG.skylineB, badge: "Off Plan", developerName: "Ellington", developerLogo: LOGO.ellington, title: "Ellington House IV", location: "Dubai Hills Estate", units: "1 - 3 Bed Apartments", from: "AED 1.3M" },
  ],
  properties: [
    { image: IMG.houseA, badge: "For Sale", title: "Address Residences Dubai Opera", location: "Downtown Dubai", beds: "2", baths: "3", sqft: "1,267", price: "AED 4,200,000" },
    { image: IMG.houseB, badge: "For Sale", title: "Palm Jumeirah Villa", location: "Palm Jumeirah", beds: "5", baths: "6", sqft: "7,500", price: "AED 32,000,000" },
    { image: IMG.aptA, badge: "For Rent", title: "Vida Residences Dubai Marina", location: "Dubai Marina", beds: "1", baths: "2", sqft: "819", price: "AED 120,000", suffix: "/ Year" },
    { image: IMG.aptB, badge: "Off Plan", title: "Sobha One", location: "Sobha Hartland", beds: "2", baths: "3", sqft: "1,200", price: "AED 2,750,000" },
  ],
  bandStats: [
    { value: "150+", label: "Properties Sold" },
    { value: "AED 500M+", label: "Total Sales Value" },
    { value: "100+", label: "Happy Clients" },
    { value: "8+", label: "Years Experience" },
    { value: "4.9/5", label: "Client Rating" },
  ],
  areas: [
    { image: IMG.houseA, label: "Dubai Marina" },
    { image: IMG.skylineC, label: "Downtown Dubai" },
    { image: IMG.houseB, label: "Palm Jumeirah" },
    { image: IMG.skylineA, label: "Business Bay" },
    { image: IMG.houseC, label: "Dubai Hills Estate" },
    { image: IMG.skylineB, label: "JVC" },
  ],
  gallery: {
    "Event Photos": [IMG.houseA, IMG.skylineC, IMG.houseB, IMG.aptA, IMG.houseC, IMG.aptB, IMG.skylineA, IMG.aptC],
    Certificates: [IMG.skylineB, IMG.aptA, IMG.houseC, IMG.skylineA],
    "Awards & Recognition": [IMG.houseB, IMG.skylineC, IMG.aptB, IMG.houseA],
  },
  testimonials: [
    { quote: "Veldora was exceptional from start to finish. His market knowledge and dedication made the entire process seamless.", name: "John D.", where: "Dubai Marina" },
    { quote: "Professional, responsive, and always had our best interests at heart. We highly recommend his services.", name: "Fatima Al Zaabi", where: "Abu Dhabi, UAE" },
    { quote: "Thanks to Veldora, we found our dream home in Dubai. Truly a partner you can trust.", name: "James & Sarah W.", where: "Sydney, Australia" },
    { quote: "From viewing to handover, everything was smooth and transparent. He made our Dubai investment effortless.", name: "Michael T.", where: "London, UK" },
  ],
  cta: {
    heading: "Ready to Take the Next Step?",
    sub: "Let's find the perfect property for you.",
  },
}
