"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Phone, Mail, Facebook, Instagram, Linkedin, Twitter } from "lucide-react"

const NAV_LINKS = [
  { label: "Home",       href: "/" },
  { label: "Developers", href: "/developers" },
  { label: "Projects",   href: "/projects" },
  { label: "Contact",    href: "/contact" },
]

const SOCIAL_LINKS = [
  { label: "Facebook",  href: "#", Icon: Facebook },
  { label: "Instagram", href: "#", Icon: Instagram },
  { label: "LinkedIn",  href: "#", Icon: Linkedin },
  { label: "Twitter",   href: "#", Icon: Twitter },
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

  // Lock body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      <header
        className={`sticky top-0 z-[900] w-full transition-all duration-300 ${
          scrolled
            ? "bg-[#001f3f]/95 backdrop-blur-xl shadow-[0_4px_32px_rgba(0,31,63,0.35)] border-b border-white/8"
            : "bg-[#001f3f]"
        }`}
      >
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 h-25 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 relative z-10">
            <Image
              src="/FHI_Branding_White.png"
              alt="FHI Global"
              width={200}
              height={80}
              className="object-contain h-15 w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-5 py-2.5 text-sm font-medium tracking-wide transition-colors duration-200 rounded-full group ${
                    isActive ? "text-[#d6b357]" : "text-white/75 hover:text-white"
                  }`}
                >
                  {label}
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#d6b357] transition-all duration-300 ${
                      isActive ? "w-5" : "w-0 group-hover:w-5"
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
              className="px-6 py-2.5 text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-full transition-all duration-200 hover:bg-white/8"
            >
              Login
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:translate-y-[-1px]"
            >
              Register
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-[1000] lg:hidden transition-all duration-300 ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />

        {/* Sidebar Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-[300px] sm:w-[340px] bg-[#001428] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Gold top accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" />

          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Image
                src="/FHI_Branding_White.png"
                alt="FHI Global"
                width={140}
                height={42}
                className="object-contain h-9 w-auto"
                priority
              />
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1 px-4 py-5 flex-1 overflow-y-auto">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-[#d6b357] border border-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] shrink-0" />
                  )}
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* CTA Buttons */}
          <div className="px-4 pb-4 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-xl transition-all duration-300 shadow-md"
            >
              Sign In / Register
            </Link>
          </div>

          {/* Contact Info */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Contact Us</p>
            <div className="flex flex-col gap-2.5">
              <a
                href="tel:+97143001234"
                className="flex items-center gap-3 text-white/60 hover:text-[#d6b357] transition-colors text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                +971 4 300 1234
              </a>
              <a
                href="mailto:info@fhiglobal.com"
                className="flex items-center gap-3 text-white/60 hover:text-[#d6b357] transition-colors text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                info@fhiglobal.com
              </a>
            </div>
          </div>

          {/* Social Media */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Follow Us</p>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/8 hover:bg-[#d6b357]/20 hover:text-[#d6b357] text-white/50 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-[11px] text-white/20 text-center">
              © {new Date().getFullYear()} FHI Global • Dubai Operations
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
