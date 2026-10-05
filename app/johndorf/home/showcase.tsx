"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { ArrowRight, ArrowUpRight, MapPin, Sparkles } from "lucide-react"
import { FLAGSHIPS, PROJECTS } from "@/lib/johndorf/company"
import { BLOCKS, TOTALS } from "@/lib/johndorf/montierra"
import { PROJECT_DETAILS } from "@/lib/johndorf/projects"
import { ProjectDetail } from "./project-detail"
import { Eyebrow, Magnetic, Odometer, Reveal, RiseWords, ease, serif } from "./ui"

/* ─── Flagships: full cards that stack as you scroll ──────────────────────── */

export function Flagships() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  return (
    <section id="flagships" className="scroll-mt-16 bg-[#160c0a] px-4 pb-[6vh] pt-24 text-white sm:px-8 sm:pt-32">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <Eyebrow light>Flagships</Eyebrow>
        </Reveal>
        <h2 className={`${serif} mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
          <RiseWords text="From affordable homes to skylines." accent={["skylines."]} accentClass="italic text-[#f0b6b1]" />
        </h2>
        <div ref={ref} className="mt-14">
          {FLAGSHIPS.map((f, i) => (
            <StackCard key={f.id} f={f} i={i} n={FLAGSHIPS.length} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StackCard({ f, i, n, progress }: { f: (typeof FLAGSHIPS)[number]; i: number; n: number; progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  // Each card shrinks a little as the ones after it slide over.
  const scale = useTransform(progress, [i / n, 1], [1, 1 - (n - 1 - i) * 0.05])
  const shade = useTransform(progress, [i / n, Math.min(1, (i + 1) / n)], [0, i === n - 1 ? 0 : 0.45])
  const flip = i % 2 === 1
  return (
    <div className="sticky mb-[6vh] h-[84svh] lg:h-[78vh]" style={{ top: `calc(9vh + ${i * 22}px)` }}>
      <motion.article style={{ scale }} className="relative grid h-full origin-top grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[30px] bg-[#241512] shadow-[0_-30px_80px_-30px_rgba(0,0,0,0.8)] lg:grid-cols-2 lg:grid-rows-1">
        <div className={`relative min-h-0 overflow-hidden ${flip ? "lg:order-2" : ""}`}>
          <motion.div initial={{ scale: 1.15 }} whileInView={{ scale: 1 }} viewport={{ once: false, amount: 0.4 }} transition={{ duration: 1.6, ease }} className="absolute inset-0">
            <Image src={f.image} alt={f.name} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" style={{ objectPosition: "focus" in f ? f.focus : undefined }} />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#241512]/60 to-transparent lg:hidden" />
        </div>
        <div className="relative flex min-h-0 flex-col gap-5 p-6 sm:p-10 lg:p-14">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f0b6b1]">
              <Sparkles className="h-3 w-3" /> {f.kicker}
            </span>
            <span className={`${serif} hidden text-lg text-white/40 sm:inline`}>
              0{i + 1} <span className="text-white/20">/ 0{n}</span>
            </span>
          </div>
          <div>
            <h3 className={`${serif} text-[44px] font-semibold leading-[0.95] sm:text-7xl lg:text-8xl`}>{f.name}</h3>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-white/65">
              <MapPin className="h-3.5 w-3.5" /> {f.place}
            </p>
          </div>
          <div className="mt-auto">
            <p className="line-clamp-2 max-w-lg text-[15px] leading-relaxed text-white/75 sm:line-clamp-none">{f.text}</p>
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
              {f.facts.map((x) => (
                <span key={x} className="rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] font-semibold text-white/90">
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>
        <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-black" />
      </motion.article>
    </div>
  )
}

/* ─── Portfolio: a film strip that slides sideways as you scroll down ─────── */

export function Portfolio() {
  const reduce = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const distance = useMotionValue(0)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = track.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const d = Math.max(0, el.scrollWidth - window.innerWidth)
      distance.set(d)
      setHeight(d + window.innerHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [distance])
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] })
  const x = useTransform(() => -scrollYProgress.get() * distance.get())
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])
  const [idx, setIdx] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (v) => setIdx(Math.min(PROJECTS.length - 1, Math.round(v * (PROJECTS.length - 1)))))
  // The project whose sheet is open (house types, amenities, photos).
  const [openName, setOpenName] = useState<string | null>(null)
  const openProject = PROJECTS.find((p) => p.name === openName)
  const openDetail = openProject?.slug ? PROJECT_DETAILS[openProject.slug] : undefined
  // Rendered outside the sliding track: a transformed parent would trap a fixed overlay.
  const sheet = (
    <AnimatePresence>
      {openProject && openDetail && <ProjectDetail key={openProject.name} project={openProject} detail={openDetail} onClose={() => setOpenName(null)} />}
    </AnimatePresence>
  )

  if (reduce) {
    return (
      <section id="portfolio" className="scroll-mt-16 bg-[#fbf8f6] px-5 py-24 sm:px-8">
        <PortfolioHeader idx={0} />
        <div className="mx-auto mt-10 grid max-w-[1400px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p, n) => (
            <ProjectCard key={p.name} p={p} n={n} onOpen={setOpenName} />
          ))}
        </div>
        {sheet}
      </section>
    )
  }

  return (
    <section id="portfolio" ref={section} className="relative scroll-mt-0 bg-[#fbf8f6]" style={{ height: height ?? "300vh" }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden pt-14">
        <div className="px-5 sm:px-8">
          <PortfolioHeader idx={idx} />
        </div>
        <motion.div ref={track} style={{ x }} className="mt-8 flex w-max gap-5 px-5 sm:mt-10 sm:gap-7 sm:px-8">
          {PROJECTS.map((p, n) => (
            <ProjectCard key={p.name} p={p} n={n} strip onOpen={setOpenName} />
          ))}
          <div className="flex w-[70vw] shrink-0 flex-col justify-center sm:w-[36vw] lg:w-[26vw]">
            <p className={`${serif} text-4xl font-semibold leading-tight sm:text-5xl`}>
              And more than <span className="italic text-[#b4241c]">fifty</span> communities since 1986.
            </p>
          </div>
        </motion.div>
        <div className="mx-5 mt-8 h-px bg-[#2a1d1b]/10 sm:mx-8">
          <motion.div style={{ width: bar }} className="h-px bg-[#b4241c]" />
        </div>
      </div>
      {sheet}
    </section>
  )
}

function PortfolioHeader({ idx }: { idx: number }) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-6">
      <div>
        <Eyebrow>Portfolio</Eyebrow>
        <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.05] sm:text-6xl`}>
          Find your <span className="italic text-[#b4241c]">perfect home.</span>
        </h2>
      </div>
      <p className={`${serif} text-2xl text-[#2a1d1b] tabular-nums sm:text-3xl`}>
        {String(idx + 1).padStart(2, "0")} <span className="text-[#c9b8b2]">/ {String(PROJECTS.length).padStart(2, "0")}</span>
      </p>
    </div>
  )
}

