"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { MapPin, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react"
import type { BuyPropertyTypeOption } from "@/lib/buy/property-types"
import { cn } from "@/lib/utils"
import { PillSelect } from "@/components/ui/pill-select"

const TEXT_DEBOUNCE_MS = 450

function listingBasePath(pathname: string): "/buy" | "/rent" {
  return pathname === "/rent" ? "/rent" : "/buy"
}

function savedSearchStorageKey(pathname: string): string {
  return listingBasePath(pathname) === "/rent" ? "fhi-rent-saved-search" : "fhi-buy-saved-search"
}

const BEDS_OPTS = [
  { label: "Beds & Baths", value: "" },
  { label: "1+ Beds", value: "1" },
  { label: "2+ Beds", value: "2" },
  { label: "3+ Beds", value: "3" },
  { label: "4+ Beds", value: "4" },
]

const BATH_OPTS = [
  { label: "Min baths", value: "" },
  { label: "1+ Baths", value: "1" },
  { label: "2+ Baths", value: "2" },
  { label: "3+ Baths", value: "3" },
  { label: "4+ Baths", value: "4" },
]

const FALLBACK_PROPERTY_TYPES: BuyPropertyTypeOption[] = [
  { id: -1, name: "Apartment" },
  { id: -2, name: "Villa" },
  { id: -3, name: "Townhouse" },
  { id: -4, name: "Penthouse" },
]

const FILTER_KEYS = ["q", "type", "beds", "minPrice", "maxPrice", "minBaths"] as const

type FilterSnapshot = {
  location: string
  ptype: string
  beds: string
  minPrice: string
  maxPrice: string
  minBaths: string
}

const pillInput =
  "w-full pl-10 pr-4 py-2.5 rounded-full border border-[#d1d5db] text-sm text-[#0f2940] placeholder:text-[#9ca3af] bg-white focus:outline-none focus:ring-2 focus:ring-[#d6b357]/30 focus:border-[#d6b357]"
const linkNavy = "text-sm font-medium text-[#0f2940] hover:text-[#d6b357] hover:underline transition-colors"

