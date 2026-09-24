"use client"

import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"

type FilterOption = { value: string; label: string }

/** A shortcut that is only a preset of the filters below, with its live count. */
export type QuickPick = { label: string; count: number; params: Record<string, string> }

type ProjectFiltersProps = {
  developers: FilterOption[]
  cities: FilterOption[]
  /** Results for the current filters, and where the reader is in them. */
  total: number
  page: number
  totalPages: number
  picks: QuickPick[]
}

/**
 * Status in the words a buyer uses. `off_plan` is not a database value: the
 * page maps it to every status except completed.
 */
const STATUS_PILLS: FilterOption[] = [
  { value: "", label: "All" },
  { value: "off_plan", label: "Off-plan" },
  { value: "launch", label: "Launching now" },
  { value: "under_construction", label: "Under construction" },
  { value: "completed", label: "Ready to move in" },
]
const STATUS_LABEL: Record<string, string> = {
  pre_launch: "Pre-launch",
  launch: "Launching now",
  under_construction: "Under construction",
  completed: "Ready to move in",
  off_plan: "Off-plan",
}

const fmtCount = (n: number) => n.toLocaleString("en-US")
const fmtAed = (n: number) => (n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `AED ${Math.round(n / 1000)}K`)

/**
 * The listing's filter bar. Sticks under the slimmed header on wide screens
 * (translucent, blurring the cards passing beneath, a shadow once stuck) so
 * the filters stay in reach across every page. Every change is a URL change,
 * so filtered views remain shareable and crawlable.
 *
 * Rows: search, developer and city, then the status pills; a strip of quick
 * picks with live counts; and, when anything is active, the chips that undo
 * each filter one at a time.
 */
export function ProjectFilters({ developers, cities, total, page, totalPages, picks }: ProjectFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [stuck, setStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: "-73px 0px 0px 0px", threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const updateParams = useCallback(
    (changes: Record<string, string>, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete("page") // reset pagination on filter
      const qs = params.toString()
      // scroll: false — the results refresh in place; without it every filter
      // change yanks the viewport back to the top of the page.
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  // Typing shouldn't navigate on every keystroke — that's a server round trip
  // per character. Wait for a pause, then replace (rather than push) so one
  // search doesn't bury the previous page under a dozen history entries.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onSearchChange = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => updateParams({ q: value }, "replace"), 350)
    },
    [updateParams],
  )
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const q = searchParams.get("q") ?? ""
  const developer = searchParams.get("developer") ?? ""
  const status = searchParams.get("status") ?? ""
  const city = searchParams.get("city") ?? ""
  const featured = searchParams.get("featured") ?? ""
  const priceMax = searchParams.get("price_max") ?? ""
  const priceMin = searchParams.get("price_min") ?? ""

  const chips: { key: string; label: string; clear: Record<string, string> }[] = []
  if (q) chips.push({ key: "q", label: `“${q}”`, clear: { q: "" } })
  if (developer) chips.push({ key: "developer", label: developers.find((d) => d.value === developer)?.label ?? "Developer", clear: { developer: "" } })
  if (status) chips.push({ key: "status", label: STATUS_LABEL[status] ?? status, clear: { status: "" } })
  if (city) chips.push({ key: "city", label: city, clear: { city: "" } })
  if (featured === "true") chips.push({ key: "featured", label: "Featured", clear: { featured: "" } })
  if (priceMax && Number.isFinite(Number(priceMax))) chips.push({ key: "price_max", label: `Under ${fmtAed(Number(priceMax))}`, clear: { price_max: "" } })
  if (priceMin && Number.isFinite(Number(priceMin))) chips.push({ key: "price_min", label: `From ${fmtAed(Number(priceMin))}`, clear: { price_min: "" } })

  const isPickActive = (p: QuickPick) => Object.entries(p.params).every(([k, v]) => (searchParams.get(k) ?? "") === v)
  const pickHref = (p: QuickPick) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(p.params)) params.set(k, v)
    return `${pathname}?${params.toString()}`
  }

  const field =
    "w-full border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] focus:ring-4 focus:ring-[#d6b357]/10 transition-all"

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
      <div className="pl-bar lg:sticky lg:top-[72px] z-[40] border-b border-[#e8eaed] bg-white/85 backdrop-blur-xl" data-stuck={stuck ? "true" : "false"}>
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          {/* Row 1: search, developer, city, count */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="hidden shrink-0 items-center gap-1.5 pr-2 text-[#001f3f] lg:flex">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Filter</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Search projects by name"
                defaultValue={q}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search projects"
                className={`${field} py-2.5 pl-9 pr-4`}
              />
            </div>
            <select value={developer} onChange={(e) => updateParams({ developer: e.target.value })} aria-label="Developer" className={`${field} cursor-pointer appearance-none px-3.5 py-2.5 lg:w-52`}>
              <option value="">All developers</option>
              {developers.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <select value={city} onChange={(e) => updateParams({ city: e.target.value })} aria-label="City" className={`${field} cursor-pointer appearance-none px-3.5 py-2.5 lg:w-44`}>
              <option value="">All cities</option>
              {cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <p className="shrink-0 text-[13px] text-[#6b7280] lg:pl-3" aria-live="polite">
              <span className="font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{fmtCount(total)}</span> {total === 1 ? "project" : "projects"}
              {totalPages > 1 && <span className="text-[#9ca3af]"> · page {page} of {totalPages}</span>}
            </p>
          </div>

          {/* Row 2: status pills, then quick picks on the right */}
          <div className="mt-2.5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
              {STATUS_PILLS.map((s) => {
                const on = status === s.value
                return (
                  <button
                    key={s.value || "all"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => updateParams({ status: s.value })}
                    className={`pl-pill ${on ? "pl-pill--on" : ""}`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
            {picks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af] sm:inline">Quick picks</span>
                {picks.map((p) => {
                  const on = isPickActive(p)
                  return (
                    <Link key={p.label} href={pickHref(p)} scroll={false} className={`pl-pick ${on ? "pl-pick--on" : ""}`}>
                      {p.label}
                      <span className="pl-pick-count">{fmtCount(p.count)}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Row 3: active filters as removable chips */}
          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#eef0f3] pt-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">Showing</span>
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => updateParams(c.clear)}
                  className="pl-chip group"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <X className="h-3 w-3 text-[#b8913f] transition-transform group-hover:rotate-90" />
                </button>
              ))}
              <Link href={pathname} scroll={false} className="ml-1 text-[12px] font-bold text-[#0d1117] underline-offset-4 hover:text-[#b8913f] hover:underline">
                Clear all
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
