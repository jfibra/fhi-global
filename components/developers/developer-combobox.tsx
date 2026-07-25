"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search, ShieldCheck } from "lucide-react"
import { DeveloperLogo } from "@/components/developers/developer-logo"
import type { DeveloperOption } from "@/lib/sales-service"

// Searchable developer picker with logo + verified badge — the same look as the
// developer registration page, replacing a plain (all-text) native <select>.
// Selection-only: pick an existing developer by id.
//
// The dropdown panel is portalled to <body> with fixed positioning so it is never
// clipped by a scrolling/overflow ancestor (e.g. the Edit-Sale modal); z-index is
// above the app's modals (which top out at z-[120]).
export function DeveloperCombobox({
  developers,
  value,
  onChange,
  disabled = false,
  placeholder = "Select developer…",
  id,
}: {
  developers: DeveloperOption[]
  value: string
  onChange: (developerId: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = developers.find((d) => d.id === value) ?? null
  const filtered = useMemo(
    () => (q ? developers.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : developers),
    [developers, q],
  )

  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left, width: r.width })
  }, [])
  const openMenu = () => { place(); setOpen(true) }
  const close = () => { setOpen(false); setQ("") }

  // Keep the portalled panel aligned with the trigger while the page/modal scrolls
  // or the window resizes.
  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, place])

  return (
    <div className="relative">
      <button
        id={id}
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? "border-[#001f3f] ring-4 ring-[#001f3f]/6" : "border-[#e5e7eb] hover:border-[#001f3f]/40"
        }`}
      >
        {selected ? (
          <>
            <DeveloperLogo url={selected.logo_url} name={selected.name} size={28} />
            <span className="flex-1 text-sm font-semibold text-[#111827] truncate">{selected.name}</span>
            {selected.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
          </>
        ) : (
          <span className="flex-1 text-sm text-[#9ca3af]">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Click-away overlay */}
            <div className="fixed inset-0" style={{ zIndex: 1000 }} onClick={close} aria-hidden />
            <div
              style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 1001 }}
              className="bg-white rounded-2xl border border-[#e8eaed] shadow-xl overflow-hidden"
            >
              <div className="p-2 border-b border-[#f0f2f5]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search developers"
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-sm focus:outline-none focus:border-[#001f3f]"
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-[#9ca3af]">No developers match “{q}”.</p>
                ) : (
                  filtered.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => { onChange(d.id); close() }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] text-left"
                    >
                      <DeveloperLogo url={d.logo_url} name={d.name} size={28} />
                      <span className="flex-1 text-sm font-medium text-[#111827] truncate">{d.name}</span>
                      {d.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                      {value === d.id && <Check className="w-4 h-4 text-[#001f3f] shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
