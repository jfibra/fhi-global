import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ContactForm } from "./contact-form"
import { createPageMetadata } from "@/lib/seo"
import {
  MapPin, Phone, Mail, Clock, Facebook, Instagram, Linkedin,
  Twitter, Building2, MessageSquare, Send, Headphones, ShieldCheck
} from "lucide-react"

export const metadata: Metadata = createPageMetadata({
  title: "Contact FHI Global | Get in Touch",
  description:
    "Contact FHI Global's team in Dubai. Reach out for developer partnerships, agent onboarding, or any real estate inquiry.",
  openGraphDescription: "Reach out to FHI Global's Dubai team for any real estate inquiry.",
  pathname: "/contact",
  keywords: ["Contact FHI Global", "Dubai real estate support", "developer partnerships Dubai"],
})

const OFFICES = [
  {
    city: "Dubai (HQ)",
    address: "Office 98, 3rd Floor, Rigga Business Center (Ibis Hotel Building), Al Rigga, Deira, Dubai, UAE",
    phone: "+971 56 742 8288",
    email: "info@fhiglobal.ae",
    hours: "Sun–Thu: 9:00 AM – 6:00 PM",
  },
  {
    city: "Abu Dhabi",
    address: "Suite 501, Al Bateen Investment Complex, Abu Dhabi, UAE",
    phone: "+971 56 742 8288",
    email: "abudhabi@fhiglobal.ae",
    hours: "Sun–Thu: 9:00 AM – 6:00 PM",
  },
]

const DEPARTMENTS = [
  {
    icon: Building2,
    name:  "Developer Relations",
    desc:  "Partner with us to list and sell your projects on the FHI Global platform.",
    email: "developers@fhiglobal.ae",
  },
  {
    icon: MessageSquare,
    name:  "Agent Onboarding",
    desc:  "Join our network of high-performing agents across the UAE and beyond.",
    email: "agents@fhiglobal.ae",
  },
  {
    icon: Mail,
    name:  "Press & Media",
    desc:  "Media enquiries, press releases, and partnership announcements.",
    email: "press@fhiglobal.ae",
  },
]

