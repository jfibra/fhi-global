"use client"

import { useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

/**
 * A select you can also search: click to open the full list, or type to
 * narrow it, then pick. The value is always one of `options` (or "") — text
 * typed without picking is dropped when the field loses focus. Keyboard:
 * ↑/↓ to move, Enter to pick, Esc to close.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  placeholder: string
  ariaLabel: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const needle = query.trim().toLowerCase()
  // Names starting with the text first, then ones containing it.
  const filtered = needle
    ? [
        ...options.filter((o) => o.toLowerCase().startsWith(needle)),
        ...options.filter((o) => !o.toLowerCase().startsWith(needle) && o.toLowerCase().includes(needle)),
      ]
    : options

  const openList = () => {
    if (open) return
    setQuery("")
    setActive(Math.max(0, options.indexOf(value)))
    setOpen(true)
  }

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery("")
  }

  const moveTo = (i: number) => {
    setActive(i)
    listRef.current?.children[i]?.scrollIntoView({ block: "nearest" })
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full px-5 pr-10 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm cursor-pointer focus:cursor-text"
        // Closed: shows the chosen value. Open: shows what's being searched.
        value={open ? query : value}
        placeholder={open && value ? value : placeholder}
        onFocus={openList}
        onClick={openList}
        onBlur={() => {
          setOpen(false)
          setQuery("")
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          if (!open) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            if (!open) openList()
            else moveTo(Math.min(filtered.length - 1, active + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            moveTo(Math.max(0, active - 1))
          } else if (e.key === "Enter") {
            if (open && filtered[active]) {
              e.preventDefault()
              pick(filtered[active])
            }
          } else if (e.key === "Escape") {
            setOpen(false)
            setQuery("")
          }
        }}
      />
      <ChevronDown
        className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`}
        aria-hidden
      />

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-[#e5e7eb] bg-white py-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)]"
        >
          {filtered.length === 0 ? (
            <li className="px-5 py-2 text-sm text-[#9ca3af]">No match</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                // mousedown, not click: picks before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o)
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-5 py-2 text-sm ${
                  i === active ? "bg-[#f3f6fa]" : ""
                } ${o === value ? "font-semibold text-[#001f3f]" : "text-[#111827]"}`}
              >
                {o}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
