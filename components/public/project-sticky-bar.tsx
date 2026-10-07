"use client"

import { useEffect, useState } from "react"
import { MessageCircle, Phone } from "lucide-react"

/**
 * Phone-only action bar for a project page: the price, an "Inquire" button that
 * scrolls to the form, and a call button when the project or developer lists a
 * number. It is in the server HTML and on screen from the first paint — a visitor
 * arriving from search should see how to enquire before they have scrolled
 * anywhere — and steps out of the way only while the Inquire Now panel itself is
 * visible, returning once it has scrolled off again. The WhatsApp float rides
 * above it by CSS alone (`.pp-sticky[data-show="true"]` in globals.css), so it is
 * already in the right place before hydration.
 */
export function ProjectStickyBar({
  price,
  phone,
  target = "#inquire",
}: {
  price: string | null
  phone: string | null
  /** Selector of the form the Inquire button scrolls to; the bar hides while it is on screen. */
  target?: string
}) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const form = document.querySelector(target)
    // No form on this page: the bar simply stays.
    if (!form) return
    // The observer reports once straight away, so a page that opens with the form already in view
    // (a #inquire link) hides the bar at once.
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 })
    io.observe(form)
    return () => io.disconnect()
  }, [target])

  const go = () => {
    const el = document.querySelector(target)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div
      className="pp-sticky fixed inset-x-0 bottom-0 z-[900] border-t border-white/10 bg-[#06182e]/95 px-4 py-3 text-white backdrop-blur-md lg:hidden"
      data-show={show ? "true" : "false"}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d6b357]">{price ? "Starting from" : "Price"}</p>
          <p className="truncate font-['Outfit'] text-lg font-bold leading-tight">{price ?? "On request"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              aria-label="Call"
              className="inline-flex h-11 w-11 items-center justify-center border border-white/25 text-white"
            >
              <Phone className="h-4 w-4 text-[#d6b357]" />
            </a>
          )}
          <button
            type="button"
            onClick={go}
            className="inline-flex h-11 items-center gap-2 bg-[#d6b357] px-5 text-[14px] font-bold text-[#001f3f]"
          >
            <MessageCircle className="h-4 w-4" />
            Inquire
          </button>
        </div>
      </div>
    </div>
  )
}
