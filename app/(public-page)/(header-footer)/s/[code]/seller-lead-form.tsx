"use client"

import { useRef, useState } from "react"
import { gaEvent } from "@/lib/ga"
import {
  CONTACT_TIME_OPTIONS, SELLER_QUESTIONS, SELLER_STEPS, sellerAsks, type SellerProfile, type SellerQuestionKey,
} from "@/lib/buyer-links"
import {
  ContactFields, EMPTY_CONTACT, Honeypot, Optional, Pills, Question, SentCard, StepIntro, StepNav, StepRail,
  briefCardCls, briefInputCls, briefLabelCls, checkContact, sendBrief, type Contact,
} from "@/components/public/brief-fields"

/**
 * The seller's side of a Buyers Link (/s/<code>): a four-step brief about the
 * property (details, the property, status and price, plans) sent to the
 * agent who owns the link (POST /api/buyer-links/lead, kind "seller").
 * Questions that don't apply are hidden and never sent: handover for a ready
 * home, tenancy for a vacant one, bedrooms for land.
 */

type Answers = Partial<Record<SellerQuestionKey, string | string[] | undefined>>

/** "2,500,000" while typing; the state keeps digits only. */
const withCommas = (digits: string) => (digits ? Number(digits).toLocaleString("en-US") : "")

