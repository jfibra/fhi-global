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

const COMPANY_LINKS  = [
  { label: "About Us",        href: "/about" },
  { label: "Our Team",        href: "/team" },
  { label: "Careers",         href: "/careers" },
  { label: "News & Media",    href: "/news" },
  { label: "Partner With Us", href: "/partners" },
]
const DEVELOPER_LINKS = [
  { label: "All Developers",        href: "/developers" },
  { label: "Register as Developer", href: "/developers/register" },
  { label: "Developer Dashboard",   href: "/dashboard/developer" },
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
    <footer className="relative bg-[#001428] text-white/70">
      {/* Gold top accent strip */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/65 to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-2 space-y-6">
            <Image
              src="/FHI_Branding_White.png"
              alt="FHI Global"
              width={130}
              height={40}
              className="object-contain h-9 w-auto"
            />
            <p className="text-sm leading-relaxed text-white/50 max-w-xs">
              Dubai&apos;s premier real estate portal — connecting investors with the finest developments from the most trusted developers.
            </p>

            <div className="space-y-3">
              <a href="tel:+97143001234" className="flex items-center gap-3 text-sm hover:text-[#d6b357] transition-colors duration-200 group">
                <div className="w-8 h-8 rounded-full bg-white/8 group-hover:bg-[#d6b357]/15 flex items-center justify-center transition-colors">
                  <Phone className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                +971 4 300 1234
              </a>
              <a href="mailto:info@fhiglobal.com" className="flex items-center gap-3 text-sm hover:text-[#d6b357] transition-colors duration-200 group">
                <div className="w-8 h-8 rounded-full bg-white/8 group-hover:bg-[#d6b357]/15 flex items-center justify-center transition-colors">
                  <Mail className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                info@fhiglobal.com
              </a>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#d6b357]" />
                </div>
                <span className="text-white/45">Office 2301, Burj Al Salam,<br />Sheikh Zayed Road, Dubai, UAE</span>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-1.5 pt-1">
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

          {/* Company */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" /> Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/50 hover:text-[#d6b357] transition-colors duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" /> Developers
            </h4>
            <ul className="space-y-3">
              {DEVELOPER_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/50 hover:text-[#d6b357] transition-colors duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Projects */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357]" /> Projects
            </h4>
            <ul className="space-y-3">
              {PROJECT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/50 hover:text-[#d6b357] transition-colors duration-200">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">
            © {year} FHI Global Real Estate. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Cookie Policy", href: "/cookies" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-xs text-white/30 hover:text-[#d6b357] transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
