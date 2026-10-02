"use client"

import { useRef, useState } from "react"
import { gaEvent } from "@/lib/ga"
import {
  BUDGET_OPTIONS, BUYER_QUESTIONS, BUYER_STEPS, CONTACT_TIME_OPTIONS, ownsBusiness, type BuyerProfile, type QuestionKey,
} from "@/lib/buyer-links"
import {
  ContactFields, EMPTY_CONTACT, Honeypot, Pills, Question, SentCard, StepIntro, StepNav, StepRail, briefCardCls,
  briefInputCls, briefLabelCls, checkContact, sendBrief, type Contact,
} from "@/components/public/brief-fields"

/**
 * The buyer's side of a Buyers Link: a four-step brief (details, buying
 * profile, preferences, financials) sent to the agent who owns the link
 * (POST /api/buyer-links/lead). Each step checks its own required answers
 * before moving on; the server checks everything again.
 */

type Answers = Record<QuestionKey, string | string[] | undefined>

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
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)
  const [contactTime, setContactTime] = useState<string | undefined>(undefined)
  const [answers, setAnswers] = useState<Partial<Answers>>({})
  const [areasOther, setAreasOther] = useState("")
  const [profession, setProfession] = useState("")
  const [position, setPosition] = useState("")
  const [budget, setBudget] = useState<string | undefined>(undefined)
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const clearError = (k: string) =>
    setErrors((e) => {
      if (!e[k]) return e
      const next = { ...e }
      delete next[k]
      return next
    })
  const set = (k: QuestionKey) => (v: string | string[] | undefined) => {
    setAnswers((a) => ({ ...a, [k]: v }))
    clearError(k)
  }

  const last = BUYER_STEPS.length - 1

  /** Required answers for a step; returns the errors it found. */
  const check = (i: number): Record<string, string> => {
    if (i === 0) return checkContact(contact)
    const e: Record<string, string> = {}
    if (i === 1) {
      if (!answers.buying_for) e.buying_for = "Please choose one."
      if (!answers.buy_timeline) e.buy_timeline = "Please choose one."
    }
    if (i === 3) {
      if (!budget) e.budget = "Please choose your budget."
      if (!answers.payment) e.payment = "Please choose one."
      if (!answers.readiness) e.readiness = "Please choose one."
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
    const profile: BuyerProfile = {
      ...answers,
      nationality: contact.nationality.trim() || undefined,
      areas_other: areasOther.trim() || undefined,
      profession: profession.trim() || undefined,
      position: position.trim() || undefined,
    }
    const error = await sendBrief({
      kind: "buyer",
      code,
      name: contact.name,
      whatsappCode: contact.whatsappCode,
      whatsapp: contact.whatsapp,
      email: contact.email,
      contactTime: contactTime ?? "",
      budget,
      message,
      profile,
      website,
    })
    setSending(false)
    if (error) {
      setServerError(error)
      return
    }
    gaEvent("submit_buyer_link", { step_count: BUYER_STEPS.length })
    setSent(true)
    scrollTop()
  }

  if (sent) {
    return (
      <SentCard
        cardRef={topRef}
        title={`Thank you, ${contact.name.trim().split(" ")[0]}.`}
        body={`${agentFirstName} has your brief and will come back to you on WhatsApp with options that fit.`}
        whatsapp={agentWhatsapp}
        agentFirstName={agentFirstName}
      />
    )
  }

  const q = (k: QuestionKey, required = false, hint?: string) => (
    <Question label={BUYER_QUESTIONS[k].label} required={required} hint={hint} error={errors[k]}>
      <Pills name={BUYER_QUESTIONS[k].label} options={BUYER_QUESTIONS[k].options} value={answers[k]} multi={BUYER_QUESTIONS[k].multi} onChange={set(k)} />
    </Question>
  )

  return (
    <div ref={topRef} className={briefCardCls}>
      <StepRail
        steps={BUYER_STEPS}
        step={step}
        onJump={(i) => {
          setErrors({})
          setStep(i)
        }}
      />

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
              <StepIntro title="Your details" sub={`So ${agentFirstName} knows who to get back to.`} />
              <ContactFields
                value={contact}
                errors={errors}
                onChange={(patch) => {
                  setContact((c) => ({ ...c, ...patch }))
                  Object.keys(patch).forEach(clearError)
                }}
              />
              {q("residence")}
              {q("contact_channel")}
              <Question label="Best time to reach you">
                <Pills name="Best time to reach you" options={CONTACT_TIME_OPTIONS} value={contactTime} multi={false} onChange={(v) => setContactTime(v as string | undefined)} />
              </Question>
            </>
          )}

          {step === 1 && (
            <>
              <StepIntro title="Buying profile" sub="Who the home is for, and when." />
              {q("buying_for", true)}
              {q("goal")}
              {q("buying_with")}
              {q("buy_timeline", true)}
              {q("move_in")}
            </>
          )}

          {step === 2 && (
            <>
              <StepIntro title="Preferences" sub="Pick as many as you like. Skip anything you haven’t decided." />
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
                  className={`${briefInputCls} mt-3`}
                />
              </Question>
              {q("must_haves")}
            </>
          )}

          {step === 3 && (
            <>
              <StepIntro title="Financials" sub={`A rough idea is enough. It stays between you and ${agentFirstName}.`} />
              <Question label="Your budget" required error={errors.budget}>
                <Pills
                  name="Your budget"
                  options={BUDGET_OPTIONS}
                  value={budget}
                  multi={false}
                  onChange={(v) => {
                    setBudget(v as string | undefined)
                    clearError("budget")
                  }}
                />
              </Question>
              {q("income_source")}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="bq-profession" className={briefLabelCls}>
                    Profession <span className="font-normal text-[#9ca3af]">optional</span>
                  </label>
                  <input
                    id="bq-profession"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    maxLength={80}
                    autoComplete="organization-title"
                    placeholder="e.g. Nurse, Engineer, Accountant"
                    className={briefInputCls}
                  />
                </div>
                <div>
                  <label htmlFor="bq-position" className={briefLabelCls}>
                    {ownsBusiness(answers.income_source) ? "Your business" : "Position and company"} <span className="font-normal text-[#9ca3af]">optional</span>
                  </label>
                  <input
                    id="bq-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    maxLength={120}
                    autoComplete="organization"
                    placeholder={ownsBusiness(answers.income_source) ? "e.g. Owner, trading company in Deira" : "e.g. Operations Manager, Emirates"}
                    className={briefInputCls}
                  />
                </div>
              </div>
              {q("payment", true)}
              {answers.payment === "mortgage" && q("mortgage_status")}
              {q("down_payment")}
              {q("golden_visa", false, "Property worth AED 2M or more can qualify for the 10-year visa.")}
              {q("readiness", true, "If the right property comes up.")}
              <div>
                <label htmlFor="bq-msg" className={briefLabelCls}>
                  Anything else {agentFirstName} should know? <span className="font-normal text-[#9ca3af]">optional</span>
                </label>
                <textarea id="bq-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={`${briefInputCls} resize-y`} />
              </div>
            </>
          )}
        </div>

        <Honeypot value={website} onChange={setWebsite} />

        {serverError && <p className="mt-6 bg-[#fef2f2] px-4 py-3 text-[14px] text-[#b91c1c]">{serverError}</p>}

        <StepNav
          step={step}
          last={last}
          sending={sending}
          sendLabel={`Send to ${agentFirstName}`}
          consent={`By sending, you agree that ${agentFirstName} from FHI Global may contact you about properties that match your brief.`}
          onBack={back}
        />
      </form>
    </div>
  )
}
