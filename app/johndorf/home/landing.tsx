"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useTransform } from "framer-motion"
import {
  ArrowRight, ArrowUpRight, Award, Building2, CheckCircle2, Compass, Crown, Gem, HandHeart, Heart, Landmark, Lightbulb, LogOut,
  MapPin, Menu, ShieldCheck, Sparkles, Trophy, Users, X,
} from "lucide-react"
import {
  AWARDS, BUYING, CITIES, COMPANY, FLAGSHIPS, HERO_SLIDES, LEADERS, NEWS, PROJECTS, RECOGNITION, STATS, TIMELINE, VALUES, type Region,
} from "@/lib/johndorf/company"
import { BLOCKS, TOTALS } from "@/lib/johndorf/montierra"
import { signOutJohndorf } from "../actions"

const ease = [0.22, 1, 0.36, 1] as const
const serif = "font-[family-name:var(--font-jd-serif)]"

const NAV = [
  { href: "#story", label: "Story" },
  { href: "#flagships", label: "Flagships" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#recognition", label: "Recognition" },
  { href: "#news", label: "News" },
]

/** Fades and lifts its children in when they scroll into view. */
function Reveal({ children, delay = 0, y = 26, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** A number that counts up the first time it's seen. */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!seen) return
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1400)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, to])
  return (
    <span ref={ref} className="tabular-nums">
      {n}
      {suffix}
    </span>
  )
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] ${light ? "text-[#f0b6b1]" : "text-[#b4241c]"}`}>
      <span className={`h-px w-10 ${light ? "bg-[#f0b6b1]/70" : "bg-[#b4241c]/60"}`} />
      {children}
    </p>
  )
}

export function JohndorfLanding() {
  return (
    <div className="bg-[#fbf8f6] text-[#2a1d1b]">
      <TopBar />
      <Hero />
      <CityMarquee />
      <Story />
      <Flagships />
      <Portfolio />
      <MontierraSpotlight />
      <Recognition />
      <ValuesAndPeople />
      <Buying />
      <News />
      <Footer />
    </div>
  )
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */

function TopBar() {
  const { scrollY } = useScroll()
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40))

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${solid ? "bg-white/90 shadow-[0_10px_30px_-18px_rgba(40,10,5,0.4)] backdrop-blur-xl" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <a href="#top" className="relative block h-11 w-[104px] shrink-0" aria-label="Johndorf Ventures Corporation">
            <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" fill sizes="104px" unoptimized className={`object-contain object-left transition-all duration-500 ${solid ? "" : "brightness-0 invert"}`} />
          </a>
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={`group relative text-[13px] font-semibold tracking-wide transition-colors ${solid ? "text-[#4b3b37] hover:text-[#b4241c]" : "text-white/85 hover:text-white"}`}>
                {n.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-current transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/johndorf/dashboard"
              className="hidden items-center gap-2 rounded-full bg-[#b4241c] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(180,36,28,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#941414] sm:inline-flex"
            >
              <Compass className="h-4 w-4" /> Montierra map
            </Link>
            <form action={signOutJohndorf} className="hidden sm:block">
              <button type="submit" aria-label="Sign out" title="Sign out" className={`rounded-full p-2.5 transition-colors ${solid ? "text-[#6b5a56] hover:bg-[#f3ece9]" : "text-white/80 hover:bg-white/10"}`}>
                <LogOut className="h-4 w-4" />
              </button>
            </form>
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className={`rounded-full p-2.5 lg:hidden ${solid ? "text-[#2a1d1b]" : "text-white"}`}>
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Outside the header: its backdrop-filter would trap a fixed overlay inside the bar. */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#1a0f0d]/96 backdrop-blur-xl lg:hidden">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-5 top-4 rounded-full p-2.5 text-white">
              <X className="h-6 w-6" />
            </button>
            <nav className="flex h-full flex-col items-center justify-center gap-7">
              {NAV.map((n, i) => (
                <motion.a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, ease }}
                  className={`${serif} text-4xl text-white`}
                >
                  {n.label}
                </motion.a>
              ))}
              <Link href="/johndorf/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#b4241c] px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                <Compass className="h-4 w-4" /> Montierra map
              </Link>
              <form action={signOutJohndorf}>
                <button type="submit" className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Sign out</button>
              </form>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */

function Hero() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(t)
  }, [])
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const words = ["Always", "there."]

  return (
    <section id="top" ref={ref} className="relative h-[100svh] min-h-[640px] overflow-hidden bg-[#1a0f0d] text-white">
      <motion.div style={{ y }} className="absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.div key={HERO_SLIDES[i].src} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, ease: "easeInOut" }} className="absolute inset-0">
            <Image src={HERO_SLIDES[i].src} alt={HERO_SLIDES[i].caption} fill priority={i === 0} sizes="100vw" className="jd-kenburns object-cover" />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_60%,rgba(26,15,13,0.25),rgba(26,15,13,0.85))]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0d] via-transparent to-[#1a0f0d]/50" />

      <motion.div style={{ opacity: fade }} className="relative mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pb-10 sm:px-8 sm:pb-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease }}>
          <Eyebrow light>{COMPANY.name} · Since {COMPANY.founded}</Eyebrow>
        </motion.div>
        <h1 className={`${serif} mt-5 text-[64px] font-semibold leading-[0.95] tracking-tight sm:text-[110px] lg:text-[148px]`}>
          {words.map((w, n) => (
            <span key={w} className="-mb-[0.16em] mr-[0.22em] inline-block overflow-hidden pb-[0.16em] align-bottom">
              <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ delay: 0.35 + n * 0.14, duration: 1, ease }}>
                {n === 1 ? <span className="italic text-[#f0b6b1]">{w}</span> : w}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.8, ease }} className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
          Homes and communities for every Filipino family — across {CITIES.slice(0, -1).join(", ")} and {CITIES.at(-1)}.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.8, ease }} className="mt-8 flex flex-wrap gap-3">
          <Link href="/johndorf/dashboard" className="group inline-flex items-center gap-2.5 rounded-full bg-[#b4241c] px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_18px_40px_-14px_rgba(180,36,28,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#941414]">
            Explore Montierra <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a href="#portfolio" className="inline-flex items-center gap-2.5 rounded-full border border-white/35 bg-white/5 px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15">
            Our portfolio
          </a>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md lg:grid-cols-4">
          {STATS.map((s, n) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 + n * 0.08, duration: 0.7, ease }} className="bg-[#1a0f0d]/30 px-5 py-4 sm:px-6 sm:py-5">
              <p className={`${serif} text-3xl font-semibold sm:text-4xl`}>
                <Counter to={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 sm:text-[11px]">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 text-xs text-white/60">
          <AnimatePresence mode="wait">
            <motion.span key={HERO_SLIDES[i].caption} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }} className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> {HERO_SLIDES[i].caption}
            </motion.span>
          </AnimatePresence>
          <div className="flex gap-1.5">
            {HERO_SLIDES.map((s, n) => (
              <button key={s.src} type="button" aria-label={`Show ${s.caption}`} onClick={() => setI(n)} className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`} />
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}

