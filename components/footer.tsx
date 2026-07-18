import Link from "next/link"
import Image from "next/image"
import { Phone, Mail, MapPin } from "lucide-react"

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={1.75} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" strokeWidth={0} />
    </svg>
  )
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}
function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const COMPANY_LINKS = [
  { label: "Contact Us", href: "/contact" },
  { label: "Buy", href: "/buy" },
  { label: "Rent", href: "/rent" },
  { label: "Developers", href: "/developers" },
  { label: "News", href: "/news" },
  { label: "Projects", href: "/projects" },
]

const ACCOUNT_LINKS = [
  { label: "Login", href: "/login" },
  { label: "Create Account", href: "/register" },
  { label: "Dashboard", href: "/dashboard" },
]
const PROJECT_LINKS = [
  { label: "All Projects",    href: "/projects" },
  { label: "Featured",        href: "/projects?featured=true" },
  { label: "Off-Plan",        href: "/projects?status=pre_launch" },
  { label: "Ready to Move",   href: "/projects?status=completed" },
  { label: "Latest Launches", href: "/projects?status=launch" },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative bg-[#001428] text-white/70 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <img
          src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x800/9.png"
          alt=""
          className="w-full h-full object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#001428]/95" />
      </div>

      {/* Gold top accent strip */}
      <div className="relative z-10">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/65 to-transparent" />
      </div>

      {/* Pre-footer CTA band */}
      <div className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#d6b357] mb-1">
                Ready to find your next investment?
              </p>
              <h3 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-white leading-snug">
                Browse Dubai&apos;s Finest Properties
              </h3>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] rounded-full font-bold text-sm hover:translate-y-[-1px] hover:shadow-[0_8px_20px_rgba(214,179,87,0.35)] transition-all duration-300"
              >
                View Projects
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/8 border border-white/15 text-white rounded-full font-semibold text-sm hover:bg-white/12 transition-all duration-200"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">

          {/* ── Brand column ──────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="inline-block">
              <Image
                src="/FHI_Branding_White.png"
                alt="FHI Global"
                width={130}
                height={40}
                className="object-contain h-9 w-auto"
              />
            </Link>

            <p className="text-sm leading-relaxed text-white/45 max-w-xs">
              Dubai&apos;s premier real estate portal — connecting investors
              with the finest developments from the most trusted developers.
            </p>

            {/* Contact details */}
            <div className="space-y-2.5">
              <a
                href="tel:+971567428288"
                className="flex items-center gap-3 text-sm hover:text-[#d6b357] transition-colors duration-200 group"
              >
                <div className="w-8 h-8 rounded-full bg-white/8 group-hover:bg-[#d6b357]/15 flex items-center justify-center transition-colors shrink-0">
                  <Phone className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                +971 56 742 8288
              </a>
              <a
                href="mailto:info@fhiglobal.ae"
                className="flex items-center gap-3 text-sm hover:text-[#d6b357] transition-colors duration-200 group"
              >
                <div className="w-8 h-8 rounded-full bg-white/8 group-hover:bg-[#d6b357]/15 flex items-center justify-center transition-colors shrink-0">
                  <Mail className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                info@fhiglobal.ae
              </a>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                <span className="text-white/40 text-sm leading-snug">
                  Level 12, DIFC Gate Building,<br />Dubai, UAE
                </span>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { label: "Facebook",  href: "#", Icon: FacebookIcon },
                { label: "Instagram", href: "#", Icon: InstagramIcon },
                { label: "LinkedIn",  href: "#", Icon: LinkedInIcon },
                { label: "Twitter/X", href: "#", Icon: TwitterXIcon },
              ].map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 border border-white/10 hover:bg-[#d6b357]/20 hover:border-[#d6b357]/30 hover:text-[#d6b357] transition-all duration-200"
                >
                  <Icon />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Company ───────────────────────────────────── */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" />
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/45 hover:text-[#d6b357] transition-colors duration-200 hover:translate-x-0.5 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Account ───────────────────────────────────── */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" />
              Account
            </h4>
            <ul className="space-y-3">
              {ACCOUNT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/45 hover:text-[#d6b357] transition-colors duration-200 hover:translate-x-0.5 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Projects ──────────────────────────────────── */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" />
              Projects
            </h4>
            <ul className="space-y-3">
              {PROJECT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-white/45 hover:text-[#d6b357] transition-colors duration-200 hover:translate-x-0.5 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © {year} FHI Global Real Estate LLC. All rights reserved. RERA Licensed.
          </p>
          <div className="flex items-center gap-5">
            {[
              { label: "Privacy Policy",  href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Cookie Policy",   href: "/cookies" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-xs text-white/25 hover:text-[#d6b357] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