function ProjectCard({ p, n, strip = false, onOpen }: { p: (typeof PROJECTS)[number]; n: number; strip?: boolean; onOpen: (name: string) => void }) {
  const hasSheet = Boolean(p.slug && PROJECT_DETAILS[p.slug])
  const body = (
    <article className={`group text-left ${strip ? "w-[78vw] shrink-0 sm:w-[44vw] lg:w-[31vw]" : ""}`} data-cursor={hasSheet ? "View" : undefined}>
      <div className={`relative overflow-hidden rounded-[24px] ${strip ? "h-[42svh] sm:h-[46vh]" : "aspect-[16/11]"}`}>
        <Image src={p.image} alt={p.name} fill sizes="(min-width:1024px) 31vw, (min-width:640px) 44vw, 78vw" className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.08]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {p.interactive && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#b4241c] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Interactive site plan
          </span>
        )}
        {p.status && <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2a1d1b]">{p.status}</span>}
        <span className={`${serif} absolute bottom-3 right-5 text-6xl font-semibold text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.75)] sm:text-7xl`}>
          {String(n + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={`${serif} truncate text-2xl font-semibold sm:text-3xl`}>{p.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-[#8a7a75]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b4241c]" /> {p.place}
          </p>
        </div>
        {hasSheet && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all group-hover:rotate-45 ${p.interactive ? "bg-[#b4241c] text-white" : "bg-[#f6efec] text-[#b4241c] group-hover:bg-[#b4241c] group-hover:text-white"}`}>
            <ArrowUpRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </article>
  )
  return hasSheet ? (
    <button type="button" onClick={() => onOpen(p.name)} aria-label={`${p.name} — house types, amenities and photos`} className="contents cursor-pointer">
      {body}
    </button>
  ) : (
    body
  )
}

/* ─── Montierra: the live plan, tilting under the mouse ───────────────────── */

export function MontierraSpotlight() {
  const pins = BLOCKS.filter((b) => b.kind === "residential").map((b) => {
    const xs = b.polygon.map((q) => q[0])
    const ys = b.polygon.map((q) => q[1])
    return { id: b.id, x: ((Math.min(...xs) + Math.max(...xs)) / 2 / 2000) * 100, y: ((Math.min(...ys) + Math.max(...ys)) / 2 / 1414) * 100 }
  })
  const rx = useSpring(0, { stiffness: 120, damping: 18 })
  const ry = useSpring(0, { stiffness: 120, damping: 18 })
  return (
    <section className="relative overflow-hidden bg-[#2a1d1b] px-5 py-24 text-white sm:px-8 sm:py-32">
      <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#b4241c]/30 blur-[130px]" />
      <div className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-[#b4241c]/15 blur-[120px]" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-14 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Reveal>
            <Eyebrow light>Live site plan</Eyebrow>
          </Reveal>
          <h2 className={`${serif} mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
            <RiseWords text="Walk Montierra, lot by lot." accent={["lot", "by", "lot."]} accentClass="italic text-[#f0b6b1]" />
          </h2>
          <Reveal delay={0.15}>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {[
                { v: BLOCKS.filter((b) => b.kind === "residential").length, l: "Blocks" },
                { v: TOTALS.lots, l: "Home lots" },
                { v: 3, l: "Clusters" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/12 bg-white/5 px-4 py-5">
                  <p className={`${serif} text-4xl font-semibold`}>
                    <Odometer value={s.v} />
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-10">
              <Magnetic>
                <Link href="/johndorf/dashboard" data-cursor="Open" className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2a1d1b]">
                  Open the site plan <ArrowRight className="h-4 w-4 text-[#b4241c] transition-transform group-hover:translate-x-1" />
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div
            className="[perspective:1400px]"
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return
              const r = e.currentTarget.getBoundingClientRect()
              ry.set(((e.clientX - r.left) / r.width - 0.5) * 12)
              rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10)
            }}
            onPointerLeave={() => {
              rx.set(0)
              ry.set(0)
            }}
          >
            <motion.div style={{ rotateX: rx, rotateY: ry }} className="[transform-style:preserve-3d]">
              <Link href="/johndorf/dashboard" data-cursor="Explore" className="relative block overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_50px_100px_-30px_rgba(0,0,0,0.75)]">
                <Image src="/johndorf/montierra-plan.jpg" alt="Montierra subdivision plan" width={2048} height={1448} sizes="(min-width:1024px) 56vw, 100vw" className="h-auto w-full" />
                {pins.map(({ id, x, y }, n) => (
                  <span key={id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b4241c] opacity-60" style={{ animationDelay: `${n * 0.3}s` }} />
                      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#b4241c]" />
                    </span>
                  </span>
                ))}
              </Link>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
