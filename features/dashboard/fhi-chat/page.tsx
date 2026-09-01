"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"

/**
 * FHI Chat — the admin one-stop shop for questions about the business.
 * Ask in plain language; the assistant runs the real database queries
 * server-side and answers with exact figures. Admin staff only.
 */

type Card = {
  kind: "agent" | "developer" | "project"
  title: string
  subtitle?: string
  image?: string | null
  rank?: number
}
type Msg = {
  role: "user" | "assistant"
  content: string
  used?: string[]
  cards?: Card[]
  names?: string[]
  typed?: boolean
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Styles the entities inside a reply: names the tools returned get bold
 *  navy, AED amounts get gold — the same hierarchy as the dashboard. Purely
 *  presentational; the matching runs against OUR card titles, not guesses. */
function RichText({ text, names }: { text: string; names: string[] }) {
  const pattern = [...names.map(escapeRe), "AED\\s[\\d,]+(?:\\.\\d+)?"].join("|")
  if (!pattern) return <>{text}</>
  const lower = new Set(names.map((n) => n.toLowerCase()))
  const parts = text.split(new RegExp(`(${pattern})`, "gi"))
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null
        if (/^AED\s[\d,]/.test(p))
          return (
            <span key={i} className="font-semibold text-[#8a6d2a]">
              {p}
            </span>
          )
        if (lower.has(p.toLowerCase()))
          return (
            <span key={i} className="font-semibold text-[#001f3f]">
              {p}
            </span>
          )
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

/** Typewriter reveal — types the reply like a live assistant, then reports
 *  done so the cards and sources fade in after the words. */
function TypedText({ text, names, onDone }: { text: string; names: string[]; onDone: () => void }) {
  const [len, setLen] = useState(0)
  const doneRef = useRef(false)
  useEffect(() => {
    doneRef.current = false
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLen(text.length)
      return
    }
    setLen(0)
    const id = window.setInterval(() => {
      setLen((n) => Math.min(n + 3, text.length))
    }, 14)
    return () => window.clearInterval(id)
  }, [text])
  // Completion is reported from an effect, never from inside a state updater —
  // React forbids updating the parent while another component renders.
  useEffect(() => {
    if (len >= text.length && !doneRef.current) {
      doneRef.current = true
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, text])
  return (
    <>
      <RichText text={text.slice(0, len)} names={names} />
      {len < text.length && <span className="inline-block w-[2px] h-[1em] align-middle bg-[#d6b357] animate-pulse" aria-hidden="true" />}
    </>
  )
}

function CardRow({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {cards.map((c) => (
        <div key={`${c.kind}:${c.title}`} className="flex items-center gap-3 border border-[#eceef1] bg-white px-3 py-2.5">
          {c.rank != null && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#d6b357] font-['Outfit'] text-[12px] font-bold text-[#001f3f]">
              {c.rank}
            </span>
          )}
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.image}
              alt={c.title}
              loading="lazy"
              className={
                c.kind === "agent"
                  ? "h-10 w-10 shrink-0 rounded-full object-cover border-2 border-[#d6b357]"
                  : c.kind === "developer"
                    ? "h-10 w-10 shrink-0 object-contain bg-white border border-[#eceef1] p-1"
                    : "h-10 w-14 shrink-0 object-cover"
              }
            />
          ) : (
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center bg-[#001f3f] text-sm font-bold text-[#d6b357] ${c.kind === "agent" ? "rounded-full" : ""}`}
            >
              {c.title.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#0d1117]">{c.title}</p>
            {c.subtitle && <p className="truncate text-[11.5px] text-[#6b7280]">{c.subtitle}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

const SUGGESTIONS = [
  "Who are the top agents this year?",
  "Total validated sales value in 2026?",
  "How many projects does each developer have?",
  "What were our most recent sales?",
  "How many registrations does our latest event have?",
  "Any open support tickets?",
]

/** Tool names → human wording for the tiny "checked" line. */
const TOOL_LABELS: Record<string, string> = {
  top_agents: "Top Sales board",
  top_developers: "Top Developers board",
  top_teams: "Team Sales board",
  sales_summary: "sales totals",
  agent_sales: "agent record",
  agent_recruits: "recruits",
  developer_overview: "developer portfolio",
  projects_stats: "project counts",
  platform_counts: "platform KPIs",
  recent_sales: "recent sales",
  events_overview: "events",
  event_attendees: "event registrations",
  new_accounts: "new signups",
}

export default function FhiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  // Follow the typewriter: while a reply is typing, keep the end in view.
  const isTyping = messages.some((m) => m.typed === false)
  useEffect(() => {
    if (!isTyping) return
    const id = window.setInterval(
      () => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
      400,
    )
    return () => window.clearInterval(id)
  }, [isTyping])

  const ask = async (raw?: string) => {
    const question = (raw ?? input).trim()
    if (!question || busy) return
    setError(null)
    setInput("")
    const next: Msg[] = [...messages, { role: "user", content: question }]
    setMessages(next)
    setBusy(true)
    try {
      const res = await fetch("/api/admin/fhi-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        used?: string[]
        cards?: Card[]
        names?: string[]
        error?: string
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? "FHI Chat couldn't answer — try again.")
      setMessages((ms) => [
        ...ms,
        {
          role: "assistant",
          content: data.reply ?? "",
          used: data.used,
          cards: data.cards,
          names: data.names,
          typed: false,
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      // Keep the question in the thread so a retry is one click away.
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <span className="flex h-11 w-11 items-center justify-center bg-[#001f3f]">
          <Sparkles className="h-5 w-5 text-[#d6b357]" />
        </span>
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117] leading-tight">FHI Chat</h1>
          <p className="text-xs text-[#6b7280]">
            Ask anything about FHI&apos;s data — sales, agents, developers, projects, events. Answers come from live queries.
          </p>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto border border-[#e5e8ec] bg-white p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8 text-[#d6b357] mb-3" />
            <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Your data, answered.</p>
            <p className="mt-1 text-sm text-[#6b7280] max-w-sm">
              Every number comes from the live database — the same figures as your dashboard, in plain language.
            </p>
            <div className="mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="border border-[#e5e5e5] bg-[#f8fafc] px-3.5 py-2 text-[13px] font-semibold text-[#001f3f] transition-colors hover:border-[#d6b357] hover:bg-[#d6b357]/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] bg-[#001f3f] px-4 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] min-w-0">
                    {/* One answer block: the typed text and its cards live in
                        the same bubble, not as separate stacked pieces. */}
                    <div className="border border-[#e5e8ec] border-l-2 border-l-[#d6b357] bg-[#fafbfc]">
                      <div className="px-4 py-3 text-sm leading-relaxed text-[#1f2937] whitespace-pre-wrap">
                        {m.typed === false ? (
                          <TypedText
                            text={m.content}
                            names={m.names ?? (m.cards ?? []).map((c) => c.title)}
                            onDone={() =>
                              setMessages((ms) => ms.map((x, xi) => (xi === i ? { ...x, typed: true } : x)))
                            }
                          />
                        ) : (
                          <RichText text={m.content} names={m.names ?? (m.cards ?? []).map((c) => c.title)} />
                        )}
                      </div>
                      {m.typed !== false && m.cards && m.cards.length > 0 && (
                        <div className="border-t border-[#eceef1] p-2.5">
                          <CardRow cards={m.cards} />
                        </div>
                      )}
                    </div>
                    {m.typed !== false && m.used && m.used.length > 0 && (
                      <p className="mt-1 text-[11px] text-[#9ca3af]">
                        Checked: {m.used.map((u) => TOOL_LABELS[u] ?? u).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                <Loader2 className="h-4 w-4 animate-spin text-[#b8913f]" />
                Checking the numbers…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      {error && (
        <p role="alert" className="border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          {error}
        </p>
      )}
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask FHI Chat — e.g. "Who sold the most this month?"'
          disabled={busy}
          className="w-full border border-[#e5e5e5] px-4 py-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none transition-colors disabled:bg-[#f8fafc]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex shrink-0 items-center gap-2 bg-[#001f3f] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00152b] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>
      <p className="mt-2 text-[11px] text-[#9ca3af]">
        Admin only · answers are computed from the live database at the moment you ask.
      </p>
    </div>
  )
}
