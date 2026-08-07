"use client"

// Site navbar — matches the FHI Global homepage header color (#001f3f). The
// logo links back to the platform homepage, not the personal site. Below lg
// the links collapse into a burger menu panel.

import { useState } from "react"
import Link from "next/link"
import { Mail, Menu, X } from "lucide-react"
import { BRAND_GRADIENT, BRAND_TO, GOLD, GOLD_GRADIENT, NAV_LINKS } from "../_data"

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    // Same gradient treatment as the dashboard listings buttons (180deg, navy
    // → darker): top is the FHI header navy, bottom is the ink used by the
    // About stats bar, so the two blend.
    <header className="sticky top-0 z-50" style={{ background: BRAND_GRADIENT }}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-4 sm:px-8 lg:gap-8">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FHI_Branding_White.png" alt="FHI Global" className="h-9 w-auto sm:h-10" />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map(({ label, href }, i) => (
            <a
              key={label}
              href={href}
              className={`relative cursor-pointer text-[13.5px] font-semibold transition-colors ${
                i === 0 ? "" : "text-white/75 hover:text-white"
              }`}
              style={i === 0 ? { color: GOLD } : undefined}
            >
              {label}
              {/* Absolute underline: the active label keeps the exact same
                  baseline as its siblings instead of lifting. */}
              {i === 0 && (
                <span
                  className="absolute -bottom-1.5 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: GOLD }}
                  aria-hidden
                />
              )}
            </a>
          ))}
        </nav>

        <a
          href="#contact"
          className="hidden items-center gap-2 px-5 py-2.5 text-[13px] font-bold sm:inline-flex lg:ml-0"
          style={{ background: GOLD_GRADIENT, color: BRAND_TO }}
        >
          <Mail className="h-4 w-4" /> Get in Touch
        </a>

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
          {NAV_LINKS.map(({ label, href }, i) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className={`block border-b border-white/5 py-3 text-[14px] font-semibold ${
                i === 0 ? "" : "text-white/80"
              }`}
              style={i === 0 ? { color: GOLD } : undefined}
            >
              {label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-[13px] font-bold"
            style={{ background: GOLD_GRADIENT, color: BRAND_TO }}
          >
            <Mail className="h-4 w-4" /> Get in Touch
          </a>
        </nav>
      )}
    </header>
  )
}
