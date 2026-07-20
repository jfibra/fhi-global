"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Search, MapPin, Building2, DollarSign, ChevronDown,
  ShieldCheck, Gem, TrendingUp, Headphones,
} from "lucide-react"

interface HeroSectionProps {
  developers: { id: string; name: string }[]
  cities: string[]
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

// Full-bleed Dubai skyline photo (approved homepage mockup), served locally.
const BG_IMAGE = "/background/home.png"

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: "Trusted Developers",  desc: "Partnered with top UAE developers" },
  { icon: Gem,         title: "Premium Properties",  desc: "Handpicked luxury developments" },
  { icon: TrendingUp,  title: "High ROI Potential",  desc: "Invest in high-growth opportunities" },
  { icon: Headphones,  title: "Expert Support",      desc: "Dedicated support for your investment journey" },
]

export function HeroSection({ developers, cities }: HeroSectionProps) {
  const router = useRouter()
  const [query,      setQuery]      = useState("")
  const [developer,  setDeveloper]  = useState("")
  const [city,       setCity]       = useState("")
  const [priceRange, setPriceRange] = useState("")

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
        <Image
          src={BG_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={80}
          className="object-cover object-center"
        />
        {/* Light navy wash on the left where the copy sits; skyline stays bright */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/70 via-[#001428]/30 to-transparent" />
        {/* Bottom fade so the highlight band and next section blend in */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#000d1c]/70 to-transparent" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10 flex flex-col justify-center min-h-[88vh]">
        {/* ═══ Hero copy + search ═══ */}
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/25 rounded-full text-xs font-medium text-white/90 mb-7 backdrop-blur-sm">
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
          <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-bold leading-[1.08] mb-5 tracking-tight lg:whitespace-nowrap drop-shadow-[0_2px_16px_rgba(0,10,30,0.6)]">
            <span className="text-white">Discover Premium</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#f3dd89] to-[#daa843]">
              Real Estate Investment
            </span>
          </h1>

          <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-9 max-w-xl drop-shadow-[0_1px_10px_rgba(0,10,30,0.7)]">
            Explore luxury developments from the most trusted developers
            in Dubai, handpicked for discerning investors.
          </p>

          {/* ── Search form ── */}
          <form
            onSubmit={handleSearch}
            className="bg-[#06182e]/70 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] w-full"
          >
            {/* 4-column field row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.08] rounded-xl overflow-hidden mb-3">
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
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] text-[#001428] font-bold text-sm tracking-wide transition-all duration-300 hover:shadow-[0_8px_24px_rgba(214,179,87,0.4)] hover:translate-y-[-1px] flex items-center justify-center gap-2"
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 hover:text-white hover:border-white/40 hover:bg-white/20 backdrop-blur-sm transition-all duration-200"
              >
                <MapPin className="w-2.5 h-2.5" /> {area}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Highlight band (mockup's bottom strip) ═══ */}
        <div className="mt-12 lg:mt-14 rounded-2xl bg-[#06182e]/65 backdrop-blur-xl border border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.35)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-white/10">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4 px-6 py-5">
              <span className="w-12 h-12 rounded-full border-2 border-[#d6b357]/70 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#d6b357]" />
              </span>
              <div>
                <p className="text-[15px] font-bold text-white">{title}</p>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
