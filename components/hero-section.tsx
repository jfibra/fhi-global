"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, Building2, DollarSign, ChevronDown } from "lucide-react"

interface HeroSectionProps {
  developers: { id: string; name: string }[]
  cities: string[]
}

const PRICE_RANGES = [
  { label: "Any Price",         value: "" },
  { label: "Under AED 500K",    value: "0-500000" },
  { label: "AED 500K – 1M",     value: "500000-1000000" },
  { label: "AED 1M – 2M",       value: "1000000-2000000" },
  { label: "AED 2M – 5M",       value: "2000000-5000000" },
  { label: "AED 5M – 10M",      value: "5000000-10000000" },
  { label: "Above AED 10M",     value: "10000000-" },
]

export function HeroSection({ developers, cities }: HeroSectionProps) {
  const router = useRouter()
  const [query,       setQuery]       = useState("")
  const [developer,   setDeveloper]   = useState("")
  const [city,        setCity]        = useState("")
  const [priceRange,  setPriceRange]  = useState("")

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
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="/hero.jpg"
          alt="Dubai skyline"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#001428]/82 via-[#001f3f]/78 to-[#001428]/92" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
      </div>

      {/* Ambient glow blobs */}
      <div className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] rounded-full opacity-20 blur-[130px] bg-[radial-gradient(circle,#d6b357,transparent)] pointer-events-none" />
      <div className="absolute bottom-0 right-[-80px] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] bg-[radial-gradient(circle,#60a5fa,transparent)] pointer-events-none" />

      {/* Gold top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/50 to-transparent" />

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-7 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
          Dubai&apos;s Premier Real Estate Portal
        </div>

        {/* Headline */}
        <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] mb-5 max-w-4xl">
          Discover Premium<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
            Real Estate Investments
          </span>
        </h1>

        <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
          Explore luxury developments from the most trusted developers in Dubai — handpicked for discerning investors.
        </p>

        {/* Glass Search Box */}
        <form
          onSubmit={handleSearch}
          className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[28px] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-5xl"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
            {/* Project Name */}
            <div className="relative bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl px-4 py-3 transition-colors group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#d6b357] mb-1 flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Project Name
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>

            {/* Developer */}
            <div className="relative bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl px-4 py-3 transition-colors">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#d6b357] mb-1 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Developer
              </label>
              <div className="relative">
                <select
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                  className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                >
                  <option value="" className="bg-[#001f3f] text-white">Any Developer</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#001f3f] text-white">{d.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* City */}
            <div className="relative bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl px-4 py-3 transition-colors">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#d6b357] mb-1 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> City / Community
              </label>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                >
                  <option value="" className="bg-[#001f3f] text-white">Any Location</option>
                  {cities.map((c) => (
                    <option key={c} value={c} className="bg-[#001f3f] text-white">{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Price Range */}
            <div className="relative bg-white/8 hover:bg-white/12 border border-white/10 rounded-2xl px-4 py-3 transition-colors">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#d6b357] mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" /> Price Range
              </label>
              <div className="relative">
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full bg-transparent text-sm text-white appearance-none focus:outline-none cursor-pointer pr-4"
                >
                  {PRICE_RANGES.map(({ label, value }) => (
                    <option key={label} value={value} className="bg-[#001f3f] text-white">{label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] text-[#001f3f] font-bold text-sm transition-all duration-300 hover:shadow-[0_8px_24px_rgba(214,179,87,0.35)] hover:translate-y-[-1px] flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" /> Search Properties
          </button>
        </form>

        {/* Quick community pills */}
        <div className="flex flex-wrap gap-2 mt-6">
          <span className="text-white/35 text-xs font-medium pt-0.5">Popular:</span>
          {["Downtown Dubai", "Dubai Marina", "Palm Jumeirah", "Business Bay", "JVC", "Jumeirah"].map((area) => (
            <button
              key={area}
              onClick={() => { setCity(area); void handleSearch }}
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/8 border border-white/15 text-xs text-white/65 hover:text-white hover:border-white/30 hover:bg-white/15 transition-all duration-200"
            >
              <MapPin className="w-2.5 h-2.5" /> {area}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
