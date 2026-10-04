"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion"
import { COMPANY, FOOTPRINT, STATS, TIMELINE } from "@/lib/johndorf/company"
import { PH_DOTS, PH_GRID } from "@/lib/johndorf/ph-dots"
import { Eyebrow, Odometer, Reveal, RiseWords, ease, serif } from "./ui"

/* ─── Mission: the sentence lights up word by word as you scroll ──────────── */

const MISSION_ACCENT = new Set(["every", "Filipino"])

function Word({ children, p, range, accent }: { children: string; p: MotionValue<number>; range: [number, number]; accent: boolean }) {
  const opacity = useTransform(p, range, [0.13, 1])
  const y = useTransform(p, range, [8, 0])
  return (
    <motion.span style={{ opacity, y }} className={`mr-[0.24em] inline-block ${accent ? "italic text-[#b4241c]" : ""}`}>
      {children}
    </motion.span>
  )
}

export function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
  const words = COMPANY.mission.split(" ")
  return (
    <section id="story" className="scroll-mt-16 bg-[#fbf8f6] px-5 pb-24 pt-28 sm:px-8 sm:pb-32 sm:pt-40">
      <div className="mx-auto max-w-[1280px]">
        <Reveal>
          <Eyebrow>Our mission</Eyebrow>
        </Reveal>
        <p ref={ref} className={`${serif} mt-8 text-[34px] font-medium leading-[1.14] text-[#2a1d1b] sm:text-6xl lg:text-[78px]`}>
          {words.map((w, i) => (
            <Word key={i} p={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} accent={MISSION_ACCENT.has(w)}>
              {w}
            </Word>
          ))}
        </p>

        <div className="mt-20 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {STATS.map((s, n) => (
            <Reveal key={s.label} delay={n * 0.08}>
              <div className="border-t border-[#2a1d1b]/15 pt-5">
                <p className={`${serif} text-6xl font-semibold text-[#2a1d1b] sm:text-7xl lg:text-8xl`}>
                  <Odometer value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a7a75]">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Footprint: the five cities on a dotted Philippines ──────────────────── */

const toGrid = (lat: number, lng: number) => ({ x: (lng - PH_GRID.lon0) / PH_GRID.step, y: (PH_GRID.lat1 - lat) / PH_GRID.step })

const DOTS = (() => {
  const out: { x: number; y: number; vm: boolean }[] = []
  for (let i = 0; i < PH_DOTS.length; i += 2) {
    const x = PH_DOTS[i]
    const y = PH_DOTS[i + 1]
    const lat = PH_GRID.lat1 - y * PH_GRID.step
    const lng = PH_GRID.lon0 + x * PH_GRID.step
    // Visayas & Mindanao (Palawan and Mindoro stay with Luzon).
    out.push({ x, y, vm: lat < 12.6 && (lng >= 121.7 || lat < 7.3) })
  }
  return out
})()

