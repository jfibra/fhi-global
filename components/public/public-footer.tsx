import Link from "next/link"
import { Building2, Mail, Phone, MapPin, Facebook, Instagram } from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"

const FOOTER_LINKS = {
  Company: [
    { label: "About Us", href: "/#about" },
    { label: "Contact", href: "/#contact" },
    { label: "Agent Login", href: "/login" },
  ],
  Explore: [
    { label: "All Developers", href: "/developers" },
    { label: "All Projects", href: "/projects" },
    { label: "Featured Projects", href: "/projects?featured=true" },
  ],
  Popular: [
    { label: "Downtown Dubai", href: "/projects?city=Downtown+Dubai" },
    { label: "Dubai Marina", href: "/projects?city=Dubai+Marina" },
    { label: "Palm Jumeirah", href: "/projects?city=Palm+Jumeirah" },
    { label: "Business Bay", href: "/projects?city=Business+Bay" },
  ],
}

export function PublicFooter() {
  return (
    <footer className="bg-[#001428] text-white">
      {/* Top strip */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand col */}
          <div className="md:col-span-2 space-y-5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Building2 className="w-4.5 h-4.5 text-[#d6b357]" strokeWidth={2} />
              </div>
              <span className="font-['Outfit'] font-bold text-lg">
                FHI<span className="text-[#d6b357]">Global</span>
              </span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              Dubai&apos;s trusted real estate portal. Connecting buyers, investors, and developers across premium communities.
            </p>
            <div className="space-y-2">
              <a href="tel:+971567428288" className="flex items-center gap-2.5 text-sm text-white/50 hover:text-white transition-colors">
                <Phone className="w-4 h-4 text-[#d6b357]" /> +971 56 742 8288
              </a>
              <a href="mailto:info@fhiglobal.ae" className="flex items-center gap-2.5 text-sm text-white/50 hover:text-white transition-colors">
                <Mail className="w-4 h-4 text-[#d6b357]" /> info@fhiglobal.ae
              </a>
              <span className="flex items-center gap-2.5 text-sm text-white/50">
                <MapPin className="w-4 h-4 text-[#d6b357]" /> Al Rigga, Deira, Dubai, UAE
              </span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              {[
                { icon: Facebook, label: "Facebook", href: SOCIAL_URLS.facebook },
                { icon: Instagram, label: "Instagram", href: SOCIAL_URLS.instagram },
              ].map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={isExternalSocial(href) ? "_blank" : undefined}
                  rel={isExternalSocial(href) ? "noopener noreferrer" : undefined}
                  className="w-9 h-9 rounded-xl bg-white/8 hover:bg-[#d6b357]/20 border border-white/10 hover:border-[#d6b357]/30 flex items-center justify-center transition-all"
                >
                  <Icon className="w-4 h-4 text-white/60" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/55 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-white/25">
          © {new Date().getFullYear()} FHI Global Real Estate LLC. All rights reserved. RERA Registered.
        </p>
        <div className="flex items-center gap-5">
          <Link href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">Privacy Policy</Link>
          <Link href="#" className="text-xs text-white/25 hover:text-white/50 transition-colors">Terms of Use</Link>
        </div>
      </div>
    </footer>
  )
}