export function BuyFiltersBar({ propertyTypes }: { propertyTypes: BuyPropertyTypeOption[] }) {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const rentActive = pathname === "/rent"
  const buyActive = !rentActive
  const listBase = listingBasePath(pathname)
  const savedSearchKey = savedSearchStorageKey(pathname)
  const [moreOpen, setMoreOpen] = useState(false)

  const [location, setLocation] = useState("")
  const [ptype, setPtype] = useState("")
  const [beds, setBeds] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [minBaths, setMinBaths] = useState("")

  const types = propertyTypes.length > 0 ? propertyTypes : FALLBACK_PROPERTY_TYPES

  const stateRef = useRef<FilterSnapshot>({
    location: "",
    ptype: "",
    beds: "",
    minPrice: "",
    maxPrice: "",
    minBaths: "",
  })
  stateRef.current = { location, ptype, beds, minPrice, maxPrice, minBaths }

  useEffect(() => {
    setLocation(searchParams.get("q") ?? "")
    setPtype(searchParams.get("type") ?? "")
    setBeds(searchParams.get("beds") ?? "")
    setMinPrice(searchParams.get("minPrice") ?? "")
    setMaxPrice(searchParams.get("maxPrice") ?? "")
    setMinBaths(searchParams.get("minBaths") ?? "")
    const hasMore =
      Boolean(searchParams.get("minPrice")) ||
      Boolean(searchParams.get("maxPrice")) ||
      Boolean(searchParams.get("minBaths"))
    if (hasMore) setMoreOpen(true)
  }, [searchParams])

  const applyParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString())
      mutate(p)
      const qs = p.toString()
      const base = listBase
      startTransition(() => router.push(qs ? `${base}?${qs}` : base))
    },
    [router, searchParams, listBase]
  )

  const pushSnapshot = useCallback(
    (s: FilterSnapshot) => {
      applyParams((p) => {
        FILTER_KEYS.forEach((k) => p.delete(k))
        if (s.location.trim()) p.set("q", s.location.trim())
        if (s.ptype) p.set("type", s.ptype)
        if (s.beds) p.set("beds", s.beds)
        if (s.minPrice.trim()) p.set("minPrice", s.minPrice.trim())
        if (s.maxPrice.trim()) p.set("maxPrice", s.maxPrice.trim())
        if (s.minBaths) p.set("minBaths", s.minBaths)
      })
    },
    [applyParams]
  )

  /** Debounced: location + price fields (typing). */
  useEffect(() => {
    const t = setTimeout(() => {
      const s = stateRef.current
      const urlQ = (searchParams.get("q") ?? "").trim()
      const urlMin = (searchParams.get("minPrice") ?? "").trim()
      const urlMax = (searchParams.get("maxPrice") ?? "").trim()
      if (
        s.location.trim() === urlQ &&
        s.minPrice.trim() === urlMin &&
        s.maxPrice.trim() === urlMax
      ) {
        return
      }
      pushSnapshot(s)
    }, TEXT_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [location, minPrice, maxPrice, searchParams, pushSnapshot])

  const pushWith = useCallback(
    (patch: Partial<FilterSnapshot>) => {
      pushSnapshot({ ...stateRef.current, ...patch })
    },
    [pushSnapshot]
  )

  const clearFilters = useCallback(() => {
    setLocation("")
    setPtype("")
    setBeds("")
    setMinPrice("")
    setMaxPrice("")
    setMinBaths("")
    applyParams((p) => {
      FILTER_KEYS.forEach((k) => p.delete(k))
    })
  }, [applyParams])

  function saveSearch() {
    if (typeof window === "undefined") return
    const qs = window.location.search
    try {
      localStorage.setItem(savedSearchKey, qs)
      setCanRestore(true)
    } catch {
      /* ignore */
    }
  }

  function restoreSavedSearch() {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(savedSearchKey)
      if (raw == null) return
      const base = listBase
      startTransition(() => router.push(`${base}${raw.startsWith("?") ? raw : `?${raw}`}`))
    } catch {
      /* ignore */
    }
  }

  const [canRestore, setCanRestore] = useState(false)
  useEffect(() => {
    try {
      setCanRestore(Boolean(localStorage.getItem(savedSearchKey)))
    } catch {
      setCanRestore(false)
    }
  }, [searchParams, savedSearchKey])

  const hasActiveFilters = FILTER_KEYS.some((k) => Boolean(searchParams.get(k)))

  return (
    <div className="flow-root w-full bg-gradient-to-b from-[#001f3f] to-[#002a52] border-b border-[#d6b357]/25 px-4 sm:px-6 lg:px-8 py-5">
      <div className="max-w-[1920px] mx-auto min-w-0 rounded-2xl bg-white shadow-[0_14px_40px_-12px_rgba(0,10,30,0.5)] px-4 sm:px-6 py-4">
        {canRestore && (
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-[#f3f4f6]">
            <button
              type="button"
              onClick={restoreSavedSearch}
              className="text-xs font-semibold text-[#0c6d8c] border border-[#e5e7eb] px-3 py-1.5 rounded-full bg-white hover:bg-[#f9fafb]"
            >
              Restore saved search
            </button>
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-6">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-nowrap xl:items-center">
              <div className="relative flex-1 min-w-0 xl:min-w-[240px] xl:max-w-xl">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d6b357]" />
                <input
                  name="q"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => pushSnapshot(stateRef.current)}
                  placeholder="Enter Location"
                  className={pillInput}
                  autoComplete="off"
                />
              </div>
              <div
                className="inline-flex w-full shrink-0 rounded-full border border-[#d1d5db] bg-white p-1 shadow-sm sm:w-auto"
                role="group"
                aria-label="Buy or Rent"
              >
                <Link
                  href="/buy"
                  className={cn(
                    "flex-1 rounded-full px-5 py-2 text-center text-sm font-bold transition-colors sm:flex-none",
                    buyActive ? "bg-[#0f2940] text-white shadow-sm" : "text-[#6b7280] hover:text-[#0f2940]",
                  )}
                >
                  Buy
                </Link>
                <Link
                  href="/rent"
                  className={cn(
                    "flex-1 rounded-full px-5 py-2 text-center text-sm font-bold transition-colors sm:flex-none",
                    rentActive ? "bg-[#0f2940] text-white shadow-sm" : "text-[#6b7280] hover:text-[#0f2940]",
                  )}
                >
                  Rent
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:flex xl:flex-nowrap xl:shrink-0 xl:flex-1 xl:min-w-0">
                <div className="w-full xl:w-[10rem]">
                  <PillSelect
                    value={ptype}
                    onValueChange={(v) => {
                      setPtype(v)
                      pushWith({ ptype: v })
                    }}
                    disabled={pending}
                    ariaLabel="Property type"
                    options={[
                      { label: "Residential", value: "" },
                      ...types.map((t) => ({ label: t.name, value: t.name.toLowerCase() })),
                    ]}
                  />
                </div>
                <div className="w-full xl:w-[11rem]">
                  <PillSelect
                    value={beds}
                    onValueChange={(v) => {
                      setBeds(v)
                      pushWith({ beds: v })
                    }}
                    disabled={pending}
                    ariaLabel="Bedrooms"
                    options={BEDS_OPTS}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={`inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-medium transition-colors sm:col-span-2 xl:w-auto ${
                    moreOpen
                      ? "border-[#d6b357] bg-[#fffdf8] text-[#0f2940]"
                      : "border-[#d1d5db] bg-white text-[#0f2940] hover:bg-[#f9fafb]"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#d6b357]" />
                  More Filter
                  {moreOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#6b7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6b7280]" />
                  )}
                </button>
              </div>
            </div>

            {moreOpen && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Min price (AED)"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  onBlur={() => pushSnapshot(stateRef.current)}
                  className="w-full sm:w-[150px] px-4 py-2.5 rounded-full border border-[#d1d5db] text-sm text-[#0f2940] bg-white focus:outline-none focus:ring-2 focus:ring-[#d6b357]/30"
                />
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Max price (AED)"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  onBlur={() => pushSnapshot(stateRef.current)}
                  className="w-full sm:w-[150px] px-4 py-2.5 rounded-full border border-[#d1d5db] text-sm text-[#0f2940] bg-white focus:outline-none focus:ring-2 focus:ring-[#d6b357]/30"
                />
                <div className="shrink-0">
                  <PillSelect
                    value={minBaths}
                    onValueChange={(v) => {
                      setMinBaths(v)
                      pushWith({ minBaths: v })
                    }}
                    disabled={pending}
                    ariaLabel="Minimum bathrooms"
                    options={BATH_OPTS}
                    className="sm:w-[150px]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end lg:min-w-[9rem] lg:justify-center">
            <button
              type="button"
              onClick={clearFilters}
              className={`${linkNavy} text-left sm:text-right py-0.5 disabled:opacity-40 disabled:no-underline`}
              disabled={pending || !hasActiveFilters}
            >
              Clear Filters
            </button>
            <button type="button" onClick={saveSearch} className={`${linkNavy} text-left sm:text-right py-0.5`}>
              Save Search
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