export function Footprint() {
  const mapRef = useRef<HTMLDivElement>(null)
  const on = useInView(mapRef, { once: true, margin: "-120px" })
  const [hot, setHot] = useState<string | null>(null)
  return (
    <section className="relative overflow-hidden bg-[#f3ece8] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Reveal>
            <Eyebrow>Footprint</Eyebrow>
          </Reveal>
          <h2 className={`${serif} mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
            <RiseWords text="Rooted in Visayas & Mindanao." accent={["Mindanao."]} />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-[#6b5a56]">Five cities and more than fifty communities — and it all began in Iligan in {COMPANY.founded}.</p>
          </Reveal>
          <ul className="mt-10 divide-y divide-[#2a1d1b]/10 border-y border-[#2a1d1b]/10">
            {FOOTPRINT.map((c, n) => (
              <motion.li
                key={c.city}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: n * 0.07, duration: 0.6, ease }}
                onPointerEnter={() => setHot(c.city)}
                onPointerLeave={() => setHot(null)}
                className="group flex cursor-default items-baseline justify-between gap-4 py-4"
              >
                <span className={`${serif} text-2xl font-semibold transition-colors sm:text-3xl ${hot === c.city ? "text-[#b4241c]" : ""}`}>{c.city}</span>
                <span className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a7a75]">{c.region}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div ref={mapRef} className={`relative mx-auto w-full max-w-[560px] ${on ? "jd-on" : ""}`}>
          <svg viewBox="17 52 70 74" className="h-auto w-full" role="img" aria-label="Map of the Philippines with Johndorf's five cities">
            {DOTS.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={0.36} className="jd-dot" fill={d.vm ? "#b4241c" : "#cbb8b1"} fillOpacity={d.vm ? 0.55 : 0.6} style={{ animationDelay: `${d.y * 9}ms` }} />
            ))}
            {FOOTPRINT.map((c, n) => {
              const { x, y } = toGrid(c.lat, c.lng)
              const left = c.label === "left"
              const dy = c.city === "Cagayan de Oro" ? -2.6 : c.city === "Iligan" ? 2.8 : 0
              const lx = left ? x - 9 : x + 9
              const isHot = hot === c.city
              return (
                <g key={c.city} className="jd-pin" style={{ animationDelay: `${1000 + n * 160}ms` }} onPointerEnter={() => setHot(c.city)} onPointerLeave={() => setHot(null)}>
                  <circle cx={x} cy={y} r={1.1} fill="none" stroke="#b4241c" strokeWidth={0.35} className="jd-ring" style={{ animationDelay: `${n * 0.4}s` }} />
                  <line x1={x} y1={y} x2={lx + (left ? 1 : -1)} y2={y + dy} stroke="#2a1d1b" strokeOpacity={0.35} strokeWidth={0.18} />
                  <circle cx={x} cy={y} r={isHot ? 1.25 : 0.95} fill="#b4241c" stroke="#fff" strokeWidth={0.35} style={{ transition: "r 0.25s" }} />
                  <text x={lx} y={y + dy + 0.9} textAnchor={left ? "end" : "start"} fontSize={2.5} fontWeight={700} fill={isHot ? "#b4241c" : "#2a1d1b"} stroke="#f3ece8" strokeWidth={0.7} paintOrder="stroke" style={{ letterSpacing: "0.02em" }}>
                    {c.city}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="mt-2 text-right text-[10px] uppercase tracking-[0.18em] text-[#a8968f]">Map: Natural Earth</p>
        </div>
      </div>
    </section>
  )
}

/* ─── Timeline: the photo changes as you read down the years ──────────────── */

export function Timeline() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.55", "end 0.55"] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(TIMELINE.length - 1, Math.max(0, Math.floor(v * TIMELINE.length)))))
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])
  const t = TIMELINE[active]
  return (
    <section className="bg-[#fbf8f6] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[1280px]">
        <Reveal>
          <Eyebrow>Since {COMPANY.founded}</Eyebrow>
        </Reveal>
        <h2 className={`${serif} mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
          <RiseWords text="Forty years, one family." accent={["family."]} />
        </h2>

        <div className="mt-16 grid gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div className="hidden lg:block">
            <div className="sticky top-[14vh] h-[72vh] overflow-hidden rounded-[30px] bg-[#2a1d1b]">
              <AnimatePresence initial={false}>
                <motion.div key={t.image} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, ease }} className="absolute inset-0">
                  <Image src={t.image} alt={t.caption} fill sizes="50vw" className="object-cover" />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-8 text-white">
                <AnimatePresence mode="wait">
                  <motion.p key={t.caption} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="text-sm text-white/80">
                    {t.caption}
                  </motion.p>
                </AnimatePresence>
                <p className={`${serif} text-6xl font-semibold leading-none text-white/90`}>{t.year}</p>
              </div>
              <div className="absolute left-0 top-0 h-full w-1 bg-white/15">
                <motion.div style={{ height: bar }} className="w-full bg-[#b4241c]" />
              </div>
            </div>
          </div>

          <div ref={ref}>
            {TIMELINE.map((m, n) => (
              <article key={m.title} className="flex min-h-[46vh] flex-col justify-center py-8 lg:min-h-[62vh]">
                <figure className="mb-6 lg:hidden">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
                    <Image src={m.image} alt={m.caption} fill sizes="100vw" className="object-cover" />
                  </div>
                  <figcaption className="mt-2 text-xs text-[#a8968f]">{m.caption}</figcaption>
                </figure>
                <p
                  className={`${serif} text-7xl font-semibold leading-none transition-colors duration-500 sm:text-8xl lg:text-[120px] ${
                    active === n ? "text-[#b4241c]" : "text-transparent [-webkit-text-stroke:1.5px_rgba(180,36,28,0.55)]"
                  }`}
                >
                  {m.year}
                </p>
                <h3 className={`${serif} mt-5 text-3xl font-semibold sm:text-4xl`}>{m.title}</h3>
                <p className="mt-3 max-w-md text-[16px] leading-relaxed text-[#6b5a56]">{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
