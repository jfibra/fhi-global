"use client"

import { useState } from "react"
import {
  Mail, Phone, CheckCircle2, User, MessageSquare,
  Building2, Loader2
} from "lucide-react"

const SUBJECTS = [
  "General Inquiry",
  "Developer Partnership",
  "Project Listing",
  "Agent Onboarding",
  "Technical Support",
  "Press & Media",
]

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    if (!data.name || !data.email || !data.message) {
      setError("Please fill in all required fields.")
      return
    }

    setStatus("sending")
    setError("")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.")
        setStatus("error")
        return
      }
      setStatus("success")
      form.reset()
    } catch {
      setError("Network error. Please check your connection and try again.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-[#faf7ee] border border-[#e7d9a8] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#d6b357]" />
        </div>
        <h3 className="font-['Outfit'] text-2xl font-bold text-white lg:text-[#0d1117] mb-2">Message Sent!</h3>
        <p className="text-white/55 lg:text-[#6b7280] text-sm mb-6 max-w-sm">
          Thank you for reaching out. Our team will get back to you within 24 hours.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors"
        >
          Send Another Message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-5">
      {/* Honeypot — hidden from users; bots that fill it are silently dropped */}
      <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Full Name *</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="name"
              type="text"
              placeholder="Ahmed Al Rashidi"
              required
              className="w-full pl-11 pr-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] transition-colors"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Email Address *</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full pl-11 pr-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Phone + Company row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Phone</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="phone"
              type="tel"
              placeholder="+971 50 000 0000"
              className="w-full pl-11 pr-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] transition-colors"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Company</label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="company"
              type="text"
              placeholder="Your Company"
              className="w-full pl-11 pr-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Subject</label>
        <div className="relative">
          <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <select
            name="subject"
            className="w-full pl-11 pr-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#d6b357] transition-colors appearance-none"
          >
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">Message *</label>
        <textarea
          name="message"
          rows={5}
          required
          placeholder="Tell us how we can help..."
          className="w-full px-4 py-3.5 border border-[#e5e8ec] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto py-3.5 px-10 bg-[#001f3f] text-white text-[13px] font-bold uppercase tracking-[0.12em] hover:bg-[#00356b] disabled:opacity-60 transition-colors"
      >
        {status === "sending" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
        ) : (
          "Send Message"
        )}
      </button>
    </form>
  )
}