export function SellerLeadForm({
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
  const [answers, setAnswers] = useState<Answers>({})
  const [areaOther, setAreaOther] = useState("")
  const [building, setBuilding] = useState("")
  const [size, setSize] = useState("")
  const [price, setPrice] = useState("")
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
  const set = (k: SellerQuestionKey) => (v: string | string[] | undefined) => {
    setAnswers((a) => ({ ...a, [k]: v }))
    clearError(k)
  }

  const asks = sellerAsks(answers as SellerProfile)
  const last = SELLER_STEPS.length - 1

  /** Required answers for a step; returns the errors it found. */
  const check = (i: number): Record<string, string> => {
    if (i === 0) return checkContact(contact)
    const e: Record<string, string> = {}
    if (i === 1) {
      if (!answers.property_type) e.property_type = "Please choose one."
      if (!answers.area && !areaOther.trim()) e.area = "Please pick the area or type it in."
    }
    if (i === 2 && !answers.completion) e.completion = "Please choose one."
    if (i === 3 && !answers.sell_timeline) e.sell_timeline = "Please choose one."
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
    // Only the questions that apply to these answers.
    const kept = Object.fromEntries(
      Object.entries(answers).filter(([k]) => asks[k as keyof typeof asks] !== false),
    ) as Answers
    const profile: SellerProfile = {
      ...kept,
      nationality: contact.nationality.trim() || undefined,
      area_other: areaOther.trim() || undefined,
      building: building.trim() || undefined,
      size_sqft: size || undefined,
      asking_price: price || undefined,
    }
    const error = await sendBrief({
      kind: "seller",
      code,
      name: contact.name,
      whatsappCode: contact.whatsappCode,
      whatsapp: contact.whatsapp,
      email: contact.email,
      contactTime: contactTime ?? "",
      message,
      profile,
      website,
    })
    setSending(false)
    if (error) {
      setServerError(error)
      return
    }
    gaEvent("submit_seller_link", { step_count: SELLER_STEPS.length })
    setSent(true)
    scrollTop()
  }

  if (sent) {
    return (
      <SentCard
        cardRef={topRef}
        title={`Thank you, ${contact.name.trim().split(" ")[0]}.`}
        body={`${agentFirstName} has your property details and will come back to you on WhatsApp to talk price and next steps.`}
        whatsapp={agentWhatsapp}
        agentFirstName={agentFirstName}
      />
    )
  }

  const q = (k: SellerQuestionKey, required = false, hint?: string) => (
    <Question label={SELLER_QUESTIONS[k].label} required={required} hint={hint} error={errors[k]}>
      <Pills name={SELLER_QUESTIONS[k].label} options={SELLER_QUESTIONS[k].options} value={answers[k]} multi={SELLER_QUESTIONS[k].multi} onChange={set(k)} />
    </Question>
  )

  return (
    <div ref={topRef} className={briefCardCls}>
      <StepRail
        steps={SELLER_STEPS}
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
              {q("relation")}
              {q("residence")}
              <Question label="Best time to reach you">
                <Pills name="Best time to reach you" options={CONTACT_TIME_OPTIONS} value={contactTime} multi={false} onChange={(v) => setContactTime(v as string | undefined)} />
              </Question>
            </>
          )}

          {step === 1 && (
            <>
              <StepIntro title="The property" sub="The basics a buyer asks first." />
              {q("property_type", true)}
              <Question label={SELLER_QUESTIONS.area.label} required error={errors.area}>
                <Pills name={SELLER_QUESTIONS.area.label} options={SELLER_QUESTIONS.area.options} value={answers.area} multi={false} onChange={set("area")} />
                <input
                  value={areaOther}
                  onChange={(e) => {
                    setAreaOther(e.target.value)
                    clearError("area")
                  }}
                  maxLength={80}
                  placeholder="Another area? Type it here"
                  aria-label="Other area"
                  className={`${briefInputCls} mt-3`}
                />
              </Question>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="bq-building" className={briefLabelCls}>Building or project <Optional /></label>
                  <input id="bq-building" value={building} onChange={(e) => setBuilding(e.target.value)} maxLength={120} placeholder="e.g. Marina Gate 2" className={briefInputCls} />
                </div>
                <div>
                  <label htmlFor="bq-size" className={briefLabelCls}>Size in sq ft <Optional /></label>
                  <input
                    id="bq-size"
                    value={withCommas(size)}
                    onChange={(e) => setSize(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7))}
                    inputMode="numeric"
                    placeholder="e.g. 1,250"
                    className={briefInputCls}
                  />
                </div>
              </div>
              {asks.bedrooms && q("bedrooms")}
              {asks.bathrooms && q("bathrooms")}
              {asks.furnishing && q("furnishing")}
              {q("features", false, "Pick any that apply.")}
            </>
          )}

          {step === 2 && (
            <>
              <StepIntro title="Status & price" sub={`A rough idea is enough. It stays between you and ${agentFirstName}.`} />
              {q("completion", true)}
              {asks.paid_percent && q("paid_percent")}
              {asks.handover && q("handover")}
              {asks.occupancy && q("occupancy")}
              {asks.tenancy_ends && q("tenancy_ends")}
              <div>
                <label htmlFor="bq-price" className={briefLabelCls}>Your asking price <Optional /></label>
                <div className="flex">
                  <span className="flex items-center border border-r-0 border-[#e5e7eb] bg-[#eef0f3] px-3.5 text-[14px] font-bold text-[#374151]">AED</span>
                  <input
                    id="bq-price"
                    value={withCommas(price)}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11))}
                    inputMode="numeric"
                    placeholder="e.g. 2,500,000"
                    className={`${briefInputCls} min-w-0 flex-1`}
                  />
                </div>
              </div>
              {q("valuation")}
              {q("mortgage")}
              {q("title_deed", false, "Oqood is the registration for an off-plan property.")}
            </>
          )}

          {step === 3 && (
            <>
              <StepIntro title="Your plans" sub="When you’d like to sell, and anything that helps." />
              {q("sell_timeline", true)}
              {q("reason")}
              {q("listed")}
              {q("also_rent")}
              <div>
                <label htmlFor="bq-msg" className={briefLabelCls}>
                  Anything else {agentFirstName} should know? <Optional />
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
          consent={`By sending, you agree that ${agentFirstName} from FHI Global may contact you about selling your property.`}
          onBack={back}
        />
      </form>
    </div>
  )
}
