"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useMotionTemplate, useScroll, useSpring, useTransform, useVelocity } from "framer-motion"
import { Award, CheckCircle2, Crown, Quote } from "lucide-react"
import { ALSO_LEADING, AWARDS, AWARD_PHOTOS, FAMILY, FAMILY_PHOTO, QUOTES, QUOTES_SOURCE, RECOGNITION, VALUES } from "@/lib/johndorf/company"
import { Eyebrow, Odometer, Reveal, RiseWords, ease, serif } from "./ui"

const GOLD = "#e3c47d"

/* ─── Recognition: the awards night, in photos ────────────────────────────── */

export function Recognition() {
  const award = AWARDS[0]
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const yBig = useTransform(scrollYProgress, [0, 1], [60, -60])
  const ySmall = useTransform(scrollYProgress, [0, 1], [140, -120])
  return (
    <section id="recognition" className="relative scroll-mt-16 overflow-hidden bg-[#160c0a] px-5 py-24 text-white sm:px-8 sm:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[#e3c47d]/10 blur-[140px]" />
      <div className="relative mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Reveal>
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
              <span className="h-px w-10" style={{ backgroundColor: GOLD }} /> Recognition · {award.year}
            </p>
          </Reveal>
          <h2 className={`${serif} mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
            <RiseWords text="Five trophies. Two citations. One night." accent={["night."]} accentClass="italic text-[#e3c47d]" />
          </h2>
          <Reveal delay={0.1}>
            <div className="mt-10 flex items-end gap-5">
              <p className={`${serif} text-[120px] font-semibold leading-none sm:text-[170px]`} style={{ color: GOLD }}>
                <Odometer value={5} />
              </p>
              <p className="pb-6 text-sm leading-relaxed text-white/70">
                trophies at the
                <br />
                <span className="font-semibold text-white">{award.body}</span>
              </p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {award.items.map((it, k) => (
              <Reveal key={it.project} delay={0.1 + k * 0.1}>
                <p className={`${serif} text-2xl font-semibold`}>{it.project}</p>
                <ul className="mt-4 space-y-2.5">
                  {it.wins.map((w) => (
                    <li key={w} className="flex items-start gap-2.5 text-sm text-white/85">
                      <Award className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} /> {w}
                    </li>
                  ))}
                  {it.commended.map((w) => (
                    <li key={w} className="flex items-start gap-2.5 text-sm text-white/50">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Highly commended · {w}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <div className="mt-12 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Image src={RECOGNITION.image} alt="Top 4 Developer plaque" fill sizes="64px" className="object-cover" />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                  <Crown className="h-3 w-3" /> {RECOGNITION.by}
                </p>
                <p className={`${serif} mt-1 text-xl font-semibold`}>{RECOGNITION.title}</p>
                <p className="text-xs text-white/55">{RECOGNITION.date}</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div ref={ref} className="relative min-h-[520px] sm:min-h-[640px]">
          <motion.figure style={{ y: yBig }} className="absolute right-0 top-0 w-[88%]">
            <div className="relative aspect-[1000/789] overflow-hidden rounded-[26px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
              <Image src={AWARD_PHOTOS.stage.src} alt={AWARD_PHOTOS.stage.alt} fill sizes="(min-width:1024px) 46vw, 88vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-xs text-white/55">
              {AWARD_PHOTOS.stage.caption} <span className="text-white/35">· Photo: {AWARD_PHOTOS.stage.credit}</span>
            </figcaption>
          </motion.figure>
          <motion.figure style={{ y: ySmall }} className="absolute bottom-0 left-0 w-[52%]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border-4 border-[#160c0a] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]">
              <Image src={AWARD_PHOTOS.sign.src} alt={AWARD_PHOTOS.sign.alt} fill sizes="(min-width:1024px) 28vw, 52vw" className="object-cover" />
            </div>
            <figcaption className="mt-2 text-[11px] text-white/45">
              {AWARD_PHOTOS.sign.caption} · Photo: {AWARD_PHOTOS.sign.credit}
            </figcaption>
          </motion.figure>
        </div>
      </div>
    </section>
  )
}

/* ─── In their words ──────────────────────────────────────────────────────── */

export function Quotes() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 9000)
    return () => clearInterval(t)
  }, [paused])
  const q = QUOTES[i]
  return (
    <section className="bg-[#fbf8f6] px-5 py-24 sm:px-8 sm:py-36" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <Eyebrow>In their words</Eyebrow>
        </Reveal>
        <div className="relative mt-10 min-h-[420px] sm:min-h-[380px]">
          <Quote className="absolute -left-10 -top-6 hidden h-36 w-36 text-[#b4241c]/10 sm:block" />
          <AnimatePresence mode="wait">
            <motion.div key={q.name} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.7, ease }} className="relative">
              <p className={`${serif} text-3xl font-medium leading-[1.2] text-[#2a1d1b] sm:text-5xl lg:text-[56px]`}>&ldquo;{q.text}&rdquo;</p>
              <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-[#7d6c68] sm:text-lg">&ldquo;{q.more}&rdquo;</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-[#2a1d1b]/10 pt-8">
          <div className="flex gap-3">
            {QUOTES.map((x, n) => (
              <button
                key={x.name}
                type="button"
                onClick={() => setI(n)}
                className={`flex items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-5 text-left transition-all ${n === i ? "border-[#b4241c] bg-white shadow-[0_14px_30px_-18px_rgba(180,36,28,0.6)]" : "border-[#2a1d1b]/10 opacity-60 hover:opacity-100"}`}
              >
                <span className="relative h-12 w-12 overflow-hidden rounded-full">
                  <Image src={x.photo} alt={x.name} fill sizes="48px" className="object-cover object-top" />
                </span>
                <span>
                  <span className={`${serif} block text-lg font-semibold leading-tight`}>{x.name}</span>
                  <span className="block text-[11px] text-[#8a7a75]">{x.role}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a8968f]">{QUOTES_SOURCE}</p>
        </div>
      </div>
    </section>
  )
}

/* ─── The family: a spotlight follows you across the photo ───────────────── */

export function Family() {
  const [active, setActive] = useState(4) // Richard Lim, centre
  const p = FAMILY[active]
  const sx = useSpring(p.x, { stiffness: 140, damping: 22 })
  const sy = useSpring(p.y + 18, { stiffness: 140, damping: 22 })
  useEffect(() => {
    sx.set(p.x)
    sy.set(p.y + 18)
  }, [p, sx, sy])
  const light = useMotionTemplate`radial-gradient(ellipse 14% 72% at ${sx}% ${sy}%, rgba(22,12,10,0) 0%, rgba(22,12,10,0) 68%, rgba(22,12,10,0.5) 100%)`
  const nearest = (xPct: number) => FAMILY.reduce((best, f, n) => (Math.abs(f.x - xPct) < Math.abs(FAMILY[best].x - xPct) ? n : best), 0)

  return (
    <section id="people" className="scroll-mt-16 bg-white px-5 py-24 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow>The family behind the name</Eyebrow>
            </Reveal>
            <h2 className={`${serif} mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
              <RiseWords text="Built by the Lim family." accent={["Lim", "family."]} />
            </h2>
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-sm text-[15px] leading-relaxed text-[#7d6c68]">Move across the photo — or tap a name — to meet them.</p>
          </Reveal>
        </div>

        <Reveal delay={0.05}>
          <figure className="mt-12">
            <div
              className="relative overflow-hidden rounded-[28px] bg-[#2a1d1b]"
              style={{ aspectRatio: `${FAMILY_PHOTO.width} / ${FAMILY_PHOTO.height}` }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setActive(nearest(((e.clientX - r.left) / r.width) * 100))
              }}
            >
              <Image src={FAMILY_PHOTO.src} alt={`The Lim family — ${FAMILY.map((f) => f.name).join(", ")}`} fill sizes="(min-width:1400px) 1400px, 100vw" className="object-cover" />
              <motion.div style={{ background: light }} className="pointer-events-none absolute inset-0" />
              {FAMILY.map((f, n) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setActive(n)}
                  onFocus={() => setActive(n)}
                  aria-label={`${f.name}, ${f.role}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${f.x}%`, top: `${Math.max(4, f.y - 13)}%` }}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg transition-all sm:h-7 sm:w-7 ${n === active ? "scale-110 bg-[#b4241c]" : "bg-black/40"}`}>{n + 1}</span>
                </button>
              ))}
              <AnimatePresence mode="wait">
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease }}
                  className="pointer-events-none absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-auto"
                >
                  <div className="inline-block rounded-2xl bg-white/95 px-5 py-3 shadow-2xl backdrop-blur sm:px-6 sm:py-4">
                    <p className={`${serif} text-xl font-semibold leading-tight text-[#2a1d1b] sm:text-3xl`}>{p.name}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b4241c] sm:text-xs">{p.role}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#a8968f]">
              <span>{FAMILY_PHOTO.caption} · left to right</span>
              <span>Photo: {FAMILY_PHOTO.credit}</span>
            </figcaption>
          </figure>
        </Reveal>

        <div className="mt-12 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...FAMILY.map((f, n) => ({ ...f, n })), ...ALSO_LEADING.map((f) => ({ ...f, n: -1, x: 0, y: 0 }))].map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => f.n >= 0 && setActive(f.n)}
              onPointerEnter={() => f.n >= 0 && setActive(f.n)}
              className={`flex items-baseline gap-3 border-b border-[#2a1d1b]/10 py-4 text-left transition-colors ${f.n === active ? "text-[#b4241c]" : ""} ${f.n < 0 ? "cursor-default" : ""}`}
            >
              <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-[#c0aea8]">{f.n >= 0 ? f.n + 1 : "·"}</span>
              <span>
                <span className={`${serif} block text-xl font-semibold`}>{f.name}</span>
                <span className="block text-[12px] text-[#8a7a75]">{f.role}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Values: a wall of words that leans with your scroll speed ──────────── */

export function ValuesMarquee() {
  const { scrollY } = useScroll()
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 300 })
  const skew = useTransform(velocity, [-2500, 2500], [9, -9], { clamp: true })
  const row = [...VALUES, ...VALUES]
  return (
    <section className="overflow-hidden bg-[#b4241c] py-16 text-white sm:py-24">
      <Reveal>
        <div className="mb-8 px-5 sm:px-8">
          <p className="mx-auto flex max-w-[1400px] items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">
            <span className="h-px w-10 bg-white/60" /> What we stand for
          </p>
        </div>
      </Reveal>
      {[0, 1].map((r) => (
        <motion.div key={r} style={{ skewX: skew }} className="flex whitespace-nowrap">
          <motion.div className="flex shrink-0" animate={{ x: r === 0 ? ["0%", "-50%"] : ["-50%", "0%"] }} transition={{ duration: 38, repeat: Infinity, ease: "linear" }}>
            {row.map((v, n) => (
              <span key={n} className={`${serif} flex items-center px-6 text-[64px] font-semibold leading-[1.15] sm:px-10 sm:text-[120px] ${(n + r) % 2 ? "text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)]" : ""}`}>
                {v}
                <span className="ml-12 inline-block h-3 w-3 rotate-45 bg-white/70 sm:ml-20" />
              </span>
            ))}
          </motion.div>
        </motion.div>
      ))}
    </section>
  )
}
