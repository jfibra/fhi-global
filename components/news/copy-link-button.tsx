"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2 } from "lucide-react"

/**
 * Round copy-link button matching the article ShareStrip icons. Copies the
 * article URL and flashes a green check for a moment as feedback.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        // Legacy fallback for non-secure contexts / older browsers.
        const ta = document.createElement("textarea")
        ta.value = url
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — nothing useful to surface
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Link copied" : "Copy link"}
      title={copied ? "Copied!" : "Copy link"}
      className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-colors ${
        copied ? "bg-[#16a34a]" : "bg-[#6b7280] hover:bg-[#001428]"
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
    </button>
  )
}
