"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, MapPin, Building2, DollarSign, ChevronDown } from "lucide-react"

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

const BG_IMAGE   = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/bg%20background.png"
const FLOAT_IMG  = "https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/fhi_global/floating%20dubai.png"

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
    <section className="relative min-h-[88vh] flex items-center overflow-hidden">
      {/* ── Background ── */}
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
      </div>

      {/* ── CSS keyframe for floating image ── */}
      <style>{`
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-14px) rotate(0.4deg); }
          66%       { transform: translateY(-7px) rotate(-0.3deg); }
        }
        .hero-float { animation: hero-float 6s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full max-w-7xl mx-auto px-1 sm:px-5 lg:px-0 py-20 lg:py-0 lg:min-h-[88vh] flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-10 lg:gap-8 items-center w-full">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex flex-col w-full">
            {/* Badge */}
            <div className="inline-flex self-start items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/85 mb-7 backdrop-blur-sm">
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
            <h1 className="font-['Outfit'] text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-bold leading-[1.08] mb-5 tracking-tight whitespace-nowrap">
              <span className="text-white">Discover Premium</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#f3dd89] to-[#daa843]">
                Real Estate Investment
              </span>
            </h1>

            <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-9 max-w-xl">
              Explore luxury developments from the most trusted developers
              in Dubai, handpicked for discerning investors.
            </p>

            {/* ── Search form ── */}
            <form
              onSubmit={handleSearch}
              className="bg-[#3a5571]/70 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] w-full"
            >
              {/* 4-column field row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.08] rounded-xl overflow-hidden mb-3">
                {/* Project Name */}
                <div className="bg-[#4a6179]/80 border border-white/15  px-4 py-3 hover:bg-white/5 transition-colors">
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
                <div className="bg-[#4a6179]/80 border border-white/15  px-4 py-3 hover:bg-white/5 transition-colors">
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
                <div className="bg-[#4a6179]/80 border border-white/15  px-4 py-3 hover:bg-white/5 transition-colors">
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
                <div className="bg-[#4a6179]/80 border border-white/15  px-4 py-3 hover:bg-white/5 transition-colors">
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
              <span className="text-white/35 text-xs font-medium pt-0.5">Popular:</span>
              {["Downtown Dubai", "Dubai Marina", "Palm Jumeirah", "Business Bay", "JVC"].map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setCity(area)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 border border-white/15 text-xs text-white/65 hover:text-white hover:border-white/30 hover:bg-white/15 transition-all duration-200"
                >
                  <MapPin className="w-2.5 h-2.5" /> {area}
                </button>
              ))}
            </div>
          </div>

          {/* ═══ RIGHT COLUMN — floating Dubai image ═══ */}
          <div className="hidden lg:flex items-center justify-center lg:justify-end relative">
            {/* Soft ambient glow behind the image */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[0px] h-[480px] rounded-full bg-[#d6b357]/10 blur-[90px]" />
            </div>
            <Image
              src={FLOAT_IMG}
              alt="Dubai skyline"
              width={560}
              height={420}
              sizes="(max-width: 1280px) 280px, 500px"
              className="hero-float relative w-full max-w-[280px] xl:max-w-[500px] h-auto drop-shadow-[0_40px_80px_rgba(0,0,0,0.5)] select-none"
              draggable={false}
            />
          </div>

        </div>
      </div>
    </section>
  )
}

