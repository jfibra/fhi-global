import type { Metadata } from "next"
import Image from "next/image"
import { ContactForm } from "./contact-form"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList, realEstateAgentOfficeSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { MapPin, Phone, Mail, Clock, Building2, Send, ArrowRight } from "lucide-react"

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

export default function ContactPage() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Both physical offices as RealEstateAgent entities — the addresses,
          phones, and hours below are the same facts, made machine-readable. */}
      <JsonLd
        schema={[
          ...OFFICES.map((o) =>
            realEstateAgentOfficeSchema({ city: o.city, address: o.address, phone: o.phone, email: o.email }),
          ),
          breadcrumbList([{ name: "Home", path: "/" }, { name: "Contact" }]),
        ]}
      />

      {/* ── Masthead — light editorial header, the same design language as
             the project and search pages: navy type on white, gold caps
             labels with hairline dividers, the skyline filling the right
             half. The old page's separate Quick Contact card lives here now,
             as the fact columns. ── */}
      <section className="relative overflow-hidden bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 lg:pr-[46%] lg:min-h-[360px]">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Contact Us
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold text-[#001f3f] leading-[1.08]">
            Get in Touch
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-xl">
            Our Dubai-based team is ready to help — developer partnerships, agent onboarding, or any
            real estate inquiry. We respond within one business day.
          </p>

          {/* The skyline — right half on desktop, after the title on mobile. */}
          <div className="relative mt-6 aspect-[16/10] bg-[#001f3f] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[56%] lg:z-10 lg:mt-0 lg:aspect-auto">
            <Image
              src="/background/dubai.webp"
              alt="Dubai skyline"
              fill
              priority
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="object-cover"
            />
          </div>

          {/* Contact columns — this page's quick facts. */}
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              {
                label: "Call Us",
                node: (
                  <a href="tel:+971567428288" className="hover:text-[#b8913f] transition-colors">
                    +971 56 742 8288
                  </a>
                ),
              },
              {
                label: "Email Us",
                node: (
                  <a href="mailto:info@fhiglobal.ae" className="hover:text-[#b8913f] transition-colors">
                    info@fhiglobal.ae
                  </a>
                ),
              },
              {
                label: "Visit Us",
                node: (
                  <a href="#offices" className="hover:text-[#b8913f] transition-colors">
                    Al Rigga, Deira, Dubai
                  </a>
                ),
              },
              { label: "Office Hours", node: "Sun–Thu · 9AM–6PM" },
            ].map((f) => (
              <div
                key={f.label}
                className="sm:max-w-[250px] sm:pr-7 sm:mr-7 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                  {f.label}
                </dt>
                <dd className="text-[15px] font-semibold text-[#001f3f] leading-snug">{f.node}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Form + right rail — the message form is the page's main event;
             offices and department inboxes support it from the side. ── */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-2 bg-white border border-[#e5e8ec] p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 bg-[#001f3f] flex items-center justify-center shrink-0">
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

        <div className="space-y-10">
          {/* Offices */}
          <div id="offices" className="scroll-mt-24">
            <p className="font-['Outfit'] text-[13px] font-bold uppercase tracking-[0.16em] text-[#0d1117] mb-3">
              Our Offices
            </p>
            <div className="space-y-4">
              {OFFICES.map(({ city, address, phone, email, hours }) => (
                <div key={city} className="bg-white border border-[#e5e8ec] p-6">
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

          {/* Departments — one row per desk, straight to the right inbox. */}
          <div>
            <p className="font-['Outfit'] text-[13px] font-bold uppercase tracking-[0.16em] text-[#0d1117] mb-3">
              Reach the Right Team
            </p>
            <div className="bg-white border border-[#e5e8ec] divide-y divide-[#eef0f3]">
              {DEPARTMENTS.map(({ name, desc, email }) => (
                <a
                  key={name}
                  href={`mailto:${email}`}
                  className="group flex items-center gap-4 p-5 hover:bg-[#faf9f6] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-['Outfit'] text-[15px] font-bold text-[#001f3f]">{name}</p>
                    <p className="text-xs text-[#6b7280] leading-relaxed mt-0.5">{desc}</p>
                    <p className="text-xs font-bold text-[#b8913f] mt-1.5 group-hover:underline">{email}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#001f3f] shrink-0 transition-transform group-hover:translate-x-1" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
