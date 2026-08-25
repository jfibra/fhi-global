import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight, Building2, Compass, CircleUserRound, Facebook, FileText,
  Mail, MapPin, Phone, ShieldCheck,
} from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"
import { SEO_SEARCH_PAGES, SEO_AREA_GUIDES } from "@/lib/seo-pages"
import { WhatsAppFab } from "@/components/public/whatsapp-fab"

const COMPANY_LINKS = [
  { label: "Contact Us", href: "/contact" },
  { label: "Buy", href: "/buy" },
  { label: "Rent", href: "/rent" },
  { label: "Developers", href: "/developers" },
  { label: "News", href: "/news" },
  { label: "Projects", href: "/projects" },
  { label: "Mortgage Calculator", href: "/dubai-mortgage-calculator" },
]

const ACCOUNT_LINKS = [
  { label: "Login", href: "/staff-login" },
  { label: "Create Account", href: "/register" },
  { label: "Dashboard", href: "/dashboard" },
]

// The header renders these inside dropdowns; the footer column guarantees
// every section has a plain server-rendered <a> on every page (several of
// these had ZERO crawlable internal links before this column existed).
const EXPLORE_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Our Agents", href: "/agents" },
  { label: "Agent Websites", href: "/agent-websites" },
  { label: "Gallery", href: "/gallery" },
  { label: "Events", href: "/events" },
]
// Pretty URLs, not query strings: /projects?status=… canonicalises back to
// /projects, so those links passed no SEO value and looked like machine URLs
// on hover. The landing pages in lib/seo-pages.ts are the crawlable versions.
const PROJECT_LINKS = [
  { label: "All Projects",    href: "/projects" },
  { label: "Off-Plan",        href: "/off-plan-projects-in-uae" },
  { label: "Ready to Move",   href: "/ready-properties-in-dubai" },
  { label: "Latest Launches", href: "/new-projects-in-dubai" },
]

// The four link columns, each with its gold section icon (approved mockup).
const SECTIONS = [
  { title: "Company",  Icon: Building2,       links: COMPANY_LINKS },
  { title: "Explore",  Icon: Compass,         links: EXPLORE_LINKS },
  { title: "Account",  Icon: CircleUserRound, links: ACCOUNT_LINKS },
  { title: "Projects", Icon: FileText,        links: PROJECT_LINKS },
]

