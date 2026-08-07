"use client"

// About — three columns: the framed portrait card (name plate at the bottom),
// the bio with a measured clamp + credential tiles + the dark stats bar, and
// the "Let's Connect" card (message/contact buttons + QR) with socials below.

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  ArrowRight, Building2, Eye, Facebook, FileText, HomeIcon, Instagram,
  Linkedin, MessageCircle, ShieldCheck, Star, Youtube,
} from "lucide-react"
import { BRAND_GRADIENT, DEFAULT_WA_MESSAGE, GOLD, GOLD_A40, GOLD_A50, GOLD_A60, GOLD_SOFT, GOLD_SOFT_A80, IMG, INK, NAVY, SAMPLE_DATA, type WebsiteData } from "../../_data"
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
  // The truncation is measured, not fixed: the bio fills whatever space
  // remains above the pinned credentials/stats group. Instead of a clamp +
  // overlay, the string itself is CUT (binary search against a hidden
  // measurer) so it ends in "…" with an inline "Show more" after it — plain
  // text flow, nothing painted over the photo background. The measurer
  // includes a small buffer so the button never crowds the last line.
  const BIO_LINE_H = 23.5 // 14.5px × leading-relaxed (1.625)
  // Non-breaking spaces: HTML collapses normal ones, these measure for real.
  const BIO_GAP = "\u00A0\u00A0" // gap between the "…" and the button
  const BIO_SUFFIX = `…${BIO_GAP}Show more${"\u00A0".repeat(5)}` // ~5-char safety buffer
  const [bioEl, setBioEl] = useState<HTMLDivElement | null>(null)
  const [measureEl, setMeasureEl] = useState<HTMLParagraphElement | null>(null)
  // null = the whole bio fits, no truncation needed.
  const [bioCut, setBioCut] = useState<number | null>(null)
  const bio = about.bio
  useEffect(() => {
    if (!bioEl || !measureEl) return
    const compute = () => {
      if (bioEl.clientHeight <= 0) return
      // +6px tolerance: a line that ALMOST fits still counts, so the slack
      // under the last line stays smaller than a full row.
      const lines = Math.max(2, Math.floor((bioEl.clientHeight + 6) / BIO_LINE_H))
      const maxH = lines * BIO_LINE_H + 2
      measureEl.textContent = bio
      if (measureEl.scrollHeight <= maxH) {
        setBioCut(null)
        return
      }
      let lo = 0
      let hi = bio.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        measureEl.textContent = bio.slice(0, mid).trimEnd() + BIO_SUFFIX
        if (measureEl.scrollHeight <= maxH) lo = mid
        else hi = mid - 1
      }
      setBioCut(lo)
    }
    const ro = new ResizeObserver(compute)
    ro.observe(bioEl)
    return () => ro.disconnect()
    // BIO_SUFFIX is a render-constant string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioEl, measureEl, bio])

  const socials = [
    { icon: Facebook, label: "Facebook", href: about.socials.facebook },
    { icon: Instagram, label: "Instagram", href: about.socials.instagram },
    { icon: Linkedin, label: "LinkedIn", href: about.socials.linkedin },
    { icon: Youtube, label: "YouTube", href: about.socials.youtube },
  ]

  const credentials = [
    { icon: ShieldCheck, label: "RERA Licensed Broker", value: `BRN: ${agent.brn}` },
    { icon: Building2, label: "Brokerage", value: agent.brokerage },
    { icon: FileText, label: "Office Registration", value: `ORN: ${agent.orn}` },
  ]

  return (
    <section id="about" className="relative scroll-mt-[72px] overflow-hidden">
      {/* Background — the homepage "We connect serious investors" skyline photo
          under a soft white wash. */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG.skylineB} alt="" aria-hidden className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/75" />
      </div>
      {/* Right column = the socials row width (4 × 44px + 3 × 12px = 212px) plus its 4rem gap margin */}
      {/* Breakpoints: <900px one column; 900–1200px portrait+copy side by side
          with Let's Connect below (its own two columns); ≥1200px three columns
          with the About↔Connect gap growing with the viewport. */}
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-stretch gap-10 px-5 py-16 sm:px-8 min-[900px]:grid-cols-[minmax(0,380px)_1fr] min-[1200px]:grid-cols-[380px_1fr_276px]">
        {/* Portrait card — gold-framed, name plate over a bottom fade */}
        <div
          className="relative min-h-[420px] overflow-hidden border shadow-[0_24px_60px_-24px_rgba(13,27,46,0.45)] min-[900px]:min-h-[540px]"
          style={{ backgroundColor: INK, borderColor: GOLD_A60 }}
        >
          {about.portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={about.portrait}
              alt={agent.name}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-7 pb-6 pt-4">
            <p className="mt-1.5 text-[13px] font-bold uppercase tracking-[0.24em] text-white/85">{agent.name}</p>
          </div>
        </div>

        {/* Copy + credentials + stats — capped at the portrait's height.
            Collapsed: clamped bio + the pinned credentials/stats group.
            Expanded: the group hides and the full bio scrolls instead. */}
        <div className="flex flex-col min-[900px]:h-[540px] min-[900px]:overflow-hidden">
          <div className="flex items-center gap-4">
            <Eyebrow>About Me</Eyebrow>
            <span className="h-px w-14" style={{ backgroundColor: GOLD }} />
          </div>
          <h2 className="mt-3 whitespace-pre-line font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
            {about.heading}
          </h2>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
            <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
            <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
          </div>

          {aboutExpanded ? (
            <>
              <div className="mt-4 max-h-[320px] min-h-0 flex-1 overflow-y-auto pr-2 min-[900px]:max-h-none">
                <p className="whitespace-pre-line text-justify text-[14.5px] leading-relaxed text-[#3d4451]">{about.bio}</p>
              </div>
              <div className="mt-2 flex justify-end">
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
              {/* Fills the space above the pinned group; the text itself is
                  cut so "Show more" flows inline after the "…" — no overlay. */}
              {/* On mobile the column has no fixed height, so the bio gets an
                  explicit cap (~8 lines) for the truncation to measure against. */}
              <div ref={setBioEl} className="relative mt-4 max-h-[188px] min-h-0 flex-1 overflow-hidden min-[900px]:max-h-none">
                {/* Hidden measurer — same width/typography as the real text */}
                <p
                  ref={setMeasureEl}
                  aria-hidden
                  className="pointer-events-none invisible absolute inset-x-0 top-0 text-justify text-[14.5px] leading-relaxed"
                />
                <p className="text-justify text-[14.5px] leading-relaxed text-[#3d4451]">
                  {bioCut === null ? (
                    bio
                  ) : (
                    <>
                      {bio.slice(0, bioCut).trimEnd()}…{BIO_GAP}
                      <button
                        type="button"
                        onClick={() => setAboutExpanded(true)}
                        className="text-[13px] font-bold hover:underline"
                        style={{ color: GOLD }}
                      >
                        Show more
                      </button>
                    </>
                  )}
                </p>
              </div>

              {/* Credential tiles + the dark stats bar — pinned to the bottom */}
              <div className="mt-auto pt-4">
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  {credentials.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3.5">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center border bg-white"
                        style={{ borderColor: GOLD_A40, color: GOLD }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-bold uppercase tracking-[0.06em]" style={{ color: NAVY }}>{label}</span>
                        <span className="block truncate text-[13px] text-[#6b7280]">{value}</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center">
                    <span
                      className="group inline-flex cursor-pointer items-center gap-2 border bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.12em]"
                      style={{ borderColor: GOLD_A60, color: GOLD_SOFT }}
                    >
                      View Agent Profile
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45" />
                    </span>
                  </div>
                </div>

                {/* Stats bar */}
                <div
                  className="mt-6 flex flex-wrap items-center justify-start gap-x-6 gap-y-4 border px-8 py-5"
                  style={{ background: BRAND_GRADIENT, borderColor: GOLD_A50 }}
                >
                  {/* Placeholder "-" for now — these will be automated from
                      real data (view tracking, listing counts, ratings). */}
                  {[
                    { icon: Eye, value: "-", label: "Views" },
                    { icon: HomeIcon, value: "-", label: "Listings" },
                    { icon: Star, value: "-", label: "Rating" },
                  ].map(({ icon: Icon, value, label }, i, arr) => (
                    <div key={label} className="flex flex-1 items-center justify-start gap-3.5" style={i < arr.length - 1 ? { borderRight: "1px solid rgba(255,255,255,0.12)" } : undefined}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: GOLD_A60, color: GOLD }}>
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                      </span>
                      <span>
                        <span className="block text-[22px] font-bold leading-tight text-white">{value}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_SOFT_A80 }}>{label}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Let's Connect — no card chrome, content sits on the section bg.
            <900px: stacked below everything, centered at the socials width.
            900–1200px: spans the full row below portrait+copy, split into two
            columns — Let's Connect | Scan to Connect.
            ≥1200px: its own third column; the left gap grows with viewport. */}
        <div className="flex min-[900px]:col-span-2 min-[1200px]:col-span-1 min-[1200px]:ml-4 min-[1300px]:ml-10 min-[1400px]:ml-16">
          <div className="mx-auto grid w-full max-w-[280px] flex-1 grid-cols-1 gap-6 pt-2 text-center min-[900px]:max-w-[680px] min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-12 min-[1200px]:mx-0 min-[1200px]:max-w-none min-[1200px]:grid-cols-1 min-[1200px]:gap-6">
            {/* Let's Connect — heading, blurb, Message Me */}
            <div className="flex flex-col items-center">
              <p className="mt-4 font-serif text-[26px] font-bold tracking-tight" style={{ color: NAVY }}>
                Let&apos;s Connect
              </p>
              <div className="mt-2.5 flex w-full items-center justify-center gap-2">
                <span className="h-px w-12" style={{ backgroundColor: GOLD_A50 }} />
                <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
                <span className="h-px w-12" style={{ backgroundColor: GOLD_A50 }} />
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[#5b6472]">
                I&apos;m here to help you find the perfect property in Dubai.
              </p>
              <a
                href={`https://wa.me/${agent.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(DEFAULT_WA_MESSAGE)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex w-full items-center justify-center px-5 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-white transition-transform hover:-translate-y-0.5"
                style={{ background: BRAND_GRADIENT }}
              >
                <MessageCircle className="h-4.5 w-4.5" />
                <span className="pl-2">Message Me</span>
              </a>
            </div>

            {/* Scan to Connect — QR + socials */}
            <div className="flex flex-col items-center">
              <div className="flex w-full items-center gap-3">
                <span className="h-px flex-1" style={{ backgroundColor: GOLD_A40 }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Scan to Connect</span>
                <span className="h-px flex-1" style={{ backgroundColor: GOLD_A40 }} />
              </div>
              <div className="mt-4 border bg-white p-3" style={{ borderColor: GOLD_A60 }}>
                <QRCodeSVG value={qrValue} size={128} fgColor={NAVY} bgColor="transparent" />
              </div>

              {/* Socials — white circles directly below the QR */}
              <div className="mt-5 flex items-center justify-center gap-3">
                {socials.map(({ icon: Icon, label, href }) => {
                  const cls =
                    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white shadow-[0_10px_24px_-10px_rgba(13,27,46,0.35)] transition-colors hover:bg-[#faf5e8]"
                  const inner = <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  return href ? (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls} style={{ color: NAVY }}>
                      {inner}
                    </a>
                  ) : (
                    <span key={label} aria-label={label} className={cls} style={{ color: NAVY }}>
                      {inner}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
