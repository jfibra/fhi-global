"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion"
import { ArrowRight, ChevronDown, MapPin } from "lucide-react"
import { CITIES, COMPANY, HERO_SLIDES } from "@/lib/johndorf/company"
import { INK, Magnetic, ease, serif } from "./ui"

/** Where the giant word sits, and the point inside a letter stroke the camera flies into. */
type Stage = { w: number; h: number; fs: number; lines: string[]; baselines: number[]; family: string; tx: number; ty: number }

function layoutWord(w: number, h: number, family: string): Stage {
  const lines = w / h < 0.85 ? ["JOHN", "DORF"] : ["JOHNDORF"]
  const ctx = document.createElement("canvas").getContext("2d")!
  ctx.font = `800 100px ${family}`
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const fs = Math.min(((w * (lines.length > 1 ? 0.84 : 0.9)) / widest) * 100, h * (lines.length > 1 ? 0.28 : 0.4))
  const lh = fs * 0.9
  const first = h / 2 - (lh * lines.length) / 2 + fs * 0.72
  const baselines = lines.map((_, i) => first + i * lh)

  // Draw the word small and find the ink pixel deepest inside a stroke near the centre.
  const k = 0.25
  const cw = Math.max(1, Math.round(w * k))
  const ch = Math.max(1, Math.round(h * k))
  const c = document.createElement("canvas")
  c.width = cw
  c.height = ch
  const g = c.getContext("2d")!
  g.scale(k, k)
  g.font = `800 ${fs}px ${family}`
  g.textAlign = "center"
  lines.forEach((l, i) => g.fillText(l, w / 2, baselines[i]))
  const data = g.getImageData(0, 0, cw, ch).data
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < cw && y < ch && data[(y * cw + x) * 4 + 3] > 128
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  let best = { x: w / 2, y: h / 2, score: -Infinity }
  for (let y = Math.floor(ch * 0.2); y < ch * 0.8; y++) {
    for (let x = Math.floor(cw * 0.25); x < cw * 0.75; x++) {
      if (!ink(x, y)) continue
      let depth = Infinity
      for (const [dx, dy] of dirs) {
        let s = 1
        while (s < 60 && ink(x + dx * s, y + dy * s)) s++
        depth = Math.min(depth, s)
      }
      const score = depth - Math.hypot(x - cw / 2, y - ch / 2) * 0.05
      if (score > best.score) best = { x: x / k, y: y / k, score }
    }
  }
  return { w, h, fs, lines, baselines, family, tx: best.x, ty: best.y }
}

/** Zoom grows slowly, then rushes — scale 1 → 80 over the first half of the hero's scroll. */
function zoomTransform(stage: Stage, progress: number, intro: number) {
  const t = Math.min(1, Math.max(0, progress / 0.5))
  const s = Math.pow(80, t * t) * intro
  return `translate(${stage.tx} ${stage.ty}) scale(${s}) translate(${-stage.tx} ${-stage.ty})`
}

