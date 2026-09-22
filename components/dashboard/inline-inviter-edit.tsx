"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Pencil, X } from "lucide-react"

/**
 * Inline editor for a registration's "Invited by": click the value (or the
 * dash) to edit, type with staff-name suggestions, Enter saves, Esc cancels.
 * Suggestions come from the same public endpoint the registration form uses.
 */
export function InlineInviterEdit({
  value,
  onSave,
}: {
  value: string | null
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlight, setHighlight] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seq = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const lookup = (q: string) => {
    clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    timer.current = setTimeout(async () => {
      const n = ++seq.current
      try {
        const res = await fetch(`/api/events/inviters?q=${encodeURIComponent(q.trim())}`)
        const data = (await res.json().catch(() => ({}))) as { people?: { name: string }[] }
        if (n !== seq.current) return
        setSuggestions((data.people ?? []).map((p) => p.name).filter((s) => s.toLowerCase() !== q.trim().toLowerCase()))
        setHighlight(-1)
      } catch {
        /* suggestions are optional */
      }
    }, 180)
  }

  const commit = async (next: string) => {
    setSaving(true)
    try {
      await onSave(next)
      setEditing(false)
      setSuggestions([])
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "")
          setEditing(true)
        }}
        title="Edit who invited them"
        className="group inline-flex items-center gap-1.5 text-left text-[#374151] hover:text-[#001f3f]"
      >
        <span>{value || <span className="text-[#9ca3af]">—</span>}</span>
        <Pencil className="w-3 h-3 text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  return (
    <div className="relative min-w-[180px]">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            lookup(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length) {
              e.preventDefault()
              setHighlight((h) => (h + 1) % suggestions.length)
            } else if (e.key === "ArrowUp" && suggestions.length) {
              e.preventDefault()
              setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
            } else if (e.key === "Enter") {
              e.preventDefault()
              void commit(highlight >= 0 ? suggestions[highlight] : draft)
            } else if (e.key === "Escape") {
              setEditing(false)
              setSuggestions([])
            }
          }}
          placeholder="Who invited them?"
          maxLength={120}
          disabled={saving}
          className="w-full px-2 py-1 border border-[#001f3f]/40 bg-white text-sm text-[#111827] focus:outline-none focus:border-[#001f3f]"
        />
        <button type="button" onClick={() => void commit(draft)} disabled={saving} className="p-1 text-emerald-700 hover:bg-emerald-50" aria-label="Save">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setEditing(false); setSuggestions([]) }} disabled={saving} className="p-1 text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul role="listbox" className="absolute left-0 top-full z-20 mt-1 w-full max-h-48 overflow-y-auto border border-[#e5e7eb] bg-white py-1 shadow-lg">
          {suggestions.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault()
                void commit(name)
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === highlight ? "bg-[#001f3f]/6 text-[#001f3f]" : "text-[#374151]"}`}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