/* ─── Cities ticker ──────────────────────────────────────────────────────── */

function CityMarquee() {
  const items = [...CITIES, ...PROJECTS.map((p) => p.name)]
  const row = [...items, ...items]
  return (
    <div className="relative overflow-hidden border-y border-[#efe6e2] bg-white py-5">
      <motion.div className="flex w-max gap-10 whitespace-nowrap" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}>
        {row.map((c, n) => (
          <span key={n} className={`flex items-center gap-10 ${serif} text-2xl ${CITIES.includes(c) ? "text-[#2a1d1b]" : "italic text-[#b4241c]/70"}`}>
            {c}
            <span className="h-1.5 w-1.5 rounded-full bg-[#b4241c]/40" />
          </span>
        ))}
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white" />
    </div>
  )
}

/* ─── Story ──────────────────────────────────────────────────────────────── */

function Story() {
  return (
    <section id="story" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <Reveal className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[28px]">
            <Image src="/johndorf/site/family.jpg" alt="A Johndorf family" fill sizes="(min-width:1024px) 50vw, 100vw" className="jd-kenburns object-cover" />
          </div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.9, ease }}
            className="absolute -bottom-8 right-4 w-[62%] overflow-hidden rounded-2xl border-4 border-[#fbf8f6] shadow-2xl sm:-right-8"
          >
            <div className="relative aspect-[16/10]">
              <Image src="/johndorf/site/tower-inauguration.jpg" alt="Johndorf Tower inauguration" fill sizes="30vw" className="object-cover" />
            </div>
          </motion.div>
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow>Who we are</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
              Fostering Filipino prosperity with homes and <span className="italic text-[#b4241c]">vibrant communities.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#6b5a56]">
              {COMPANY.origin} in {COMPANY.founded}, Johndorf is a wholly Filipino-owned developer. Its mission: {COMPANY.mission.charAt(0).toLowerCase() + COMPANY.mission.slice(1)}
            </p>
          </Reveal>

          <ol className="relative mt-10 space-y-5 border-l border-[#e6d8d3] pl-7">
            {TIMELINE.map((t, n) => (
              <motion.li
                key={t.title}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: n * 0.06, duration: 0.6, ease }}
                className="relative"
              >
                <span className="absolute -left-[33px] top-1.5 h-3 w-3 rounded-full border-2 border-[#b4241c] bg-[#fbf8f6]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b4241c]">{t.year}</p>
                <p className={`${serif} text-xl font-semibold`}>{t.title}</p>
                <p className="text-sm leading-relaxed text-[#7d6c68]">{t.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ─── Flagships ─────────────────────────────────────────────────────────── */

function Flagships() {
  const [big, ...rest] = FLAGSHIPS
  return (
    <section id="flagships" className="scroll-mt-20 bg-[#1a0f0d] py-24 text-white sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow light>Flagships</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className={`${serif} mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
                From affordable homes to <span className="italic text-[#f0b6b1]">skylines.</span>
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <FlagshipCard f={big} tall />
          <div className="grid gap-5">
            {rest.map((f) => (
              <FlagshipCard key={f.id} f={f} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FlagshipCard({ f, tall = false }: { f: (typeof FLAGSHIPS)[number]; tall?: boolean }) {
  return (
    <Reveal>
      <motion.article whileHover="hover" className={`group relative overflow-hidden rounded-[26px] ${tall ? "min-h-[460px] lg:h-full" : "min-h-[300px]"}`}>
        <motion.div variants={{ hover: { scale: 1.06 } }} transition={{ duration: 1.2, ease }} className="absolute inset-0">
          <Image src={f.image} alt={f.name} fill sizes={tall ? "(min-width:1024px) 58vw, 100vw" : "(min-width:1024px) 42vw, 100vw"} className="object-cover" style={{ objectPosition: "focus" in f ? f.focus : undefined }} />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0d] via-[#1a0f0d]/40 to-transparent" />
        <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-7 sm:p-9">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f0b6b1] backdrop-blur">
            <Sparkles className="h-3 w-3" /> {f.kicker}
          </span>
          <h3 className={`${serif} ${tall ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"} font-semibold`}>{f.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
            <MapPin className="h-3.5 w-3.5" /> {f.place}
          </p>
          <p className={`mt-4 max-w-lg text-sm leading-relaxed text-white/80 ${tall ? "" : "hidden sm:block"}`}>{f.text}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {f.facts.map((x) => (
              <span key={x} className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/90">
                {x}
              </span>
            ))}
          </div>
        </div>
      </motion.article>
    </Reveal>
  )
}

/* ─── Portfolio ─────────────────────────────────────────────────────────── */

function Portfolio() {
  const regions: ("All" | Region)[] = ["All", "Cebu", "Cagayan de Oro", "Iligan"]
  const [region, setRegion] = useState<"All" | Region>("All")
  const shown = PROJECTS.filter((p) => region === "All" || p.region === region)

  return (
    <section id="portfolio" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow>Portfolio</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
                Find your <span className="italic text-[#b4241c]">perfect home.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <div className="flex flex-wrap gap-1.5 rounded-full border border-[#ecdfda] bg-white p-1.5">
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
                  className={`relative rounded-full px-4 py-2 text-[12px] font-semibold tracking-wide transition-colors ${region === r ? "text-white" : "text-[#6b5a56] hover:text-[#2a1d1b]"}`}
                >
                  {region === r && <motion.span layoutId="region-pill" className="absolute inset-0 rounded-full bg-[#2a1d1b]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative">{r}</span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <motion.div layout className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((p) => {
              const card = (
                <motion.article
                  layout
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.45, ease }}
                  whileHover={{ y: -6 }}
                  className="group overflow-hidden rounded-[22px] border border-[#efe6e2] bg-white shadow-[0_20px_50px_-35px_rgba(60,20,10,0.5)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={p.image} alt={p.name} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.07]" />
                    {p.interactive && (
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#b4241c] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        Interactive site plan
                      </span>
                    )}
                    {p.status && (
                      <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2a1d1b] backdrop-blur">
                        {p.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className={`${serif} truncate text-2xl font-semibold`}>{p.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[#8a7a75]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b4241c]" /> {p.place}
                      </p>
                    </div>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${p.interactive ? "bg-[#b4241c] text-white" : "bg-[#f6efec] text-[#b4241c] group-hover:bg-[#b4241c] group-hover:text-white"}`}>
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                </motion.article>
              )
              return p.interactive ? (
                <Link key={p.name} href="/johndorf/dashboard" className="contents">
                  {card}
                </Link>
              ) : (
                card
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}

/* ─── Montierra spotlight ───────────────────────────────────────────────── */

function MontierraSpotlight() {
  const pins = BLOCKS.filter((b) => b.kind === "residential").map((b) => {
    const xs = b.polygon.map((p) => p[0])
    const ys = b.polygon.map((p) => p[1])
    return { id: b.id, x: ((Math.min(...xs) + Math.max(...xs)) / 2 / 2000) * 100, y: ((Math.min(...ys) + Math.max(...ys)) / 2 / 1414) * 100 }
  })
  return (
    <section className="relative overflow-hidden bg-[#2a1d1b] py-24 text-white sm:py-28">
      <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#b4241c]/25 blur-[120px]" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <Reveal>
            <Eyebrow light>Live site plan</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
              Walk Montierra, <span className="italic text-[#f0b6b1]">lot by lot.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { v: BLOCKS.filter((b) => b.kind === "residential").length, l: "Blocks" },
                { v: TOTALS.lots, l: "Home lots" },
                { v: 3, l: "Clusters" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4">
                  <p className={`${serif} text-3xl font-semibold`}>
                    <Counter to={s.v} />
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <Link href="/johndorf/dashboard" className="group mt-9 inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2a1d1b] transition-all hover:-translate-y-0.5">
              Open the site plan <ArrowRight className="h-4 w-4 text-[#b4241c] transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <Link href="/johndorf/dashboard" className="group relative block overflow-hidden rounded-[26px] border border-white/10 bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]">
            <Image src="/johndorf/montierra-plan.jpg" alt="Montierra subdivision plan" width={2048} height={1448} sizes="(min-width:1024px) 55vw, 100vw" className="h-auto w-full transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]" />
            {pins.map(({ id, x, y }, n) => (
              <span key={id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                <span className="relative flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b4241c] opacity-60" style={{ animationDelay: `${n * 0.35}s` }} />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#b4241c]" />
                </span>
              </span>
            ))}
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Recognition ───────────────────────────────────────────────────────── */

function Recognition() {
  const award = AWARDS[0]
  return (
    <section id="recognition" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <Reveal>
          <Eyebrow>Recognition</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className={`${serif} mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
            Built to a standard <span className="italic text-[#b4241c]">others notice.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Reveal>
            <div className="h-full rounded-[26px] border border-[#efe6e2] bg-white p-7 sm:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b4241c] text-white">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b4241c]">{award.year}</p>
                    <p className={`${serif} text-2xl font-semibold`}>{award.body}</p>
                  </div>
                </div>
                <span className={`${serif} text-3xl font-semibold text-[#b4241c]`}>{award.headline}</span>
              </div>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {award.items.map((it) => (
                  <div key={it.project}>
                    <p className={`${serif} text-xl font-semibold`}>{it.project}</p>
                    <ul className="mt-3 space-y-2">
                      {it.wins.map((w, n) => (
                        <motion.li key={w} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: n * 0.08, ease }} className="flex items-start gap-2 text-sm text-[#4b3b37]">
                          <Award className="mt-0.5 h-4 w-4 shrink-0 text-[#b4241c]" /> {w}
                        </motion.li>
                      ))}
                      {it.commended.map((w) => (
                        <li key={w} className="flex items-start gap-2 text-sm text-[#8a7a75]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a59f]" /> Highly commended · {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex h-full flex-col overflow-hidden rounded-[26px] bg-[#1a0f0d] text-white">
              <div className="relative min-h-[300px] flex-1 overflow-hidden">
                <Image src={RECOGNITION.image} alt="Top 4 Developer plaque" fill sizes="(min-width:1024px) 40vw, 100vw" className="jd-kenburns object-cover" />
              </div>
              <div className="p-7 sm:p-9">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
                  <Crown className="h-3 w-3 text-[#f0b6b1]" /> {RECOGNITION.by}
                </span>
                <p className={`${serif} mt-3 text-4xl font-semibold leading-tight`}>{RECOGNITION.title}</p>
                <p className="mt-2 text-sm text-white/70">{RECOGNITION.date}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── Values & people ───────────────────────────────────────────────────── */

const VALUE_ICONS = [HandHeart, Heart, Lightbulb, Users, Gem, ShieldCheck]

function ValuesAndPeople() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-2">
          <div>
            <Reveal>
              <Eyebrow>Core values</Eyebrow>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VALUES.map((v, n) => {
                const Icon = VALUE_ICONS[n]
                return (
                  <motion.div
                    key={v}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: n * 0.06, duration: 0.6, ease }}
                    whileHover={{ y: -4 }}
                    className="rounded-2xl border border-[#efe6e2] bg-[#fbf8f6] p-5"
                  >
                    <Icon className="h-6 w-6 text-[#b4241c]" />
                    <p className={`${serif} mt-4 text-lg font-semibold`}>{v}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <div>
            <Reveal>
              <Eyebrow>Leadership</Eyebrow>
            </Reveal>
            <div className="mt-8 space-y-3">
              {LEADERS.map((l, n) => (
                <motion.div
                  key={l.name}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: n * 0.07, duration: 0.6, ease }}
                  className="flex items-center gap-4 rounded-2xl border border-[#efe6e2] px-5 py-4"
                >
                  <span className={`${serif} flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2a1d1b] text-lg font-semibold text-[#f0b6b1]`}>
                    {l.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <p className={`${serif} text-xl font-semibold`}>{l.name}</p>
                    <p className="text-sm text-[#8a7a75]">{l.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Buying ────────────────────────────────────────────────────────────── */

function Buying() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <Reveal>
          <Eyebrow>Owning a Johndorf home</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
            Three steps to your <span className="italic text-[#b4241c]">front door.</span>
          </h2>
        </Reveal>

        <div className="relative mt-14 grid gap-5 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-transparent via-[#e2cfc9] to-transparent md:block" />
          {BUYING.steps.map((s, n) => (
            <Reveal key={s} delay={n * 0.1} className="h-full">
              <div className="relative h-full rounded-[22px] border border-[#efe6e2] bg-white p-7 text-center">
                <span className={`${serif} mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#b4241c] text-2xl font-semibold text-white shadow-[0_14px_30px_-12px_rgba(180,36,28,0.8)]`}>{n + 1}</span>
                <p className={`${serif} mt-5 text-xl font-semibold`}>{s}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8 flex flex-col gap-6 rounded-[22px] bg-[#2a1d1b] p-7 text-white sm:p-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Financing</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BUYING.financing.map((f) => (
                  <span key={f} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold">{f}</span>
                ))}
              </div>
            </div>
            <div className="lg:max-w-[55%]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Turnover, by Johndorf&apos;s Property Management</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-white/80">
                {BUYING.turnover.map((t, n) => (
                  <span key={t} className="flex items-center gap-2">
                    {t}
                    {n < BUYING.turnover.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[#f0b6b1]" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── News ──────────────────────────────────────────────────────────────── */

function News() {
  return (
    <section id="news" className="scroll-mt-20 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <Reveal>
          <Eyebrow>Updates</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className={`${serif} mt-5 text-4xl font-semibold leading-[1.08] sm:text-6xl`}>
            In the <span className="italic text-[#b4241c]">news.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS.map((n, k) => (
            <Reveal key={n.title} delay={k * 0.08}>
              <a href={n.href} target="_blank" rel="noopener noreferrer" className="group block h-full overflow-hidden rounded-[22px] border border-[#efe6e2] bg-[#fbf8f6] transition-transform duration-300 hover:-translate-y-1.5">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={n.image} alt="" fill sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.07]" />
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b4241c]">{n.date}</p>
                  <p className={`${serif} mt-2 text-lg font-semibold leading-snug`}>{n.title}</p>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b5a56] group-hover:text-[#b4241c]">
                    Read <ArrowUpRight className="h-3.5 w-3.5" />
                  </p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#1a0f0d] text-white">
      <div className="absolute -left-40 bottom-0 h-[480px] w-[480px] rounded-full bg-[#b4241c]/25 blur-[130px]" />
      <div className="relative mx-auto max-w-[1400px] px-5 pb-10 pt-24 sm:px-8">
        <Reveal>
          <p className={`${serif} text-6xl font-semibold leading-none sm:text-8xl lg:text-[150px]`}>
            Always <span className="italic text-[#f0b6b1]">there.</span>
          </p>
        </Reveal>
        <div className="mt-14 grid gap-10 border-t border-white/10 pt-10 sm:grid-cols-3">
          <div>
            <div className="relative h-12 w-[120px]">
              <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" fill sizes="120px" unoptimized className="object-contain object-left brightness-0 invert" />
            </div>
            <p className="mt-4 text-sm text-white/55">A wholly Filipino-owned developer since {COMPANY.founded}.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Head office</p>
            <p className="mt-3 flex gap-2 text-sm leading-relaxed text-white/75">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {COMPANY.hq[0]}
                <br />
                {COMPANY.hq[1]}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Explore</p>
            <Link href="/johndorf/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
              <Compass className="h-4 w-4" /> Montierra site plan
            </Link>
            <a href={COMPANY.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
              <Landmark className="h-4 w-4" /> Official website <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <form action={signOutJohndorf}>
              <button type="submit" className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
        <p className="mt-12 text-[11px] uppercase tracking-[0.18em] text-white/35">
          © {new Date().getFullYear()} {COMPANY.name}
        </p>
      </div>
    </footer>
  )
}
