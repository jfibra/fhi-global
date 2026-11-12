"use client"

// The website chat's panel (boss via Juliecor, 2026-11-06): the public FHI
// Assistant on fhiglobal.ae, loaded by site-chat.tsx on the first tap.
//
// A visitor asks in plain words; the answer streams in from app/api/site-chat
// (projects, listings, events and guides from the site's own data, nothing
// private) with photo cards that open the page. "Talk to a consultant" asks
// for their name, email and WhatsApp number and posts them to
// app/api/site-chat/lead — an ordinary inquiry in Emails. The conversation
// lives in sessionStorage under a random session id, so it survives a page
// change and ends with the tab; nothing is kept in a cookie.
//
// Full-screen on phones, a 400 px panel above the floating buttons on larger
// screens. Plain text answers: "- " lines become a list, links become links.

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Image from "next/image"
import { ArrowUp, Loader2, MessageCircle, RotateCcw, Sparkles, UserRound, X } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { COMPANY, companyWhatsappHref } from "@/lib/company"
import { SITE_CHAT_FAQ_CHIPS } from "@/lib/site-chat-faq"
import { COUNTRY_CODES } from "@/lib/user-service"

type Card = { title: string; subtitle?: string; image?: string | null; href: string | null; kind: "project" | "listing" | "event" | "agent" }
type Msg = {
  role: "user" | "assistant"
  content: string
  cards?: Card[]
  streaming?: boolean
  status?: string
  /** A refusal or failure, with the WhatsApp fallback when the server gave one. */
  error?: { text: string; whatsapp?: string | null }
}
type Stored = { session: string; messages: Array<Pick<Msg, "role" | "content" | "cards">>; leadDone?: boolean }

const STORE_KEY = "fhi-site-chat"
const MAX_CHARS = 600
const SUGGESTIONS = ["Cheapest 1-bedroom in JVC", "Projects handing over in 2027", "Villas under AED 3M", "How do payment plans work?"]
const TOOL_WORDS: Record<string, string> = { find_projects: "projects", project_details: "the project", find_listings: "listings", upcoming_events: "events", site_pages: "our guides" }
const WELCOME = "Hi! I'm FHI Assistant. Ask me about any project in Dubai — prices, payment plans, handover — or tell me what you're looking for."

