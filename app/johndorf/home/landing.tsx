"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from "framer-motion"
import { Compass, LogOut, Menu, X } from "lucide-react"
import { COMPANY } from "@/lib/johndorf/company"
import { signOutJohndorf } from "../actions"
import { Buying, Footer, News } from "./closing"
import { Hero } from "./hero"
import { Family, Quotes, Recognition, ValuesMarquee } from "./people"
import { Flagships, MontierraSpotlight, Portfolio } from "./showcase"
import { Footprint, Manifesto, Timeline } from "./story"
import { CursorFollower, ease, serif } from "./ui"

const NAV = [
  { href: "#story", label: "Story" },
  { href: "#flagships", label: "Flagships" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#recognition", label: "Awards" },
  { href: "#people", label: "People" },
  { href: "#news", label: "News" },
]

/** The intro plays once per visit — coming back from the Montierra map skips it. */
const intro = { played: false }

export function JohndorfLanding({ signedIn }: { signedIn: boolean }) {
  const [showIntro, setShowIntro] = useState(() => !intro.played)
  const finish = useCallback(() => {
    intro.played = true
    setShowIntro(false)
  }, [])
  return (
    <div className="bg-[#fbf8f6] text-[#2a1d1b]">
      <AnimatePresence>{showIntro && <Preloader key="intro" onDone={finish} />}</AnimatePresence>
      <ScrollLine />
      <CursorFollower />
      <div aria-hidden className="jd-grain pointer-events-none fixed z-[70]" />
      <TopBar signedIn={signedIn} />
      <Hero ready={!showIntro} />
      <Manifesto />
      <Footprint />
      <Timeline />
      <Flagships />
      <Portfolio />
      <MontierraSpotlight />
      <Recognition />
      <Quotes />
      <Family />
      <ValuesMarquee />
      <Buying />
      <News />
      <Footer signedIn={signedIn} />
    </div>
  )
}

/* ─── Intro: 1986 counts up to today, then the curtain lifts ─────────────── */

function Preloader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const [year, setYear] = useState(COMPANY.founded)
  const progress = useMotionValue(0)
  useEffect(() => {
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = "hidden"
    window.scrollTo(0, 0)
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    if (reduce) {
      timer = setTimeout(onDone, 0)
    } else {
      const start = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1900)
        const e = 1 - Math.pow(1 - p, 3)
        progress.set(e)
        setYear(COMPANY.founded + Math.round(40 * e))
        if (p < 1) raf = requestAnimationFrame(tick)
        else timer = setTimeout(onDone, 420)
      }
      raf = requestAnimationFrame(tick)
    }
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      root.style.overflow = prev
    }
  }, [onDone, progress, reduce])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#160c0a] text-white"
      initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
      exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
      transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.div initial={{ opacity: 0, scale: 0.7, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.9, ease }} className="relative h-16 w-16 sm:h-20 sm:w-20">
        <Image src="/johndorf/mark.png" alt="" fill sizes="80px" unoptimized priority className="object-contain" />
      </motion.div>
      <p className={`${serif} mt-8 text-[88px] font-semibold leading-none tabular-nums sm:text-[150px]`}>{year}</p>
      <motion.p initial={{ opacity: 0, letterSpacing: "0.2em" }} animate={{ opacity: 1, letterSpacing: "0.42em" }} transition={{ duration: 1.6, ease }} className="mt-5 text-center text-[10px] font-semibold uppercase text-white/60 sm:text-[11px]">
        {COMPANY.name}
      </motion.p>
      <div className="mt-10 h-px w-48 bg-white/15 sm:w-64">
        <motion.div style={{ scaleX: progress }} className="h-full origin-left bg-[#b4241c]" />
      </div>
    </motion.div>
  )
}

function ScrollLine() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 32 })
  return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[#b4241c]" />
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */

function TopBar({ signedIn }: { signedIn: boolean }) {
  const { scrollY } = useScroll()
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  // See-through over the opening (it's dark), solid once the page proper begins.
  useMotionValueEvent(scrollY, "change", (y) => {
    const hero = document.getElementById("top")
    setSolid(y > (hero ? hero.offsetHeight - 90 : 40))
  })

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${solid ? "bg-white/90 shadow-[0_10px_30px_-18px_rgba(40,10,5,0.4)] backdrop-blur-xl" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <a href="#top" className="relative block h-11 w-[104px] shrink-0" aria-label="Johndorf Ventures Corporation">
            <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" fill sizes="104px" unoptimized className={`object-contain object-left transition-all duration-500 ${solid ? "" : "brightness-0 invert"}`} />
          </a>
          <nav className="hidden items-center gap-7 lg:flex">
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
            {signedIn && (
              <form action={signOutJohndorf} className="hidden sm:block">
                <button type="submit" aria-label="Sign out" title="Sign out" className={`rounded-full p-2.5 transition-colors ${solid ? "text-[#6b5a56] hover:bg-[#f3ece9]" : "text-white/80 hover:bg-white/10"}`}>
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            )}
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className={`rounded-full p-2.5 lg:hidden ${solid ? "text-[#2a1d1b]" : "text-white"}`}>
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Outside the header: its backdrop-filter would trap a fixed overlay inside the bar. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[75] bg-[#160c0a] lg:hidden"
          >
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-5 top-4 rounded-full p-2.5 text-white">
              <X className="h-6 w-6" />
            </button>
            <nav className="flex h-full flex-col items-center justify-center gap-6">
              {NAV.map((n, i) => (
                <motion.a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + 0.05 * i, ease }}
                  className={`${serif} text-4xl text-white`}
                >
                  {n.label}
                </motion.a>
              ))}
              <Link href="/johndorf/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#b4241c] px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white">
                <Compass className="h-4 w-4" /> Montierra map
              </Link>
              {signedIn && (
                <form action={signOutJohndorf}>
                  <button type="submit" className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                    Sign out
                  </button>
                </form>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
