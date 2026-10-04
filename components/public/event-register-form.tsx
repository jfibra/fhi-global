"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { CalendarDays, CheckCircle2, Loader2, Mail, MessageCircle, Ticket, User, UserPlus } from "lucide-react"
import type { AnswerValue, RegistrationField } from "@/lib/events/fields"
import type { PublicDaySeats } from "@/lib/events/pax"

/** One day of a multi-day event, as the form lists it ("" while its date isn't set). */
export type RegisterDay = { day: number; dateLabel: string; time: string }

async function fetchSeats(eventId: string): Promise<PublicDaySeats[]> {
  const res = await fetch(`/api/events/seats?event=${eventId}`, { cache: "no-store" })
  if (!res.ok) throw new Error(String(res.status))
  return ((await res.json()) as { days?: PublicDaySeats[] }).days ?? []
}

/** "12 seats left" / "Fully booked" / "1 seat left" — nothing when the day has no limit. */
function seatsText(s: PublicDaySeats | undefined): string | null {
  if (!s || s.limit === null || s.left === null) return null
  if (s.full) return "Fully booked"
  return `${s.left} seat${s.left === 1 ? "" : "s"} left`
}

/**
 * Public registration form for one event (posts to /api/events/register).
 * Pax per date (075): a multi-day event lists its days to tick (at least one;
 * a full day is shown but can't be picked), a one-day event with a limit shows
 * its seats left, and when nothing is left the form says the event is fully
 * booked. Seats load live on open (the page itself may be cached), and only
 * for an event with a limit.
 */
