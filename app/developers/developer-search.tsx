"use client"

import { useRouter, usePathname } from "next/navigation"
import { useCallback, useState } from "react"
import { Search } from "lucide-react"

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
    <div className="relative mb-8">
      <div className="relative bg-white border border-[#e8eaed] rounded-[20px] shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#001f3f] via-[#d6b357] to-transparent" />
        <div className="flex items-center gap-3 px-5 py-1">
          <Search className="w-4 h-4 text-[#d6b357] shrink-0" />
          <input
            type="text"
            placeholder="Search by developer name..."
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 py-3.5 bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
          />
          {value && (
            <button
              onClick={() => handleChange("")}
              className="text-xs text-[#9ca3af] hover:text-[#001f3f] transition-colors font-medium px-2 py-1 rounded-lg hover:bg-[#f3f4f6]"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