const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, "0").slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`)

function load(): Stored {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Stored
      if (parsed && typeof parsed.session === "string" && Array.isArray(parsed.messages)) return parsed
    }
  } catch {
    // Unreadable or unavailable storage: a fresh conversation.
  }
  return { session: newSession(), messages: [] }
}
function save(s: Stored) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    // Nothing to remember then.
  }
}

const URL_RE = /(https?:\/\/[^\s)]+)/g

/** Plain text → paragraphs, "- " lists and clickable links. */
function renderText(text: string): ReactNode {
  const linkify = (line: string, key: string) =>
    line.split(URL_RE).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={`${key}-${i}`} href={part.replace(/[.,;:]+$/, "")} className="break-all font-semibold text-[#001f3f] underline decoration-[#d6b357] underline-offset-2">
          {part.replace(/^https?:\/\/(www\.)?/, "").replace(/[.,;:]+$/, "")}
        </a>
      ) : (
        <span key={`${key}-${i}`}>{part}</span>
      ),
    )
  const lines = text.split("\n")
  const out: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`l${out.length}`} className="my-1.5 space-y-1 pl-4">
          {list.map((item, i) => (
            <li key={i} className="list-disc">{linkify(item, `li${out.length}-${i}`)}</li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (/^[-•]\s+/.test(line)) list.push(line.replace(/^[-•]\s+/, ""))
    else {
      flush()
      if (line.trim()) out.push(<p key={`p${i}`} className="my-1.5">{linkify(line, `p${i}`)}</p>)
    }
  })
  flush()
  return out
}

export function SiteChatPanel({ open, onClose, page }: { open: boolean; onClose: () => void; page: string }) {
  const [store] = useState<Stored>(() => load())
  const [session, setSession] = useState(store.session)
  const [messages, setMessages] = useState<Msg[]>(() => store.messages.map((m) => ({ ...m })))
  const [leadDone, setLeadDone] = useState(!!store.leadDone)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<"chat" | "lead">("chat")
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Remember the conversation (never a half-written answer).
  useEffect(() => {
    save({ session, messages: messages.filter((m) => !m.streaming && !m.error).map(({ role, content, cards }) => ({ role, content, cards })), leadDone })
  }, [session, messages, leadDone])

  // Keep the newest message in view; focus the box when the panel opens.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, view, open])
  useEffect(() => {
    if (open && view === "chat") {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80)
      return () => window.clearTimeout(id)
    }
  }, [open, view])

  useEffect(() => () => abortRef.current?.abort(), [])

  const patchLive = (patch: (m: Msg) => Msg) => setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 && m.streaming ? patch(m) : m)))

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_CHARS)
      if (!text || busy) return
      const next: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: text }]
      setMessages([...next, { role: "assistant", content: "", streaming: true, status: "Thinking…" }])
      setInput("")
      setBusy(true)
      gaEvent("site_chat_ask", { page, turn: next.filter((m) => m.role === "user").length })
      const controller = new AbortController()
      abortRef.current = controller
      let liveText = ""
      let flushTimer: number | null = null
      const flush = () => {
        flushTimer = null
        const t = liveText
        patchLive((m) => ({ ...m, content: t, status: undefined }))
      }
      type Final = { reply?: string; cards?: Card[]; error?: string; whatsapp?: string | null }
      try {
        const res = await fetch("/api/site-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ session, page, website: "", messages: next.slice(-32).map(({ role, content }) => ({ role, content })) }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
          const data = (await res.json().catch(() => ({}))) as Final
          if (!res.ok || !data.reply) throw Object.assign(new Error(data.error ?? "I couldn't answer that — please try again."), { whatsapp: data.whatsapp ?? null })
          patchLive((m) => ({ ...m, content: data.reply ?? "", cards: data.cards, streaming: false, status: undefined }))
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finished = false
        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let cut: number
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const line = buffer.slice(0, cut).trim()
            buffer = buffer.slice(cut + 2)
            if (!line.startsWith("data:")) continue
            const ev = JSON.parse(line.slice(5)) as { type: string; text?: string; tools?: string[]; error?: string } & Final
            if (ev.type === "status") {
              const words = [...new Set((ev.tools ?? []).map((t) => TOOL_WORDS[t] ?? t.replace(/_/g, " ")))]
              patchLive((m) => ({ ...m, status: words.length ? `Checking ${words.join(", ")}…` : "Thinking…" }))
            } else if (ev.type === "delta") {
              liveText += ev.text ?? ""
              if (flushTimer === null) flushTimer = window.setTimeout(flush, 50)
            } else if (ev.type === "reset") {
              liveText = ""
              patchLive((m) => ({ ...m, content: "" }))
            } else if (ev.type === "done") {
              if (flushTimer !== null) window.clearTimeout(flushTimer)
              patchLive((m) => ({ ...m, content: ev.reply ?? liveText, cards: ev.cards, streaming: false, status: undefined }))
              finished = true
            } else if (ev.type === "error") {
              throw new Error(ev.error ?? "I couldn't answer that — please try again.")
            }
          }
        }
        if (!finished) throw new Error("The answer was cut off — please try again.")
      } catch (e) {
        if (flushTimer !== null) window.clearTimeout(flushTimer)
        const aborted = e instanceof DOMException && e.name === "AbortError"
        const text = aborted ? "" : e instanceof Error ? e.message : "Something went wrong."
        const whatsapp = (e as { whatsapp?: string | null })?.whatsapp ?? null
        setMessages((ms) => {
          const last = ms[ms.length - 1]
          if (!last?.streaming) return ms
          if (aborted) return ms.slice(0, -1)
          return [...ms.slice(0, -1), { role: "assistant", content: "", error: { text, whatsapp } }]
        })
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [busy, messages, page, session],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  // Clear: a brand-new conversation (new session id, nothing remembered), like closing the tab.
  const clear = () => {
    abortRef.current?.abort()
    setMessages([])
    setLeadDone(false)
    setSession(newSession())
    setInput("")
    setView("chat")
    gaEvent("site_chat_clear", { page })
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const whatsapp = companyWhatsappHref("Hi! I was chatting on fhiglobal.ae and would like to speak to a consultant.")
  const hasTalked = messages.some((m) => m.role === "assistant" && !m.error && !m.streaming)

  return (
    <div
      role="dialog"
      aria-label="FHI Assistant chat"
      aria-hidden={!open}
      className={`fixed inset-0 z-[960] flex flex-col bg-white text-[#0d1117] shadow-[0_30px_80px_-20px_rgba(0,15,35,0.55)] transition-[opacity,transform] duration-200 sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(640px,calc(100dvh-112px))] sm:w-[400px] sm:max-w-[calc(100vw-40px)] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#e5e7eb] ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 bg-[#001f3f] px-4 py-3 text-white" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d6b357]">
          <Sparkles className="h-[18px] w-[18px] text-[#001f3f]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-['Outfit'] text-[15px] font-bold leading-tight">FHI Assistant</p>
          <p className="truncate text-[11.5px] text-white/70">Dubai property, answered from fhiglobal.ae</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} aria-label="Clear the conversation" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close chat" className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {view === "lead" ? (
        <LeadForm
          session={session}
          page={page}
          onBack={() => setView("chat")}
          onDone={(name) => {
            setLeadDone(true)
            setView("chat")
            setMessages((ms) => [...ms.filter((m) => !m.error), { role: "assistant", content: `Thank you, ${name}! A consultant will contact you on WhatsApp shortly. Anything else I can look up meanwhile?` }])
          }}
        />
      ) : (
        <>
          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <Bubble role="assistant">{renderText(WELCOME)}</Bubble>
            {messages.length === 0 && (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5 pl-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-[#d6b357]/60 bg-[#fbf7ec] px-3 py-1.5 text-[12.5px] font-semibold text-[#5b4a1a] transition-colors hover:bg-[#f3e9cc]">
                      {s}
                    </button>
                  ))}
                </div>
                {/* Ready answers about the website itself (lib/site-chat-faq.ts) — answered without the model. */}
                <p className="mb-1.5 pl-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Quick answers</p>
                <div className="mb-3 flex flex-wrap gap-1.5 pl-1">
                  {SITE_CHAT_FAQ_CHIPS.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) =>
              m.error ? (
                <div key={i} className="mb-3 rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-amber-900">
                  <p>{m.error.text}</p>
                  <a href={m.error.whatsapp ?? whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => gaEvent("click_whatsapp", { location: "site_chat", recipient: "company" })} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-3 py-1.5 text-[12.5px] font-bold text-white">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp {COMPANY.phone}
                  </a>
                </div>
              ) : (
                <Bubble key={i} role={m.role}>
                  {m.streaming && !m.content ? (
                    <span className="inline-flex items-center gap-2 text-[#6b7280]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {m.status ?? "Thinking…"}</span>
                  ) : (
                    renderText(m.content)
                  )}
                  {!!m.cards?.length && <Cards cards={m.cards} />}
                </Bubble>
              ),
            )}
          </div>

          {/* Actions + input */}
          <div className="border-t border-[#eef0f3] px-3 pt-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-2 flex items-center gap-1.5">
              {!leadDone && (
                <button type="button" onClick={() => { setView("lead"); gaEvent("site_chat_lead_open", { page, talked: hasTalked }) }} className="inline-flex items-center gap-1.5 rounded-full bg-[#fbf7ec] px-3 py-1.5 text-[12.5px] font-bold text-[#5b4a1a] transition-colors hover:bg-[#f3e9cc]">
                  <UserRound className="h-3.5 w-3.5" /> Talk to a consultant
                </button>
              )}
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => gaEvent("click_whatsapp", { location: "site_chat", recipient: "company" })} className="inline-flex items-center gap-1.5 rounded-full bg-[#eafaf0] px-3 py-1.5 text-[12.5px] font-bold text-[#128c4a] transition-colors hover:bg-[#d7f4e2]">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
            <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-2xl border border-[#e5e7eb] bg-[#fafbfc] px-3 py-1.5 focus-within:border-[#001f3f]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder="Ask about a project, area or budget…"
                aria-label="Your message"
                disabled={busy}
                className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[14px] leading-snug text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none disabled:opacity-60"
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = "auto"
                  el.style.height = `${Math.min(el.scrollHeight, 112)}px`
                }}
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-white transition-colors hover:bg-[#00356b] disabled:opacity-35">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-1.5 px-1 text-[10.5px] text-[#9ca3af]">Answers come from fhiglobal.ae&apos;s own listings; prices are &ldquo;from&rdquo; prices and can change.</p>
          </div>
        </>
      )}
    </div>
  )
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return role === "user" ? (
    <div className="mb-3 flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[#001f3f] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{children}</div>
    </div>
  ) : (
    <div className="mb-3 flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-[#f1f3f6] px-3.5 py-2 text-[13.5px] leading-relaxed text-[#1f2937] [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">{children}</div>
    </div>
  )
}

