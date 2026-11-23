"use client"

// The agent's website drawn by the real template components (the same ones
// /website/<slug> renders) at a 1440 px desktop width, scaled to fit its box
// and scrolled inside it — no iframe (the site sends frame-ancestors 'none').
// Used by My Website (the saved site). A copy of the Website Builder's own
// LivePreview (website-builder-client.tsx), which is left as it is.

import { useEffect, useState } from "react"
import { themeVars, type Testimonial, type WebsiteData } from "@/app/website/_data"
import { SiteHeader } from "@/app/website/_components/header"
import { SiteFooter } from "@/app/website/_components/footer"
import { HeroSection } from "@/app/website/_components/sections/hero"
import { AboutSection } from "@/app/website/_components/sections/about"
import { FeaturedSection } from "@/app/website/_components/sections/featured"
import { ServiceAreasSection } from "@/app/website/_components/sections/service-areas"
import { GallerySection } from "@/app/website/_components/sections/gallery"
import { TestimonialsSection } from "@/app/website/_components/sections/what-my-clients-say"

export const VIRTUAL_WIDTH = 1440

// ─── Live preview ─────────────────────────────────────────────────────────────

/** A scroll request: the template anchor id plus a counter so re-clicking the
 *  same section still scrolls. */
export type PreviewTarget = { id: string; n: number }

/** Template anchors in page order — used by the scroll spy. */
const SPY_ANCHORS = ["home", "about", "projects", "properties", "stats", "areas", "gallery", "reviews", "contact"] as const

export function LivePreview({
  data,
  reviews,
  target,
  onSectionInView,
  qrValue,
}: {
  data: WebsiteData
  /** The agent's approved client reviews — none hides the section, as on the live site. */
  reviews: Testimonial[]
  target: PreviewTarget | null
  /** Fires with the anchor id of the section currently at the top of the preview. */
  onSectionInView?: (anchor: string) => void
  /** The live site's QR code target (About section); the builder leaves it to the template. */
  qrValue?: string
}) {
  const [outerEl, setOuterEl] = useState<HTMLDivElement | null>(null)
  const [innerEl, setInnerEl] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)
  const [innerH, setInnerH] = useState(5000)

  // Scroll the preview to the section that's being edited. Rect math is in
  // post-transform (scaled) coordinates, so no manual scale factor needed.
  useEffect(() => {
    if (!target || !outerEl || !innerEl) return
    const el = innerEl.querySelector(`#${target.id}`)
    if (!el) return
    const top = el.getBoundingClientRect().top - outerEl.getBoundingClientRect().top + outerEl.scrollTop
    outerEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    // outerEl/innerEl are stable refs; only a new click should re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  useEffect(() => {
    if (!outerEl) return
    const ro = new ResizeObserver(() => {
      if (outerEl.clientWidth > 0) setScale(outerEl.clientWidth / VIRTUAL_WIDTH)
    })
    ro.observe(outerEl)
    return () => ro.disconnect()
  }, [outerEl])

  useEffect(() => {
    if (!innerEl) return
    const ro = new ResizeObserver(() => {
      if (innerEl.offsetHeight > 0) setInnerH(innerEl.offsetHeight)
    })
    ro.observe(innerEl)
    return () => ro.disconnect()
  }, [innerEl])

  // Scroll spy — report which section is at the top of the preview so the
  // form can follow along. Rect math is post-transform, so scale-safe.
  useEffect(() => {
    if (!outerEl || !innerEl || !onSectionInView) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const outerTop = outerEl.getBoundingClientRect().top
        let current: string = SPY_ANCHORS[0]
        for (const id of SPY_ANCHORS) {
          const el = innerEl.querySelector(`#${id}`)
          if (el && el.getBoundingClientRect().top - outerTop <= 140) current = id
        }
        onSectionInView(current)
      })
    }
    outerEl.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      outerEl.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [outerEl, innerEl, onSectionInView])

  return (
    <div ref={setOuterEl} className="h-full overflow-y-auto overflow-x-hidden bg-[#dfe4ea]">
      <div style={{ height: innerH * scale }} className="relative">
        <div ref={setInnerEl} style={{ width: VIRTUAL_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left", ...themeVars(data.theme) }}>
          <SiteHeader sticky={false} data={data} showReviews={reviews.length > 0} />
          <HeroSection data={data} />
          <AboutSection data={data} qrValue={qrValue} />
          {/* Listings and the stats band are off for now — projects only (as on the live site). */}
          <FeaturedSection data={{ ...data, properties: [] }} />
          <ServiceAreasSection data={data} />
          <GallerySection data={data} />
          <TestimonialsSection testimonials={reviews} />
          <SiteFooter data={data} />
        </div>
      </div>
    </div>
  )
}
