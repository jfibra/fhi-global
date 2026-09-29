"use client"

import type { Ref } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import type { Choice } from "@/lib/buyer-links"

/**
 * The parts both Buyers Link briefs share: the buyer's (/b/<code>) and the
 * seller's (/s/<code>). Answer pills, question blocks, the contact fields,
 * the step rail, the Back / Continue / Send bar and the thank-you card, so
 * the two forms look and behave the same.
 */

export const briefInputCls =
  "w-full border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-3 text-[15px] text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:bg-white focus:outline-none"
export const briefLabelCls = "mb-1.5 block text-[13px] font-bold text-[#0d1117]"
export const briefCardCls = "bq-card scroll-mt-24 border border-[#e8eaed] bg-white shadow-[0_24px_70px_-35px_rgba(0,20,40,0.35)]"

export function Optional() {
  return <span className="font-normal text-[#9ca3af]">optional</span>
}

export function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1.5 text-[13px] font-semibold text-[#b91c1c]">{children}</p> : null
}

/** Answer choices as pills: one pick (radio) or several (checkbox). Tapping a picked single choice clears it. */
export function Pills({
  name,
  options,
  value,
  multi,
  onChange,
}: {
  name: string
  options: Choice[]
  value: string | string[] | undefined
  multi: boolean
  onChange: (next: string | string[] | undefined) => void
}) {
  const picked = Array.isArray(value) ? value : value ? [value] : []
  const toggle = (v: string) => {
    if (multi) {
      const next = picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]
      onChange(next.length ? next : undefined)
    } else {
      onChange(picked[0] === v ? undefined : v)
    }
  }
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = picked.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => toggle(o.value)}
            className={`bq-opt ${on ? "bq-opt--on" : ""}`}
          >
            {on && <Check className="h-3.5 w-3.5 shrink-0" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Question({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2.5 font-['Outfit'] text-[16px] font-bold text-[#0d1117]">
        {label}
        {required ? <span className="text-[#b8913f]"> *</span> : <span className="ml-1.5 text-[12px] font-normal text-[#9ca3af]">optional</span>}
      </p>
      {hint && <p className="-mt-1.5 mb-2.5 text-[13px] text-[#6b7280]">{hint}</p>}
      {children}
      {error && <p className="mt-2 text-[13px] font-semibold text-[#b91c1c]">{error}</p>}
    </div>
  )
}

export function StepIntro({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">{title}</p>
      <p className="mt-1 text-[14px] text-[#6b7280]">{sub}</p>
    </div>
  )
}

// ─── Contact: the first step of both briefs ──────────────────────────────────

export type Contact = { name: string; whatsappCode: string; whatsapp: string; email: string; nationality: string }
export const EMPTY_CONTACT: Contact = { name: "", whatsappCode: "+971", whatsapp: "", email: "", nationality: "" }

/** The contact fields' own errors (the server checks them again). */
export function checkContact(c: Contact): Record<string, string> {
  const e: Record<string, string> = {}
  if (!c.name.trim()) e.name = "Please enter your name."
  if (!/^[0-9 ()-]{4,20}$/.test(c.whatsapp.trim())) e.whatsapp = "Please enter a valid WhatsApp or Viber number."
  // Email is required (2026-09-29): the agent needs a second channel that
  // works even when the number turns out to be wrong.
  if (!c.email.trim()) e.email = "Please enter your email."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = "Please enter a valid email."
  return e
}

export function ContactFields({
  value,
  onChange,
  errors,
}: {
  value: Contact
  onChange: (patch: Partial<Contact>) => void
  errors: Record<string, string>
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="bq-name" className={briefLabelCls}>Full name <span className="text-[#b8913f]">*</span></label>
        <input id="bq-name" value={value.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={200} autoComplete="name" className={briefInputCls} />
        <FieldError>{errors.name}</FieldError>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="bq-wa" className={briefLabelCls}>WhatsApp / Viber number <span className="text-[#b8913f]">*</span></label>
        <div className="flex gap-2">
          <PhoneCountrySelect
            value={value.whatsappCode}
            onChange={(v) => onChange({ whatsappCode: v })}
            ariaLabel="WhatsApp / Viber country code"
            className="rounded-none border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 focus:ring-[#001f3f]/6"
          />
          <input
            id="bq-wa"
            type="tel"
            value={value.whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="50 123 4567"
            className={`${briefInputCls} min-w-0 flex-1`}
          />
        </div>
        <FieldError>{errors.whatsapp}</FieldError>
      </div>
      <div>
        <label htmlFor="bq-email" className={briefLabelCls}>Email <span className="text-[#b8913f]">*</span></label>
        <input id="bq-email" type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} maxLength={320} autoComplete="email" required className={briefInputCls} />
        <FieldError>{errors.email}</FieldError>
      </div>
      <div>
        <label htmlFor="bq-nat" className={briefLabelCls}>Nationality <Optional /></label>
        <input id="bq-nat" value={value.nationality} onChange={(e) => onChange({ nationality: e.target.value })} maxLength={60} autoComplete="country-name" className={briefInputCls} />
      </div>
    </div>
  )
}

// ─── Frame: step rail, nav bar, honeypot, thank-you ──────────────────────────

export function StepRail({ steps, step, onJump }: { steps: { id: string; title: string }[]; step: number; onJump: (i: number) => void }) {
  return (
    <div className="border-b border-[#eef0f3] px-5 pt-5 sm:px-8 sm:pt-7">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = i < step
          const on = i === step
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => (i < step ? onJump(i) : undefined)}
                disabled={i > step}
                aria-current={on ? "step" : undefined}
                className="group flex w-full flex-col items-start gap-2 text-left disabled:cursor-default"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-bold transition-colors ${
                    on ? "border-[#0d1117] bg-[#0d1117] text-white" : done ? "border-[#d6b357] bg-[#d6b357] text-[#001f3f]" : "border-[#d7dae0] text-[#9ca3af]"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`hidden text-[12.5px] font-bold sm:block ${on ? "text-[#0d1117]" : done ? "text-[#8a6d2b]" : "text-[#9ca3af]"}`}>
                  {s.title}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b8913f] sm:hidden">
        Step {step + 1} of {steps.length} · {steps[step].title}
      </p>
      <div className="mt-4 h-[3px] w-full bg-[#eef0f3]">
        <span className="block h-full bg-[#d6b357] transition-[width] duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  )
}

/** Back / Continue, and Send on the last step. Continue and Send are the form's submit button. */
export function StepNav({
  step,
  last,
  sending,
  sendLabel,
  consent,
  onBack,
}: {
  step: number
  last: number
  sending: boolean
  sendLabel: string
  consent: string
  onBack: () => void
}) {
  return (
    <>
      <div className="mt-9 flex items-center justify-between gap-3 border-t border-[#eef0f3] pt-6">
        {step > 0 ? (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-2 py-3 text-[14px] font-bold text-[#374151] transition-colors hover:text-[#0d1117]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <span className="text-[12.5px] text-[#9ca3af]">About two minutes</span>
        )}
        {step < last ? (
          <button type="submit" className="group inline-flex items-center gap-2 bg-[#0d1117] px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
            Continue <ArrowRight className="h-4 w-4 text-[#d6b357] transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button type="submit" disabled={sending} className="inline-flex items-center gap-2 bg-[#d6b357] px-7 py-3.5 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a] disabled:opacity-60">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendLabel}
          </button>
        )}
      </div>
      {step === last && <p className="mt-4 text-[12px] leading-relaxed text-[#9ca3af]">{consent}</p>}
    </>
  )
}

/** Invisible to people, irresistible to bots: the API drops any brief that fills it. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-hidden="true"
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  )
}

export function SentCard({
  cardRef,
  title,
  body,
  whatsapp,
  agentFirstName,
}: {
  cardRef: Ref<HTMLDivElement>
  title: string
  body: string
  /** wa.me digits, when the agent has a number on their profile. */
  whatsapp: string | null
  agentFirstName: string
}) {
  return (
    <div ref={cardRef} className={`${briefCardCls} px-6 py-12 text-center`}>
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d6b357] bg-[#d6b357]/10">
        <CheckCircle2 className="h-8 w-8 text-[#b8913f]" />
      </span>
      <p className="mt-5 font-['Outfit'] text-[28px] font-bold leading-tight text-[#0d1117]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#4b5563]">{body}</p>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 bg-[#25d366] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]"
        >
          <MessageCircle className="h-4 w-4" /> Message {agentFirstName} now
        </a>
      )}
    </div>
  )
}

/** POST a brief; null on success, else the message to show. */
export async function sendBrief(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch("/api/buyer-links/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) return null
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return body.error ?? "Could not send your brief — please try again."
  } catch {
    return "Could not send your brief — please check your connection and try again."
  }
}
