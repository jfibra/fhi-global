import Link from "next/link"
import { Phone, Mail } from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"
import { COMPANY, companyPhoneHref } from "@/lib/company"

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth={1.75} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" strokeWidth={0} />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
    </svg>
  )
}

// A profile that is not published yet ("#" in lib/social.ts) renders no icon at all: a
// dead "#" link on every page of the site is worse than no link.
const SOCIALS = [
  { href: SOCIAL_URLS.facebook, label: "Facebook", Icon: FacebookIcon },
  { href: SOCIAL_URLS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_URLS.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
].filter(({ href }) => isExternalSocial(href))

export function TopBar() {
  return (
    <div className="bg-[#001428] border-b border-white/5 text-white/70 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between">
        {/* Left — contact info */}
        <div className="flex items-center gap-5">
          {/* Dubai office line — the top bar fronts the UAE business. */}
          <a
            href={companyPhoneHref()}
            className="flex items-center gap-1.5 hover:text-[#d6b357] transition-colors duration-200"
          >
            <Phone className="w-3 h-3" />
            <span>{COMPANY.phone}</span>
          </a>
          <span className="hidden sm:block w-px h-3 bg-white/15" />
          <a
            href={`mailto:${COMPANY.email}`}
            className="hidden sm:flex items-center gap-1.5 hover:text-[#d6b357] transition-colors duration-200"
          >
            <Mail className="w-3 h-3" />
            <span>{COMPANY.email}</span>
          </a>
        </div>

        {/* Right — social icons */}
        <div className="flex items-center gap-0.5">
          {SOCIALS.map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              aria-label={label}
              target={isExternalSocial(href) ? "_blank" : undefined}
              rel={isExternalSocial(href) ? "noopener noreferrer" : undefined}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:text-[#d6b357] hover:bg-white/8 transition-all duration-200"
            >
              <Icon />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
