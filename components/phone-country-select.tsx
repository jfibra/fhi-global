"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { COUNTRY_CODES } from "@/lib/user-service"
import { cn } from "@/lib/utils"

export function PhoneCountrySelect({
  value,
  onChange,
  className,
  style,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = COUNTRY_CODES.find((c) => c.value === value)
  const closedDial = selected?.dial ?? (value.trim() || COUNTRY_CODES[0].dial)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false)
        }}
        className={cn(
          "flex items-center justify-between gap-0.5 text-left rounded-2xl border border-[#e5e5e5] bg-white text-sm focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 cursor-pointer",
          className,
        )}
        style={style}
      >
        <span className="tabular-nums truncate min-w-0">{closedDial}</span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 text-[#9ca3af] shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute z-[100] mt-1 left-0 w-max min-w-full max-w-[min(320px,calc(100vw-2rem))] max-h-60 overflow-y-auto rounded-2xl border border-[#e5e5e5] bg-white py-1 shadow-lg shadow-black/10"
        >
          {COUNTRY_CODES.map((c) => (
            <li key={c.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={c.value === value}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm hover:bg-[#f4f6f9] flex items-center justify-between gap-4",
                  c.value === value && "bg-[#001f3f]/6 text-[#001f3f] font-medium",
                )}
                onClick={() => {
                  onChange(c.value)
                  setOpen(false)
                }}
              >
                <span className="min-w-0">{c.country}</span>
                <span className="text-[#9ca3af] tabular-nums shrink-0 text-xs">{c.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
