"use client"

import { useRouter, usePathname } from "next/navigation"
import { useCallback, useState } from "react"
import { Search, X } from "lucide-react"

export function DeveloperSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(initialQ)

  const handleChange = useCallback(
    (val: string) => {
      setValue(val)
      const params = new URLSearchParams()
      if (val.trim()) params.set("q", val.trim())
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname]
  )

  return (
    <div className="relative">
      <div className="relative bg-white border border-[#e2e5ea] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden transition-shadow duration-200 focus-within:shadow-[0_4px_20px_rgba(0,31,63,0.12)] focus-within:border-[#001f3f]/30">
        {/* top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#001f3f] via-[#d6b357] to-transparent" />
        <div className="flex items-center gap-3 px-5">
          <Search className="w-4 h-4 text-[#d6b357] shrink-0" />
          <input
            type="text"
            placeholder="Search developers by name…"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 py-4 bg-transparent text-sm text-[#111827] placeholder:text-[#b0b7c3] focus:outline-none"
          />
          {value && (
            <button
              onClick={() => handleChange("")}
              className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f0f2f5] hover:bg-[#e2e5ea] transition-colors text-[#6b7280]"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
