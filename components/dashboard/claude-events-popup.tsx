"use client"

// A centred pop-up for agents and team leaders (boss via Juliecor, 2026-11-27): "create your events just by
// talking to Claude" — what it does, an example sentence, and the three steps for THEIR situation:
//   · no Claude connected yet        → how to connect (Connect Claude page);
//   · connected before events came   → how to renew the connection so Claude may create events;
//   · already allowed to create them → nothing is shown, and it is recorded so we stop checking.
// The situation comes from GET /api/account/connected-apps (their own connections, `events` per connection).
//
// It reminds, it does not nag: "Remind me later" brings it back after three days, three showings at most,
// "Don't show again" ends it; the button that takes them to Connect Claude ends it too. Each choice is saved on
// their profile (POST /api/account/claude-events-popup → metadata.claude_events_popup), so it follows the account,
// not the device. Mounted by components/dashboard/dashboard-auth-gate.tsx after the setup gates and the
// FHI Assistant teaser — never two pop-ups at once — and never on the Connect Claude page itself.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarPlus, ImageIcon, ListChecks, Sparkles, X } from "lucide-react"
import { gaEvent } from "@/lib/ga"

type Mode = "connect" | "update"
type Action = "go" | "later" | "never" | "close"
export type ClaudeEventsPopupState = { shown?: number; later_at?: string; done_at?: string }

/** Three days between reminders. */
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

const STEPS: Record<Mode, string[]> = {
  connect: [
    "Open Connect Claude in your dashboard. It has a one-minute video and the address to copy.",
    "In claude.ai choose Plugins, Connectors, Add, Add custom connector, and paste the address. A free Claude account works.",
    "Sign in with your FHI login, keep “Create, change and publish your own events” ticked, and press Allow.",
  ],
  update: [
    "Open Connect Claude in your dashboard and press Disconnect on your current connection.",
    "In claude.ai remove the FHI Global connector, then add it again with the same address.",
    "Sign in, keep “Create, change and publish your own events” ticked, and press Allow.",
  ],
}

