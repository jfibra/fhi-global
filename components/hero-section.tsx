"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Search, MapPin, Building2, DollarSign, ChevronDown,
  ShieldCheck, Gem, TrendingUp, Headphones, ArrowRight,
} from "lucide-react"

export interface HeroSpotlight {
  name: string
  slug: string | null
  image: string
  location: string | null
  priceLabel: string | null
  statusLabel: string | null
}

interface HeroSectionProps {
  developers: { id: string; name: string }[]
  cities: string[]
  /** Featured projects for the rotating spotlight card (xl screens). */
  spotlight?: HeroSpotlight[]
}

const PRICE_RANGES = [
  { label: "Any Price",      value: "" },
  { label: "Under AED 500K", value: "0-500000" },
  { label: "AED 500K – 1M",  value: "500000-1000000" },
  { label: "AED 1M – 2M",    value: "1000000-2000000" },
  { label: "AED 2M – 5M",    value: "2000000-5000000" },
  { label: "AED 5M – 10M",   value: "5000000-10000000" },
  { label: "Above AED 10M",  value: "10000000-" },
]

// The hero rotates through these on a slow crossfade — one frozen photo was
// the single biggest reason the section read as static. All served locally.
const HERO_SLIDES = [
  "/background/home.webp",
  "/background/developers.webp",
  "/background/featured-marina.jpg",
  "/background/dubai.webp",
]
const SLIDE_MS = 7000

// The last headline word cycles — motion at the exact spot every visitor reads.
const ROTATING_WORDS = ["Investment", "Opportunities", "Living"]
const WORD_MS = 3600

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: "Trusted Developers",  desc: "Partnered with top UAE developers" },
  { icon: Gem,         title: "Premium Properties",  desc: "Handpicked luxury developments" },
  { icon: TrendingUp,  title: "High ROI Potential",  desc: "Invest in high-growth opportunities" },
  { icon: Headphones,  title: "Expert Support",      desc: "Dedicated support for your investment journey" },
]

