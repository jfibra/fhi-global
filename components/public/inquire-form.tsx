"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, ChevronDown, Loader2, Mail, User } from "lucide-react"
import { gaEvent } from "@/lib/ga"
import { readUtm } from "@/lib/utm"
import { PhoneCountrySelect } from "@/components/phone-country-select"

type Category = "off_plan" | "ready" | "rent"

/**
 * Which page the lead is sent from. A project page sends the project (the
 * server snapshots its name and developer); a landing or developer page sends
 * its slug (the server checks it exists and stores "landing:<slug>" /
 * "developer:<slug>" — see lib/lead-source.ts). `name` is only what the thank-you
 * message and analytics call it.
 */
export type InquireContext =
  | { kind: "project"; projectId: number; name: string }
  | { kind: "landing" | "developer"; slug: string; name: string }

/**
 * The one buyer lead form — "Inquire Now" on project pages, and the enquiry
 * section of landing and developer pages (posts to /api/inquiries, which emails
 * the admin team and files the lead in the Leads inbox). Square surfaces to
 * match the flat public design.
 */
export function InquireForm({
  context,
  defaultCategory = "off_plan",
}: {
  context: InquireContext
  defaultCategory?: Category
}) {
  const subject = context.name
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneCountryCode, setPhoneCountryCode] = useState("+971")
  const [phone, setPhone] = useState("")
  const [lookingFor, setLookingFor] = useState<"myself" | "agent">("myself")
  const [propertyCategory, setPropertyCategory] = useState<Category>(defaultCategory)
  const [website, setWebsite] = useState("") // honeypot — humans never see it
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  const inputCls =
    "w-full px-4 py-3 border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
  const selectCls = `${inputCls} appearance-none pr-10 cursor-pointer`
  const labelCls = "text-xs font-semibold uppercase tracking-wider text-[#374151]"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError(null)
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phoneCountryCode,
          phone,
          lookingFor,
          propertyCategory,
          ...(context.kind === "project" ? { projectId: context.projectId } : { context: { kind: context.kind, slug: context.slug } }),
          utm: readUtm(),
          website,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Could not send your inquiry — please try again")
      setStatus("done")
      gaEvent("submit_inquiry", {
        form: context.kind,
        // `project` keeps its old meaning for project pages (existing GA reports key on it); landing and developer pages add `context`.
        ...(context.kind === "project" ? { project: context.name } : { context: context.slug }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your inquiry — please try again")
      setStatus("idle")
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-[#d6b357]/15 border-2 border-[#d6b357]/40 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-[#d6b357]" />
        </div>
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-1.5">Inquiry sent!</h3>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Thank you for your interest in <span className="font-semibold text-[#0f2940]">{subject}</span>.
          Our team will contact you shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-1.5">
        <label className={labelCls}>Name *</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            maxLength={200}
            autoComplete="name"
            className={`${inputCls} pl-11`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Phone *</label>
        <div className="flex gap-2">
          <PhoneCountrySelect
            value={phoneCountryCode}
            onChange={setPhoneCountryCode}
            ariaLabel="Phone country code"
            className="rounded-none border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 focus:ring-[#001f3f]/6"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="50 000 0000"
            required
            maxLength={20}
            autoComplete="tel-national"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Email *</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            maxLength={320}
            autoComplete="email"
            className={`${inputCls} pl-11`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Who I am looking for</label>
        <div className="relative">
          <select
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value as "myself" | "agent")}
            className={selectCls}
          >
            <option value="myself">I&apos;m looking for myself</option>
            <option value="agent">I&apos;m an agent</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Property Category</label>
        <div className="relative">
          <select
            value={propertyCategory}
            onChange={(e) => setPropertyCategory(e.target.value as Category)}
            className={selectCls}
          >
            <option value="off_plan">Off Plan</option>
            <option value="ready">Ready</option>
            <option value="rent">Rent</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
        </div>
      </div>

      {/* Honeypot — hidden from humans, bots fill it in */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden"
      />

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3 bg-[#d6b357] hover:bg-[#c8a544] text-[#001f3f] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Sending…
          </>
        ) : (
          "Contact Us"
        )}
      </button>
      <p className="text-[11px] text-[#9ca3af] text-center leading-relaxed">
        Your details go only to the FHI Global team and are never shared. By sending this you agree to our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[#6b7280]">Privacy Policy</Link>.
      </p>
    </form>
  )
}