export function ClaudeEventsPopup({
  firstName,
  connectHref,
  state,
  onDone,
}: {
  firstName: string
  /** Their own Connect Claude page (/agent/connect-claude, /teamleader/connect-claude). */
  connectHref: string
  /** What their profile already holds for this pop-up. */
  state: ClaudeEventsPopupState
  /** The shell records the choice in its copy of the profile, so the pop-up does not return without a reload. */
  onDone: (next: ClaudeEventsPopupState) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const done = useRef(false)
  const shown = state.shown ?? 0
  const laterAt = state.later_at ?? null

  const save = useCallback(
    (action: "later" | "done") => {
      // keepalive: the button that opens Connect Claude navigates away at once, and the record must still land.
      void fetch("/api/account/claude-events-popup", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => {})
      const now = new Date().toISOString()
      onDone(action === "done" ? { shown: shown + 1, done_at: now } : { shown: shown + 1, later_at: now })
    },
    [onDone, shown],
  )

  // The newest `save`, for the check below: the shell hands a new onDone on every render, and the check must not
  // start again because of it.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  // Their situation, once per page load: still snoozed → nothing; already allowed to create events → recorded, nothing shown.
  useEffect(() => {
    if (laterAt && Date.now() - new Date(laterAt).getTime() < SNOOZE_MS) return
    let live = true
    void fetch("/api/account/connected-apps", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ apps?: Array<{ events?: boolean }> }>) : Promise.reject(new Error("no list"))))
      .then((d) => {
        if (!live || done.current) return
        const apps = d.apps ?? []
        if (apps.some((a) => a.events)) {
          done.current = true
          saveRef.current("done")
          return
        }
        setMode(apps.length ? "update" : "connect")
      })
      .catch(() => {
        /* could not tell: say nothing now, ask again on the next visit */
      })
    return () => {
      live = false
    }
  }, [laterAt])

  useEffect(() => {
    if (!mode) return
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    gaEvent("claude_events_popup_shown", { mode })
  }, [mode])

  const finish = useCallback(
    (action: Action) => {
      if (done.current) return
      done.current = true
      dialogRef.current?.close()
      gaEvent("claude_events_popup_close", { action, mode: mode ?? "" })
      // The X, Escape and a tap outside are "later"; only the two clear choices end it.
      save(action === "go" || action === "never" ? "done" : "later")
    },
    [mode, save],
  )

  if (!mode) return null
  const steps = STEPS[mode]

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="claude-events-title"
      onCancel={(e) => {
        e.preventDefault()
        finish("close")
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish("close")
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[640px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-[#0d1117] shadow-[0_40px_120px_-30px_rgba(0,15,35,0.7)] backdrop:bg-[#000c1a]/75 backdrop:backdrop-blur-[3px]"
    >
      <div className="relative px-5 pb-1 pt-5 sm:px-7 sm:pt-6">
        <button
          type="button"
          onClick={() => finish("close")}
          aria-label="Close"
          className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full text-[#6b7280] transition-colors hover:bg-[#f1f3f6] hover:text-[#0d1117]"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
          <Sparkles className="h-3.5 w-3.5" /> {mode === "update" ? "New for your Claude" : "New for you"}
        </p>
        <h2 id="claude-events-title" className="mt-2 pr-8 font-['Outfit'] text-[23px] font-bold leading-tight text-[#001f3f] sm:text-[27px]">
          {firstName ? `Hi ${firstName} — create your events just by talking to Claude` : "Create your events just by talking to Claude"}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4b5563]">
          Tell Claude the event&apos;s name, date and place. FHI saves it for you, draws the poster and shows you the result. No form to fill in.
        </p>
      </div>

      <div className="px-5 pt-4 sm:px-7">
        {/* What they would type — the whole idea in one line. */}
        <div className="rounded-2xl rounded-br-md bg-[#001f3f] px-4 py-3 text-[15px] leading-relaxed text-white">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#d6b357]">You say</span>
          &ldquo;Create an event: Property Talk at Azizi Venice Sales Gallery, 12 December, 3 pm, 30 seats.&rdquo;
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-2.5 text-[14.5px] leading-snug text-[#1f2937] sm:grid-cols-3">
          <li className="flex items-start gap-2.5 rounded-xl bg-[#f6f8fb] px-3 py-3">
            <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-[#b8913f]" aria-hidden="true" />
            <span>Your event is saved as a draft in seconds.</span>
          </li>
          <li className="flex items-start gap-2.5 rounded-xl bg-[#f6f8fb] px-3 py-3">
            <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#b8913f]" aria-hidden="true" />
            <span>FHI draws the poster, or you add your own photo.</span>
          </li>
          <li className="flex items-start gap-2.5 rounded-xl bg-[#f6f8fb] px-3 py-3">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-[#b8913f]" aria-hidden="true" />
            <span>It tells you what is missing, and goes live when you say so.</span>
          </li>
        </ul>
      </div>

      <div className="px-5 pt-5 sm:px-7">
        <p className="font-['Outfit'] text-[16px] font-bold text-[#0d1117]">
          {mode === "update" ? "Your Claude is connected. Three steps to switch this on:" : "Three steps, once:"}
        </p>
        <ol className="mt-2.5 space-y-2.5 text-[14.5px] leading-relaxed text-[#374151]">
          {steps.map((text, i) => (
            <li key={text} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#001f3f] font-['Outfit'] text-[13px] font-bold text-white">{i + 1}</span>
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="px-5 pt-3 text-[13px] text-[#6b7280] sm:px-7">
        <button type="button" onClick={() => finish("never")} className="min-h-11 underline decoration-[#c7ccd4] underline-offset-2 hover:text-[#0d1117]">
          Don&apos;t show this again
        </button>
      </p>

      {/* Always in view, also on a phone where the steps scroll: the two choices people are here for. */}
      <div className="sticky bottom-0 flex flex-col-reverse gap-1 border-t border-[#eef0f3] bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:px-7">
        <button type="button" onClick={() => finish("later")} className="min-h-11 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold text-[#4b5563] transition-colors hover:bg-[#f1f3f6]">
          Remind me later
        </button>
        <Link
          href={connectHref}
          onClick={() => finish("go")}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#001f3f] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00356b] sm:w-auto"
        >
          {mode === "update" ? "Update my Claude" : "Connect Claude"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </dialog>
  )
}
