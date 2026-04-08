"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { LayoutGrid, Map as MapIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "list" | "map"

export function DevelopersListToolbar({ className }: { className?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const view = (searchParams.get("view") as ViewMode) || "list"

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const p = new URLSearchParams(searchParams.toString())
      if (value == null || value === "") p.delete(key)
      else p.set(key, value)
      const qs = p.toString()
      startTransition(() => router.push(qs ? `/developers?${qs}` : "/developers"))
    },
    [router, searchParams],
  )

  const listMapActive = "bg-[#fff8e1] text-[#0f2940] shadow-sm"
  const listMapInactive = "bg-transparent text-[#6b7280] hover:text-[#0f2940]"

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3", className)}>
      <div className="inline-flex rounded-full border border-[#d1d5db] bg-white p-1 self-start sm:self-auto shadow-sm">
        <button
          type="button"
          onClick={() => setParam("view", "list")}
          disabled={pending}
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
          disabled={pending}
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
