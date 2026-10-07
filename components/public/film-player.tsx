"use client"

import { Fragment, useCallback, useEffect, useRef } from "react"
import Image from "next/image"
import { Play, X } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { InView } from "@/components/public/in-view"

/**
 * FHI's own films (the AVP, the Dubai event) on the About page, served from
 * our S3 as web-optimised MP4 ("faststart": playback begins after the first
 * few hundred KB, the rest streams as it plays). Nothing is fetched until the
 * visitor presses play: the poster is an image, the video has no src.
 *
 * FilmTrigger opens a full-screen cinema (a native <dialog> in the top
 * layer). The file is chosen and play() called inside the tap itself, which
 * is what iOS needs to allow sound. Closing pauses and drops the src, so a
 * closed film never keeps downloading.
 */

export type Film = {
  id: string
  title: string
  /** "3:12" */
  duration: string
  poster: string
  /** 1080p for wide screens, 720p for phones and slow connections. */
  hd: string
  sd: string
  /** Picture width / height (16/9 = 1.78; the Dubai event is 2.35). */
  ratio: number
}

/** Phones, data-saver and slow connections get the 720p file. */
function pickSource(film: Film): string {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const slow = conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")
  return slow || window.matchMedia("(max-width: 767px)").matches ? film.sd : film.hd
}

