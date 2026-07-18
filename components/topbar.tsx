import Link from "next/link"
import { Phone, Mail } from "lucide-react"

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
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}
function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function TopBar() {
  return (
    <div className="bg-[#001428] border-b border-white/5 text-white/70 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between">
        {/* Left — contact info */}
        <div className="flex items-center gap-5">
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
            { href: "#", label: "Facebook",  Icon: FacebookIcon },
            { href: "#", label: "Instagram", Icon: InstagramIcon },
            { href: "#", label: "LinkedIn",  Icon: LinkedInIcon },
            { href: "#", label: "Twitter/X", Icon: TwitterXIcon },
          ].map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              aria-label={label}
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
