"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, Phone } from "lucide-react"

/**
 * Phone-only action bar for a project page. Hidden while the masthead is on
 * screen; slides up from the bottom once the reader has scrolled past it and
 * stays there: the price, an "Inquire" button that scrolls to the form, and
 * a call button when the project or developer lists a number.
 */
export function ProjectStickyBar({
  price,
  phone,
  watch = "#pp-masthead",
  target = "#inquire",
}: {
  price: string | null
  phone: string | null
  /** Selector of the element whose leaving the viewport shows the bar. */
  watch?: string
  /** Selector the Inquire button scrolls to. */
  target?: string
}) {
  const [show, setShow] = useState(false)
  const shown = useRef(false)

  useEffect(() => {
    const el = document.querySelector(watch)
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        const next = !e.isIntersecting && e.boundingClientRect.bottom < 0
        if (next !== shown.current) {
          shown.current = next
          setShow(next)
          // Lets the WhatsApp float step up out of the bar's way (CSS .wa-fab).
          document.body.classList.toggle("has-sticky-bar", next)
        }
      },
      { threshold: 0 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      document.body.classList.remove("has-sticky-bar")
    }
  }, [watch])

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
