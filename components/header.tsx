"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Menu, X, Phone, Mail, Facebook, Instagram, ChevronDown, LayoutDashboard,
  LogOut, Building2, CalendarDays, Camera, KeyRound, Landmark, Newspaper,
  Tag, Users, type LucideIcon,
} from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"
import { getDashboardRouteByRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/client"
import { AuthModal } from "@/components/auth/auth-modal"

type NavChild = { label: string; href: string; desc: string; icon: LucideIcon }
type NavItem = { label: string; href: string; children?: NavChild[] }

// Six top-level items, three of them dropdowns, so the bar stays short as
// sections are added: the four browse destinations collapse into Properties,
// the two "who we are" pages into About Us, and the two timely ones into News
// & Events. Off-Plan stays top-level because it is the search people actually
// type, and it points at the landing page built for that query.
//
// A parent's href is never navigated to (the button only opens the menu) — it
// exists so every item has one; keep it pointing at the primary child.
const NAV_LINKS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Off-Plan", href: "/off-plan-projects-in-dubai" },
  {
    label: "Properties",
    href: "/projects",
    children: [
      { label: "Buy",        href: "/buy",        desc: "Homes and investments for sale", icon: Tag },
      { label: "Rent",       href: "/rent",       desc: "Available rentals across Dubai",  icon: KeyRound },
      { label: "Projects",   href: "/projects",   desc: "Every development we cover",      icon: Building2 },
      { label: "Developers", href: "/developers", desc: "Verified developers and portfolios", icon: Landmark },
    ],
  },
  {
    label: "About Us",
    href: "/about",
    children: [
      { label: "Our Company", href: "/about",   desc: "Who we are and how we work",     icon: Landmark },
      { label: "Agents",      href: "/agents",  desc: "Meet the team behind FHI Global", icon: Users },
      { label: "Gallery",     href: "/gallery", desc: "Photos from our events",          icon: Camera },
    ],
  },
  {
    label: "News & Events",
    href: "/events",
    children: [
      { label: "Events", href: "/events", desc: "Showcases and investor nights", icon: CalendarDays },
      { label: "News",   href: "/news",   desc: "Dubai market updates",           icon: Newspaper },
    ],
  },
  { label: "Contact", href: "/contact" },
]

const SOCIAL_LINKS = [
  { label: "Facebook",  href: SOCIAL_URLS.facebook,  Icon: Facebook },
  { label: "Instagram", href: SOCIAL_URLS.instagram, Icon: Instagram },
]

type HeaderSession = {
  dashboardHref: string
  displayName: string
  avatarUrl: string | null
  email: string | null
}

// The header remounts on every page navigation (each public page renders its
// own <Header/>), which used to refetch auth + profile and flash the avatar.
// Cache the resolved session for the tab: module cache covers client-side
// navigation, sessionStorage covers full reloads. `undefined` = never loaded,
// `null` = known logged-out. A background refresh still runs on every mount.
let headerSessionCache: HeaderSession | null | undefined
const SESSION_KEY = "fhi-header-session"

function readCachedSession(): HeaderSession | null | undefined {
  if (headerSessionCache !== undefined) return headerSessionCache
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw === null) return undefined
    return raw === "null" ? null : (JSON.parse(raw) as HeaderSession)
  } catch {
    return undefined
  }
}

function writeCachedSession(value: HeaderSession | null) {
  headerSessionCache = value
  try {
    sessionStorage.setItem(SESSION_KEY, value === null ? "null" : JSON.stringify(value))
  } catch {
    // storage unavailable (private mode) — module cache still helps
  }
}

function initialsFrom(displayName: string, email: string | null) {
  const n = displayName.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
    }
    return n.slice(0, 2).toUpperCase()
  }
  const local = email?.split("@")[0] ?? "?"
  return local.slice(0, 2).toUpperCase()
}

