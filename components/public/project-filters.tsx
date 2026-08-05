"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Search, SlidersHorizontal } from "lucide-react"

type FilterOption = { value: string; label: string }

type ProjectFiltersProps = {
  developers: FilterOption[]
  statuses: FilterOption[]
  cities: FilterOption[]
}

const STATUS_OPTIONS: FilterOption[] = [
  { value: "pre_launch", label: "Pre-Launch" },
  { value: "launch", label: "Launching" },
  { value: "under_construction", label: "Under Construction" },
  { value: "completed", label: "Completed" },
]

export function ProjectFilters({ developers, cities }: Omit<ProjectFiltersProps, "statuses">) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page") // reset pagination on filter
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const q = searchParams.get("q") ?? ""
  const developer = searchParams.get("developer") ?? ""
  const status = searchParams.get("status") ?? ""
  const city = searchParams.get("city") ?? ""

  return (
    <div className="relative bg-white border border-[#e5e8ec] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 bg-[#f0f2f5] flex items-center justify-center">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#001f3f]" />
        </div>
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#0d1117]">Filter Projects</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <input
            type="text"
            placeholder="Search projects..."
            defaultValue={q}
            onChange={(e) => updateParams("q", e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-[#e5e5e5] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all"
          />
        </div>

        {/* Developer */}
        <select
          value={developer}
          onChange={(e) => updateParams("developer", e.target.value)}
          className="w-full px-4 py-3 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
        >
          <option value="">All Developers</option>
          {developers.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => updateParams("status", e.target.value)}
          className="w-full px-4 py-3 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* City */}
        <select
          value={city}
          onChange={(e) => updateParams("city", e.target.value)}
          className="w-full px-4 py-3 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
