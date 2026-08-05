// Shared theme + placeholder content for the Website Builder agent-site
// template (/website/sample). Every image is a local asset or the already-
// allowlisted S3 bucket, so nothing trips the CSP. When the template gets
// wired to real builder data, this module is the single seam to replace.

import { Award, HomeIcon, Star, TrendingUp, Users } from "lucide-react"

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
  houseA: "/images/house.jpg",
  houseB: "/images/house 2.jpg",
  houseC: "/images/properties.jpg",
  aptA: `${S3}/grbucket/projects/9/images/1br-1.jpg`,
  aptB: `${S3}/grbucket/projects/9/images/1br-3.jpg`,
  aptC: `${S3}/grbucket/projects/9/images/1br-4.jpg`,
}

export type PartnerLogo = { name: string; url: string }

export const PARTNER_LOGOS: PartnerLogo[] = [
  { name: "Aldar", url: `${S3}/FHI_GLOBAL/aldar-development/1785813465953-logo.png` },
  { name: "Sobha", url: `${S3}/FHI_GLOBAL/sobha-realty/1785813695666-logo.png` },
  { name: "Danube", url: `${S3}/FHI_GLOBAL/danube-properties/1785813896317-logo.png` },
  { name: "Ellington", url: `${S3}/FHI_GLOBAL/ellington-properties/1785813947798-logo.png` },
  { name: "Imtiaz", url: `${S3}/FHI_GLOBAL/imtiaz-development/1785813861825-logo.png` },
  { name: "Acube", url: `${S3}/FHI_GLOBAL/acube-developments/1785821040488-logo.png` },
  { name: "Qube", url: `${S3}/FHI_GLOBAL/qube-development/1785821102405-logo.png` },
  { name: "Dugasta", url: `${S3}/FHI_GLOBAL/dugasta/1785821474147-logo.png` },
]

export const AGENT = {
  name: "Raphael Tempest",
  firstName: "Raphael",
  brn: "123456",
  orn: "34567",
  phone: "+971 50 123 4567",
  email: "raphael.tempest@fhiglobal.ae",
  office: "Business Bay, Dubai, UAE",
}

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

export type Stat = { icon: typeof Award; value: string; label: string }

export const HERO_STATS: Stat[] = [
  { icon: Award, value: "8+", label: "Years Experience" },
  { icon: HomeIcon, value: "150+", label: "Properties Sold" },
  { icon: TrendingUp, value: "AED 500M+", label: "Sales Volume" },
  { icon: Star, value: "TOP 5%", label: "Agent in FHI Global" },
]

export type Property = {
  image: string
  badge: string
  title: string
  location: string
  beds: number
  baths: number
  sqft: string
  price: string
  suffix?: string
}

export const PROPERTIES: Property[] = [
  { image: IMG.houseA, badge: "For Sale", title: "Address Residences Dubai Opera", location: "Downtown Dubai", beds: 2, baths: 3, sqft: "1,267", price: "AED 4,200,000" },
  { image: IMG.houseB, badge: "For Sale", title: "Palm Jumeirah Villa", location: "Palm Jumeirah", beds: 5, baths: 6, sqft: "7,500", price: "AED 32,000,000" },
  { image: IMG.aptA, badge: "For Rent", title: "Vida Residences Dubai Marina", location: "Dubai Marina", beds: 1, baths: 2, sqft: "819", price: "AED 120,000", suffix: "/ Year" },
  { image: IMG.aptB, badge: "Off Plan", title: "Sobha One", location: "Sobha Hartland", beds: 2, baths: 3, sqft: "1,200", price: "AED 2,750,000" },
]

export type Project = {
  image: string
  developer: PartnerLogo
  title: string
  location: string
  units: string
  from: string
}

