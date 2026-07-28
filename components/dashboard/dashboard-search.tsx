"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getSearchTargets, type NavSearchTarget } from "@/components/dashboard/sidebar-config"

/**
 * Topbar search: type to filter this role's destinations, ↑/↓ + Enter or click
 * to jump. Destinations come from sidebar-config, so pages that only exist as
 * tiles inside a hub are reachable in one step instead of two.
 *
 * Hidden below `sm` — the burger menu covers navigation on mobile.
 */
export function DashboardSearch() {
  const router = useRouter()
  const { profile } = useAuth()

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const targets = useMemo(() => getSearchTargets(profile?.role), [profile?.role])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return targets
    return targets.filter(
      (t) => t.label.toLowerCase().includes(q) || (t.group?.toLowerCase().includes(q) ?? false),
    )
  }, [targets, query])

  // Clamp rather than reset-in-effect: the highlight must stay in range when the
  // result set shrinks, and doing it here keeps the component effect-free.
  const idx = Math.min(activeIdx, Math.max(0, results.length - 1))

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    return () => document.removeEventListener("mousedown", onPointer)
  }, [open])

  const select = (target: NavSearchTarget) => {
    setOpen(false)
    setQuery("")
    setActiveIdx(0)
    inputRef.current?.blur()
    router.push(target.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx(Math.min(idx + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx(Math.max(idx - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const target = results[idx]
      if (target) select(target)
    } else if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <div
        className={`flex h-10 w-[240px] items-center gap-2 rounded-xl border px-3 transition-colors md:w-[340px] ${
          open ? "border-[#d6b357] bg-white" : "border-transparent bg-[#f4f6f9] hover:bg-[#eef1f5]"
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" />
        <input
          ref={inputRef}
          value={query}
          placeholder="Search dashboard…"
          aria-label="Search dashboard"
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIdx(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#0d1117] outline-none placeholder:text-[#9ca3af]"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-[360px] w-full overflow-y-auto rounded-2xl border border-[#e8eaed] bg-white py-1 shadow-[0_10px_36px_-4px_rgba(0,31,63,0.18)]">
          {results.map((target, i) => {
            const { icon: Icon, label, href, group } = target
            return (
              <button
                key={`${href}::${label}`}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => select(target)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === idx ? "bg-[#d6b357]/12" : "hover:bg-[#f4f6f9]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[#9ca3af]" />
                <span className="truncate text-sm font-semibold text-[#0d1117]">{label}</span>
                <span className="flex-1" />
                {group && <span className="shrink-0 text-[11px] text-[#9ca3af]">{group}</span>}
                {i === idx && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
