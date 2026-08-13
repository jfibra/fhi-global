"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"
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
    (key: string, value: string, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page") // reset pagination on filter
      const qs = params.toString()
      // scroll: false — the results refresh in place; without it every filter
      // change yanks the viewport back to the top of the page.
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  // Typing shouldn't navigate on every keystroke — that's a server round trip
  // per character. Wait for a pause, then replace (rather than push) so one
  // search doesn't bury the previous page under a dozen history entries.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onSearchChange = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => updateParams("q", value, "replace"), 350)
    },
    [updateParams],
  )
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const q = searchParams.get("q") ?? ""
  const developer = searchParams.get("developer") ?? ""
  const status = searchParams.get("status") ?? ""
  const city = searchParams.get("city") ?? ""

  // One slim row (no boxed card) — the bar hangs off the masthead so the
  // project grid starts above the fold.
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
      <div className="hidden lg:flex items-center gap-1.5 pr-2 shrink-0 text-[#001f3f]">
        <SlidersHorizontal className="w-4 h-4" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Filter</span>
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
        <input
          type="text"
          placeholder="Search projects..."
          defaultValue={q}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-[#e5e5e5] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all"
        />
      </div>

      {/* Developer */}
      <select
        value={developer}
        onChange={(e) => updateParams("developer", e.target.value)}
        className="w-full lg:w-48 px-3.5 py-2.5 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
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
        className="w-full lg:w-44 px-3.5 py-2.5 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
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
        className="w-full lg:w-40 px-3.5 py-2.5 border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all appearance-none cursor-pointer"
      >
        <option value="">All Cities</option>
        {cities.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
    </div>
  )
}
