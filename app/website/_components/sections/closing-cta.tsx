// Closing CTA — navy skyline band with consultation buttons and the white
// contact card (phone / email / office).

import { CalendarCheck, Landmark, Mail, Phone } from "lucide-react"
import { GOLD, GOLD_GRADIENT, GOLD_TINT, IMG, INK, NAVY, SAMPLE_DATA, type WebsiteData } from "../../_data"

export function ClosingCtaSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  const { agent, cta } = data
  return (
    <section id="contact" className="relative scroll-mt-[72px] overflow-hidden" style={{ backgroundColor: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG.skylineA} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {cta.heading}
          </h2>
          <p className="mt-3 text-[14px] text-white/70">{cta.sub}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${agent.email}`}
              className="inline-flex items-center gap-2 px-6 py-3 text-[13px] font-bold"
              style={{ background: GOLD_GRADIENT, color: INK }}
            >
              <CalendarCheck className="h-4 w-4" /> Book a Consultation
            </a>
            <a href={`tel:${agent.phone}`} className="inline-flex items-center gap-2 border border-white/30 px-6 py-3 text-[13px] font-bold text-white hover:bg-white/10">
              <Phone className="h-4 w-4" /> Contact Me
            </a>
          </div>
        </div>
        <div className="bg-white p-5">
          <div className="space-y-4">
            {[
              { icon: Phone, label: "Phone", value: agent.phone, href: `tel:${agent.phone}` },
              { icon: Mail, label: "Email", value: agent.email, href: `mailto:${agent.email}` },
              { icon: Landmark, label: "Office", value: agent.office },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: GOLD_TINT, color: GOLD }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#9aa0aa]">{label}</span>
                  {href ? (
                    <a href={href} className="block truncate text-[13px] font-semibold" style={{ color: NAVY }}>
                      {value}
                    </a>
                  ) : (
                    <span className="block truncate text-[13px] font-semibold" style={{ color: NAVY }}>
                      {value}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
