"use client"

/**
 * Event raffle — full-screen navy/gold stage made to be projected at the
 * venue. Names spin on a vertical roulette reel past a gold ticker window,
 * decelerate with a slot-machine easing curve, and land on a random winner
 * with a confetti burst. A prize label ("Car Raffle", "iPhone 16", …) shows
 * on stage and is stamped onto each winner in the side panel (clearable,
 * exportable to PDF). Previous winners are excluded from later draws by
 * default.
 *
 * The backdrop (world-map dots, skyline, gold ribbons, drifting flakes,
 * sparkles) is pure CSS/SVG — no image assets.
 */

import { useMemo, useRef, useState } from "react"
import {
  Building2, Check, Eraser, FileText, Gift, Loader2, Mail, Medal, PartyPopper,
  RotateCcw, Trophy, Users, X,
} from "lucide-react"

type RaffleEntry = {
  id: string
  fullName: string
  email: string
}

type Phase = "idle" | "spinning" | "winner"

/** A draw result: who won and what they won (prize label typed by the host). */
type WinnerRecord = { entry: RaffleEntry; prize: string }

const ROW_H = 96 // px height of one reel row
const SPIN_MS = 5200

const CONFETTI_COLORS = ["#d6b357", "#f0d890", "#ffffff", "#4f83c4", "#34d399", "#f472b6"]
const GOLD_TONES = ["#d6b357", "#f0d890", "#b8913f", "#f7e5a5"]