function Cards({ cards }: { cards: Card[] }) {
  return (
    <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {cards.map((c, i) => {
        const inner = (
          <>
            <div className="relative aspect-[4/3] w-full bg-[#dfe3e8]">
              {c.image ? <Image src={c.image} alt="" fill sizes="160px" className="object-cover" /> : null}
            </div>
            <div className="px-2 py-1.5">
              <p className="truncate text-[12px] font-bold text-[#0d1117]">{c.title}</p>
              {c.subtitle && <p className="truncate text-[11px] text-[#6b7280]">{c.subtitle}</p>}
            </div>
          </>
        )
        const cls = "block w-[160px] shrink-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white transition-shadow hover:shadow-md"
        return c.href ? (
          <a key={i} href={c.href} className={cls} onClick={() => gaEvent("site_chat_card", { kind: c.kind, title: c.title })}>
            {inner}
          </a>
        ) : (
          <div key={i} className={cls}>{inner}</div>
        )
      })}
    </div>
  )
}

function LeadForm({ session, page, onBack, onDone }: { session: string; page: string; onBack: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("+971")
  const [phone, setPhone] = useState("")
  const [category, setCategory] = useState<"off_plan" | "ready" | "rent">("off_plan")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/site-chat/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, page, name, email, phoneCountryCode: code, phone, category, website: "" }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not send your details. Please try again.")
      gaEvent("site_chat_lead", { page, category })
      gaEvent("submit_inquiry", { location: "site_chat", category })
      onDone(name.trim().split(/\s+/)[0] || name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your details.")
    } finally {
      setBusy(false)
    }
  }

  const base = "rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-[14px] text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
  const field = `${base} w-full`
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto px-4 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <p className="font-['Outfit'] text-[17px] font-bold text-[#001f3f]">Talk to a consultant</p>
      <p className="mt-1 text-[13px] text-[#6b7280]">Leave your details and one of our consultants will message you on WhatsApp — usually within the hour in office time.</p>
      <div className="mt-4 space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="Your name" autoComplete="name" className={field} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" maxLength={320} placeholder="Email" autoComplete="email" className={field} />
        <div className="flex gap-2">
          <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Country code" className={`${base} w-[104px] shrink-0 px-2`}>
            {COUNTRY_CODES.map((c) => (
              <option key={c.value} value={c.value}>{c.dial}</option>
            ))}
          </select>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" pattern="[0-9 ()-]{4,20}" placeholder="WhatsApp number" autoComplete="tel-national" className={`${base} min-w-0 flex-1`} />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {([["off_plan", "Off-plan"], ["ready", "Ready to move in"], ["rent", "Renting"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setCategory(v)} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${category === v ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e7eb] text-[#374151] hover:border-[#d6b357]"}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Honeypot — humans never see or fill this. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" defaultValue="" />
      </div>
      {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#6b7280] hover:bg-[#f1f3f6]">Back</button>
        <button type="submit" disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send my details
        </button>
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-[#9ca3af]">By sending, you agree that FHI Global may contact you about properties. We never share your details.</p>
    </form>
  )
}