export function EventRegisterForm({
  eventId,
  eventTitle,
  fields = [],
  days = [],
  limited = false,
}: {
  eventId: string
  eventTitle: string
  /** Per-event custom questions, in display order (events.registration_fields). */
  fields?: RegistrationField[]
  /** A multi-day event's days (071/072), day 1 first; empty for a one-day event. */
  days?: RegisterDay[]
  /** Some day has a pax limit — the seats are worth loading. */
  limited?: boolean
}) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [invitedBy, setInvitedBy] = useState("")
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  // Pax per date: the days ticked, and the live seats per day.
  const multiDay = days.length > 1
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [seats, setSeats] = useState<PublicDaySeats[] | null>(null)
  const applySeats = useCallback((s: PublicDaySeats[]) => {
    setSeats(s)
    // A day that filled up since it was ticked comes off the selection.
    setPicked((prev) => new Set([...prev].filter((d) => !s.find((x) => x.day === d)?.full)))
  }, [])
  useEffect(() => {
    if (!limited) return
    let alive = true
    fetchSeats(eventId).then(
      (s) => alive && applySeats(s),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [eventId, limited, applySeats])
  const seatOf = (day: number) => seats?.find((s) => s.day === day)
  const allFull = !!seats?.length && seats.every((s) => s.full)
  const togglePick = (day: number) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })

  const setAnswer = (key: string, value: AnswerValue) => setAnswers((a) => ({ ...a, [key]: value }))

  // "Invited by" suggestions: staff names matching what has been typed so far.
  // Purely a convenience — the box is free text and any name goes through.
  type Inviter = { name: string; avatar: string | null }
  const [suggestions, setSuggestions] = useState<Inviter[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suggestSeq = useRef(0)

  const lookupInviters = (value: string) => {
    clearTimeout(suggestTimer.current)
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSuggestOpen(false)
      return
    }
    suggestTimer.current = setTimeout(async () => {
      const seq = ++suggestSeq.current
      try {
        const res = await fetch(`/api/events/inviters?q=${encodeURIComponent(q)}`)
        const data = (await res.json().catch(() => ({}))) as { people?: Inviter[] }
        // Ignore a slow reply that arrives after a newer keystroke's request.
        if (seq !== suggestSeq.current) return
        const people = (data.people ?? []).filter((p) => p.name.toLowerCase() !== q.toLowerCase())
        setSuggestions(people)
        setSuggestOpen(people.length > 0)
        setHighlight(-1)
      } catch {
        // Suggestions are optional; a failed lookup just shows none.
      }
    }, 180)
  }
  useEffect(() => () => clearTimeout(suggestTimer.current), [])

  const pickInviter = (name: string) => {
    setInvitedBy(name)
    setSuggestions([])
    setSuggestOpen(false)
  }

  const inputCls =
    "w-full pl-11 pr-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (multiDay && picked.size === 0) {
      setError("Please choose the day(s) you'll attend.")
      return
    }
    setStatus("sending")
    setError(null)
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          fullName,
          email,
          whatsapp,
          invitedBy,
          answers,
          ...(multiDay ? { days: [...picked].sort((a, b) => a - b) } : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; full_day?: number | null }
      if (!res.ok) {
        // A day filled up while they were typing: refresh the seats so it shows.
        if (res.status === 409 && data.full_day !== undefined) fetchSeats(eventId).then(applySeats, () => {})
        throw new Error(data.error ?? "Registration failed — please try again")
      }
      setStatus("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed — please try again")
      setStatus("idle")
    }
  }

  // Every seat taken: nothing to register for.
  if (allFull && status !== "done") {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-[#faf7ee] border border-[#e7d9a8] flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-6 h-6 text-[#9ca3af]" />
        </div>
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-1.5">Fully booked</h3>
        <p className="text-sm text-[#6b7280] leading-relaxed max-w-xs mx-auto">
          Every seat for {multiDay ? "every day of " : ""}
          <span className="font-semibold text-[#0f2940]">{eventTitle}</span> is taken.
        </p>
      </div>
    )
  }

  const pickedDays = days.filter((d) => picked.has(d.day))

  if (status === "done") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-[#d6b357]/15 border-2 border-[#d6b357]/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#d6b357]" />
        </div>
        <h3 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">You&apos;re registered!</h3>
        <p className="text-sm text-[#6b7280] leading-relaxed max-w-xs mx-auto">
          Thank you for registering for <span className="font-semibold text-[#0f2940]">{eventTitle}</span>
          {multiDay && pickedDays.length > 0 && pickedDays.length < days.length && (
            <> — {pickedDays.map((d) => `Day ${d.day}`).join(", ")}</>
          )}
          . We&apos;ll be in touch — see you there!
        </p>
      </div>
    )
  }

  // A one-day event with a limit shows what's left above the form.
  const singleSeats = !multiDay ? seatsText(seatOf(1)) : null

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Pax per date (075): tick the days you'll attend — a full day can't be picked. */}
      {multiDay && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#374151]">
            Which day(s) will you attend? *
          </legend>
          {days.map((d) => {
            const s = seatOf(d.day)
            const full = !!s?.full
            const note = seatsText(s)
            const on = picked.has(d.day)
            return (
              <label
                key={d.day}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  full
                    ? "cursor-not-allowed border-[#eef0f3] bg-[#f9fafb] opacity-60"
                    : on
                      ? "cursor-pointer border-[#001f3f] bg-[#001f3f]/[0.04]"
                      : "cursor-pointer border-[#e5e7eb] bg-white hover:border-[#d6b357]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={full}
                  onChange={() => togglePick(d.day)}
                  className="h-4 w-4 shrink-0 rounded border-[#d1d5db] text-[#001f3f] focus:ring-[#001f3f]/30"
                />
                <CalendarDays className="h-4 w-4 shrink-0 text-[#d6b357]" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-bold text-[#0f2940]">Day {d.day}</span>
                  {[d.dateLabel, d.time].filter(Boolean).map((part) => (
                    <span key={part} className="text-[#4b5563]"> · {part}</span>
                  ))}
                </span>
                {note && (
                  <span className={`shrink-0 text-[11px] font-bold ${full ? "text-rose-600" : "text-[#8a6d2a]"}`}>{note}</span>
                )}
              </label>
            )
          })}
        </fieldset>
      )}
      {singleSeats && (
        <p className="flex items-center gap-2 rounded-xl border border-[#e7d9a8] bg-[#faf7ee] px-3.5 py-2 text-xs font-bold text-[#8a6d2a]">
          <Ticket className="h-3.5 w-3.5" /> {singleSeats}
        </p>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">Full name *</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ahmed Al Rashidi"
            required
            maxLength={120}
            autoComplete="name"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">Email address *</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            maxLength={200}
            autoComplete="email"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">WhatsApp</label>
        <div className="relative">
          <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+971 50 000 0000"
            maxLength={40}
            autoComplete="tel"
            className={inputCls}
          />
        </div>
      </div>

      {/* Per-event questions. The API re-validates every answer against the
          event's current field list, so this is presentation only. */}
      {fields.map((f) => {
        const value = answers[f.key]
        if (f.type === "checkbox") {
          return (
            <label key={f.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => setAnswer(f.key, e.target.checked)}
                required={f.required}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d1d5db] text-[#001f3f] focus:ring-[#001f3f]/30"
              />
              <span className="text-sm text-[#374151] leading-snug">
                {f.label} {f.required && <span className="text-rose-500">*</span>}
              </span>
            </label>
          )
        }
        return (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
              {f.label} {f.required && "*"}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setAnswer(f.key, e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                rows={3}
                maxLength={2000}
                className={`${inputCls} pl-4 resize-y`}
              />
            ) : f.type === "select" ? (
              <select
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setAnswer(f.key, e.target.value)}
                required={f.required}
                className={`${inputCls} pl-4`}
              >
                <option value="">Select…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                onChange={(e) => setAnswer(f.key, e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                maxLength={500}
                className={`${inputCls} pl-4`}
              />
            )}
          </div>
        )
      })}

      {/* Always on the form, always optional — attendees type whoever sent
          them, which may be an agent, a friend or a company. */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">Invited by</label>
        <div className="relative">
          <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            value={invitedBy}
            onChange={(e) => {
              setInvitedBy(e.target.value)
              lookupInviters(e.target.value)
            }}
            onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            onKeyDown={(e) => {
              if (!suggestOpen || suggestions.length === 0) return
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setHighlight((h) => (h + 1) % suggestions.length)
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
              } else if (e.key === "Enter" && highlight >= 0) {
                e.preventDefault()
                pickInviter(suggestions[highlight].name)
              } else if (e.key === "Escape") {
                setSuggestOpen(false)
              }
            }}
            placeholder="Name of the person who invited you (optional)"
            maxLength={120}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestOpen}
            aria-autocomplete="list"
            aria-controls="invited-by-suggestions"
            className={inputCls}
          />
          {suggestOpen && (
            <ul
              id="invited-by-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg"
            >
              {suggestions.map(({ name, avatar }, i) => (
                <li
                  key={name}
                  role="option"
                  aria-selected={i === highlight}
                  // mousedown (not click) so the pick lands before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickInviter(name)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                    i === highlight ? "bg-[#001f3f]/6 text-[#001f3f]" : "text-[#374151]"
                  }`}
                >
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-[#d6b357]/40"
                    />
                  ) : (
                    // Initials on navy when there is no photo, so every row has the same shape.
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-[11px] font-bold text-[#d6b357]">
                      {name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("")}
                    </span>
                  )}
                  <span className="truncate">{name}</span>
                </li>
              ))}
              <li className="px-4 pt-1.5 pb-1 text-[11px] text-[#9ca3af] border-t border-[#f3f4f6] mt-1">
                Not listed? Just keep typing the name.
              </li>
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#c9a449] hover:from-[#c9a449] hover:to-[#b8913f] text-[#001f3f] text-sm font-bold transition-all shadow-[0_8px_24px_-6px_rgba(214,179,87,0.5)] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Registering…
          </>
        ) : (
          "Register for this event"
        )}
      </button>
      <p className="text-[11px] text-[#9ca3af] text-center leading-relaxed">
        Your details go only to the FHI Global events team and are never shared.
      </p>
    </form>
  )
}
