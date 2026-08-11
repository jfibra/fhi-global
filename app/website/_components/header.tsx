"use client"

// Site navbar — matches the FHI Global homepage header color (#001f3f). The
// logo links back to the platform homepage, not the personal site. Below lg
// the links collapse into a burger menu panel.

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react"
import { BRAND_GRADIENT, BRAND_TO, GOLD, GOLD_GRADIENT, NAV_LINKS, SAMPLE_DATA, type WebsiteData } from "../_data"
import { buildContactChannels } from "./contact-channels"

export function SiteHeader({ sticky = true, data = SAMPLE_DATA }: { sticky?: boolean; data?: WebsiteData }) {
  const [open, setOpen] = useState(false)
  // Contact Me — same dropdown channels as the About section.
  const [contactOpen, setContactOpen] = useState(false)
  const contactChannels = buildContactChannels(data)

  const channelLinks = (onPick: () => void) =>
    contactChannels.map(({ icon: Icon, label, href }) => (
      <a
        key={label}
        href={href}
        target={href.startsWith("mailto:") || href.startsWith("tel:") ? undefined : "_blank"}
        rel="noopener noreferrer"
        onClick={onPick}
        className="flex items-center gap-3 border-b border-[#f0ede4] px-4 py-3 text-left text-[13px] font-semibold last:border-b-0 hover:bg-[#faf8f4]"
        style={{ color: BRAND_TO }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
        {label}
      </a>
    ))

  return (
    // Same gradient treatment as the dashboard listings buttons (180deg, navy
    // → darker): top is the FHI header navy, bottom is the ink used by the
    // About stats bar, so the two blend. `sticky` is off in the builder's
    // live preview — there it should scroll with the page like plain content.
    <header className={sticky ? "sticky top-0 z-50" : "relative"} style={{ background: BRAND_GRADIENT }}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-4 sm:px-8 lg:gap-8">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FHI_Branding_White.png" alt="FHI Global" className="h-9 w-auto sm:h-10" />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map(({ label, href }) => {
            // "Home" (#home) is the active link — not whatever sits first in
            // the list (e.g. the FHI Global Homepage link).
            const active = href === "#home"
            return (
              <a
                key={label}
                href={href}
                className={`relative cursor-pointer text-[13.5px] font-semibold transition-colors ${
                  active ? "" : "text-white/75 hover:text-white"
                }`}
                style={active ? { color: GOLD } : undefined}
              >
                {label}
                {/* Absolute underline: the active label keeps the exact same
                    baseline as its siblings instead of lifting. */}
                {active && (
                  <span
                    className="absolute -bottom-1.5 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: GOLD }}
                    aria-hidden
                  />
                )}
              </a>
            )
          })}
        </nav>

        <div className="relative hidden sm:block lg:ml-0">
          <button
            type="button"
            onClick={() => setContactOpen((o) => !o)}
            aria-expanded={contactOpen}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold"
            style={{ background: GOLD_GRADIENT, color: BRAND_TO }}
          >
            <MessageCircle className="h-4 w-4" /> Contact Me
            <ChevronDown className={`h-4 w-4 transition-transform ${contactOpen ? "rotate-180" : ""}`} />
          </button>
          {contactOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 border border-[#e8e2d4] bg-white shadow-[0_18px_40px_-18px_rgba(13,27,46,0.4)]">
              {channelLinks(() => setContactOpen(false))}
            </div>
          )}
        </div>

        {/* Burger — mobile/tablet only */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="ml-auto flex h-10 w-10 items-center justify-center text-white sm:ml-0 lg:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="border-t border-white/10 px-5 pb-6 pt-2 lg:hidden" style={{ backgroundColor: BRAND_TO }}>
          {NAV_LINKS.map(({ label, href }) => {
            const active = href === "#home"
            return (
              <a
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={`block border-b border-white/5 py-3 text-[14px] font-semibold ${
                  active ? "" : "text-white/80"
                }`}
                style={active ? { color: GOLD } : undefined}
              >
                {label}
              </a>
            )
          })}
          <button
            type="button"
            onClick={() => setContactOpen((o) => !o)}
            aria-expanded={contactOpen}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-[13px] font-bold"
            style={{ background: GOLD_GRADIENT, color: BRAND_TO }}
          >
            <MessageCircle className="h-4 w-4" /> Contact Me
            <ChevronDown className={`h-4 w-4 transition-transform ${contactOpen ? "rotate-180" : ""}`} />
          </button>
          {contactOpen && (
            <div className="mt-1 border border-[#e8e2d4] bg-white">
              {channelLinks(() => { setContactOpen(false); setOpen(false) })}
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
