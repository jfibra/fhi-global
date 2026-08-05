// Site navbar — matches the FHI Global homepage header color (#001f3f). The
// logo links back to the platform homepage, not the personal site.

import Link from "next/link"
import { Mail } from "lucide-react"
import { GOLD, GOLD_SOFT, INK, NAV_LINKS } from "../_data"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50" style={{ backgroundColor: "#001f3f" }}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FHI_Branding_White.png" alt="FHI Global" className="h-10 w-auto" />
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
          className="hidden items-center gap-2 px-5 py-2.5 text-[13px] font-bold sm:inline-flex"
          style={{ backgroundColor: GOLD_SOFT, color: INK }}
        >
          <Mail className="h-4 w-4" /> Get in Touch
        </a>
      </div>
    </header>
  )
}