export default function ContactPage() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />


      {/* ── Hero — homepage skyline photo (approved mockup) ──── */}
      <section className="relative pt-20 pb-44 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/background/home.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          {/* Light navy wash for legibility; photo stays bright like the mockup */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/60 via-[#001f3f]/30 to-[#001f3f]/10" />
          {/* Fade into the white content area so the cards overlap the photo */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/40 to-transparent" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/25 rounded-full text-xs font-medium text-white/90 mb-6 backdrop-blur-sm">
            <Headphones className="w-3.5 h-3.5 text-[#d6b357]" />
            We&apos;d love to hear from you
          </div>

          <h1
            className="font-['Outfit'] text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-5"
            style={{ textShadow: "0 2px 30px rgba(0,0,0,0.5)" }}
          >
            Get In{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
              Touch
            </span>
          </h1>

          {/* Gold divider with diamond (mockup) */}
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            <span className="h-px w-24 bg-gradient-to-r from-transparent to-[#d6b357]/80" />
            <span className="w-2 h-2 rotate-45 bg-[#d6b357]" />
            <span className="h-px w-24 bg-gradient-to-l from-transparent to-[#d6b357]/80" />
          </div>

          <p
            className="text-white/90 text-lg md:text-xl max-w-xl mx-auto leading-relaxed"
            style={{ textShadow: "0 1px 12px rgba(0,10,30,0.7)" }}
          >
            Our Dubai-based team is ready to help. Reach out for developer partnerships,
            agent onboarding, or any real estate inquiry.
          </p>
        </div>
      </section>

      {/* ── Main content — cards overlap the hero photo ──────── */}
      <section className="relative z-10 -mt-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">

        {/* ── Left: info panel ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick contact */}
          <div className="bg-gradient-to-br from-[#001f3f] to-[#002a52] rounded-[28px] p-7 relative overflow-hidden ring-1 ring-[#d6b357]/40 shadow-[0_24px_70px_-16px_rgba(0,10,30,0.5)]">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
            <div className="relative space-y-5">
              <div>
                <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-4">Quick Contact</p>
                {[
                  { icon: Phone, label: "Main Office", value: "+971 56 742 8288", sub: "Sun–Thu, 9AM–6PM GST", href: "tel:+971567428288" },
                  { icon: Mail,  label: "Email Us",    value: "info@fhiglobal.ae", sub: "We respond within one business day.", href: "mailto:info@fhiglobal.ae" },
                  { icon: MapPin, label: "HQ Location", value: "Al Rigga, Deira, Dubai, UAE", sub: "Visit our main office", href: "#offices" },
                  { icon: Clock,  label: "Working Hours", value: "Sun–Thu, 9AM–6PM GST", sub: "Friday & Saturday closed" },
                ].map(({ icon: Icon, label, value, sub, href }) => (
                  <div key={label} className="flex items-start gap-4 py-4 border-b border-white/10 last:border-0">
                    <div className="w-12 h-12 rounded-full border-2 border-[#d6b357]/70 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#d6b357]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#d6b357] uppercase tracking-wider mb-0.5">{label}</p>
                      {href ? (
                        <a href={href} className="text-base font-bold text-white hover:text-[#d6b357] transition-colors leading-snug">{value}</a>
                      ) : (
                        <p className="text-base font-bold text-white leading-snug">{value}</p>
                      )}
                      <p className="text-xs text-white/55 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Follow Us</p>
                <div className="flex gap-2">
                  {[
                    { label: "Facebook",  href: "#", icon: <Facebook  className="w-4 h-4" /> },
                    { label: "Instagram", href: "#", icon: <Instagram className="w-4 h-4" /> },
                    { label: "LinkedIn",  href: "#", icon: <Linkedin  className="w-4 h-4" /> },
                    { label: "Twitter",   href: "#", icon: <Twitter   className="w-4 h-4" /> },
                  ].map(({ label, href, icon }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={label}
                      className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 hover:bg-[#d6b357]/20 hover:border-[#d6b357]/40 flex items-center justify-center text-white/50 hover:text-[#d6b357] transition-all"
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Department emails */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] px-1">Departments</p>
            {DEPARTMENTS.map(({ icon: Icon, name, desc, email }) => (
              <div key={name} className="flex items-start gap-4 p-5 bg-white rounded-[20px] border border-[#e8eaed] shadow-sm hover:shadow-md hover:border-[#d6b357]/20 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-[#001f3f]/6 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#001f3f]" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#0d1117] mb-0.5">{name}</p>
                  <p className="text-xs text-[#9ca3af] leading-relaxed mb-2">{desc}</p>
                  <a href={`mailto:${email}`} className="text-xs font-semibold text-[#001f3f] hover:text-[#d6b357] transition-colors group-hover:underline">
                    {email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: form ───────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[28px] border border-[#e8eaed] shadow-[0_24px_70px_-16px_rgba(0,10,30,0.25)] p-8 lg:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] flex items-center justify-center shadow-md shrink-0">
                  <Send className="w-5 h-5 text-[#d6b357]" />
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-0.5">Send us a message</h2>
                  <p className="text-sm text-[#6b7280]">We respond to all enquiries within one business day.</p>
                </div>
              </div>
              {/* Gold hairline with diamond end (mockup) */}
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-px flex-1 bg-gradient-to-r from-[#e8eaed] to-[#d6b357]/60" />
                <span className="w-1.5 h-1.5 rotate-45 bg-[#d6b357]" />
              </div>
            </div>
            <ContactForm />
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#9ca3af]">
              <span className="w-6 h-6 rounded-full bg-[#001f3f]/6 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#001f3f]" />
              </span>
              Your information is secure and will never be shared.
            </p>
          </div>
        </div>
      </section>

      {/* ── Offices ───────────────────────────────────────────── */}
      <section id="offices" className="relative py-16 scroll-mt-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x800/7.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[#f5f3ef]/88" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
              <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Our Offices
            </div>
            <h2 className="font-['Outfit'] text-4xl md:text-5xl font-bold text-[#0d1117] leading-tight tracking-tight">
              Find{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
                Us
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {OFFICES.map(({ city, address, phone, email, hours }) => (
              <div key={city} className="bg-white rounded-[24px] border border-[#e8eaed] p-7 shadow-sm hover:shadow-lg hover:border-[#d6b357]/20 hover:translate-y-[-4px] transition-all duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#002a52] flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#d6b357]" />
                  </div>
                  <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-lg">{city}</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: MapPin, value: address },
                    { icon: Phone,  value: phone,  href: `tel:${phone.replace(/\s/g, "")}` },
                    { icon: Mail,   value: email,  href: `mailto:${email}` },
                    { icon: Clock,  value: hours },
                  ].map(({ icon: Icon, value, href }) => (
                    <div key={value} className="flex items-start gap-3">
                      <Icon className="w-4 h-4 text-[#9ca3af] shrink-0 mt-0.5" />
                      {href ? (
                        <a href={href} className="text-sm text-[#374151] hover:text-[#001f3f] transition-colors">{value}</a>
                      ) : (
                        <span className="text-sm text-[#374151]">{value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative bg-gradient-to-r from-[#001f3f] to-[#002a52] rounded-[28px] overflow-hidden p-10 md:p-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="absolute top-[-40px] left-[-40px] w-[300px] h-[300px] rounded-full opacity-20 blur-[100px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
          <div className="relative">
            <h3
              className="font-['Outfit'] text-3xl md:text-4xl font-bold text-white leading-tight mb-2"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.3)" }}
            >
              Not sure where to start?
            </h3>
            <p className="text-white/55 text-base">
              Book a free 30-minute discovery call with one of our Dubai experts.
            </p>
          </div>
          <div className="relative flex flex-shrink-0 gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] rounded-full font-bold text-sm hover:translate-y-[-2px] hover:shadow-[0_10px_24px_rgba(214,179,87,0.4)] transition-all duration-300"
            >
              Book a Call
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white rounded-full font-semibold text-sm hover:bg-white/15 transition-all"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
