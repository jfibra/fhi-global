"use client"

// Full agent-site template (design sample) — copies the approved mockup with
// placeholder data throughout. Every image is a local asset or the already-
// allowlisted S3 bucket, so nothing trips the CSP.

import { QRCodeSVG } from "qrcode.react"
import {
  ArrowRight, Award, Bath, BedDouble, Building2, CalendarCheck, Check, Facebook, Globe2,
  Eye, Handshake, Heart, HomeIcon, Instagram, KeyRound, Landmark, Linkedin, Mail, MapPin,
  Maximize, MessageCircle, Phone, Play, QrCode, Star, TrendingUp, Users, Youtube,
} from "lucide-react"

const GOLD = "#c9a24b"
const GOLD_SOFT = "#d6b357"
const NAVY = "#0d1b2e"
const INK = "#0a1628"
const IVORY = "#faf8f4"

const S3 = "https://filipinohomes123.s3.ap-southeast-1.amazonaws.com"

const IMG = {
  hero: "/background/sample-hero.png",
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

const PARTNER_LOGOS = [
  { name: "Aldar", url: `${S3}/FHI_GLOBAL/aldar-development/1785813465953-logo.png` },
  { name: "Sobha", url: `${S3}/FHI_GLOBAL/sobha-realty/1785813695666-logo.png` },
  { name: "Danube", url: `${S3}/FHI_GLOBAL/danube-properties/1785813896317-logo.png` },
  { name: "Ellington", url: `${S3}/FHI_GLOBAL/ellington-properties/1785813947798-logo.png` },
  { name: "Imtiaz", url: `${S3}/FHI_GLOBAL/imtiaz-development/1785813861825-logo.png` },
  { name: "Acube", url: `${S3}/FHI_GLOBAL/acube-developments/1785821040488-logo.png` },
  { name: "Qube", url: `${S3}/FHI_GLOBAL/qube-development/1785821102405-logo.png` },
  { name: "Dugasta", url: `${S3}/FHI_GLOBAL/dugasta/1785821474147-logo.png` },
]

const AGENT = {
  name: "Raphael Tempest",
  firstName: "Raphael",
  brn: "123456",
  orn: "34567",
  phone: "+971 50 123 4567",
  email: "raphael.tempest@fhiglobal.ae",
  office: "Business Bay, Dubai, UAE",
}

const NAV_LINKS = ["Home", "Properties", "Projects", "About", "Dubai Guide", "Blog", "Contact"]

const HERO_STATS = [
  { icon: Award, value: "8+", label: "Years Experience" },
  { icon: HomeIcon, value: "150+", label: "Properties Sold" },
  { icon: TrendingUp, value: "AED 500M+", label: "Sales Volume" },
  { icon: Star, value: "TOP 5%", label: "Agents in Dubai" },
]

const PROPERTIES = [
  { image: IMG.houseA, badge: "For Sale", title: "Address Residences Dubai Opera", location: "Downtown Dubai", beds: 2, baths: 3, sqft: "1,267", price: "AED 4,200,000" },
  { image: IMG.houseB, badge: "For Sale", title: "Palm Jumeirah Villa", location: "Palm Jumeirah", beds: 5, baths: 6, sqft: "7,500", price: "AED 32,000,000" },
  { image: IMG.aptA, badge: "For Rent", title: "Vida Residences Dubai Marina", location: "Dubai Marina", beds: 1, baths: 2, sqft: "819", price: "AED 120,000", suffix: "/ Year" },
  { image: IMG.aptB, badge: "Off Plan", title: "Sobha One", location: "Sobha Hartland", beds: 2, baths: 3, sqft: "1,200", price: "AED 2,750,000" },
]

const PROJECTS = [
  { image: IMG.skylineA, developer: PARTNER_LOGOS[0], title: "Aldar Beachfront", location: "Dubai Harbour", units: "1 - 4 Bed Apartments", from: "AED 2.1M" },
  { image: IMG.aptC, developer: PARTNER_LOGOS[1], title: "Sobha Hartland II", location: "Mohammed Bin Rashid City", units: "1 - 5 Bed Apartments & Villas", from: "AED 1.6M" },
  { image: IMG.skylineC, developer: PARTNER_LOGOS[2], title: "Palm Jebel Ali", location: "Palm Jebel Ali", units: "4 - 6 Bed Villas", from: "AED 5.2M" },
  { image: IMG.skylineB, developer: PARTNER_LOGOS[3], title: "Ellington House IV", location: "Dubai Hills Estate", units: "1 - 3 Bed Apartments", from: "AED 1.3M" },
]

const SERVICES = [
  { icon: HomeIcon, title: "Buy Property", desc: "Find the perfect home that fits your lifestyle." },
  { icon: Landmark, title: "Sell Property", desc: "Get the best value for your property." },
  { icon: TrendingUp, title: "Investment Advisory", desc: "Smart strategies for high returns and growth." },
  { icon: KeyRound, title: "Property Management", desc: "Hassle-free management for your investment." },
  { icon: Handshake, title: "Mortgage Assistance", desc: "Guidance to secure the best financing options." },
  { icon: Globe2, title: "Golden Visa Assistance", desc: "Expert support for your UAE Golden Visa." },
]

const BAND_STATS = [
  { icon: HomeIcon, value: "150+", label: "Properties Sold" },
  { icon: TrendingUp, value: "AED 500M+", label: "Total Sales Value" },
  { icon: Users, value: "100+", label: "Happy Clients" },
  { icon: Award, value: "8+", label: "Years Experience" },
  { icon: Star, value: "4.9/5", label: "Client Rating" },
]

const AREAS = [
  { image: IMG.houseA, label: "Dubai Marina", sub: "Waterfront Living" },
  { image: IMG.skylineC, label: "Downtown Dubai", sub: "City Icons" },
  { image: IMG.houseB, label: "Palm Jumeirah", sub: "Beachfront Villas" },
  { image: IMG.skylineA, label: "Business Bay", sub: "The Business Hub" },
  { image: IMG.houseC, label: "Dubai Hills Estate", sub: "Family Communities" },
  { image: IMG.skylineB, label: "JVC", sub: "Smart Investments" },
]

const TESTIMONIALS = [
  { quote: "Raphael was exceptional from start to finish. His market knowledge and dedication made the entire process seamless.", name: "John D.", where: "Dubai Marina" },
  { quote: "Professional, responsive, and always had our best interests at heart. We highly recommend his services.", name: "Fatima Al Zaabi", where: "Abu Dhabi, UAE" },
  { quote: "Thanks to Raphael, we found our dream home in Dubai. Truly a partner you can trust.", name: "James & Sarah W.", where: "Sydney, Australia" },
]

const script = { fontFamily: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive" }

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.3em] ${center ? "text-center" : ""}`} style={{ color: GOLD }}>
      {children}
    </p>
  )
}

function GoldRing({ icon: Icon, dark }: { icon: typeof Award; dark?: boolean }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: GOLD, color: GOLD, backgroundColor: dark ? "rgba(255,255,255,0.04)" : "transparent" }}
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} />
    </span>
  )
}

function Stars() {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5" style={{ color: GOLD, fill: GOLD }} />
      ))}
    </span>
  )
}

export function SampleSite() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: IVORY }}>
      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border" style={{ borderColor: GOLD }}>
              <Building2 className="h-5 w-5" style={{ color: GOLD }} />
            </span>
            <span>
              <span className="block text-[15px] font-bold uppercase tracking-[0.14em] text-white">{AGENT.name}</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.4em]" style={{ color: GOLD }}>
                Real Estate
              </span>
            </span>
          </div>
          <nav className="ml-auto hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((label, i) => (
              <span
                key={label}
                className={`cursor-pointer text-[13.5px] font-semibold ${i === 0 ? "" : "text-white/75 hover:text-white"} transition-colors`}
                style={i === 0 ? { color: GOLD, borderBottom: `2px solid ${GOLD}`, paddingBottom: 2 } : undefined}
              >
                {label}
              </span>
            ))}
          </nav>
          <a
            href={`mailto:${AGENT.email}`}
            className="hidden items-center gap-2 px-5 py-2.5 text-[13px] font-bold sm:inline-flex"
            style={{ backgroundColor: GOLD_SOFT, color: INK }}
          >
            <CalendarCheck className="h-4 w-4" /> Book a Consultation
          </a>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.hero} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="flex min-h-[520px] items-center gap-8 py-16">
            {/* Left: headline */}
            <div className="max-w-xl">
              <Eyebrow>Your trusted real estate partner in Dubai</Eyebrow>
              <h1 className="mt-4 font-serif text-4xl leading-[1.14] font-bold tracking-tight sm:text-[54px] sm:leading-[1.1]" style={{ color: NAVY }}>
                Guiding You to
                <br />
                the <span style={{ color: GOLD }}>Right Move.</span>
              </h1>
              <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-[#3d4451]">
                Personalized real estate solutions with integrity, market expertise, and a commitment to your success.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#properties" className="inline-flex items-center px-6 py-3 text-[13px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                  Explore Properties
                </a>
                <a href="#about" className="inline-flex items-center gap-2 border px-6 py-3 text-[13px] font-bold" style={{ borderColor: NAVY, color: NAVY }}>
                  <Play className="h-3.5 w-3.5" /> Watch Intro
                </a>
              </div>
            </div>

          </div>

        </div>

        {/* Broker card — frosted glass, floating at the hero's lower right */}
        <div className="absolute bottom-14 right-[max(2.5rem,calc((100vw-1400px)/2+2rem))] hidden w-72 lg:block">
          <div
            className="rounded-xl border border-white/15 p-6 shadow-2xl backdrop-blur-md"
            style={{ backgroundColor: "rgba(10,22,40,0.72)" }}
          >
            <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-white">{AGENT.name}</p>
            <p className="mt-1 text-xs text-white/70">International Property Endorser</p>
            <div className="mt-3.5 space-y-2">
              <a
                href={`https://wa.me/${AGENT.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" style={{ color: GOLD }} /> {AGENT.phone}
              </a>
              <a href={`tel:${AGENT.phone}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
                <Phone className="h-3.5 w-3.5" style={{ color: GOLD }} /> {AGENT.phone}
              </a>
              <a href={`mailto:${AGENT.email}`} className="flex items-center gap-2 text-[12px] text-white/85 hover:text-white">
                <Mail className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="truncate">{AGENT.email}</span>
              </a>
            </div>
            <div className="mt-4 h-px w-full bg-white/15" />
            <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
              <Landmark className="h-4 w-4" /> RERA BRN: {AGENT.brn}
            </p>
            <p className="mt-3.5 flex items-center gap-2 text-[11.5px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>
              <Landmark className="h-4 w-4" /> RERA ORN: {AGENT.orn}
            </p>
          </div>
        </div>

        {/* Stat strip — ONE dark-glass band that RESPECTS the page's left
            padding (its left edge lines up with the headline/buttons) and
            bleeds off to the right viewport edge; photo stays visible below. */}
        <div className="relative mx-auto mb-12 max-w-[1400px] px-5 sm:px-8">
          <div
            className="inline-flex max-w-full flex-wrap items-center gap-x-10 gap-y-4 border-y border-white/10 py-4 pl-5 pr-10 backdrop-blur-md"
            style={{ backgroundColor: "rgba(6,12,22,0.3)" }}
          >
            {HERO_STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: GOLD }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: `${GOLD}80`, color: GOLD }}>
                    <Icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                </span>
                <span>
                  <span className="block whitespace-nowrap text-[19px] font-bold leading-tight text-white">{value}</span>
                  <span className="block whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/60">{label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ABOUT ═══════════════════════════════════════════════════════════ */}
      <section id="about" className="bg-white">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[380px_1fr_190px]">
          {/* Portrait */}
          <div className="relative h-[420px] overflow-hidden" style={{ backgroundColor: INK }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/background/sample-portrait.png"
              alt={AGENT.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
            <p className="absolute bottom-5 left-5 text-2xl" style={{ ...script, color: GOLD }}>
              {AGENT.name}
            </p>
          </div>

          {/* Copy + credentials */}
          <div>
            <Eyebrow>About me</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
              Dedicated to Delivering
              <br />
              Exceptional Results
            </h2>
            <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-[#3d4451]">
              With years of experience in Dubai&apos;s dynamic real estate market, I help clients buy, sell, and invest with confidence.
            </p>
            <div className="mt-7 grid max-w-lg grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
              {[
                { icon: Check, label: "RERA Licensed Broker", value: `BRN: ${AGENT.brn}` },
                { icon: Check, label: "Brokerage", value: "Filipino Homes Dubai" },
                { icon: Check, label: "Office Registration", value: "ORN: 98765" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
                  <span>
                    <span className="block text-[12px] font-bold" style={{ color: NAVY }}>{label}</span>
                    <span className="block text-[12px] leading-relaxed text-[#6b7280]">{value}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 max-w-lg border-t border-[#eceadf]" />
            <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-4">
              {[
                { icon: Eye, value: "12.5K", label: "Views" },
                { icon: HomeIcon, value: "24", label: "Listings" },
                { icon: Star, value: "4.9/5", label: "Rating" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#faf5e8", color: GOLD }}>
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-[18px] font-bold leading-tight" style={{ color: NAVY }}>{value}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa0aa]">{label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* QR + socials */}
          <div className="hidden flex-col gap-4 lg:flex">
            <div className="flex flex-col items-center gap-3 border border-[#eceadf] bg-[#fbfaf7] p-5">
              <QRCodeSVG value="https://fhiglobal.ae/website/sample" size={130} fgColor={NAVY} bgColor="transparent" />
              <p className="text-[11px] font-semibold text-[#6b7280]">Scan to Connect</p>
            </div>
            <div className="flex items-center justify-center gap-2.5">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Instagram, label: "Instagram" },
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Youtube, label: "YouTube" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  aria-label={label}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#e3ddcd] bg-white transition-colors hover:bg-[#faf5e8]"
                  style={{ color: NAVY }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURED PROJECTS ═══════════════════════════════════════════════ */}
      <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            Featured Projects
          </h2>
          <span className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold" style={{ color: NAVY }}>
            View All Projects <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
          </span>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECTS.map((p) => (
            <div key={p.title} className="group border border-[#e8e5dc] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(13,27,46,0.3)]">
              <div className="p-3 pb-0">
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: GOLD_SOFT, color: INK }}>
                    Off Plan
                  </span>
                  <span className="absolute right-3 top-3 flex h-9 w-14 items-center justify-center bg-white/95 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.developer.url} alt={p.developer.name} className="max-h-full max-w-full object-contain" />
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="truncate text-[14.5px] font-bold" style={{ color: NAVY }}>{p.title}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                  {p.location}
                </p>
                <p className="mt-2 text-[12px] text-[#5b6472]">{p.units}</p>
                <p className="mt-1 text-[12px] font-semibold text-[#5b6472]">
                  Starting from <span className="font-bold" style={{ color: NAVY }}>{p.from}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex flex-1 cursor-pointer items-center justify-center px-3 py-2 text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                    View Project
                  </span>
                  <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-[#d8d3c6]">
                    <QrCode className="h-4 w-4" style={{ color: NAVY }} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURED PROPERTIES ═════════════════════════════════════════════ */}
      <section id="properties" className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            Featured Properties
          </h2>
          <span className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold" style={{ color: NAVY }}>
            View All Properties <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {["All", "For Sale", "For Rent", "Off Plan", "Commercial"].map((chip, i) => (
            <span
              key={chip}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-bold ${
                i === 0 ? "text-white" : "border border-[#d8d3c6] text-[#5b6472] hover:border-[#9aa0aa]"
              }`}
              style={i === 0 ? { backgroundColor: NAVY } : undefined}
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROPERTIES.map((p) => (
            <div key={p.title} className="group border border-[#e8e5dc] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(13,27,46,0.3)]">
              <div className="p-3 pb-0">
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: GOLD_SOFT, color: INK }}>
                    {p.badge}
                  </span>
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                    <Heart className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="truncate text-[14.5px] font-bold" style={{ color: NAVY }}>{p.title}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                  {p.location}
                </p>
                <div className="mt-3 flex items-center gap-3 border-y border-[#f0ede4] py-2.5 text-[11px] text-[#5b6472]">
                  <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.beds} Bed</span>
                  <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.baths} Bath</span>
                  <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.sqft} Sqft</span>
                </div>
                <p className="mt-3 text-[16px] font-bold" style={{ color: NAVY }}>
                  {p.price} {p.suffix && <span className="text-[11px] font-semibold text-[#9aa0aa]">{p.suffix}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ STATS BAND ══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: INK }}>
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-5 py-9 sm:grid-cols-3 sm:px-8 lg:grid-cols-5">
          {BAND_STATS.map(({ icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <GoldRing icon={icon} dark />
              <span>
                <span className="block text-lg font-bold leading-tight text-white">{value}</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ AREAS — hover-to-expand accordion strip ═════════════════════════ */}
      <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
            Areas I Specialize In
          </h2>
          <span className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-bold" style={{ color: NAVY }}>
            View All Areas <ArrowRight className="h-4 w-4" style={{ color: GOLD }} />
          </span>
        </div>
        <div className="mt-8 flex h-[420px] gap-3">
          {AREAS.map((a) => (
            <div
              key={a.label}
              className="group relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-2xl transition-all duration-500 ease-out hover:flex-[3.5]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image} alt={a.label} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25" />
              <div className="absolute bottom-4 left-5 right-5 text-center">
                <p className="truncate text-[17px] font-semibold text-white">{a.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW I CAN HELP ══════════════════════════════════════════════════ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <h2 className="text-center font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            How I Can Help You
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SERVICES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-[#eceadf] bg-[#fbfaf7] p-5 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center border" style={{ borderColor: GOLD, color: GOLD }}>
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <p className="mt-4 text-[13px] font-bold" style={{ color: NAVY }}>{title}</p>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[#6b7280]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="border border-[#e8e5dc] bg-white p-6">
              <Stars />
              <p className="mt-4 text-[13px] leading-relaxed text-[#3d4451]">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>
                  {t.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-[13px] font-bold" style={{ color: NAVY }}>{t.name}</span>
                  <span className="block text-[11px] text-[#9aa0aa]">{t.where}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CLOSING CTA ═════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.skylineA} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Take the Next Step?
            </h2>
            <p className="mt-3 text-[14px] text-white/70">Let&apos;s find the perfect property for you.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`mailto:${AGENT.email}`} className="inline-flex items-center gap-2 px-6 py-3 text-[13px] font-bold" style={{ backgroundColor: GOLD_SOFT, color: INK }}>
                <CalendarCheck className="h-4 w-4" /> Book a Consultation
              </a>
              <a href={`tel:${AGENT.phone}`} className="inline-flex items-center gap-2 border border-white/30 px-6 py-3 text-[13px] font-bold text-white hover:bg-white/10">
                <Phone className="h-4 w-4" /> Contact Me
              </a>
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="space-y-4">
              {[
                { icon: Phone, label: "Phone", value: AGENT.phone, href: `tel:${AGENT.phone}` },
                { icon: Mail, label: "Email", value: AGENT.email, href: `mailto:${AGENT.email}` },
                { icon: Landmark, label: "Office", value: AGENT.office },
              ].map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#faf5e8", color: GOLD }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#9aa0aa]">{label}</span>
                    {href ? (
                      <a href={href} className="block truncate text-[13px] font-semibold" style={{ color: NAVY }}>
                        {value}
                      </a>
                    ) : (
                      <span className="block truncate text-[13px] font-semibold" style={{ color: NAVY }}>
                        {value}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative border-t border-white/10 py-4 text-center text-[11px] text-white/40">
          © {AGENT.name} · Powered by FHI Global — sample template with placeholder data
        </div>
      </section>
    </div>
  )
}
