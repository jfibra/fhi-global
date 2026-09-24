import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight, Building2, Compass, CircleUserRound, Facebook, FileText,
  Mail, MapPin, Phone, ShieldCheck,
} from "lucide-react"
import { SOCIAL_URLS, isExternalSocial } from "@/lib/social"
import { SEO_SEARCH_PAGES, SEO_AREA_GUIDES } from "@/lib/seo-pages"
import { WhatsAppFab } from "@/components/public/whatsapp-fab"
import { InView } from "@/components/public/in-view"
import { MagneticLink } from "@/components/public/magnetic-link"

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

/**
 * A stylised Dubai skyline in one stroke: low towers, the Burj Al Arab sail,
 * the Burj Khalifa spire at centre, the Dubai Frame, more towers. Drawn by a
 * single path so it can trace itself in (pathLength=1, stroke-dashoffset).
 * Decorative: a silhouette, not a map.
 */
const SKYLINE_D = [
  "M0 100 H50 V74 H74 V100 H108 V62 H122 V54 H136 V62 H150 V100 H190 V80 H214 V100 H250 V68 H262 V60 H274 V68 H286 V100 H330",
  // Burj Al Arab sail
  "C360 100 372 40 400 30 C412 44 420 70 424 100 H470",
  // towers
  "V72 H484 V100 H520 V58 H530 V50 H540 V58 H552 V100 H600 V78 H626 V100",
  // Burj Khalifa
  "H672 L684 78 L694 62 L702 48 L708 34 L713 20 L716 6 L719 20 L724 34 L730 48 L738 62 L748 78 L760 100",
  // towers
  "H800 V66 H814 V100 H846 V84 H870 V100",
  // Dubai Frame
  "H900 V32 H912 V88 H968 V32 H980 V100",
  // towers to the right
  "H1020 V70 H1034 V62 H1048 V70 H1062 V100 H1100 V80 H1126 V100 H1160 V56 H1170 V46 H1180 V56 H1190 V100 H1230 V76 H1256 V100 H1300 V64 H1316 V100 H1360 V82 H1386 V100 H1440",
].join(" ")

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="ft wf relative bg-[#001428] text-white/70">
      <noscript>
        <style>{`.ft [class*="wf-"], .ft .wf-word > span, .ft .ft-sky path, .ft .ft-sky-fill { opacity: 1 !important; transform: none !important; filter: none !important; stroke-dashoffset: 0 !important; }`}</style>
      </noscript>

      {/* ── Popular searches & area guides ───────────────
          The SEO interlinking rail, sitting at the top of the footer so it
          is the first thing seen rather than buried under the columns: every
          public page links to the landing pages in lib/seo-pages.ts plus the
          strongest developer portfolios, so crawlers — and readers — reach
          them from anywhere on the site. Static on purpose. */}
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

      {/* ── The skyline draws itself across the top of the footer ── */}
      <InView className="relative overflow-hidden border-t border-[#d6b357]/40" threshold={0.3}>
        <svg
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          className="ft-sky block h-[72px] w-full sm:h-[96px]"
          aria-hidden="true"
        >
          <path d={`${SKYLINE_D} V110 H0 Z`} className="ft-sky-fill" fill="#d6b357" stroke="none" />
          <path d={SKYLINE_D} pathLength={1} fill="none" stroke="#d6b357" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" aria-hidden="true" />
      </InView>

      {/* ── Pre-footer CTA band — skyline photo showing through (mockup) ── */}
      <InView className="relative overflow-hidden border-b border-white/[0.06]" threshold={0.3}>
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
              <p className="wf-fade flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-3">
                Ready to find your next investment?
                <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              </p>
              <h3 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-white leading-tight">
                {["Browse", "Dubai’s", "Finest"].map((w, i) => (
                  <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: i }}>{w}</span></span>
                ))}
                <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 3 }} className="wf-gold">Properties</span></span>
              </h3>
              <p className="wf-fade mt-3 text-sm text-white/70 max-w-md leading-relaxed" style={{ ["--d" as string]: "600ms" }}>
                Explore off-plan and ready properties from Dubai&apos;s most trusted developers.
              </p>
            </div>
            <div className="wf-fade flex flex-wrap items-center gap-3 flex-shrink-0" style={{ ["--d" as string]: "750ms" }}>
              <MagneticLink
                href="/projects"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold uppercase tracking-wider hover:bg-[#c8a544] transition-colors"
              >
                View Projects <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticLink>
              <MagneticLink
                href="/contact"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 border border-[#d6b357]/60 text-white text-sm font-bold uppercase tracking-wider hover:bg-white/[0.06] transition-colors"
              >
                Contact Us <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticLink>
            </div>
          </div>
        </div>
      </InView>

      {/* ── Main footer content — brand first, then each column in turn ── */}
      <InView className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10" threshold={0.2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-0">

          {/* Brand column */}
          <div className="lg:col-span-2 space-y-6 lg:pr-10">
            <Link href="/" className="wf-fade inline-block">
              <Image
                src="/FHI_Branding_White.png"
                alt="FHI Global"
                width={130}
                height={40}
                className="object-contain h-10 w-auto"
              />
            </Link>

            <p className="wf-fade text-sm leading-relaxed text-white/55 max-w-xs" style={{ ["--d" as string]: "150ms" }}>
              Dubai&apos;s premier real estate portal, connecting investors
              with the finest developments from the most trusted developers.
            </p>

            {/* Contact details */}
            <div className="wf-fade space-y-3" style={{ ["--d" as string]: "280ms" }}>
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
            <div className="wf-fade flex items-center gap-2.5 pt-1" style={{ ["--d" as string]: "400ms" }}>
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

          {/* Link columns — gold icon headers, hairline dividers that draw in. */}
          {SECTIONS.map(({ title, Icon, links }, ci) => (
            <div key={title} className="relative lg:pl-8">
              <span className="ft-divider hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-white/10" style={{ ["--d" as string]: `${300 + ci * 120}ms` }} aria-hidden="true" />
              <h4 className="wf-fade flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white" style={{ ["--d" as string]: `${350 + ci * 120}ms` }}>
                <Icon className="w-[18px] h-[18px] text-[#d6b357]" />
                {title}
              </h4>
              <span className="wf-rule block w-8 h-[2px] bg-[#d6b357]/70 mt-3 mb-5" style={{ ["--d" as string]: `${450 + ci * 120}ms` }} aria-hidden="true" />
              <ul className="space-y-3">
                {links.map(({ label, href }, li) => (
                  <li key={label} className="wf-fade" style={{ ["--d" as string]: `${500 + ci * 120 + li * 50}ms` }}>
                    <Link
                      href={href}
                      className="ft-link relative inline-block text-sm text-white/60 hover:text-[#d6b357] transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </InView>

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
