"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

export function DeveloperSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQ)

  useEffect(() => {
    setValue(initialQ)
  }, [initialQ])

  // The input stays instant (local state); only the navigation waits for a
  // pause in typing. scroll: false keeps the viewport steady, and replace
  // avoids one history entry per character.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const handleChange = useCallback(
    (val: string) => {
      setValue(val)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (val.trim()) params.set("q", val.trim())
        else params.delete("q")
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      }, 350)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="relative">
      <div className="relative bg-white border border-[#e5e5e5] overflow-hidden transition-all focus-within:border-[#d6b357] focus-within:ring-4 focus-within:ring-[#d6b357]/10">
        <div className="flex items-center gap-3 px-3.5">
          <Search className="w-4 h-4 text-[#9ca3af] shrink-0" />
          <input
            type="text"
            placeholder="Search developers by name…"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 py-2.5 bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
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
