"use client"

// Shown once over the dashboard to everyone with an FHI Assistant — agents, team leaders and admin staff (boss
// via Juliecor, 2026-11-04): a centred pop-up
// that introduces FHI Assistant and plays its 90-second teaser (lib/films.ts ASSISTANT_TEASER — female voice,
// captions burned in, so it still reads with the sound off). Try FHI Assistant opens the chat; Maybe later,
// the X, Escape or a tap outside close it. Any of those records it on the profile
// (POST /api/account/assistant-teaser → metadata.assistant_teaser_seen_at), so it doesn't come back on this
// device or another; the FHI Assistant page keeps a "Watch the 90-second tour" button for later.
//
// Nothing downloads until play is pressed: the poster is an image and the <video> has no src until then, and the
// file is picked inside the tap (720p on phones), which is what iOS needs to allow sound.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Play, Sparkles, X } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { ASSISTANT_TEASER } from "@/lib/films"
import { pickSource } from "@/components/public/film-player"

type Action = "try" | "later" | "close"

export function AssistantTeaserPopup({
  firstName,
  chatHref,
  onDone,
}: {
  firstName: string
  /** Their own FHI Assistant page (/agent/fhi-chat, /teamleader/fhi-chat, /admin/fhi-chat …). */
  chatHref: string
  /** The shell drops the pop-up without a reload. */
  onDone: () => void
}) {
  const film = ASSISTANT_TEASER
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    gaEvent("assistant_teaser_shown")
  }, [])

  const finish = useCallback(
    (action: Action) => {
      if (done.current) return
      done.current = true
      const v = videoRef.current
      const watched = v && v.getAttribute("src") ? Math.round(v.currentTime) : 0
      if (v) {
        v.pause()
        v.removeAttribute("src")
        v.load() // a closed film stops downloading
      }
      dialogRef.current?.close()
      gaEvent("assistant_teaser_close", { action, watched_s: watched })
      // keepalive: "Try" navigates away at once, and the record must still land.
      void fetch("/api/account/assistant-teaser", { method: "POST", keepalive: true }).catch(() => {})
      onDone()
    },
    [onDone],
  )

  const play = () => {
    const v = videoRef.current
    if (!v) return
    if (!v.getAttribute("src")) v.src = pickSource(film)
    v.preload = "auto"
    setPlaying(true)
    // Inside the tap: iOS allows sound only for play() started by the gesture.
    void v.play().catch(() => {})
    gaEvent("play_film", { film: film.id, at: 0, location: "assistant_teaser_popup" })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="assistant-teaser-title"
      onCancel={(e) => {
        e.preventDefault()
        finish("close")
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish("close")
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[720px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-[#0d1117] shadow-[0_40px_120px_-30px_rgba(0,15,35,0.7)] backdrop:bg-[#000c1a]/75 backdrop:backdrop-blur-[3px]"
    >
      <div className="relative px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
        <button
          type="button"
          onClick={() => finish("close")}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-[#6b7280] transition-colors hover:bg-[#f1f3f6] hover:text-[#0d1117]"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
          <Sparkles className="h-3.5 w-3.5" /> New in your dashboard
        </p>
        <h2 id="assistant-teaser-title" className="mt-2 pr-8 font-['Outfit'] text-[24px] font-bold leading-tight text-[#001f3f] sm:text-[28px]">
          {firstName ? `Hi ${firstName} — meet FHI Assistant` : "Meet FHI Assistant"}
        </h2>
        <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[#4b5563]">
          Ask about sales, leads, teams or any project in plain words, and get the answer from FHI&apos;s live data in seconds.
          Watch the 90-second tour.
        </p>
      </div>

      <div className="relative aspect-video w-full bg-[#001f3f]">
        <video
          ref={videoRef}
          controls={playing}
          playsInline
          preload="none"
          poster={film.poster}
          className="h-full w-full bg-black"
          onEnded={() => gaEvent("film_ended", { film: film.id, location: "assistant_teaser_popup" })}
        />
        {!playing && (
          <button
            type="button"
            onClick={play}
            aria-label={`Play ${film.title} (${film.duration})`}
            // Low on the frame: the poster's title sits in the middle and must stay readable.
            className="group absolute inset-0 flex items-end justify-center pb-3 sm:pb-6"
          >
            <span className="inline-flex items-center gap-2.5 rounded-full bg-[#d6b357] py-1.5 pl-1.5 pr-4 text-[#001f3f] shadow-[0_14px_40px_-10px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-[1.04] sm:gap-3 sm:py-2.5 sm:pl-2.5 sm:pr-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#001f3f] sm:h-10 sm:w-10">
                <Play className="ml-0.5 h-4 w-4 fill-[#d6b357] text-[#d6b357] sm:h-5 sm:w-5" />
              </span>
              <span className="text-[14px] font-bold sm:text-[15px]">Watch · {film.duration}</span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
        <button
          type="button"
          onClick={() => finish("later")}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-[#4b5563] transition-colors hover:bg-[#f1f3f6]"
        >
          Maybe later
        </button>
        <Link
          href={chatHref}
          onClick={() => finish("try")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
        >
          Try FHI Assistant <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </dialog>
  )
}
