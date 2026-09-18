"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

/**
 * Collapses long prose on small screens behind a "Read more" toggle.
 *
 * The full text is always in the server-rendered HTML — only its height is
 * clipped with CSS. That distinction matters: Google indexes and weights
 * content that is merely collapsed on mobile exactly as it does visible
 * content, but it cannot see text that only arrives after a click. So never
 * replace this with a conditional render of the children.
 *
 * Desktop is untouched (the column is wide enough), so the control and the
 * clipping are both mobile-only.
 */
export function ReadMore({
  children,
  /** Collapsed height on mobile. Roughly six lines of 15.5px/1.8 text. */
  collapsedClassName = "max-h-[10.5rem]",
  /** Page background, so the fade blends instead of banding. */
  fadeFrom = "from-[#fafafa]",
}: {
  children: React.ReactNode
  collapsedClassName?: string
  fadeFrom?: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div
        className={`relative sm:max-h-none sm:overflow-visible ${
          expanded ? "" : `overflow-hidden ${collapsedClassName}`
        }`}
      >
        {children}
        {!expanded && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t ${fadeFrom} to-transparent sm:hidden`}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-[#001f3f] hover:text-[#b8913f] transition-colors sm:hidden"
      >
        {expanded ? "Show less" : "Read more"}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  )
}
