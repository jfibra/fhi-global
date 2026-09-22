"use client"

import { useState } from "react"
import { Award, Download, Loader2, Mail, User } from "lucide-react"
import type { SelfService } from "@/lib/events/certificate"

/** Public self-service certificate: enter email (or name), see it, download the PDF. */
export function EventCertificateClaim({ eventId, eventTitle, mode }: { eventId: string; eventTitle: string; mode: Exclude<SelfService, "off"> }) {
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<"idle" | "checking" | "ready">("idle")
  const [error, setError] = useState<string | null>(null)
  const [claim, setClaim] = useState<{ name: string; token: string } | null>(null)
  const [previewLoaded, setPreviewLoaded] = useState(false)

  const inputCls =
    "w-full pl-11 pr-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("checking")
    setError(null)
    try {
      const res = await fetch("/api/events/certificate/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "registered" ? { eventId, email: value } : { eventId, name: value }),
      })
      const data = (await res.json().catch(() => ({}))) as { name?: string; token?: string; error?: string }
      if (!res.ok || !data.token || !data.name) throw new Error(data.error ?? "Something went wrong — please try again")
      setClaim({ name: data.name, token: data.token })
      setPreviewLoaded(false)
      setStatus("ready")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again")
      setStatus("idle")
    }
  }

  if (status === "ready" && claim) {
    const file = (format: "png" | "pdf") => `/api/events/certificate/file?token=${encodeURIComponent(claim.token)}&format=${format}`
    return (
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b8913f]">Congratulations</p>
          <h3 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1">{claim.name}</h3>
          <p className="text-sm text-[#6b7280] mt-1">Here is your certificate for {eventTitle}.</p>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-[#e5e7eb] bg-[#f6f8fb] aspect-[1754/1240]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file("png")} alt={`Certificate for ${claim.name}`} onLoad={() => setPreviewLoaded(true)} className={`absolute inset-0 h-full w-full object-contain transition-opacity ${previewLoaded ? "opacity-100" : "opacity-0"}`} />
          {!previewLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#6b7280] text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-[#001f3f]" /> Preparing your certificate…
            </div>
          )}
        </div>
        <a
          href={file("pdf")}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#c9a449] hover:from-[#c9a449] hover:to-[#b8913f] text-[#001f3f] text-sm font-bold transition-all shadow-[0_8px_24px_-6px_rgba(214,179,87,0.5)] flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Download PDF
        </a>
        <button type="button" onClick={() => { setStatus("idle"); setClaim(null); setValue("") }} className="w-full text-xs text-[#6b7280] hover:text-[#001f3f]">
          Not you? Enter different details
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
          {mode === "registered" ? "Email you registered with *" : "Your full name *"}
        </label>
        <div className="relative">
          {mode === "registered" ? (
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          ) : (
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          )}
          <input
            type={mode === "registered" ? "email" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "registered" ? "you@example.com" : "Ana Montecalvo Fragata"}
            required
            maxLength={mode === "registered" ? 200 : 80}
            autoComplete={mode === "registered" ? "email" : "name"}
            className={inputCls}
          />
        </div>
        {mode === "open" && <p className="text-[11px] text-[#9ca3af]">Type it exactly as you want it printed.</p>}
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "checking"}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#c9a449] hover:from-[#c9a449] hover:to-[#b8913f] text-[#001f3f] text-sm font-bold transition-all shadow-[0_8px_24px_-6px_rgba(214,179,87,0.5)] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === "checking" ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <><Award className="w-4 h-4" /> Get my certificate</>}
      </button>
    </form>
  )
}