export function FilmTrigger({
  film,
  className,
  children,
  ariaLabel,
  style,
  startAt = 0,
}: {
  film: Film
  className?: string
  children: React.ReactNode
  ariaLabel?: string
  /** Entrance-delay variables for the site's .wf-* choreography. */
  style?: React.CSSProperties
  /** Open the film at this second (a quote's moment). */
  startAt?: number
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  /** Hover or focus on the button: fetch the file's header and first frames, so the click feels instant. */
  const warm = useCallback(() => {
    const v = videoRef.current
    if (!v || v.getAttribute("src")) return
    v.preload = "metadata"
    v.src = pickSource(film)
  }, [film])

  const openFilm = useCallback(() => {
    const d = dialogRef.current
    const v = videoRef.current
    if (!d || !v) return
    if (!v.getAttribute("src")) v.src = pickSource(film)
    v.preload = "auto"
    if (startAt > 0) {
      // The seek needs the file's index; with faststart that's the first few KB.
      const seek = () => {
        v.currentTime = startAt
      }
      if (v.readyState >= 1) seek()
      else v.addEventListener("loadedmetadata", seek, { once: true })
    }
    d.showModal()
    document.documentElement.classList.add("film-open")
    // Inside the tap: iOS allows sound only for play() started by the gesture.
    void v.play().catch(() => {})
    // Phones: the native full-screen player, which also allows landscape.
    if (window.innerWidth < 768) {
      const native = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
      try {
        if (native.webkitEnterFullscreen) native.webkitEnterFullscreen()
        else void v.requestFullscreen?.().catch(() => {})
      } catch {
        /* stays in the dialog */
      }
    }
    gaEvent("play_film", { film: film.id, at: startAt })
  }, [film, startAt])

  const closeFilm = useCallback(() => {
    const v = videoRef.current
    if (v) {
      v.pause()
      v.removeAttribute("src")
      v.load() // drop the connection: a closed film stops downloading
    }
    dialogRef.current?.close()
    document.documentElement.classList.remove("film-open")
  }, [])

  useEffect(() => () => document.documentElement.classList.remove("film-open"), [])

  return (
    <>
      <button
        type="button"
        onClick={openFilm}
        onPointerEnter={warm}
        onFocus={warm}
        className={className}
        style={style}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        className="film-dialog"
        aria-label={film.title}
        onCancel={(e) => {
          e.preventDefault()
          closeFilm()
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeFilm()
        }}
      >
        <div className="film-stage" style={{ ["--r" as string]: film.ratio }}>
          <video ref={videoRef} controls playsInline preload="none" poster={film.poster} className="h-full w-full bg-black" />
        </div>
        <div className="film-caption">
          <span className="font-['Outfit'] text-[15px] font-bold text-white">{film.title}</span>
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#d6b357]">{film.duration}</span>
        </div>
        <button type="button" onClick={closeFilm} className="film-close" aria-label="Close the film">
          <X className="h-5 w-5" />
        </button>
      </dialog>
    </>
  )
}

/**
 * The About page's screening room: a full-bleed band where a silent 12 s
 * loop of the AVP plays behind the title (fetched only once the band is on
 * screen, never on data-saver or reduced motion, paused when scrolled away),
 * the gold play button for the film, and the Dubai event beside it.
 */
export function ScreeningRoom({ main, teaser, second }: { main: Film; teaser: string; second: Film }) {
  const bandRef = useRef<HTMLElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const band = bandRef.current
    const loop = loopRef.current
    if (!band || !loop) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!loop.src) loop.src = teaser
          void loop.play().catch(() => {})
        } else {
          loop.pause()
        }
      },
      { rootMargin: "200px 0px" },
    )
    io.observe(band)
    return () => io.disconnect()
  }, [teaser])

  return (
    <section ref={bandRef} className="sr relative overflow-hidden bg-[#06182e] text-white" aria-label="Films">
      <div className="absolute inset-0" aria-hidden="true">
        <Image src={main.poster} alt="" fill sizes="100vw" className="object-cover" />
        <video
          ref={loopRef}
          muted
          loop
          playsInline
          preload="none"
          className="sr-loop absolute inset-0 h-full w-full object-cover"
          onPlaying={(e) => e.currentTarget.classList.add("is-on")}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/90 via-[#06182e]/55 to-[#06182e]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/20 to-[#06182e]/40" />
      </div>

      <InView className="relative mx-auto flex min-h-[78vh] max-w-[1440px] flex-col justify-end px-4 pb-14 pt-32 sm:px-6 lg:min-h-[88vh] lg:px-8 lg:pb-20" threshold={0.25}>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
              <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
              <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>The film</span>
            </p>
            <h2 className="mt-4 font-['Outfit'] text-[40px] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_18px_rgba(0,10,30,0.6)] sm:text-[58px] lg:text-[72px]">
              {["This", "is"].map((w, i) => (
                <Fragment key={w}><span className="wf-word"><span style={{ ["--i" as string]: i }}>{w}</span></span>{" "}</Fragment>
              ))}
              {["FHI", "Global."].map((w, i) => (
                <Fragment key={w}><span className="wf-word"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>{" "}</Fragment>
              ))}
            </h2>
            <p className="wf-fade mt-4 max-w-md text-[16px] leading-relaxed text-white/80" style={{ ["--d" as string]: "600ms" }}>
              Our people and our Dubai story, in three minutes.
            </p>
            <FilmTrigger
              film={main}
              className="wf-fade group mt-9 inline-flex items-center gap-4 text-left"
              style={{ ["--d" as string]: "750ms" }}
              ariaLabel={`Play the film: ${main.title}, ${main.duration}`}
            >
              <span className="sr-play-ring relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#d6b357] text-[#001f3f] transition-transform duration-300 group-hover:scale-105">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </span>
              <span>
                <span className="block font-['Outfit'] text-[20px] font-bold text-white">Play the film</span>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-[#d6b357]">{main.duration}</span>
              </span>
            </FilmTrigger>
          </div>

          <FilmTrigger
            film={second}
            className="wf-fade group block w-full max-w-sm text-left lg:w-[360px]"
            style={{ ["--d" as string]: "900ms" }}
            ariaLabel={`Play ${second.title}, ${second.duration}`}
          >
            <span className="relative block aspect-[16/9] overflow-hidden border border-white/15 bg-black shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
              <Image src={second.poster} alt="" fill sizes="360px" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#06182e]/85 via-transparent to-transparent" aria-hidden="true" />
              <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#06182e]/60 backdrop-blur transition-colors group-hover:border-[#d6b357] group-hover:bg-[#d6b357] group-hover:text-[#001f3f]">
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              </span>
              <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#d6b357]">Also watch</span>
                  <span className="block font-['Outfit'] text-[17px] font-bold text-white">{second.title}</span>
                </span>
                <span className="text-[12px] font-semibold text-white/75">{second.duration}</span>
              </span>
            </span>
          </FilmTrigger>
        </div>
      </InView>
    </section>
  )
}

/**
 * A silent loop behind the About page's opening photo. It is the first
 * thing on screen, so it must never slow the page: the photo paints first,
 * the loop is fetched only after the window's load event (fonts, hero image
 * and scripts are done by then), fades in once it actually plays, pauses
 * when scrolled away, and phones get the smaller file. Skipped entirely on
 * data-saver and reduced motion.
 */
export function HeroLoop({ hd, sd, className = "" }: { hd: string; sd: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData || /(^|-)2g/.test(conn?.effectiveType ?? "")) return
    let started = false
    const start = () => {
      if (started) return
      started = true
      v.src = window.innerWidth < 768 ? sd : hd
      void v.play().catch(() => {})
    }
    const t = window.setTimeout(start, 4000) // the load event never fires on a stalled page; don't wait forever
    if (document.readyState === "complete") start()
    else window.addEventListener("load", start, { once: true })
    const io = new IntersectionObserver(([e]) => {
      if (!started) return
      if (e.isIntersecting) void v.play().catch(() => {})
      else v.pause()
    })
    io.observe(v)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("load", start)
      io.disconnect()
    }
  }, [hd, sd])

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className={`pp-hero-loop absolute inset-0 h-full w-full object-cover ${className}`}
      onPlaying={(e) => e.currentTarget.classList.add("is-on")}
    />
  )
}

