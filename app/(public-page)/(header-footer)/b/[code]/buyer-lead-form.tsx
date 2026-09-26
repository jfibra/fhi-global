"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react"
import { PhoneCountrySelect } from "@/components/phone-country-select"
import { gaEvent } from "@/lib/ga"
import { BUDGET_OPTIONS, CONTACT_TIME_OPTIONS } from "@/lib/buyer-links"

/**
 * The client's side of a Buyers Link: their details go to the agent who sent
 * the link (POST /api/buyer-links/lead). Square surfaces to match the page.
 */
export function BuyerLeadForm({
  code,
  agentFirstName,
  agentWhatsapp,
  projects,
}: {
  code: string
  agentFirstName: string
  /** wa.me digits, when the agent has a number on their profile. */
  agentWhatsapp: string | null
  projects: { id: number; name: string }[]
}) {
  const [name, setName] = useState("")
  const [whatsappCode, setWhatsappCode] = useState("+971")
  const [whatsapp, setWhatsapp] = useState("")
  const [email, setEmail] = useState("")
  const [budget, setBudget] = useState("")
  const [contactTime, setContactTime] = useState("")
  const [message, setMessage] = useState("")
  const [picked, setPicked] = useState<number[]>(() => projects.map((p) => p.id))
  const [website, setWebsite] = useState("") // honeypot
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch("/api/buyer-links/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, whatsappCode, whatsapp, email, budget, contactTime, message, projectIds: picked, website }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? "Could not send your details — please try again.")
        return
      }
      gaEvent("submit_buyer_link", { projects: picked.length })
      setSent(true)
    } catch {
      setError("Could not send your details — please check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="border border-[#e8eaed] bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-11 w-11 text-[#15803d]" />
        <p className="mt-3 font-['Outfit'] text-xl font-bold text-[#0d1117]">Thank you, {name.trim().split(" ")[0]}!</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4b5563]">
          {agentFirstName} has your details and will contact you on WhatsApp soon.
        </p>
        {agentWhatsapp && (
          <a
            href={`https://wa.me/${agentWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 bg-[#25d366] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1fb857]"
          >
            <MessageCircle className="h-4 w-4" /> Message {agentFirstName} now
          </a>
        )}
      </div>
    )
  }

  const labelCls = "mb-1.5 block text-[12px] font-bold text-[#0d1117]"
  const inputCls =
    "w-full border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-3 text-[15px] text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:bg-white focus:outline-none"

  return (
    <form onSubmit={submit} className="border border-[#e8eaed] bg-white">
      <div className="bg-[#001f3f] px-5 py-4">
        <p className="text-base font-bold leading-tight text-white">Interested? Send your details</p>
        <p className="mt-1 text-[13px] text-white/65">{agentFirstName} will get back to you on WhatsApp.</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="bl-name" className={labelCls}>Full name *</label>
          <input id="bl-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="bl-wa" className={labelCls}>WhatsApp number *</label>
          <div className="flex gap-2">
            <PhoneCountrySelect
              value={whatsappCode}
              onChange={setWhatsappCode}
              ariaLabel="WhatsApp country code"
              className="rounded-none border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 focus:ring-[#001f3f]/6"
            />
            <input
              id="bl-wa"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="50 123 4567"
              className={`${inputCls} min-w-0 flex-1`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="bl-email" className={labelCls}>Email <span className="font-normal text-[#9ca3af]">(optional)</span></label>
          <input id="bl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} autoComplete="email" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bl-budget" className={labelCls}>Budget</label>
            <select id="bl-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls}>
              <option value="">Select</option>
              {BUDGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bl-time" className={labelCls}>Best time to call</label>
            <select id="bl-time" value={contactTime} onChange={(e) => setContactTime(e.target.value)} className={inputCls}>
              <option value="">Any time</option>
              {CONTACT_TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {projects.length > 1 && (
          <fieldset>
            <legend className={labelCls}>I&rsquo;m interested in</legend>
            <div className="space-y-1.5">
              {projects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#374151]">
                  <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[#001f3f]" />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="bl-msg" className={labelCls}>Questions <span className="font-normal text-[#9ca3af]">(optional)</span></label>
          <textarea id="bl-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000} className={`${inputCls} resize-y`} />
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
        {error && <p className="bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 bg-[#d6b357] px-5 py-3.5 text-[15px] font-bold text-[#1a1408] transition-all hover:brightness-95 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to {agentFirstName}
        </button>
        <p className="text-[11.5px] leading-relaxed text-[#9ca3af]">
          By sending, you agree that {agentFirstName} from FHI Global may contact you about these projects.
        </p>
      </div>
    </form>
  )
}
