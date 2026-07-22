"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, Mail, MessageCircle, User } from "lucide-react"

/** Public registration form for one event (posts to /api/events/register). */
export function EventRegisterForm({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  const inputCls =
    "w-full pl-11 pr-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError(null)
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, fullName, email, whatsapp }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Registration failed — please try again")
      setStatus("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed — please try again")
      setStatus("idle")
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-[#d6b357]/15 border-2 border-[#d6b357]/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#d6b357]" />
        </div>
        <h3 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">You&apos;re registered!</h3>
        <p className="text-sm text-[#6b7280] leading-relaxed max-w-xs mx-auto">
          Thank you for registering for <span className="font-semibold text-[#0f2940]">{eventTitle}</span>.
          We&apos;ll be in touch — see you there!
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
