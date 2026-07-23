"use client"

import { useRef } from "react"

/**
 * Segmented one-time-code input — one box per digit. Controlled via a single
 * string `value`; handles typing, backspace, arrow keys, and paste. Digits only.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
}: {
  value: string
  onChange: (next: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? "")

  const focusBox = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(i, length - 1))]
    el?.focus()
    el?.select()
  }

  const handleChange = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, "")
    const arr = [...digits]
    if (!clean) {
      arr[i] = ""
      onChange(arr.join("").replace(/\s+$/, ""))
      return
    }
    // Fill from the current box (supports fast typing / autofill of multiple).
    let idx = i
    for (const c of clean.split("")) {
      if (idx >= length) break
      arr[idx] = c
      idx++
    }
    onChange(arr.join("").slice(0, length))
    focusBox(idx)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      const arr = [...digits]
      if (digits[i]) {
        arr[i] = ""
        onChange(arr.join(""))
      } else if (i > 0) {
        arr[i - 1] = ""
        onChange(arr.join(""))
        focusBox(i - 1)
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!text) return
    onChange(text)
    focusBox(text.length)
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-semibold rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-[#111827] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all disabled:opacity-50"
        />
      ))}
    </div>
  )
}
