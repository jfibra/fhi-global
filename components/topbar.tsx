import Link from "next/link"
import { Phone, Mail } from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"

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

export function TopBar() {
  return (
    <div className="bg-[#001428] border-b border-white/5 text-white/70 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between">
        {/* Left — contact info */}
        <div className="flex items-center gap-5">
          {/* Dubai office line — the top bar fronts the UAE business. */}
          <a
            href="tel:+971567428288"
            className="flex items-center gap-1.5 hover:text-[#d6b357] transition-colors duration-200"
          >
            <Phone className="w-3 h-3" />
            <span>+971 56 742 8288</span>
          </a>
          <span className="hidden sm:block w-px h-3 bg-white/15" />
          <a
            href="mailto:info@fhiglobal.ae"
            className="hidden sm:flex items-center gap-1.5 hover:text-[#d6b357] transition-colors duration-200"
          >
            <Mail className="w-3 h-3" />
            <span>info@fhiglobal.ae</span>
          </a>
        </div>

        {/* Right — social icons */}
        <div className="flex items-center gap-0.5">
          {[
            { href: SOCIAL_URLS.facebook,  label: "Facebook",  Icon: FacebookIcon },
            { href: SOCIAL_URLS.instagram, label: "Instagram", Icon: InstagramIcon },
          ].map(({ href, label, Icon }) => (
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