export function Hero({ ready }: { ready: boolean }) {
  const reduce = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const stageBox = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const maskG = useRef<SVGGElement>(null)
  const [stage, setStage] = useState<Stage | null>(null)
  const [slide, setSlide] = useState(0)
  const [live, setLive] = useState(false)
  const intro = useMotionValue(1.18)

  useEffect(() => {
    const t = setInterval(() => setSlide((n) => (n + 1) % HERO_SLIDES.length), 5200)
    return () => clearInterval(t)
  }, [])

  // Lay the word out for this screen (again on resize), once the serif is loaded.
  useEffect(() => {
    const el = stageBox.current
    const p = probe.current
    if (!el || !p) return
    let alive = true
    const family = getComputedStyle(p).fontFamily
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      document.fonts
        .load(`800 100px ${family}`)
        .catch(() => null)
        .then(() => {
          if (alive) setStage(layoutWord(r.width, r.height, family))
        })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [])

  // The camera pulls back as the curtain lifts.
  useEffect(() => {
    if (!ready) return
    const a = animate(intro, 1, { duration: reduce ? 0 : 1.8, ease })
    return () => a.stop()
  }, [ready, intro, reduce])

  const { scrollYProgress: p } = useScroll({ target: section, offset: ["start start", "end end"] })
  useEffect(() => {
    if (!stage) return
    const apply = () => {
      const tr = zoomTransform(stage, p.get(), intro.get())
      maskG.current?.setAttribute("transform", tr)
    }
    apply()
    const a = p.on("change", apply)
    const b = intro.on("change", apply)
    return () => {
      a()
      b()
    }
  }, [stage, p, intro])
  useMotionValueEvent(p, "change", (v) => setLive(v > 0.5))

  const inkOpacity = useTransform(p, [0.3, 0.48], [1, 0])
  const photoScale = useTransform(p, [0, 0.55], [1.22, 1])
  const cueOpacity = useTransform(p, [0, 0.07], [1, 0])
  const contentOpacity = useTransform(p, [0.5, 0.62], [0, 1])
  const contentY = useTransform(p, [0.5, 0.68], [70, 0])
  const shadeOpacity = useTransform(p, [0.42, 0.6], [0, 1])

  const showMask = !reduce

  return (
    <section id="top" ref={section} className="relative" style={{ height: showMask ? "280vh" : "100svh", backgroundColor: INK }}>
      <span ref={probe} aria-hidden className={`${serif} pointer-events-none absolute opacity-0`}>
        J
      </span>
      <div ref={stageBox} className="sticky top-0 h-[100svh] overflow-hidden text-white">
        {/* Photos — seen through the letters first, then full screen. */}
        <motion.div style={{ scale: showMask ? photoScale : 1 }} className="absolute inset-0">
          <AnimatePresence initial={false}>
            <motion.div key={HERO_SLIDES[slide].src} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: "easeInOut" }} className="absolute inset-0">
              <Image src={HERO_SLIDES[slide].src} alt={HERO_SLIDES[slide].caption} fill priority={slide === 0} sizes="100vw" className="jd-kenburns object-cover" />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Legibility shade for the headline once the screen is all photo. */}
        <motion.div style={{ opacity: showMask ? shadeOpacity : 1 }} className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_70%,rgba(22,12,10,0.2),rgba(22,12,10,0.85))]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#160c0a] via-[#160c0a]/45 to-[#160c0a]/55" />
        </motion.div>

        {/* The word: ink everywhere except the letters, which are windows onto the photos. */}
        {showMask && stage && (
          <motion.svg style={{ opacity: inkOpacity }} width={stage.w} height={stage.h} viewBox={`0 0 ${stage.w} ${stage.h}`} className="pointer-events-none absolute inset-0" aria-hidden>
            <defs>
              <mask id="jd-hero-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={stage.w} height={stage.h}>
                <rect width={stage.w} height={stage.h} fill="white" />
                <g ref={maskG}>
                  {stage.lines.map((l, i) => (
                    <text key={l} x={stage.w / 2} y={stage.baselines[i]} textAnchor="middle" fontSize={stage.fs} fontWeight={800} fontFamily={stage.family} fill="black">
                      {l}
                    </text>
                  ))}
                </g>
              </mask>
            </defs>
            <rect width={stage.w} height={stage.h} fill={INK} mask="url(#jd-hero-mask)" />
          </motion.svg>
        )}
        {showMask && !stage && <div className="absolute inset-0" style={{ backgroundColor: INK }} />}

        {/* Opening lines around the word. */}
        {showMask && (
          <motion.div style={{ opacity: cueOpacity }} className="pointer-events-none absolute inset-0">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={ready ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: 0.6, duration: 0.9, ease }}
              className="absolute inset-x-0 top-[16%] text-center text-[10px] font-semibold uppercase tracking-[0.42em] text-white/70 sm:top-[22%] sm:text-[11px]"
            >
              {COMPANY.name} · Since {COMPANY.founded}
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={ready ? { opacity: 1 } : undefined}
              transition={{ delay: 1.2, duration: 0.9 }}
              className="absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.36em] text-white/65"
            >
              Scroll to enter
              <motion.span animate={{ y: [0, 7, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </motion.div>
          </motion.div>
        )}

        {/* What the camera lands on. */}
        <HeroContent opacity={showMask ? contentOpacity : null} y={showMask ? contentY : null} live={live || !showMask} slide={slide} setSlide={setSlide} />
      </div>
    </section>
  )
}

function HeroContent({ opacity, y, live, slide, setSlide }: { opacity: MotionValue<number> | null; y: MotionValue<number> | null; live: boolean; slide: number; setSlide: (n: number) => void }) {
  return (
    <motion.div style={{ opacity: opacity ?? 1, y: y ?? 0 }} className={`absolute inset-0 ${live ? "" : "pointer-events-none"}`}>
      <div className="mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pb-8 sm:px-8 sm:pb-12">
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f0b6b1]">
          <span className="h-px w-10 bg-[#f0b6b1]/70" />
          {COMPANY.name}
        </p>
        <h1 className={`${serif} mt-4 text-[68px] font-semibold leading-[0.92] tracking-tight sm:text-[120px] lg:text-[164px]`}>
          {["Always", "there."].map((w, n) => (
            <span key={w} className="-mb-[0.16em] mr-[0.2em] inline-block overflow-hidden pb-[0.16em] align-bottom">
              <motion.span className={`inline-block ${n === 1 ? "italic text-[#f0b6b1]" : ""}`} initial={false} animate={{ y: live ? "0%" : "105%" }} transition={{ duration: 1.1, delay: n * 0.12, ease }}>
                {w}
              </motion.span>
            </span>
          ))}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
          Homes and communities for every Filipino family — across {CITIES.slice(0, -1).join(", ")} and {CITIES.at(-1)}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Magnetic>
            <Link
              href="/johndorf/dashboard"
              data-cursor="Open"
              className="group inline-flex items-center gap-2.5 rounded-full bg-[#b4241c] px-7 py-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_18px_40px_-14px_rgba(180,36,28,0.9)] transition-colors hover:bg-[#941414]"
            >
              Explore Montierra <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Magnetic>
          <Magnetic>
            <a href="#story" className="inline-flex items-center gap-2.5 rounded-full border border-white/35 bg-white/5 px-7 py-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur transition-colors hover:bg-white/15">
              Our story
            </a>
          </Magnetic>
        </div>
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-white/60">
          <AnimatePresence mode="wait">
            <motion.span key={HERO_SLIDES[slide].caption} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }} className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> {HERO_SLIDES[slide].caption}
            </motion.span>
          </AnimatePresence>
          <div className="flex gap-1.5">
            {HERO_SLIDES.map((s, n) => (
              <button key={s.src} type="button" aria-label={`Show ${s.caption}`} onClick={() => setSlide(n)} className={`h-1.5 rounded-full transition-all duration-500 ${n === slide ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