const SOCIALS = [
  { label: "Facebook", href: SOCIAL_URLS.facebook, Icon: Facebook },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative bg-[#001428] text-white/70">
      {/* ── Popular searches & area guides ───────────────
          The SEO interlinking rail, sitting at the top of the footer so it
          is the first thing seen rather than buried under the columns: every
          public page links to the landing pages in lib/seo-pages.ts plus the
          strongest developer portfolios, so crawlers — and readers — reach
          them from anywhere on the site. */}
      <div className="bg-[#f7f8fa] border-t border-[#e8eaed]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a07c1f] mb-4">
              Popular Searches in Dubai &amp; UAE
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
              {[
                ...SEO_SEARCH_PAGES.map((p) => ({ label: p.label, href: `/${p.slug}` })),
                // Top developer portfolios by live project count (see the
                // matching curation note in lib/seo-pages.ts).
                { label: "Samana Developers Projects", href: "/samana-developers" },
                { label: "Reportage Properties Projects", href: "/reportage-properties" },
                { label: "Azizi Developments Projects", href: "/azizi-developments" },
                { label: "Properties for Sale in Dubai", href: "/buy" },
                { label: "Properties for Rent in Dubai", href: "/rent" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-[#4b5563] hover:text-[#001f3f] hover:underline underline-offset-4 transition-colors duration-200 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a07c1f] mb-4">
              Dubai Area Guides
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
              {SEO_AREA_GUIDES.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/${p.slug}`}
                    className="text-sm text-[#4b5563] hover:text-[#001f3f] hover:underline underline-offset-4 transition-colors duration-200 inline-block"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Gold top rule */}
      <div className="h-[2px] bg-[#d6b357]" />

      {/* ── Pre-footer CTA band — skyline photo showing through (mockup) ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[center_30%]"
            aria-hidden="true"
          />
          {/* Scrim: readable on the left, skyline visible on the right. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/95 via-[#001428]/80 to-[#001428]/45" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#001428] to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-2">
                Ready to find your next investment?
                <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              </p>
              <h3 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-white leading-tight">
                Browse Dubai&apos;s Finest Properties
              </h3>
              <p className="mt-2.5 text-sm text-white/70 max-w-md leading-relaxed">
                Explore off-plan and ready properties from Dubai&apos;s most trusted developers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold uppercase tracking-wider hover:bg-[#c8a544] transition-colors"
              >
                View Projects <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 border border-[#d6b357]/60 text-white text-sm font-bold uppercase tracking-wider hover:bg-white/[0.06] transition-colors"
              >
                Contact Us <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main footer content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-0">

          {/* Brand column */}
          <div className="lg:col-span-2 space-y-6 lg:pr-10">
            <Link href="/" className="inline-block">
              <Image
                src="/FHI_Branding_White.png"
                alt="FHI Global"
                width={130}
                height={40}
                className="object-contain h-10 w-auto"
              />
            </Link>

            <p className="text-sm leading-relaxed text-white/55 max-w-xs">
              Dubai&apos;s premier real estate portal — connecting investors
              with the finest developments from the most trusted developers.
            </p>

            {/* Contact details */}
            <div className="space-y-3">
              <a
                href="tel:+971567428288"
                className="flex items-center gap-3 text-sm text-white/70 hover:text-[#d6b357] transition-colors duration-200"
              >
                <Phone className="w-4 h-4 text-[#d6b357] shrink-0" />
                +971 56 742 8288
              </a>
              <a
                href="mailto:info@fhiglobal.ae"
                className="flex items-center gap-3 text-sm text-white/70 hover:text-[#d6b357] transition-colors duration-200"
              >
                <Mail className="w-4 h-4 text-[#d6b357] shrink-0" />
                info@fhiglobal.ae
              </a>
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
                <span className="text-white/55 leading-snug">
                  Office 98, 3rd Floor, Rigga Business Center<br />
                  (Ibis Hotel Building), Al Rigga, Deira, Dubai, UAE
                </span>
              </div>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-2.5 pt-1">
              {SOCIALS.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  target={isExternalSocial(href) ? "_blank" : undefined}
                  rel={isExternalSocial(href) ? "noopener noreferrer" : undefined}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/80 hover:border-[#d6b357] hover:text-[#d6b357] transition-colors duration-200"
                >
                  <Icon className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Link columns — gold icon headers, hairline dividers (mockup). */}
          {SECTIONS.map(({ title, Icon, links }) => (
            <div key={title} className="lg:border-l lg:border-white/10 lg:pl-8">
              <h4 className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
                <Icon className="w-[18px] h-[18px] text-[#d6b357]" />
                {title}
              </h4>
              <span className="block w-8 h-[2px] bg-[#d6b357]/70 mt-3 mb-5" aria-hidden="true" />
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-white/60 hover:text-[#d6b357] transition-colors duration-200 inline-block"
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

      {/* ── Bottom bar ── */}
      <div className="border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-white/40">
            <ShieldCheck className="w-4 h-4 text-[#d6b357] shrink-0" />
            © {year} FHI Global Property. All rights reserved. RERA Licensed.
          </p>
          <div className="flex items-center">
            {[
              { label: "Privacy Policy",   href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Cookie Policy",    href: "/cookies" },
            ].map(({ label, href }, i) => (
              <span key={label} className="flex items-center">
                {i > 0 && <span className="mx-4 h-3 w-px bg-white/15" aria-hidden="true" />}
                <Link href={href} className="text-xs text-white/40 hover:text-[#d6b357] transition-colors">
                  {label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating WhatsApp — footer renders on every public page, so this
          reaches all of them without touching the dashboards. */}
      <WhatsAppFab />
    </footer>
  )
}
