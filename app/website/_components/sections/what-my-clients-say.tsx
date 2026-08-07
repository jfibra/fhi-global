"use client"

// Client testimonials — 3 visible, auto-advancing one card at a time and
// sliding back to the start after the last position; dot indicators below.

import { useEffect, useState } from "react"
import { GOLD, NAVY, SAMPLE_DATA, type WebsiteData } from "../../_data"
import { TestimonialCard } from "../cards"
import { Eyebrow } from "../ui"

export function TestimonialsSection({ data = SAMPLE_DATA }: { data?: WebsiteData }) {
  const testimonials = data.testimonials
  // 3 cards per view on sm+ screens, 1 on phones — the slide step and dot
  // count both depend on it, so it's tracked from the same breakpoint the
  // card widths use (sm:w-1/3).
  const [perView, setPerView] = useState(3)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => setPerView(mq.matches ? 3 : 1)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const positions = Math.max(1, testimonials.length - perView + 1)
  const [reviewIdx, setReviewIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setReviewIdx((i) => (i + 1) % positions), 3500)
    return () => clearInterval(id)
  }, [positions])

  return (
    <section id="reviews" className="scroll-mt-[72px] bg-white">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
      <Eyebrow center>Client Testimonials</Eyebrow>
      <h2 className="mt-3 text-center font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: NAVY }}>
        What My Clients Say
      </h2>
      <div className="mx-auto mt-4 flex items-center justify-center gap-2">
        <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
        <span className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: GOLD }} />
        <span className="h-px w-10" style={{ backgroundColor: GOLD }} />
      </div>
      <div className="mt-10 overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${Math.min(reviewIdx, positions - 1) * (100 / perView)}%)` }}
        >
          {testimonials.map((t, i) => (
            <div key={`${t.name}-${i}`} className="w-full shrink-0 px-2.5 sm:w-1/3">
              <TestimonialCard testimonial={t} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        {Array.from({ length: positions }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show reviews from position ${i + 1}`}
            onClick={() => setReviewIdx(i)}
            className="h-2 w-2 rounded-full transition-colors"
            style={{ backgroundColor: i === reviewIdx ? GOLD : "#ded8c8" }}
          />
        ))}
      </div>
      </div>
    </section>
  )
}