function ConfettiBurst() {
  // Generated once per mount (each winner reveal remounts via key).
  const pieces = useMemo(
    () =>
      Array.from({ length: 130 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.6 + Math.random() * 2.4,
        size: 7 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tilt: Math.random() * 360,
        drift: -40 + Math.random() * 80,
        round: Math.random() > 0.6,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            left: `${p.left}%`,
            top: "-4%",
            width: p.size,
            height: p.size * (p.round ? 1 : 0.45),
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "2px",
            transform: `rotate(${p.tilt}deg)`,
            animationName: "raffle-confetti",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

/** Sparse gold flakes drifting down forever — ambience, not celebration. */
function AmbientFlakes() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 41 + 13) % 100,
        delay: (i * 0.83) % 7,
        duration: 7 + ((i * 1.7) % 6),
        size: 4 + ((i * 2.3) % 6),
        color: GOLD_TONES[i % GOLD_TONES.length],
        drift: -30 + ((i * 17) % 60),
        round: i % 3 !== 0,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            left: `${f.left}%`,
            top: "-3%",
            width: f.size,
            height: f.size * (f.round ? 1 : 0.5),
            backgroundColor: f.color,
            borderRadius: f.round ? "50%" : "2px",
            animationName: "raffle-confetti",
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            ["--drift" as string]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

/** Static backdrop: dotted world texture, skyline, gold ribbons, sparkles. */
function StageBackdrop() {
  return (
    <>
      {/* Dotted map-like texture, fading toward the edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(214,196,255,0.14) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 38%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 38%, black 30%, transparent 75%)",
        }}
        aria-hidden
      />
      {/* Gold light rays from below */}
      <div
        className="absolute inset-0 opacity-35 pointer-events-none"
        style={{
          background:
            "conic-gradient(from 170deg at 50% 130%, transparent 0deg, rgba(214,179,87,0.26) 6deg, transparent 12deg, rgba(214,179,87,0.16) 20deg, transparent 26deg, rgba(214,179,87,0.28) 34deg, transparent 40deg, rgba(214,179,87,0.15) 48deg, transparent 54deg, rgba(214,179,87,0.24) 62deg, transparent 68deg, rgba(214,179,87,0.16) 76deg, transparent 82deg, rgba(214,179,87,0.26) 90deg, transparent 96deg)",
        }}
        aria-hidden
      />
      {/* Skyline silhouette + sweeping gold ribbons */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full pointer-events-none"
        viewBox="0 0 1440 260"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="raffle-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d6b357" stopOpacity="0" />
            <stop offset="0.35" stopColor="#f0d890" stopOpacity="0.9" />
            <stop offset="0.7" stopColor="#d6b357" stopOpacity="0.5" />
            <stop offset="1" stopColor="#d6b357" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 260 L0 150 L46 150 L46 110 L78 110 L78 168 L118 168 L118 84 L132 84 L132 70 L160 70 L160 178 L204 178 L204 128 L242 128 L242 190 L282 190 L282 104 L306 104 L306 92 L330 92 L330 200 L1440 200 L1440 260 Z"
          fill="#04122a"
          opacity="0.85"
        />
        <path
          d="M0 152 L46 152 L46 112 L78 112 L78 170 L118 170 L118 86 L132 86 L132 72 L160 72 L160 180 L204 180 L204 130 L242 130 L242 192 L282 192 L282 106 L306 106 L306 94 L330 94 L330 202"
          fill="none"
          stroke="rgba(214,179,87,0.35)"
          strokeWidth="1.5"
        />
        <path d="M-40 240 C 320 140, 620 300, 1480 170" fill="none" stroke="url(#raffle-gold)" strokeWidth="2.5" opacity="0.5" />
        <path d="M-40 262 C 380 180, 700 330, 1480 210" fill="none" stroke="url(#raffle-gold)" strokeWidth="1.5" opacity="0.35" />
      </svg>
      {/* Pulsing sparkle stars */}
      {[
        { left: "18%", top: "16%", s: 14, d: "0s" },
        { left: "72%", top: "12%", s: 10, d: "0.8s" },
        { left: "84%", top: "34%", s: 16, d: "1.6s" },
        { left: "10%", top: "48%", s: 10, d: "2.2s" },
        { left: "60%", top: "22%", s: 8, d: "2.9s" },
      ].map((st, i) => (
        <span
          key={i}
          className="absolute text-[#f0d890] pointer-events-none select-none"
          style={{
            left: st.left,
            top: st.top,
            fontSize: st.s,
            animation: `raffle-twinkle 3.4s ease-in-out ${st.d} infinite`,
          }}
          aria-hidden
        >
          ✦
        </span>
      ))}
      <AmbientFlakes />
    </>
  )
}

export function EventRaffle({
  eventId,
  eventTitle,
  entries,
  onClose,
}: {
  eventId: string
  eventTitle: string
  entries: RaffleEntry[]
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [winners, setWinners] = useState<WinnerRecord[]>([])
  const [excludeWinners, setExcludeWinners] = useState(true)
  // What's being raffled this draw ("Car Raffle", "iPhone 16", …) — shown on
  // the stage and stamped onto each winner in the side panel.
  const [prize, setPrize] = useState("")

  // Roulette reel state: the strip of names and its animated Y offset.
  const [reel, setReel] = useState<RaffleEntry[]>([])
  const [reelY, setReelY] = useState(0)
  const [reelTransition, setReelTransition] = useState("none")
  const winnerIndexRef = useRef(0)
  const pendingWinnerRef = useRef<RaffleEntry | null>(null)

  const wonIds = new Set(winners.map((w) => w.entry.id))
  const pool = excludeWinners ? entries.filter((e) => !wonIds.has(e.id)) : entries
  const latestWinner = winners[winners.length - 1] ?? null

  const draw = () => {
    if (pool.length === 0 || phase === "spinning") return
    // The winner is chosen up-front; the reel is pure theatre.
    const winner = pool[Math.floor(Math.random() * pool.length)]

    // Random filler that differs from the previous row, so the reel never
    // shows the same name twice in a row (impossible with a 1-person pool).
    const pickDifferent = (prev: RaffleEntry | null): RaffleEntry => {
      if (pool.length === 1) return pool[0]
      let candidate = pool[Math.floor(Math.random() * pool.length)]
      while (prev && candidate.id === prev.id) {
        candidate = pool[Math.floor(Math.random() * pool.length)]
      }
      return candidate
    }

    // Build the strip: plenty of filler rows, the winner, then two trailing
    // rows so the window below the ticker isn't empty when it stops.
    const fillers = Math.max(40, Math.min(80, pool.length * 4))
    const rows: RaffleEntry[] = []
    for (let i = 0; i < fillers; i++) {
      rows.push(pickDifferent(rows[rows.length - 1] ?? null))
    }
    // The row right before the winner must differ from the winner too.
    if (pool.length > 1 && rows[rows.length - 1].id === winner.id) {
      const replacement = pool.filter((e) => e.id !== winner.id && e.id !== rows[rows.length - 2]?.id)
      rows[rows.length - 1] = replacement[Math.floor(Math.random() * replacement.length)] ?? rows[rows.length - 1]
    }
    const winnerIndex = rows.length
    rows.push(winner)
    for (let i = 0; i < 2; i++) {
      rows.push(pickDifferent(rows[rows.length - 1]))
    }

    winnerIndexRef.current = winnerIndex
    pendingWinnerRef.current = winner
    setReel(rows)
    setReelTransition("none")
    setReelY(0)
    setPhase("spinning")

    // Two frames so the reset position paints before the transition starts.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReelTransition(`transform ${SPIN_MS}ms cubic-bezier(0.12, 0.85, 0.22, 1)`)
        // Land the winner row in the center slot of the 3-row window.
        setReelY(-(winnerIndex - 1) * ROW_H)
      })
    })
  }

  const settle = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Only the reel strip's own transform transition counts — child rows have
    // their own transitions whose end events bubble up here.
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return
    if (phase !== "spinning") return
    // Capture before clearing: the setWinners updater runs after this handler,
    // so reading the ref inside it would see null.
    const winner = pendingWinnerRef.current
    if (!winner) return
    pendingWinnerRef.current = null
    setWinners((w) => [...w, { entry: winner, prize: prize.trim() }])
    setPhase("winner")
  }

  // Per-winner email status (keyed by position in the winners list). The
  // generation counter keeps an in-flight send from a cleared list from
  // stamping its status onto a new winner at the same index.
  const [mailStatus, setMailStatus] = useState<Record<number, "sending" | "sent" | "error">>({})
  const mailGenRef = useRef(0)

  const emailWinner = async (index: number, w: WinnerRecord) => {
    if (mailStatus[index] === "sending" || mailStatus[index] === "sent") return
    const gen = mailGenRef.current
    setMailStatus((m) => ({ ...m, [index]: "sending" }))
    try {
      const res = await fetch(`/api/admin/events/${eventId}/notify-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: w.entry.id, prize: w.prize }),
      })
      if (!res.ok) throw new Error("failed")
      if (gen === mailGenRef.current) setMailStatus((m) => ({ ...m, [index]: "sent" }))
    } catch {
      if (gen === mailGenRef.current) setMailStatus((m) => ({ ...m, [index]: "error" }))
    }
  }

  const clearWinners = () => {
    if (winners.length === 0) return
    if (!window.confirm("Clear the winners list? The next draw starts fresh.")) return
    mailGenRef.current++
    setWinners([])
    setMailStatus({})
    setPhase("idle")
    setReel([])
  }

  // Branded print view of the winners — the browser's print dialog offers
  // "Save as PDF" (or direct printing for prize hand-out at the venue).
  const exportWinnersPdf = () => {
    if (winners.length === 0) return
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=900,height=700")
    if (!w) return
    const generated = new Date().toLocaleString("en-AE", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    })
    const body = winners
      .map(
        (r, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td><strong>${esc(r.entry.fullName)}</strong></td>
          <td>${esc(r.entry.email)}</td>
          <td>${r.prize ? `<span class="prize">${esc(r.prize)}</span>` : "—"}</td>
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Raffle Winners — ${esc(eventTitle)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #ffffff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; flex-wrap: wrap; gap: 20px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12.5px; }
  th { background: #001f3f; color: #ffffff; text-align: left; padding: 9px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 9px 12px; border-bottom: 1px solid #eef0f3; }
  tr:nth-child(even) td { background: #fafbfc; }
  .n { color: #9ca3af; width: 34px; }
  .prize { background: #fdf6e3; color: #8a6d2a; border: 1px solid #e7d9a8; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { margin: 14mm; }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Raffle Winners</p><h1>${esc(eventTitle)}</h1></div>
  <div class="meta">
    <span>Total winners: <strong>${winners.length}</strong></span>
    <span>Drawn: <strong>${esc(generated)}</strong></span>
  </div>
  <table>
    <thead><tr><th>#</th><th>Winner</th><th>Email</th><th>Prize</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">Generated from the FHI Global live raffle · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-gradient-to-b from-[#0b2c58] via-[#072141] to-[#051a33] overflow-hidden">
      <StageBackdrop />

      {phase === "winner" && <ConfettiBurst key={winners.length} />}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-6">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-2xl bg-[#d6b357]/12 border border-[#d6b357]/40 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-[#d6b357]" />
          </span>
          <div>
            <p className="text-[#f0d890] text-xs sm:text-sm font-bold uppercase tracking-[0.35em]">
              FHI Global · Live Raffle
            </p>
            <p className="text-white/80 text-sm sm:text-base font-semibold mt-0.5 max-w-[55vw] truncate">{eventTitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Close raffle"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col lg:flex-row min-h-0">
        {/* ── Stage ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Prize plaque — what this draw is for, big enough for the projector */}
          {phase !== "idle" && prize.trim() && (
            <p className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-[#d6b357]/10 border border-[#d6b357]/40 text-[#f0d890] text-lg sm:text-2xl font-bold uppercase tracking-[0.2em] mb-4">
              <Gift className="w-6 h-6 shrink-0" />
              {prize.trim()}
            </p>
          )}

          {phase === "idle" ? (
            <>
              {/* Gold medallion */}
              <span className="relative rounded-full p-[5px] bg-gradient-to-br from-[#f7e5a5] via-[#d6b357] to-[#8f6f2d] shadow-[0_0_90px_-8px_rgba(214,179,87,0.55)] mb-7">
                <span className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#0a2440] flex items-center justify-center">
                  <Gift className="w-12 h-12 sm:w-14 sm:h-14 text-[#f0d890]" />
                </span>
                <span className="absolute -top-1 -right-2 text-[#f0d890] text-lg select-none" aria-hidden>✦</span>
                <span className="absolute -bottom-2 -left-3 text-[#d6b357] text-sm select-none" aria-hidden>✦</span>
              </span>
              <h2 className="font-['Outfit'] text-4xl sm:text-6xl font-bold text-white mb-5">
                Ready to{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#f9e9a8] via-[#f0d890] to-[#c9a449]">
                  draw?
                </span>
              </h2>
              <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/[0.07] border border-white/15 text-white/85 text-sm sm:text-base font-semibold">
                <Users className="w-5 h-5 text-[#d6b357]" />
                {pool.length} participant{pool.length !== 1 ? "s" : ""} in the pool
              </span>
            </>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border text-sm sm:text-base font-bold uppercase tracking-[0.3em] mb-4 transition-all ${
                  phase === "winner"
                    ? "bg-[#d6b357]/15 border-[#d6b357]/60 text-[#f0d890]"
                    : "bg-white/5 border-white/15 text-white/60 animate-pulse"
                }`}
              >
                {phase === "winner" ? <PartyPopper className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                {phase === "winner" ? "Winner" : "Drawing…"}
              </span>

              {/* ── Roulette reel: 3-row window, gold ticker on the center row ── */}
              <div className="relative w-full max-w-4xl">
                {/* Ticker frame + side pointers */}
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: ROW_H, height: ROW_H }}
                  aria-hidden
                >
                  <div className="absolute inset-x-6 sm:inset-x-10 inset-y-0 rounded-2xl border-2 border-[#d6b357]/80 bg-[#d6b357]/5 shadow-[0_0_60px_-10px_rgba(214,179,87,0.5)]" />
                  <span className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[12px] border-y-transparent border-l-[16px] border-l-[#d6b357]" />
                  <span className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[12px] border-y-transparent border-r-[16px] border-r-[#d6b357]" />
                </div>

                {/* Viewport */}
                <div className="relative overflow-hidden" style={{ height: ROW_H * 3 }}>
                  <div
                    style={{ transform: `translateY(${reelY}px)`, transition: reelTransition }}
                    onTransitionEnd={settle}
                  >
                    {reel.map((r, i) => {
                      const isWinnerRow = phase === "winner" && i === winnerIndexRef.current
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-center px-10"
                          style={{ height: ROW_H }}
                        >
                          <p
                            className={`font-['Outfit'] font-bold leading-tight truncate max-w-full transition-all duration-500 ${
                              isWinnerRow
                                ? "text-4xl sm:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-[#f9e9a8] via-[#f0d890] to-[#c9a449]"
                                : phase === "spinning"
                                  ? "text-3xl sm:text-5xl text-white/70 blur-[7px]" // unreadable mid-spin — no early peeking
                                  : "text-3xl sm:text-5xl text-white/45 blur-[5px]" // neighbors stay soft after the reveal
                            }`}
                            style={isWinnerRow ? { filter: "drop-shadow(0 6px 40px rgba(214,179,87,0.5))" } : undefined}
                          >
                            {r.fullName}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  {/* Fade the rows above/below the ticker into the navy */}
                  <div className="absolute inset-x-0 top-0 pointer-events-none bg-gradient-to-b from-[#07203f] to-transparent" style={{ height: ROW_H * 0.9 }} aria-hidden />
                  <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-[#07203f] to-transparent" style={{ height: ROW_H * 0.9 }} aria-hidden />
                </div>
              </div>

              {phase === "winner" && latestWinner && (
                <p className="text-white/60 text-sm sm:text-base mt-5">{latestWinner.entry.email}</p>
              )}
            </>
          )}

          {/* Controls */}
          <div className="mt-9 w-full max-w-md flex flex-col items-center gap-4">
            {phase === "idle" && (
              <div>
                <p className="font-['Outfit'] text-white text-xl sm:text-2xl font-bold">What&apos;s the prize?</p>
                <p className="text-white/45 text-sm mt-1">e.g. Car Raffle, iPhone 16, Cash Prize</p>
              </div>
            )}
            {phase !== "spinning" && (
              <div className="relative w-full">
                <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#d6b357] pointer-events-none" />
                <input
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  maxLength={80}
                  placeholder="Enter prize name…"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#0d2a4d]/70 border-2 border-[#d6b357]/50 focus:border-[#d6b357] text-[#f0d890] placeholder:text-white/35 text-base sm:text-lg font-semibold focus:outline-none focus:shadow-[0_0_40px_-8px_rgba(214,179,87,0.5)] transition-all"
                />
              </div>
            )}
            {phase !== "spinning" && (
              <button
                type="button"
                onClick={draw}
                disabled={pool.length === 0}
                className="w-full inline-flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-[#f0d890] via-[#d6b357] to-[#b8913f] text-[#001428] text-lg font-bold shadow-[0_18px_60px_-10px_rgba(214,179,87,0.65)] hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                {phase === "winner" ? <RotateCcw className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                {phase === "winner" ? "Draw again" : "Draw winner"}
              </button>
            )}
            {phase !== "spinning" && pool.length === 0 && (
              <p className="text-white/60 text-sm">
                Everyone in the pool has already won — untick “exclude previous winners” or clear the list.
              </p>
            )}
            {phase !== "spinning" && (
              <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeWinners}
                  onChange={(e) => setExcludeWinners(e.target.checked)}
                  className="w-4 h-4 accent-[#d6b357]"
                />
                Exclude previous winners from the next draw
              </label>
            )}
          </div>
        </div>

        {/* ── Winners side panel ── */}
        <aside className="relative lg:w-80 xl:w-96 shrink-0 px-6 sm:px-10 lg:px-0 lg:pr-10 pb-6 lg:py-8 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col min-h-0 rounded-3xl bg-white/[0.07] border border-[#d6b357]/30 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <p className="text-[#f0d890] text-xs font-bold uppercase tracking-[0.25em] flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Winners
                {winners.length > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-[#d6b357] text-[#001428] text-[11px] font-bold flex items-center justify-center tracking-normal">
                    {winners.length}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={exportWinnersPdf}
                  disabled={winners.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d6b357]/20 text-[#f0d890] text-xs font-bold hover:bg-[#d6b357]/30 transition-colors disabled:opacity-30"
                  title="Download the winners list as PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={clearWinners}
                  disabled={winners.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-bold hover:bg-white/20 transition-colors disabled:opacity-30"
                  title="Clear the winners list"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {winners.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
                  <span className="relative rounded-full p-[3px] bg-gradient-to-br from-[#d6b357]/70 to-[#8f6f2d]/40 mb-5">
                    <span className="w-16 h-16 rounded-full bg-[#0a2440] flex items-center justify-center">
                      <Medal className="w-8 h-8 text-[#d6b357]" />
                    </span>
                    <span className="absolute -top-1 -right-1.5 text-[#f0d890] text-xs select-none" aria-hidden>✦</span>
                  </span>
                  <p className="font-['Outfit'] text-white text-lg font-bold mb-1.5">No winners yet</p>
                  <p className="text-white/45 text-sm leading-relaxed">Every draw lands here, in order.</p>
                </div>
              ) : (
                winners.map((w, i) => (
                  <div
                    key={`${w.entry.id}-${i}`}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                      i === winners.length - 1 && phase === "winner"
                        ? "bg-[#d6b357]/15 border-[#d6b357]/60"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f0d890] to-[#b8913f] text-[#001428] text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-bold truncate">{w.entry.fullName}</p>
                      <p className="text-white/45 text-xs truncate">{w.entry.email}</p>
                      {w.prize && (
                        <p className="text-[#f0d890] text-xs font-semibold truncate mt-0.5 inline-flex items-center gap-1">
                          <Gift className="w-3 h-3 shrink-0" /> {w.prize}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void emailWinner(i, w)}
                      disabled={mailStatus[i] === "sending" || mailStatus[i] === "sent"}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        mailStatus[i] === "sent"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : mailStatus[i] === "error"
                            ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                      aria-label={`Email ${w.entry.fullName} their winning confirmation`}
                      title={
                        mailStatus[i] === "sent"
                          ? "Winning email sent"
                          : mailStatus[i] === "error"
                            ? "Send failed — click to retry"
                            : "Email this winner their proof of winning"
                      }
                    >
                      {mailStatus[i] === "sending" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : mailStatus[i] === "sent" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* FHI monogram, bottom-left */}
      <span
        className="absolute bottom-5 left-6 z-10 w-12 h-12 rounded-full border border-[#d6b357]/40 flex items-center justify-center text-[#f0d890]/80 text-sm font-bold tracking-wider pointer-events-none"
        aria-hidden
      >
        FHI
      </span>

      {/* Keyframes */}
      <style>{`
        @keyframes raffle-confetti {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(720deg); opacity: 0.7; }
        }
        @keyframes raffle-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
