"use client" 

import { useState } from "react"
import { Loader2, Mail } from "lucide-react"

/**
 * News sidebar newsletter box. Posts to our /api/news/subscribe proxy, which
 * forwards to the HomesPH News subscribe endpoint with the site key attached
 * server-side.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === "sending") return
    setState("sending")
    setError("")
    try {
      const res = await fetch("/api/news/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setState("done")
        return
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setError(json.error ?? "Couldn't subscribe right now — try again later.")
      setState("error")
    } catch {
      setError("Couldn't subscribe right now — try again later.")
      setState("error")
    }
  }

  return (
    <div className="bg-[#001428] p-5 text-white">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#d6b357] mb-2">
        Daily Newsletter
      </p>
      {state === "done" ? (
        <p className="text-sm leading-relaxed text-white/90">
          You&apos;re in! Check your inbox for a welcome email.
        </p>
      ) : (
        <>
          <p className="text-sm font-bold leading-snug mb-3">
            Get the latest real estate news delivered to your inbox.
          </p>
          <form onSubmit={(e) => void submit(e)} className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-xs pl-8 pr-3 py-2.5 focus:outline-none focus:border-[#d6b357] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full flex items-center justify-center gap-2 bg-[#d6b357] text-[#001428] text-xs font-black uppercase tracking-widest px-4 py-2.5 hover:bg-[#c4a247] transition-colors disabled:opacity-60"
            >
              {state === "sending" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {state === "sending" ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
          {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
        </>
      )}
    </div>
  )
}
