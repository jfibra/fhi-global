"use client"

// About — portrait, bio with a measured clamp (fills the space above the
// pinned credentials/stats group; "Show more" swaps to a scrollable full bio
// that never exceeds the portrait height), and the QR + socials rail.

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, Eye, Facebook, HomeIcon, Instagram, Linkedin, Star, Youtube } from "lucide-react"
import { GOLD, INK, NAVY, SAMPLE_DATA, script, type WebsiteData } from "../../_data"
import { Eyebrow } from "../ui"

export function AboutSection({
  data = SAMPLE_DATA,
  qrValue = "https://fhiglobal.ae/website/sample",
}: {
  data?: WebsiteData
  /** What the "Scan to Connect" QR encodes — the site's own public URL. */
  qrValue?: string
}) {
  const { agent, about } = data
  const [aboutExpanded, setAboutExpanded] = useState(false)
  // The clamp is measured, not fixed: the bio fills whatever space remains
  // above the pinned credentials/stats group, clamped to whole lines.
  const BIO_LINE_H = 23.5 // 14.5px × leading-relaxed (1.625)
  const [bioEl, setBioEl] = useState<HTMLDivElement | null>(null)
  const [bioLines, setBioLines] = useState(3)
  useEffect(() => {
    if (!bioEl) return
    const ro = new ResizeObserver(() => {
      // +6px tolerance: a line that ALMOST fits still counts, so the slack
      // under the last line stays smaller than a full row.
      if (bioEl.clientHeight > 0) setBioLines(Math.max(2, Math.floor((bioEl.clientHeight + 6) / BIO_LINE_H)))
    })
    ro.observe(bioEl)
    return () => ro.disconnect()
  }, [bioEl])

  const socials = [
    { icon: Facebook, label: "Facebook", href: about.socials.facebook },
    { icon: Instagram, label: "Instagram", href: about.socials.instagram },
    { icon: Linkedin, label: "LinkedIn", href: about.socials.linkedin },
    { icon: Youtube, label: "YouTube", href: about.socials.youtube },
  ]

  return (
    <section id="about" className="scroll-mt-[72px] bg-white">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[380px_1fr_190px]">
        {/* Portrait */}
        <div className="relative h-[420px] overflow-hidden" style={{ backgroundColor: INK }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={about.portrait}
            alt={agent.name}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
          <p className="absolute bottom-5 left-5 text-2xl" style={{ ...script, color: GOLD }}>
            {agent.name}
          </p>
        </div>

        {/* Copy + credentials — capped at the portrait's height (420px).
            Collapsed: clamped bio + the credentials/stats group.
            Expanded: the group hides and the full bio scrolls instead. */}
        <div className="flex flex-col lg:h-[420px] lg:overflow-hidden">
          <Eyebrow>About me</Eyebrow>
          <h2 className="mt-2 whitespace-pre-line font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            {about.heading}
          </h2>

          {aboutExpanded ? (
            <>
              <div className="mt-4 min-h-0 max-w-lg flex-1 overflow-y-auto pr-2">
                <p className="whitespace-pre-line text-justify text-[14.5px] leading-relaxed text-[#3d4451]">{about.bio}</p>
              </div>
              <div className="mt-2 flex max-w-lg justify-end">
                <button
                  type="button"
                  onClick={() => setAboutExpanded(false)}
                  className="text-[13px] font-bold hover:underline"
                  style={{ color: GOLD }}
                >
                  Show less
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Fills the space above the pinned group; the clamp is
                  measured from the container height. "Show more" overlays
                  the end of the last visible line. */}
              <div ref={setBioEl} className="relative mt-3 min-h-0 max-w-lg flex-1 overflow-hidden">
                <p
                  className="text-justify text-[14.5px] leading-relaxed text-[#3d4451]"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: bioLines,
                    overflow: "hidden",
                  }}
                >
                  {about.bio}
                </p>
                <button
                  type="button"
                  onClick={() => setAboutExpanded(true)}
                  className="absolute right-0 pl-10 text-[13px] font-bold hover:underline"
                  style={{
                    top: `${(bioLines - 1) * BIO_LINE_H}px`,
                    lineHeight: `${BIO_LINE_H}px`,
                    color: GOLD,
                    background: "linear-gradient(90deg, rgba(255,255,255,0), #ffffff 32%)",
                  }}
                >
                  Show more
                </button>
              </div>

              {/* Credentials + stats — one group pinned to the photo's bottom edge; hidden while expanded */}
              <div className="mt-auto pt-2">
                <div className="grid max-w-lg grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
                  {[
                    { label: "RERA Licensed Broker", value: `BRN: ${agent.brn}` },
                    { label: "Brokerage", value: agent.brokerage },
                    { label: "Office Registration", value: `ORN: ${agent.orn}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
                      <span>
                        <span className="block text-[12px] font-bold" style={{ color: NAVY }}>{label}</span>
                        <span className="block text-[12px] leading-relaxed text-[#6b7280]">{value}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 max-w-lg border-t border-[#eceadf]" />
                <div className="mt-3 flex flex-wrap items-center gap-x-10 gap-y-4">
                  {[
                    { icon: Eye, value: about.views, label: "Views" },
                    { icon: HomeIcon, value: about.listings, label: "Listings" },
                    { icon: Star, value: about.rating, label: "Rating" },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#faf5e8", color: GOLD }}>
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <span>
                        <span className="block text-[18px] font-bold leading-tight" style={{ color: NAVY }}>{value}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa0aa]">{label}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* QR + socials */}
        <div className="hidden flex-col gap-4 lg:flex">
          <div className="flex flex-col items-center gap-3 border border-[#eceadf] bg-[#fbfaf7] p-5">
            <QRCodeSVG value={qrValue} size={130} fgColor={NAVY} bgColor="transparent" />
            <p className="text-[11px] font-semibold text-[#6b7280]">Scan to Connect</p>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            {socials.map(({ icon: Icon, label, href }) => {
              const cls =
                "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#e3ddcd] bg-white transition-colors hover:bg-[#faf5e8]"
              return href ? (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls} style={{ color: NAVY }}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </a>
              ) : (
                <span key={label} aria-label={label} className={cls} style={{ color: NAVY }}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
