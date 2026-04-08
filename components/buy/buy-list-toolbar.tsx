"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { LayoutGrid, Map as MapIcon, ChevronDown, AlignJustify } from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "list" | "map"

export function BuyListToolbar({
  className,
  listingBasePath = "/buy",
}: {
  className?: string
  listingBasePath?: "/buy" | "/rent"
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const sort = searchParams.get("sort") ?? "popular"
  const view = (searchParams.get("view") as ViewMode) || "list"

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const p = new URLSearchParams(searchParams.toString())
      if (value == null || value === "") p.delete(key)
      else p.set(key, value)
      const qs = p.toString()
      const base = listingBasePath
      startTransition(() => router.push(qs ? `${base}?${qs}` : base))
    },
    [router, searchParams, listingBasePath]
  )

  /** Reference: active segment = light yellow fill, not gold gradient. */
  const listMapActive = "bg-[#fff8e1] text-[#0f2940] shadow-sm"
  const listMapInactive = "bg-transparent text-[#6b7280] hover:text-[#0f2940]"

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3 mb-6",
        className
      )}
    >
      <div className="relative shrink-0 w-full sm:w-auto">
        <AlignJustify className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          disabled={pending}
          className="appearance-none w-full sm:w-auto min-w-[11rem] pl-11 pr-10 py-2.5 rounded-full border border-[#d1d5db] text-sm font-semibold text-[#0f2940] bg-white focus:outline-none focus:ring-2 focus:ring-[#d6b357]/30"
        >
          <option value="popular">Popular</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
      </div>

      <div className="inline-flex rounded-full border border-[#d1d5db] bg-white p-1 self-start sm:self-auto shadow-sm">
        <button
          type="button"
          onClick={() => setParam("view", "list")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            view === "list" ? listMapActive : listMapInactive
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          List
        </button>
        <button
          type="button"
          onClick={() => setParam("view", "map")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            view === "map" ? listMapActive : listMapInactive
          }`}
        >
          <MapIcon className="w-4 h-4" />
          Map
        </button>
      </div>
    </div>
  )
}
