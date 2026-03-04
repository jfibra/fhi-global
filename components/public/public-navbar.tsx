"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Menu, X, ChevronRight } from "lucide-react"

const NAV_LINKS = [
  { href: "/developers", label: "Developers" },
  { href: "/projects", label: "Projects" },
]

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 z-[1000] w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-[#e8eaed] shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#001f3f] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Building2 className="w-4.5 h-4.5 text-[#d6b357]" strokeWidth={2} />
          </div>
          <span
            className={`font-['Outfit'] font-bold text-lg tracking-tight transition-colors ${
              scrolled ? "text-[#001f3f]" : "text-white"
            }`}
          >
            FHI<span className="text-[#d6b357]">Global</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors relative group ${
                  scrolled
                    ? active
                      ? "text-[#001f3f]"
                      : "text-[#374151] hover:text-[#001f3f]"
                    : active
                    ? "text-[#d6b357]"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {label}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 rounded-full bg-[#d6b357] transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            )
          })}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002a52] transition-all shadow-sm hover:shadow-md"
          >
            Agent Login <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className={`md:hidden p-2 rounded-lg transition-colors ${
            scrolled ? "text-[#001f3f] hover:bg-[#f3f4f6]" : "text-white hover:bg-white/10"
          }`}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#e8eaed] px-4 py-5 space-y-3 shadow-lg">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] hover:text-[#001f3f] transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-1.5 mt-2 px-4 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-semibold"
          >
            Agent Login <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </header>
  )
}