export function HeroSection({ developers, cities, spotlight = [] }: HeroSectionProps) {
  const router = useRouter()
  const [query,      setQuery]      = useState("")
  const [developer,  setDeveloper]  = useState("")
  const [city,       setCity]       = useState("")
  const [priceRange, setPriceRange] = useState("")

  // Rotation state for the background, the headline word and the spotlight
  // card. One interval each, all skipped for reduced-motion users.
  const [slide, setSlide] = useState(0)
  const [word, setWord] = useState(0)
  const [spot, setSpot] = useState(0)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const slides = setInterval(() => setSlide((i) => (i + 1) % HERO_SLIDES.length), SLIDE_MS)
    const words = setInterval(() => setWord((i) => (i + 1) % ROTATING_WORDS.length), WORD_MS)
    const spots = spotlight.length > 1
      ? setInterval(() => setSpot((i) => (i + 1) % spotlight.length), 6000)
      : undefined
    return () => {
      clearInterval(slides)
      clearInterval(words)
      clearInterval(spots)
    }
  }, [spotlight.length])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query)      params.set("q",         query)
    if (developer)  params.set("developer", developer)
    if (city)       params.set("city",      city)
    if (priceRange) {
      const [min, max] = priceRange.split("-")
      if (min) params.set("price_min", min)
      if (max) params.set("price_max", max)
    }
    router.push(`/projects?${params.toString()}`)
  }

  return (
    <section className="relative min-h-[88vh] flex overflow-hidden">
      {/* ── Background photo + legibility washes ── */}
      <div className="absolute inset-0">
        {HERO_SLIDES.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            quality={80}
            className={`object-cover object-center animate-kenburns transition-opacity duration-[1800ms] ease-linear ${
              i === slide ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* Light navy wash on the left where the copy sits; skyline stays bright */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/70 via-[#001428]/30 to-transparent" />
        {/* Bottom fade so the highlight band and next section blend in */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#000d1c]/70 to-transparent" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 flex flex-col justify-center min-h-[88vh]">
        {/* ═══ Hero copy + search ═══ */}
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="animate-hero-item inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/25 text-xs font-medium text-white/90 mb-7 backdrop-blur-sm" style={{ animationDelay: "0.05s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://flagcdn.com/w20/ae.png"
              alt="UAE"
              width={18}
              height={13}
              className="rounded-sm object-cover shrink-0"
            />
            Dubai&apos;s Premier Real Estate Portal
          </div>

          {/* Headline */}
          <h1 className="animate-hero-item font-['Outfit'] text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-bold leading-[1.08] mb-5 tracking-tight lg:whitespace-nowrap drop-shadow-[0_2px_16px_rgba(0,10,30,0.6)]" style={{ animationDelay: "0.18s" }}>
            <span className="text-white">Discover Premium</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#f3dd89] to-[#daa843]">
              Real Estate{" "}
              <span key={ROTATING_WORDS[word]} className="animate-hero-item inline-block">
                {ROTATING_WORDS[word]}
              </span>
            </span>
          </h1>

          <p className="animate-hero-item text-white/85 text-base sm:text-lg leading-relaxed mb-9 max-w-xl drop-shadow-[0_1px_10px_rgba(0,10,30,0.7)]" style={{ animationDelay: "0.32s" }}>
            Explore luxury developments from the most trusted developers
            in Dubai, handpicked for discerning investors.
          </p>

          {/* ── Search form ── */}
          <form
            onSubmit={handleSearch}
            className="animate-hero-item bg-[#06182e]/70 backdrop-blur-2xl border border-white/15 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] w-full"
            style={{ animationDelay: "0.46s" }}
          >
            {/* 4-column field row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.08] overflow-hidden mb-3">
              {/* Project Name */}
              <div className="bg-[#0d2440]/85 border border-white/10 px-4 py-3 hover:bg-white/5 transition-colors">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d6b357] mb-1.5">
                  <Search className="w-3 h-3 shrink-0" /> Project Name
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Projects..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                />
              </div>

              {/* Developer */}
              <div className="bg-[#0d2440]/85 border border-white/10 px-4 py-3 hover:bg-white/5 transition-colors">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d6b357] mb-1.5">
                  <Building2 className="w-3 h-3 shrink-0" /> Developer
                </label>
                <div className="relative">
                  <select
                    value={developer}
                    onChange={(e) => setDeveloper(e.target.value)}
                    className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                  >
                    <option value="" className="bg-[#001428] text-white">Residential</option>
                    {developers.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#001428] text-white">{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                </div>
              </div>

              {/* City / Community */}
              <div className="bg-[#0d2440]/85 border border-white/10 px-4 py-3 hover:bg-white/5 transition-colors">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d6b357] mb-1.5">
                  <MapPin className="w-3 h-3 shrink-0" /> City/ Community
                </label>
                <div className="relative">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                  >
                    <option value="" className="bg-[#001428] text-white">Any Location</option>
                    {cities.map((c) => (
                      <option key={c} value={c} className="bg-[#001428] text-white">{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                </div>
              </div>

              {/* Price Range */}
              <div className="bg-[#0d2440]/85 border border-white/10 px-4 py-3 hover:bg-white/5 transition-colors">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d6b357] mb-1.5">
                  <DollarSign className="w-3 h-3 shrink-0" /> Price Range
                </label>
                <div className="relative">
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                  >
                    {PRICE_RANGES.map(({ label, value }) => (
                      <option key={value} value={value} className="bg-[#001428] text-white">{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[#d6b357] hover:bg-[#c8a544] text-[#001428] font-bold text-sm tracking-wide transition-colors duration-300 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" /> Search Properties
            </button>
          </form>

          {/* Popular pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            <span className="text-white/60 text-xs font-medium pt-0.5">Popular:</span>
            {["Downtown Dubai", "Dubai Marina", "Palm Jumeirah", "Business Bay", "JVC"].map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setCity(area)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-xs text-white/80 hover:text-white hover:border-white/40 hover:bg-white/20 backdrop-blur-sm transition-all duration-200"
              >
                <MapPin className="w-2.5 h-2.5" /> {area}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Highlight band (mockup's bottom strip) ═══ */}
        <div
          className="animate-hero-item mt-12 lg:mt-14 bg-[#06182e]/65 backdrop-blur-xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.35)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-white/10"
          style={{ animationDelay: "0.62s" }}
        >
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4 px-6 py-5">
              <span className="w-12 h-12 border-2 border-[#d6b357]/70 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#d6b357]" />
              </span>
              <div>
                <p className="text-[15px] font-bold text-white">{title}</p>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* ═══ Rotating featured-project spotlight (wide screens) ═══ */}
        {spotlight.length > 0 && spotlight[spot] && (
          <Link
            key={spotlight[spot].slug ?? spot}
            href={spotlight[spot].slug ? `/projects/${spotlight[spot].slug}` : "/projects"}
            className="animate-hero-item hidden xl:block absolute right-8 top-24 w-[300px] bg-[#06182e]/75 backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.45)] hover:border-[#d6b357]/70 transition-colors group"
          >
            <div className="relative h-40 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={spotlight[spot].image}
                alt={spotlight[spot].name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
              />
              {spotlight[spot].statusLabel && (
                <span className="absolute top-0 left-0 bg-[#0a2647] text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1.5">
                  {spotlight[spot].statusLabel}
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1.5">
                Featured Project
              </p>
              <p className="font-['Outfit'] text-base font-bold text-white leading-snug line-clamp-1">
                {spotlight[spot].name}
              </p>
              {spotlight[spot].location && (
                <p className="text-xs text-white/60 mt-1 inline-flex items-center gap-1.5 max-w-full">
                  <MapPin className="w-3 h-3 text-[#d6b357] shrink-0" />
                  <span className="truncate">{spotlight[spot].location}</span>
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#d6b357]">
                  {spotlight[spot].priceLabel ?? "Price on request"}
                </span>
                <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-[#d6b357] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>
        )}

        {/* Scroll cue */}
        <span
          className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 text-white/45 animate-bounce"
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5" />
        </span>
      </div>
    </section>
  )
}
