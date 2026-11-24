"use client"

import { useRef, useState } from "react"
import { Play } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { CONNECT_CLAUDE_CHAPTERS, CONNECT_CLAUDE_TUTORIAL } from "@/lib/films"
import { pickSource } from "@/components/public/film-player"

/**
 * The Connect Claude tutorial on the Connect Claude page: the real screen recording (lib/films.ts) with its steps as
 * a chapter list beside it — a tap on a step plays from there. Like the assistant teaser, nothing downloads until
 * play is pressed (poster only, no src), and the file is picked inside the tap (720p on phones) so iOS allows sound.
 */

const film = CONNECT_CLAUDE_TUTORIAL
const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

export function TutorialVideo({ className = "" }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(-1)

  const playFrom = (at: number) => {
    const v = videoRef.current
    if (!v) return
    if (!v.getAttribute("src")) v.src = pickSource(film)
    v.preload = "auto"
    // Before the file's metadata is in, a seek can be dropped (Safari): seek once it is.
    if (v.readyState >= 1) v.currentTime = at
    else if (at > 0) v.addEventListener("loadedmetadata", () => (v.currentTime = at), { once: true })
    setStarted(true)
    // Inside the tap: iOS allows sound only for play() started by the gesture.
    void v.play().catch(() => {})
    gaEvent("play_film", { film: film.id, at, location: "connect_claude" })
  }

  const onTime = () => {
    const t = videoRef.current?.currentTime ?? 0
    let i = -1
    CONNECT_CLAUDE_CHAPTERS.forEach((c, n) => {
      if (t >= c.at) i = n
    })
    if (i !== current) setCurrent(i)
  }

  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-['Outfit'] text-[17px] font-bold text-[#0d1117]">Watch how · {film.duration}</h2>
        <span className="text-[13px] text-[#6b7280]">The real screens, step by step</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#001f3f]">
          <video
            ref={videoRef}
            controls={started}
            playsInline
            preload="none"
            poster={film.poster}
            className="h-full w-full bg-black"
            onTimeUpdate={onTime}
            onEnded={() => gaEvent("film_ended", { film: film.id, location: "connect_claude" })}
          />
          {!started && (
            <button
              type="button"
              onClick={() => playFrom(0)}
              aria-label={`Play ${film.title} (${film.duration})`}
              className="group absolute inset-0 flex items-end justify-center pb-4 sm:pb-6"
            >
              <span className="inline-flex items-center gap-2.5 rounded-full bg-[#d6b357] py-1.5 pl-1.5 pr-4 text-[#001f3f] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-[1.04] sm:gap-3 sm:py-2 sm:pl-2 sm:pr-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#001f3f] sm:h-9 sm:w-9">
                  <Play className="ml-0.5 h-4 w-4 fill-[#d6b357] text-[#d6b357]" />
                </span>
                <span className="text-[14px] font-bold sm:text-[15px]">Watch · {film.duration}</span>
              </span>
            </button>
          )}
        </div>
        <ol className="flex flex-col gap-1.5">
          {CONNECT_CLAUDE_CHAPTERS.map((c, n) => {
            const on = n === current
            return (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => playFrom(c.at)}
                  aria-current={on ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${on ? "border-[#d6b357] bg-[#fbf6e9]" : "border-[#e8eaed] bg-white hover:bg-[#f4f6f9]"}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-['Outfit'] text-[12px] font-bold ${on ? "bg-[#d6b357] text-[#001f3f]" : "bg-[#001f3f] text-white"}`}>{n + 1}</span>
                  <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-[#0d1117]">{c.label}</span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#6b7280]">{stamp(c.at)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
