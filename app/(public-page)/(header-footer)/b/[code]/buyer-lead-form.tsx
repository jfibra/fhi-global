"use client"

import { useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { gaEvent } from "@/lib/ga"
import {
  BUDGET_OPTIONS, BUYER_QUESTIONS, BUYER_STEPS, CONTACT_TIME_OPTIONS, type BuyerProfile, type Choice, type QuestionKey,
} from "@/lib/buyer-links"

/**
 * The client's side of a Buyers Link: a four-step brief (details, buying
 * profile, preferences, financials) sent to the agent who owns the link
 * (POST /api/buyer-links/lead). Each step checks its own required answers
 * before moving on; the server checks everything again.
 */

type Answers = Record<QuestionKey, string | string[] | undefined>

function Pills({
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

function Question({ label, hint, required, error, children }: { label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode }) {
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

export function BuyerLeadForm({
  code,
  agentFirstName,
  agentWhatsapp,
}: {
  code: string
  agentFirstName: string
  /** wa.me digits, when the agent has a number on their profile. */
  agentWhatsapp: string | null
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [whatsappCode, setWhatsappCode] = useState("+971")
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [nationality, setNationality] = useState("")
  const [contactTime, setContactTime] = useState<string | undefined>(undefined)
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [areasOther, setAreasOther] = useState("")
  const [budget, setBudget] = useState<string | undefined>(undefined)
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const set = (k: QuestionKey) => (v: string | string[] | undefined) => {
    setAnswers((a) => ({ ...a, [k]: v }))
    setErrors((e) => {
      const next = { ...e }
      delete next[k]
      return next
    })
  }

  const last = BUYER_STEPS.length - 1

  /** Required answers for a step; returns the errors it found. */
  const check = (i: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (i === 0) {
      if (!name.trim()) e.name = "Please enter your name."
      if (!/^[0-9 ()-]{4,20}$/.test(whatsapp.trim())) e.whatsapp = "Please enter a valid WhatsApp number."
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Please enter a valid email."
    }
    if (i === 1) {
      if (!answers.buying_for) e.buying_for = "Please choose one."
      if (!answers.buy_timeline) e.buy_timeline = "Please choose one."
    }
    if (i === 3) {
      if (!budget) e.budget = "Please choose your budget."
      if (!answers.payment) e.payment = "Please choose one."
    }
    return e
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  const next = () => {
    const e = check(step)
    setErrors(e)
    if (Object.keys(e).length) return
    setStep((s) => Math.min(last, s + 1))
    scrollTop()
  }
  const back = () => {
    setErrors({})
    setStep((s) => Math.max(0, s - 1))
    scrollTop()
  }

  const submit = async () => {
    // Every step again, in case something was skipped with the step tabs.
    for (let i = 0; i <= last; i++) {
      const e = check(i)
      if (Object.keys(e).length) {
        setErrors(e)
        setStep(i)
        scrollTop()
        return
      }
    }
    setServerError(null)
    setSending(true)
    const profile: BuyerProfile = { ...answers, nationality: nationality.trim() || undefined, areas_other: areasOther.trim() || undefined }
    try {
      const res = await fetch("/api/buyer-links/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, whatsappCode, whatsapp, email, contactTime: contactTime ?? "", budget, message, profile, website }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setServerError(body.error ?? "Could not send your brief — please try again.")
        return
      }
      gaEvent("submit_buyer_link", { step_count: BUYER_STEPS.length })
      setSent(true)
      scrollTop()
    } catch {
      setServerError("Could not send your brief — please check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  const inputCls =
    "w-full border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-3 text-[15px] text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:bg-white focus:outline-none"
  const labelCls = "mb-1.5 block text-[13px] font-bold text-[#0d1117]"

  if (sent) {
    return (
      <div ref={topRef} className="bq-card scroll-mt-24 border border-[#e8eaed] bg-white px-6 py-12 text-center shadow-[0_24px_70px_-35px_rgba(0,20,40,0.35)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d6b357] bg-[#d6b357]/10">
          <CheckCircle2 className="h-8 w-8 text-[#b8913f]" />
        </span>
        <p className="mt-5 font-['Outfit'] text-[28px] font-bold leading-tight text-[#0d1117]">
          Thank you, {name.trim().split(" ")[0]}.
        </p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#4b5563]">
          {agentFirstName} has your brief and will come back to you on WhatsApp with options that fit.
        </p>
        {agentWhatsapp && (
          <a
            href={`https://wa.me/${agentWhatsapp}`}
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

  const q = (k: QuestionKey, required = false, hint?: string) => (
    <Question label={BUYER_QUESTIONS[k].label} required={required} hint={hint} error={errors[k]}>
      <Pills name={BUYER_QUESTIONS[k].label} options={BUYER_QUESTIONS[k].options} value={answers[k]} multi={BUYER_QUESTIONS[k].multi} onChange={set(k)} />
    </Question>
  )

  return (
    <div ref={topRef} className="bq-card scroll-mt-24 border border-[#e8eaed] bg-white shadow-[0_24px_70px_-35px_rgba(0,20,40,0.35)]">
      {/* ── Step rail ── */}
      <div className="border-b border-[#eef0f3] px-5 pt-5 sm:px-8 sm:pt-7">
        <ol className="grid grid-cols-4 gap-2">
          {BUYER_STEPS.map((s, i) => {
            const done = i < step
            const on = i === step
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (i < step ? (setErrors({}), setStep(i)) : undefined)}
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
          Step {step + 1} of {BUYER_STEPS.length} · {BUYER_STEPS[step].title}
        </p>
        <div className="mt-4 h-[3px] w-full bg-[#eef0f3]">
          <span className="block h-full bg-[#d6b357] transition-[width] duration-500" style={{ width: `${((step + 1) / BUYER_STEPS.length) * 100}%` }} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (step < last) next()
          else void submit()
        }}
        className="px-5 py-7 sm:px-8 sm:py-9"
        noValidate
      >
        <div key={step} className="bq-step space-y-8">
          {step === 0 && (
            <>
              <div>
                <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">Your details</p>
                <p className="mt-1 text-[14px] text-[#6b7280]">So {agentFirstName} knows who to get back to.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="bq-name" className={labelCls}>Full name <span className="text-[#b8913f]">*</span></label>
                  <input id="bq-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="name" className={inputCls} />
                  {errors.name && <p className="mt-1.5 text-[13px] font-semibold text-[#b91c1c]">{errors.name}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bq-wa" className={labelCls}>WhatsApp number <span className="text-[#b8913f]">*</span></label>
                  <div className="flex gap-2">
                    <PhoneCountrySelect
                      value={whatsappCode}
                      onChange={setWhatsappCode}
                      ariaLabel="WhatsApp country code"
                      className="rounded-none border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 focus:ring-[#001f3f]/6"
                    />
                    <input
                      id="bq-wa"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="50 123 4567"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                  </div>
                  {errors.whatsapp && <p className="mt-1.5 text-[13px] font-semibold text-[#b91c1c]">{errors.whatsapp}</p>}
                </div>
                <div>
                  <label htmlFor="bq-email" className={labelCls}>Email <span className="font-normal text-[#9ca3af]">optional</span></label>
                  <input id="bq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} autoComplete="email" className={inputCls} />
                  {errors.email && <p className="mt-1.5 text-[13px] font-semibold text-[#b91c1c]">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="bq-nat" className={labelCls}>Nationality <span className="font-normal text-[#9ca3af]">optional</span></label>
                  <input id="bq-nat" value={nationality} onChange={(e) => setNationality(e.target.value)} maxLength={60} autoComplete="country-name" className={inputCls} />
                </div>
              </div>
              {q("residence")}
              <Question label="Best time to reach you">
                <Pills name="Best time to reach you" options={CONTACT_TIME_OPTIONS} value={contactTime} multi={false} onChange={(v) => setContactTime(v as string | undefined)} />
              </Question>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">Buying profile</p>
                <p className="mt-1 text-[14px] text-[#6b7280]">Who the home is for, and when.</p>
              </div>
              {q("buying_for", true)}
              {q("buying_with")}
              {q("buy_timeline", true)}
              {q("move_in")}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">Preferences</p>
                <p className="mt-1 text-[14px] text-[#6b7280]">Pick as many as you like. Skip anything you haven&rsquo;t decided.</p>
              </div>
              {q("property_types")}
              {q("bedrooms")}
              {q("completion")}
              <Question label={BUYER_QUESTIONS.areas.label}>
                <Pills name={BUYER_QUESTIONS.areas.label} options={BUYER_QUESTIONS.areas.options} value={answers.areas} multi onChange={set("areas")} />
                <input
                  value={areasOther}
                  onChange={(e) => setAreasOther(e.target.value)}
                  maxLength={200}
                  placeholder="Another area? Type it here"
                  aria-label="Other areas"
                  className={`${inputCls} mt-3`}
                />
              </Question>
              {q("must_haves")}
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="font-['Outfit'] text-[22px] font-bold text-[#0d1117]">Financials</p>
                <p className="mt-1 text-[14px] text-[#6b7280]">A rough idea is enough. It stays between you and {agentFirstName}.</p>
              </div>
              <Question label="Your budget" required error={errors.budget}>
                <Pills
                  name="Your budget"
                  options={BUDGET_OPTIONS}
                  value={budget}
                  multi={false}
                  onChange={(v) => {
                    setBudget(v as string | undefined)
                    setErrors((e) => ({ ...e, budget: "" }))
                  }}
                />
              </Question>
              {q("payment", true)}
              {answers.payment === "mortgage" && q("mortgage_status")}
              {q("down_payment")}
              {q("golden_visa", false, "Property worth AED 2M or more can qualify for the 10-year visa.")}
              <div>
                <label htmlFor="bq-msg" className={labelCls}>Anything else {agentFirstName} should know? <span className="font-normal text-[#9ca3af]">optional</span></label>
                <textarea id="bq-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={`${inputCls} resize-y`} />
              </div>
            </>
          )}
        </div>

        {/* Honeypot: invisible to people, irresistible to bots. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {serverError && <p className="mt-6 bg-[#fef2f2] px-4 py-3 text-[14px] text-[#b91c1c]">{serverError}</p>}

        <div className="mt-9 flex items-center justify-between gap-3 border-t border-[#eef0f3] pt-6">
          {step > 0 ? (
            <button type="button" onClick={back} className="inline-flex items-center gap-2 px-2 py-3 text-[14px] font-bold text-[#374151] transition-colors hover:text-[#0d1117]">
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
              Send to {agentFirstName}
            </button>
          )}
        </div>
        {step === last && (
          <p className="mt-4 text-[12px] leading-relaxed text-[#9ca3af]">
            By sending, you agree that {agentFirstName} from FHI Global may contact you about properties that match your brief.
          </p>
        )}
      </form>
    </div>
  )
}