export function Header() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Which desktop dropdown is open, by label. Also drives the mobile accordion.
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileSection, setMobileSection] = useState<string | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const [authReady, setAuthReady]   = useState(false)
  const [session, setSession]       = useState<HeaderSession | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (!openMenu) return
    const onDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [openMenu])
  const router = useRouter()

  const loadSession = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        writeCachedSession(null)
        setSession(null)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, profile_url, fullname")
        .eq("id", user.id)
        .maybeSingle()

      const displayName = (typeof profile?.fullname === "string" && profile.fullname.trim())
        ? profile.fullname.trim()
        : (user.email?.split("@")[0] ?? "Account")

      const value: HeaderSession = {
        dashboardHref: getDashboardRouteByRole(profile?.role ?? null),
        displayName,
        avatarUrl: typeof profile?.profile_url === "string" && profile.profile_url.trim()
          ? profile.profile_url.trim()
          : null,
        email: user.email ?? null,
      }
      writeCachedSession(value)
      setSession(value)
    } catch {
      setSession(null)
    } finally {
      setAuthReady(true)
    }
  }, [])

  useEffect(() => {
    // Cached session (this tab) shows the account chip instantly; the fetch
    // below still revalidates in the background.
    const cached = readCachedSession()
    if (cached !== undefined) {
      setSession(cached)
      setAuthReady(true)
    }
    void loadSession()
    try {
      const supabase = createClient()
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        void loadSession()
      })
      return () => subscription.unsubscribe()
    } catch {
      return undefined
    }
  }, [loadSession])

  useEffect(() => {
    if (!accountOpen) return
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [accountOpen])

  const handleSignOut = async () => {
    setAccountOpen(false)
    setMobileOpen(false)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    setSession(null)
    router.push("/")
    router.refresh()
  }

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
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault()
              setMobileOpen(false)
              window.location.href = "/"
            }}
            className="flex-shrink-0 relative z-10"
            aria-label="Go to homepage"
          >
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
          <nav ref={navRef} className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map((item) => {
              const { label, href, children } = item
              // A parent counts as active when any of its children is.
              const isActive = children
                ? children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
                : pathname === href || (href !== "/" && pathname.startsWith(href))
              const underline = (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#d6b357] transition-all duration-300 ${
                    isActive ? "w-5" : "w-0 group-hover:w-5"
                  }`}
                />
              )
              const tone = isActive ? "text-[#d6b357]" : "text-white/75 hover:text-white"

              if (!children) {
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpenMenu(null)}
                    className={`relative px-5 py-2.5 text-[15px] font-semibold tracking-[0.01em] transition-colors duration-200 group ${tone}`}
                  >
                    {label}
                    {underline}
                  </Link>
                )
              }

              const open = openMenu === label
              return (
                <div
                  key={label}
                  className="relative"
                  // Hover opens it like a normal menu bar; the button keeps it
                  // usable by keyboard and touch, where hover does not exist.
                  onMouseEnter={() => setOpenMenu(label)}
                  onMouseLeave={() => setOpenMenu((cur) => (cur === label ? null : cur))}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="true"
                    onClick={() => setOpenMenu(open ? null : label)}
                    className={`relative inline-flex items-center gap-1.5 px-5 py-2.5 text-[15px] font-semibold tracking-[0.01em] transition-colors duration-200 group ${tone}`}
                  >
                    {label}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    {underline}
                  </button>

                  {/* White panel against the navy bar, so the menu reads as a
                      surface of the page rather than more chrome. Each row is
                      an icon tile + name + what you'll find there. */}
                  {open && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-[290px] bg-white border border-[#e5e8ec] shadow-[0_24px_60px_-18px_rgba(0,12,26,0.45)]">
                      <span className="block h-[3px] bg-[#d6b357]" aria-hidden="true" />
                      <div className="py-1.5">
                        {children.map((c) => {
                          const childActive = pathname === c.href || pathname.startsWith(`${c.href}/`)
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              onClick={() => setOpenMenu(null)}
                              className={`group/item relative flex items-start gap-3 px-4 py-2.5 transition-colors ${
                                childActive ? "bg-[#faf7ee]" : "hover:bg-[#f6f7f9]"
                              }`}
                            >
                              {/* Gold rail marks the current page, and slides
                                  in on hover. */}
                              <span
                                className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#d6b357] transition-opacity ${
                                  childActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                                }`}
                                aria-hidden="true"
                              />
                              <span
                                className={`w-9 h-9 flex items-center justify-center shrink-0 transition-colors ${
                                  childActive ? "bg-[#001f3f]" : "bg-[#f0f2f5] group-hover/item:bg-[#001f3f]"
                                }`}
                              >
                                <c.icon
                                  className={`w-[18px] h-[18px] transition-colors ${
                                    childActive ? "text-[#d6b357]" : "text-[#5f6368] group-hover/item:text-[#d6b357]"
                                  }`}
                                />
                              </span>
                              <span className="min-w-0">
                                <span className={`block font-['Outfit'] text-[14px] font-bold leading-tight ${
                                  childActive ? "text-[#b8913f]" : "text-[#001f3f]"
                                }`}>
                                  {c.label}
                                </span>
                                <span className="block text-[11.5px] text-[#6b7280] leading-snug mt-0.5">
                                  {c.desc}
                                </span>
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Desktop: signed-in account / guest CTAs */}
          <div className="hidden lg:flex items-center gap-3 min-h-[42px]">
            {!authReady ? (
              <div className="w-[200px] h-10 rounded-full bg-white/5 animate-pulse" aria-hidden />
            ) : session ? (
              <div className="relative flex items-center gap-2" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 pl-1 pr-3 py-1 hover:bg-white/15 transition-colors"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  {session.avatarUrl ? (
                    <Image
                      src={session.avatarUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="rounded-full object-cover w-9 h-9 border border-white/20"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d6b357] to-[#f0d890] text-[#001f3f] text-xs font-bold flex items-center justify-center border border-white/20"
                      aria-hidden
                    >
                      {initialsFrom(session.displayName, session.email)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-white max-w-[140px] truncate hidden sm:inline">
                    {session.displayName}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-white/70 shrink-0 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
                </button>
                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#0a2847] shadow-xl py-1 z-[950] overflow-hidden"
                  >
                    <Link
                      href={session.dashboardHref}
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#d6b357]" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleSignOut()}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-300" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-6 py-2.5 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:translate-y-[-1px]"
              >
                Login / Register
              </button>
            )}
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
            {NAV_LINKS.map((item) => {
              const { label, href, children } = item
              const isActive = children
                ? children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
                : pathname === href || (href !== "/" && pathname.startsWith(href))

              if (children) {
                const expanded = mobileSection === label
                return (
                  <div key={label}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setMobileSection(expanded ? null : label)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-white/10 text-[#d6b357] border border-white/10"
                          : "text-white/70 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] shrink-0" />}
                      {label}
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                    {expanded && (
                      <div className="mt-1 ml-3 border-l border-white/10 pl-3 flex flex-col gap-1">
                        {children.map((c) => {
                          const childActive = pathname === c.href || pathname.startsWith(`${c.href}/`)
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                childActive ? "text-[#d6b357] bg-white/[0.06]" : "text-white/65 hover:text-white hover:bg-white/8"
                              }`}
                            >
                              <c.icon className={`w-4 h-4 shrink-0 ${childActive ? "text-[#d6b357]" : "text-white/40"}`} />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold leading-tight">{c.label}</span>
                                <span className="block text-[11px] text-white/40 leading-snug mt-0.5">{c.desc}</span>
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold transition-all duration-200 ${
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

          {/* CTA / account */}
          <div className="px-4 pb-4 flex flex-col gap-3">
            {authReady && session ? (
              <>
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/10">
                  {session.avatarUrl ? (
                    <Image
                      src={session.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="rounded-full object-cover w-11 h-11 border border-white/20 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d6b357] to-[#f0d890] text-[#001f3f] text-sm font-bold flex items-center justify-center border border-white/20 shrink-0"
                      aria-hidden
                    >
                      {initialsFrom(session.displayName, session.email)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{session.displayName}</p>
                    {session.email && (
                      <p className="text-xs text-white/45 truncate">{session.email}</p>
                    )}
                  </div>
                </div>
                <Link
                  href={session.dashboardHref}
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center py-3.5 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-xl transition-all duration-300 shadow-md flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="w-full text-center py-3.5 text-sm font-semibold text-white/85 border border-white/20 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : authReady ? (
              <button
                type="button"
                onClick={() => { setMobileOpen(false); setAuthModalOpen(true) }}
                className="w-full text-center py-3.5 text-sm font-semibold text-[#001f3f] bg-gradient-to-r from-[#d6b357] to-[#f0d890] hover:from-[#c9a449] hover:to-[#e8d080] rounded-xl transition-all duration-300 shadow-md"
              >
                Login / Register
              </button>
            ) : (
              <div className="h-12 rounded-xl bg-white/5 animate-pulse" aria-hidden />
            )}
          </div>

          {/* Contact Info */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Contact Us</p>
            <div className="flex flex-col gap-2.5">
              <a
                href="tel:+971567428288"
                className="flex items-center gap-3 text-white/60 hover:text-[#d6b357] transition-colors text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                +971 56 742 8288
              </a>
              <a
                href="mailto:info@fhiglobal.ae"
                className="flex items-center gap-3 text-white/60 hover:text-[#d6b357] transition-colors text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                info@fhiglobal.ae
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
                  target={isExternalSocial(href) ? "_blank" : undefined}
                  rel={isExternalSocial(href) ? "noopener noreferrer" : undefined}
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

      {/* Public login/register modal (OTP + Google) */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </>
  )
}
