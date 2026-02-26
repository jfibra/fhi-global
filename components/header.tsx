"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, ChevronDown } from "lucide-react"

const NAV_LINKS = [
  { label: "Home",       href: "/" },
  { label: "Developers", href: "/developers" },
  { label: "Projects",   href: "/projects" },
  { label: "About",      href: "/about" },
  { label: "Contact",    href: "/contact" },
]

export function Header() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <header
      className={`sticky top-0 z-[900] w-full transition-all duration-300 ${
        scrolled
          ? "bg-[#001f3f]/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,31,63,0.3)] border-b border-white/8"
          : "bg-[#001f3f]"
      }`}
    >
      {/* Subtle gold top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 relative z-10">
          <Image
            src="/FHI_Branding_White.png"
            alt="FHI Global"
            width={130}
            height={40}
            className="object-contain h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-full group ${
                  isActive ? "text-[#d6b357]" : "text-white/75 hover:text-white"
                }`}
              >
                {label}
                <span
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#d6b357] transition-all duration-300 ${
                    isActive ? "w-4" : "w-0 group-hover:w-4"
                  }`}
                />
              </Link>
            )
          })}
        </nav>

        {/* Desktop CTA Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-full transition-all duration-200 hover:bg-white/8"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:translate-y-[-1px]"
          >
            Register
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-white/10 bg-[#001428] px-4 py-5">
          <nav className="flex flex-col gap-1 mb-5">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-[#d6b357]"
                      : "text-white/70 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="flex gap-3">
            <Link href="/login" className="flex-1 text-center py-3 text-sm font-semibold text-white/80 border border-white/20 rounded-full hover:bg-white/8 transition-all">
              Login
            </Link>
            <Link href="/login" className="flex-1 text-center py-3 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] rounded-full">
              Register
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
