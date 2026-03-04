"use client"

import { useRef } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import type { Developer } from "@/lib/project-service"

interface Props {
  search: string
  onSearch: (v: string) => void
  filterDev: string
  onFilterDev: (v: string) => void
  filterStatus: string
  onFilterStatus: (v: string) => void
  developers: Developer[]
}

export function ProjectsSidebar({ search, onSearch, filterDev, onFilterDev, filterStatus, onFilterStatus, developers }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[#f3f4f6] rounded-xl px-3 py-2 border border-transparent focus-within:border-[#001f3f]/20 transition-all">
        <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search projectsâ€¦"
          className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none"
        />
        {search && (
          <button type="button" onClick={() => onSearch("")} className="text-[#9ca3af] hover:text-[#374151] text-xs">âœ•</button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-xl px-2 py-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
          <select
            value={filterDev}
            onChange={(e) => onFilterDev(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[#374151] outline-none appearance-none cursor-pointer min-w-0"
          >
            <option value="">All Developers</option>
            {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-[#f3f4f6] rounded-xl px-2 py-1.5">
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatus(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[#374151] outline-none appearance-none cursor-pointer min-w-0"
          >
            <option value="">All Statuses</option>
            <option value="pre_launch">Pre-Launch</option>
            <option value="launch">Launch</option>
            <option value="under_construction">Under Construction</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
    </div>
  )
}
