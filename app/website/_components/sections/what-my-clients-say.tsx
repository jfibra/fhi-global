"use client"

// Client testimonials — 3 visible, auto-advancing one card at a time and
// sliding back to the start after the last position; dot indicators below.

import { useEffect, useState } from "react"
import { GOLD, NAVY, TESTIMONIALS } from "../../_data"
import { TestimonialCard } from "../cards"
import { Eyebrow } from "../ui"

export function TestimonialsSection() {
  const positions = Math.max(1, TESTIMONIALS.length - 2)
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
          style={{ transform: `translateX(-${reviewIdx * (100 / 3)}%)` }}
        >
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="w-full shrink-0 px-2.5 sm:w-1/3">
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