export const PROJECTS: Project[] = [
  { image: IMG.skylineA, developer: PARTNER_LOGOS[0], title: "Aldar Beachfront", location: "Dubai Harbour", units: "1 - 4 Bed Apartments", from: "AED 2.1M" },
  { image: IMG.aptC, developer: PARTNER_LOGOS[1], title: "Sobha Hartland II", location: "Mohammed Bin Rashid City", units: "1 - 5 Bed Apartments & Villas", from: "AED 1.6M" },
  { image: IMG.skylineC, developer: PARTNER_LOGOS[2], title: "Palm Jebel Ali", location: "Palm Jebel Ali", units: "4 - 6 Bed Villas", from: "AED 5.2M" },
  { image: IMG.skylineB, developer: PARTNER_LOGOS[3], title: "Ellington House IV", location: "Dubai Hills Estate", units: "1 - 3 Bed Apartments", from: "AED 1.3M" },
]

export const BAND_STATS: Stat[] = [
  { icon: HomeIcon, value: "150+", label: "Properties Sold" },
  { icon: TrendingUp, value: "AED 500M+", label: "Total Sales Value" },
  { icon: Users, value: "100+", label: "Happy Clients" },
  { icon: Award, value: "8+", label: "Years Experience" },
  { icon: Star, value: "4.9/5", label: "Client Rating" },
]

export type Area = { image: string; label: string; sub: string }

export const AREAS: Area[] = [
  { image: IMG.houseA, label: "Dubai Marina", sub: "Waterfront Living" },
  { image: IMG.skylineC, label: "Downtown Dubai", sub: "City Icons" },
  { image: IMG.houseB, label: "Palm Jumeirah", sub: "Beachfront Villas" },
  { image: IMG.skylineA, label: "Business Bay", sub: "The Business Hub" },
  { image: IMG.houseC, label: "Dubai Hills Estate", sub: "Family Communities" },
  { image: IMG.skylineB, label: "JVC", sub: "Smart Investments" },
]

export const GALLERY_CATEGORIES = ["Event Photos", "Certificates", "Awards & Recognition"] as const
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]

/** Placeholder gallery — all three categories reuse the sample images until
 *  real photos / certificates / awards are uploaded via the builder. */
export const GALLERY: Record<GalleryCategory, string[]> = {
  "Event Photos": [IMG.houseA, IMG.skylineC, IMG.houseB, IMG.aptA, IMG.houseC, IMG.aptB, IMG.skylineA, IMG.aptC],
  Certificates: [IMG.skylineB, IMG.aptA, IMG.houseC, IMG.skylineA],
  "Awards & Recognition" : [IMG.houseB, IMG.skylineC, IMG.aptB, IMG.houseA],
}

export type Testimonial = { quote: string; name: string; where: string }

export const TESTIMONIALS: Testimonial[] = [
  { quote: "Raphael was exceptional from start to finish. His market knowledge and dedication made the entire process seamless.", name: "John D.", where: "Dubai Marina" },
  { quote: "Professional, responsive, and always had our best interests at heart. We highly recommend his services.", name: "Fatima Al Zaabi", where: "Abu Dhabi, UAE" },
  { quote: "Thanks to Raphael, we found our dream home in Dubai. Truly a partner you can trust.", name: "James & Sarah W.", where: "Sydney, Australia" },
  { quote: "From viewing to handover, everything was smooth and transparent. He made our Dubai investment effortless.", name: "Michael T.", where: "London, UK" },
]

export const ABOUT_TEXT =
  "With years of experience in Dubai's dynamic real estate market, I help clients buy, sell, and invest with confidence. My focus is on understanding each client's goals first — whether that's a family home in a quiet community, a high-yield off-plan investment, or a waterfront residence with iconic views. I work closely with Dubai's most trusted developers and keep a close eye on market movements, so my clients always act on current, reliable information. From the first viewing to final handover, I handle the details — negotiations, paperwork, and everything in between — so the journey stays simple and transparent. With years of experience in Dubai's dynamic real estate market, I help clients buy, sell, and invest with confidence. My focus is on understanding each client's goals first — whether that's a family home in a quiet community, a high-yield off-plan investment, or a waterfront residence with iconic views. I work closely with Dubai's most trusted developers and keep a close eye on market movements, so my clients always act on current, reliable information. From the first viewing to final handover, I handle the details — negotiations, paperwork, and everything in between — so the journey stays simple and transparent."
