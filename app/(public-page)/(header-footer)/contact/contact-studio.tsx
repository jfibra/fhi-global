"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { MagneticLink } from "@/components/public/magnetic-link"

/**
 * The contact page's form. Same fields and the same /api/contact payload as
 * the shared ContactForm (name, email, phone, company, subject, message and
 * the honeypot), restyled: the subject is chosen as a row of pills, labels
 * float inside the fields, the message counts down its room, and the success
 * state says exactly what happens next.
 *
 * The stored subject values are the admin inbox's own filter list; the pill
 * labels are what a visitor would say, mapped one to one.
 */
const REASONS: { label: string; hint: string; subject: string }[] = [
  { label: "Buying or investing", hint: "A home or an investment in the UAE", subject: "General Inquiry" },
  { label: "Listing a project", hint: "You are a developer with a project to sell", subject: "Project Listing" },
  { label: "Developer partnership", hint: "Working with FHI on a portfolio", subject: "Developer Partnership" },
  { label: "Joining as an agent", hint: "Selling with FHI in Dubai or abroad", subject: "Agent Onboarding" },
  { label: "Press and media", hint: "Interviews, quotes, announcements", subject: "Press & Media" },
  { label: "Website or account", hint: "Something on the site is not working", subject: "Technical Support" },
]
const MAX_MESSAGE = 5000

export function ContactStudio() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [error, setError] = useState("")
  const [reason, setReason] = useState(REASONS[0])
  const [length, setLength] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    if (!data.name || !data.email || !data.message) {
      setError("Please add your name, your email and a message.")
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
      gaEvent("submit_inquiry", { form: "contact" })
      form.reset()
      setLength(0)
    } catch {
      setError("Network error. Please check your connection and try again.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="ct-success flex min-h-[520px] flex-col items-start justify-center px-2 py-10 sm:px-6">
        <span className="ct-success-ring relative inline-flex h-16 w-16 items-center justify-center rounded-full border border-[#d6b357]">
          <CheckCircle2 className="h-7 w-7 text-[#d6b357]" strokeWidth={1.75} />
        </span>
        <h3 className="mt-7 font-['Outfit'] text-[34px] font-bold leading-[1.05] tracking-tight text-[#0d1117] sm:text-[44px]">
          Received.
          <span className="block text-[#b8913f]">A consultant replies within one business day.</span>
        </h3>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-[#4b5563]">
          You will hear from a person, not an autoresponder. If it is urgent, the phone and WhatsApp numbers above reach the same team.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <MagneticLink href="/projects" className="group inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
            Browse projects meanwhile
            <ArrowRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:translate-x-0.5" />
          </MagneticLink>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="inline-flex items-center gap-2 border border-[#0d1117]/20 px-6 py-3.5 text-[15px] font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]"
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="ct-form relative">
      {/* Honeypot — hidden from users; bots that fill it are silently dropped */}
      <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* 01 · Reason */}
      <fieldset className="ct-step" style={{ ["--d" as string]: "0ms" }}>
        <legend className="ct-legend">
          <span className="ct-num">01</span> What brings you here?
        </legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const on = r.subject === reason.subject
            return (
              <label key={r.subject} className={`ct-pill ${on ? "ct-pill--on" : ""}`}>
                <input
                  type="radio"
                  name="subject"
                  value={r.subject}
                  checked={on}
                  onChange={() => setReason(r)}
                  className="sr-only"
                />
                {r.label}
              </label>
            )
          })}
        </div>
        <p className="mt-3 text-[13px] text-[#6b7280]" aria-live="polite">{reason.hint}.</p>
      </fieldset>

      {/* 02 · You */}
      <fieldset className="ct-step mt-10" style={{ ["--d" as string]: "120ms" }}>
        <legend className="ct-legend">
          <span className="ct-num">02</span> How do we reach you?
        </legend>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="ct-field">
            <input name="name" type="text" required autoComplete="name" placeholder=" " className="ct-input" />
            <span className="ct-label">Full name</span>
          </label>
          <label className="ct-field">
            <input name="email" type="email" required autoComplete="email" placeholder=" " className="ct-input" />
            <span className="ct-label">Email address</span>
          </label>
          <label className="ct-field">
            <input name="phone" type="tel" autoComplete="tel" placeholder=" " className="ct-input" />
            <span className="ct-label">Phone or WhatsApp <span className="text-[#9ca3af]">(optional)</span></span>
          </label>
          <label className="ct-field">
            <input name="company" type="text" autoComplete="organization" placeholder=" " className="ct-input" />
            <span className="ct-label">Company <span className="text-[#9ca3af]">(optional)</span></span>
          </label>
        </div>
      </fieldset>

      {/* 03 · Message */}
      <fieldset className="ct-step mt-10" style={{ ["--d" as string]: "240ms" }}>
        <legend className="ct-legend">
          <span className="ct-num">03</span> Tell us what you are looking for
        </legend>
        <label className="ct-field mt-5 block">
          <textarea
            name="message"
            required
            rows={6}
            maxLength={MAX_MESSAGE}
            placeholder=" "
            onChange={(e) => setLength(e.target.value.length)}
            className="ct-input ct-textarea"
          />
          <span className="ct-label">Budget, timeline, where you are buying from. Anything that helps.</span>
        </label>
        <div className="mt-2 flex items-center justify-between text-[12px] text-[#9ca3af]">
          <span>Your details go only to the FHI Global team and are never shared.</span>
          <span className="tabular-nums">{length.toLocaleString("en-US")} / {MAX_MESSAGE.toLocaleString("en-US")}</span>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-6 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="ct-step mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between" style={{ ["--d" as string]: "360ms" }}>
        <button
          type="submit"
          disabled={status === "sending"}
          className="ct-submit group relative inline-flex items-center justify-center gap-2.5 overflow-hidden bg-[#d6b357] px-8 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a] disabled:opacity-60"
        >
          {status === "sending" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Sending</>
          ) : (
            <>Send message <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></>
          )}
        </button>
        <p className="text-[13px] text-[#6b7280]">
          Prefer to talk?{" "}
          <Link href="https://wa.me/971567428288" target="_blank" rel="noopener noreferrer" className="font-bold text-[#0d1117] underline-offset-4 hover:text-[#b8913f] hover:underline">
            WhatsApp us
          </Link>
          {" "}or call <a href="tel:+971567428288" className="font-bold text-[#0d1117] hover:text-[#b8913f]">+971 56 742 8288</a>.
        </p>
      </div>
    </form>
  )
}
