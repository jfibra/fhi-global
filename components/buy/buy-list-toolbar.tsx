"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { LayoutGrid, Map as MapIcon, AlignJustify } from "lucide-react"
import { cn } from "@/lib/utils"
import { PillSelect } from "@/components/ui/pill-select"

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
      // scroll: false — sorting or switching view refreshes the results in
      // place; jumping to the top loses the reader's position.
      startTransition(() => router.push(qs ? `${base}?${qs}` : base, { scroll: false }))
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
      <div className="shrink-0 w-full sm:w-auto">
        <PillSelect
          value={sort}
          onValueChange={(v) => setParam("sort", v)}
          disabled={pending}
          ariaLabel="Sort listings"
          leftIcon={<AlignJustify className="w-4 h-4 text-[#6b7280]" />}
          className="sm:w-auto min-w-[11rem] font-semibold"
          options={[
            { label: "Popular", value: "popular" },
            { label: "Newest", value: "newest" },
            { label: "Price: Low to High", value: "price_asc" },
            { label: "Price: High to Low", value: "price_desc" },
          ]}
        />
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
