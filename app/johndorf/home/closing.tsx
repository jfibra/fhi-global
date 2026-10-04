"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, ArrowUp, ArrowUpRight, Building2, Compass, Landmark, LogOut } from "lucide-react"
import { BUYING, COMPANY, NEWS } from "@/lib/johndorf/company"
import { signOutJohndorf } from "../actions"
import { Eyebrow, Magnetic, Reveal, RiseWords, ease, serif } from "./ui"

/* ─── Buying: three steps, joined by a line that draws as you scroll ─────── */

export function Buying() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.55"] })
  const line = useTransform(scrollYProgress, [0, 1], [0, 1])
  return (
    <section className="bg-[#fbf8f6] px-5 py-24 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <Eyebrow>Owning a Johndorf home</Eyebrow>
        </Reveal>
        <h2 className={`${serif} mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
          <RiseWords text="Three steps to your front door." accent={["front", "door."]} />
        </h2>

        <div ref={ref} className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="absolute left-[16.6%] right-[16.6%] top-[38px] hidden h-[2px] bg-[#2a1d1b]/10 md:block">
            <motion.div style={{ scaleX: line }} className="h-full origin-left bg-[#b4241c]" />
          </div>
          {BUYING.steps.map((s, n) => (
            <Reveal key={s} delay={n * 0.12} className="h-full">
              <div className="relative flex h-full flex-col items-center rounded-[26px] border border-[#efe6e2] bg-white px-7 pb-9 pt-0 text-center">
                <span className={`${serif} -mt-px flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#b4241c] text-3xl font-semibold text-white shadow-[0_18px_36px_-14px_rgba(180,36,28,0.85)] ring-8 ring-[#fbf8f6]`}>{n + 1}</span>
                <p className={`${serif} mt-6 text-2xl font-semibold leading-snug`}>{s}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-8 rounded-[26px] bg-[#2a1d1b] p-7 text-white sm:p-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Financing</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {BUYING.financing.map((f) => (
                  <span key={f} className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b6b1]">Turnover, by Johndorf&apos;s Property Management</p>
              <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm text-white/85">
                {BUYING.turnover.map((t, n) => (
                  <motion.li key={t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + n * 0.08, ease }} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">{n + 1}</span>
                    {t}
                    {n < BUYING.turnover.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-[#f0b6b1]" />}
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── News: the newest story large, the rest beside it ───────────────────── */

export function News() {
  const [lead, ...rest] = NEWS
  return (
    <section id="news" className="scroll-mt-16 bg-white px-5 py-24 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <Eyebrow>Updates</Eyebrow>
        </Reveal>
        <h2 className={`${serif} mt-6 text-4xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl`}>
          <RiseWords text="In the news." accent={["news."]} />
        </h2>
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <Reveal>
            <a href={lead.href} target="_blank" rel="noopener noreferrer" data-cursor="Read" className="group block h-full overflow-hidden rounded-[28px] bg-[#160c0a] text-white">
              <div className="relative aspect-[16/11] overflow-hidden">
                <Image src={lead.image} alt="" fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.06]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#160c0a] via-transparent to-transparent" />
                <span className="absolute left-5 top-5 rounded-full bg-[#b4241c] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">Latest</span>
              </div>
              <div className="p-7 sm:p-9">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0b6b1]">{lead.date}</p>
                <p className={`${serif} mt-3 text-2xl font-semibold leading-snug sm:text-3xl`}>{lead.title}</p>
                <p className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70 group-hover:text-white">
                  Read the story <ArrowUpRight className="h-3.5 w-3.5" />
                </p>
              </div>
            </a>
          </Reveal>
          <div className="grid gap-4">
            {rest.map((n, k) => (
              <Reveal key={n.title} delay={k * 0.08}>
                <a href={n.href} target="_blank" rel="noopener noreferrer" data-cursor="Read" className="group flex gap-5 rounded-[22px] border border-[#efe6e2] bg-[#fbf8f6] p-3 transition-colors hover:border-[#b4241c]/30">
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-40">
                    <Image src={n.image} alt="" fill sizes="160px" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.08]" />
                  </div>
                  <div className="min-w-0 py-1 pr-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b4241c]">{n.date}</p>
                    <p className={`${serif} mt-1.5 line-clamp-3 text-[17px] font-semibold leading-snug`}>{n.title}</p>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#160c0a] text-white">
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[#b4241c]/30 blur-[140px]" />
      <div className="relative mx-auto max-w-[1400px] px-5 pb-10 pt-24 sm:px-8 sm:pt-36">
        <p className={`${serif} text-[19vw] font-semibold leading-[0.9] tracking-tight lg:text-[15vw] xl:text-[13.5rem]`}>
          <RiseWords text="Always there." accent={["there."]} accentClass="italic text-[#f0b6b1]" />
        </p>
        <div className="mt-16 grid gap-10 border-t border-white/10 pt-10 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <div>
            <div className="relative h-12 w-[120px]">
              <Image src="/johndorf/logo.png" alt="Johndorf Ventures Corporation" fill sizes="120px" unoptimized className="object-contain object-left brightness-0 invert" />
            </div>
            <p className="mt-4 max-w-xs text-sm text-white/55">A wholly Filipino-owned developer since {COMPANY.founded}.</p>
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
          <div className="flex items-start sm:justify-end">
            <Magnetic strength={0.5}>
              <a href="#top" aria-label="Back to top" data-cursor="Top" className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 transition-colors hover:bg-white hover:text-[#160c0a]">
                <ArrowUp className="h-5 w-5" />
              </a>
            </Magnetic>
          </div>
        </div>
        <p className="mt-14 text-[11px] uppercase tracking-[0.18em] text-white/35">
          © {new Date().getFullYear()} {COMPANY.name}
        </p>
      </div>
    </footer>
  )
}
