import type { Metadata } from "next"
import Image from "next/image"
import { ContactForm } from "./contact-form"
import { createPageMetadata } from "@/lib/seo"
import { MapPin, Phone, Mail, Clock, Building2, Send } from "lucide-react"

export const metadata: Metadata = createPageMetadata({
  title: "Contact Us — Get in Touch",
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

/** Routing addresses, so an enquiry reaches the right desk without the form. */
const DEPARTMENTS = [
  { name: "Developer Relations", desc: "List and sell your projects with us.", email: "developers@fhiglobal.ae" },
  { name: "Agent Onboarding", desc: "Join our agent network across the UAE.", email: "agents@fhiglobal.ae" },
  { name: "Press & Media", desc: "Media enquiries and announcements.", email: "press@fhiglobal.ae" },
]

const QUICK_CONTACT = [
  {
    icon: Phone,
    label: "Main Office",
    value: "+971 56 742 8288",
    sub: "Sun–Thu, 9AM–6PM GST",
    href: "tel:+971567428288",
  },
  {
    icon: Mail,
    label: "Email Us",
    value: "info@fhiglobal.ae",
    sub: "We respond within one business day.",
    href: "mailto:info@fhiglobal.ae",
  },
  {
    icon: MapPin,
    label: "HQ Location",
    value: "Al Rigga, Deira, Dubai, UAE",
    sub: "Visit our main office",
    href: "#offices",
  },
]

export default function ContactPage() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative bg-[#f7f5f1] border-b border-[#ebe7e0] overflow-hidden">
        {/* Skyline kept faint and to the right: texture behind the headline,
            not a photo competing with it. */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[58%] opacity-[0.16]" aria-hidden="true">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f7f5f1] via-[#f7f5f1]/50 to-transparent" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16 text-center">
          <h1 className="font-['Outfit'] text-4xl md:text-[52px] font-bold leading-[1.05] tracking-tight">
            <span className="text-[#001f3f]">Get In </span>
            <span className="text-[#d6b357]">Touch</span>
          </h1>
          <span className="block w-16 h-[3px] bg-[#d6b357] mx-auto my-5" aria-hidden="true" />
          <p className="text-[#5f6368] text-[15px] leading-relaxed max-w-lg mx-auto">
            Our Dubai-based team is ready to help. Reach out for developer partnerships, agent
            onboarding, or any real estate inquiry.
          </p>
        </div>
      </section>

      {/* ── Quick contact + form ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6 items-start">
        <div className="bg-white border border-[#e5e8ec] p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-5">
            Quick Contact
          </p>
          <div className="space-y-1">
            {QUICK_CONTACT.map(({ icon: Icon, label, value, sub, href }) => (
              <div
                key={label}
                className="flex items-start gap-4 py-4 border-b border-[#f0f0f0] last:border-0"
              >
                <span className="w-11 h-11 rounded-full bg-[#001f3f] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-[#d6b357]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] mb-1">
                    {label}
                  </p>
                  <a
                    href={href}
                    className="block font-['Outfit'] text-[15px] font-bold text-[#001f3f] leading-snug hover:text-[#b8913f] transition-colors"
                  >
                    {value}
                  </a>
                  <p className="text-xs text-[#9ca3af] mt-1 leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#e5e8ec] p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-full bg-[#001f3f] flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-[#d6b357]" />
            </span>
            <div>
              <h2 className="font-['Outfit'] text-xl font-bold text-[#001f3f] leading-tight">
                Send us a message
              </h2>
              <p className="text-[13px] text-[#6b7280] mt-0.5">
                We respond to all enquiries within one business day.
              </p>
            </div>
          </div>
          <span className="block h-[2px] bg-[#d6b357] mt-5 mb-7" aria-hidden="true" />
          <ContactForm />
        </div>
      </section>

      {/* ── Offices ── */}
      <section id="offices" className="scroll-mt-24 bg-white border-y border-[#ebedf0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.16em] text-[#001f3f]">
            Our offices
          </h2>
          <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5 mb-7" aria-hidden="true" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {OFFICES.map(({ city, address, phone, email, hours }) => (
              <div key={city} className="border border-[#e5e8ec] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-9 h-9 bg-[#001f3f] flex items-center justify-center shrink-0">
                    <Building2 className="w-[18px] h-[18px] text-[#d6b357]" />
                  </span>
                  <h3 className="font-['Outfit'] text-base font-bold text-[#001f3f]">{city}</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { icon: MapPin, value: address },
                    { icon: Phone, value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
                    { icon: Mail, value: email, href: `mailto:${email}` },
                    { icon: Clock, value: hours },
                  ].map(({ icon: Icon, value, href }) => (
                    <div key={value} className="flex items-start gap-3">
                      <Icon className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
                      {href ? (
                        <a href={href} className="text-sm text-[#4b5563] hover:text-[#001f3f] transition-colors">
                          {value}
                        </a>
                      ) : (
                        <span className="text-sm text-[#4b5563] leading-relaxed">{value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Departments ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h2 className="font-['Outfit'] text-sm font-bold uppercase tracking-[0.16em] text-[#001f3f]">
          Reach the right team
        </h2>
        <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5 mb-7" aria-hidden="true" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {DEPARTMENTS.map(({ name, desc, email }) => (
            <a
              key={name}
              href={`mailto:${email}`}
              className="group bg-white border border-[#e5e8ec] p-5 hover:border-[#d6b357] transition-colors"
            >
              <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{name}</p>
              <p className="text-xs text-[#6b7280] leading-relaxed mt-1.5 mb-3">{desc}</p>
              <span className="text-xs font-bold text-[#b8913f] group-hover:underline">{email}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