export type FilmLine = { at: number; text: string; who: string; role?: string }
const stamp = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`

/** Lines spoken in the film, each with a chip that opens the cinema at that exact moment. */
export function FilmLines({ film, lines }: { film: Film; lines: FilmLine[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {lines.map((l, i) => (
        <figure key={l.at} className="wf-fade relative flex flex-col border border-[#e5e8ec] bg-white p-6 sm:p-7" style={{ ["--d" as string]: `${150 + i * 120}ms` }}>
          <span className="font-['Outfit'] text-[56px] font-bold leading-none text-[#d6b357]" aria-hidden="true">&ldquo;</span>
          <blockquote className="-mt-4 font-['Outfit'] text-[20px] font-bold leading-[1.3] text-[#0d1117] sm:text-[22px]">{l.text}</blockquote>
          <figcaption className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <span>
              <span className="block text-[13.5px] font-bold text-[#0d1117]">{l.who}</span>
              {l.role && <span className="block text-[12px] text-[#6b7280]">{l.role}</span>}
            </span>
            <FilmTrigger
              film={film}
              startAt={l.at}
              className="group inline-flex items-center gap-2 border border-[#e5e8ec] px-3 py-2 text-[12.5px] font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10"
              ariaLabel={`Play the film from ${stamp(l.at)}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0d1117] text-[#d6b357] transition-colors group-hover:bg-[#d6b357] group-hover:text-[#001f3f]">
                <Play className="ml-px h-3 w-3 fill-current" />
              </span>
              {stamp(l.at)}
            </FilmTrigger>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export type Story = Film & { name: string; role: string }

/** A row of story films: the poster, a play badge, who it is and how long. Scrolls sideways on phones. */
export function StoryRow({ label, stories, cols }: { label: string; stories: Story[]; cols: 3 | 4 }) {
  return (
    <div className="mt-10 first:mt-0">
      <p className="wf-fade mb-4 text-[11px] font-bold uppercase tracking-[0.26em] text-[#b8913f]">{label}</p>
      <ul className={`-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        {stories.map((st, i) => (
          <li key={st.id} className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <FilmTrigger film={st} className="wf-fade group block w-full text-left" style={{ ["--d" as string]: `${120 + i * 110}ms` }} ariaLabel={`Play ${st.title}, ${st.duration}`}>
              <span className="relative block aspect-[16/9] overflow-hidden bg-[#0b2a4d]">
                <Image src={st.poster} alt="" fill sizes="(max-width: 640px) 78vw, 320px" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                <span className="absolute inset-0 bg-gradient-to-t from-[#06182e]/80 via-transparent to-transparent" aria-hidden="true" />
                <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#06182e]/60 text-white backdrop-blur transition-colors group-hover:border-[#d6b357] group-hover:bg-[#d6b357] group-hover:text-[#001f3f]">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
                <span className="absolute bottom-3 right-3 text-[12px] font-semibold text-white/80">{st.duration}</span>
              </span>
              <span className="mt-3 block font-['Outfit'] text-[17px] font-bold leading-snug text-[#0d1117] transition-colors group-hover:text-[#8a6d2b]">{st.name}</span>
              <span className="block text-[12.5px] text-[#6b7280]">{st.role}</span>
            </FilmTrigger>
          </li>
        ))}
      </ul>
    </div>
  )
}
