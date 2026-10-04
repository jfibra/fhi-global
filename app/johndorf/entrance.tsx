"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { Bath, BedDouble, Home, MapPin, Trees, Waves } from "lucide-react"

/**
 * The entrance to the Johndorf presentation: Montierra's photos drift and
 * cross-fade behind the project's headline facts (as published at launch),
 * with the sign-in card beside them. On phones the photos become a hero above
 * the card.
 */

const SLIDES = [
  { src: "/johndorf/houses/townhouse-peach.jpg", caption: "Two-storey townhomes in three colour schemes" },
  { src: "/johndorf/houses/pool.jpg", caption: "Clubhouse with a swimming pool" },
  { src: "/johndorf/houses/green.jpg", caption: "Finished streets at Montierra" },
  { src: "/johndorf/houses/amenities.jpg", caption: "Landscaped entrance and parks" },
  { src: "/johndorf/houses/gate.jpg", caption: "Main gate and guardhouse" },
]
const HOLD_MS = 5500
const ease = [0.22, 1, 0.36, 1] as const

const FACTS = [
  { icon: Home, value: "600", label: "Townhomes" },
  { icon: BedDouble, value: "3", label: "Bedrooms" },
  { icon: Bath, value: "2", label: "Toilet & bath" },
  { icon: Waves, value: "Pool", label: "Clubhouse" },
  { icon: Trees, value: "26", label: "Parks" },
]

export function Entrance({ children }: { children: React.ReactNode }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), HOLD_MS)
    return () => clearInterval(t)
  }, [])
  const slide = SLIDES[i]

  return (
    <main className="relative min-h-screen lg:grid lg:grid-cols-[1.2fr_minmax(420px,0.8fr)]">
      {/* ── The pictures ── */}
      <section className="relative h-[46vh] min-h-[340px] overflow-hidden bg-[#2a1d1b] text-white lg:h-auto lg:min-h-screen">
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.src}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image src={slide.src} alt={slide.caption} fill priority={i === 0} sizes="(min-width: 1024px) 60vw, 100vw" className="jd-kenburns object-cover" />
          </motion.div>
        </AnimatePresence>
        {/* readable text over any photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0d] via-[#1a0f0d]/45 to-[#1a0f0d]/10" />
        <div className="absolute inset-x-0 top-0 h-1 bg-[#b4241c]" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-14">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease }}
            className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#e6a39e]"
          >
            Johndorf Ventures Corporation
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease }}
            className="mt-2 font-[family-name:var(--font-jd-serif)] text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl"
          >
            Montierra
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease }}
            className="mt-3 flex items-center gap-2 text-sm text-white/80 sm:text-base"
          >
            <MapPin className="h-4 w-4 text-[#e6a39e]" /> Upper Balulang, Cagayan de Oro
          </motion.p>

          {/* the facts */}
          <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
            {FACTS.map((f, n) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 + n * 0.08, duration: 0.5, ease }}
                className="flex items-center gap-2.5 rounded-md border border-white/15 bg-white/10 px-3.5 py-2 backdrop-blur-md"
              >
                <f.icon className="h-4 w-4 text-[#e6a39e]" />
                <div className="leading-tight">
                  <p className="font-[family-name:var(--font-jd-serif)] text-lg font-semibold">{f.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">{f.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* caption + dots */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={slide.caption}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="text-xs text-white/70 sm:text-sm"
              >
                {slide.caption}
              </motion.p>
            </AnimatePresence>
            <div className="flex shrink-0 gap-1.5">
              {SLIDES.map((s, n) => (
                <button
                  key={s.src}
                  type="button"
                  aria-label={`Show photo ${n + 1}`}
                  onClick={() => setI(n)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sign in ── */}
      <section className="relative flex items-center justify-center px-4 py-10 sm:px-8 lg:min-h-screen">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#b4241c] lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 flex justify-center">
            <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" width={391} height={186} priority className="h-auto w-[210px]" unoptimized />
          </div>
          <div className="rounded-lg border border-[#ece5e2] bg-white p-7 shadow-[0_24px_60px_-32px_rgba(80,20,15,0.45)] sm:p-8">
            <h2 className="font-[family-name:var(--font-jd-serif)] text-[28px] font-semibold leading-tight text-[#2a1d1b]">Sign in</h2>
            <p className="mt-1.5 mb-6 text-sm text-[#7d6c68]">Welcome to the Johndorf portal.</p>
            {children}
          </div>
          <p className="mt-8 text-center text-[11px] uppercase tracking-[0.18em] text-[#a89c98]">
            © {new Date().getFullYear()} Johndorf Ventures Corporation
          </p>
        </motion.div>
      </section>
    </main>
  )
}
