"use client"

// The public review form — a faithful web version of the printed "Customer
// Feedback Review" sheet: overall stars, the details block, the 7-question
// performance matrix (Poor … Excellent), likelihood to recommend, and the
// three free-text questions. No login: the POST endpoint validates, rate
// limits and writes via the service role.

import { useState } from "react"
import { CheckCircle2, Loader2, Send, Star } from "lucide-react"

const MATRIX: Array<{ key: ScoreKey; label: string }> = [
  { key: "communication", label: "Communication — the advisor kept me informed and responded promptly" },
  { key: "market", label: "Market knowledge — the advisor understood the local market and pricing" },
  { key: "understanding", label: "Understanding my needs — the advisor listened and matched options to what I wanted" },
  { key: "professionalism", label: "Professionalism — the advisor was courteous, honest, and reliable" },
  { key: "negotiation", label: "Negotiation — the advisor worked to get me the best possible terms" },
  { key: "process", label: "Process guidance — the advisor explained paperwork, fees, and next steps clearly" },
  { key: "experience", label: "Overall experience with this advisor" },
]
const MATRIX_COLS = ["Poor", "Fair", "Good", "V. Good", "Excel."]

const RECOMMEND_OPTIONS = [
  { value: "definitely_not", label: "Definitely Not" },
  { value: "unlikely", label: "Unlikely" },
  { value: "not_sure", label: "Not Sure" },
  { value: "likely", label: "Likely" },
  { value: "very_likely", label: "Very Likely" },
  { value: "definitely_yes", label: "Definitely Yes" },
] as const

type ScoreKey =
  | "communication" | "market" | "understanding" | "professionalism"
  | "negotiation" | "process" | "experience"

export function FeedbackForm({ agentId, advisorName }: { agentId: string; advisorName: string }) {
  const [overall, setOverall] = useState(0)
  const [hoverStar, setHoverStar] = useState(0)
  const [clientName, setClientName] = useState("")
  const [propertyRef, setPropertyRef] = useState("")
  const [transactionDate, setTransactionDate] = useState("")
  const [transactionType, setTransactionType] = useState("")
  const [scores, setScores] = useState<Partial<Record<ScoreKey, number>>>({})
  const [recommend, setRecommend] = useState("")
  const [didWell, setDidWell] = useState("")
  const [toImprove, setToImprove] = useState("")
  const [otherComments, setOtherComments] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const setScore = (key: ScoreKey, value: number) =>
    setScores((s) => ({ ...s, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (overall === 0) { setError("Please give an overall star rating."); return }
    if (!clientName.trim()) { setError("Please enter your name."); return }
    const missing = MATRIX.find((q) => !scores[q.key])
    if (missing) { setError(`Please rate: ${missing.label.split(" — ")[0]}.`); return }
    if (!recommend) { setError("Please tell us how likely you are to recommend this advisor."); return }

    setSending(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          clientName: clientName.trim(),
          propertyRef: propertyRef.trim(),
          transactionType: transactionType || null,
          transactionDate: transactionDate || null,
          overallRating: overall,
          scores,
          recommend,
          didWell: didWell.trim(),
          toImprove: toImprove.trim(),
          otherComments: otherComments.trim(),
          website,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error ?? "Could not send your feedback — please try again.")
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-[#e5e8ec] px-6 py-16 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-2">
          Thank you for your feedback!
        </h2>
        <p className="text-[#6b7280] text-sm leading-relaxed max-w-md mx-auto">
          Your review of {advisorName} has been recorded. It helps us raise the standard of
          service at FHI Global Property.
        </p>
      </div>
    )
  }

  const inputCls =
    "w-full px-3.5 py-2.5 border border-[#dfe3e8] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
  const labelCls = "block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5"

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* ── Overall stars ── */}
      <div className="bg-white border border-[#e5e8ec] p-6 text-center">
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] uppercase tracking-wide">
          Overall Star Rating
        </h2>
        <p className="text-xs text-[#9ca3af] italic mt-1 mb-4">
          Please select your overall rating for this advisor
        </p>
        <div className="inline-flex items-center gap-2" onMouseLeave={() => setHoverStar(0)}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hoverStar || overall)
            return (
              <button
                key={n}
                type="button"
                onClick={() => setOverall(n)}
                onMouseEnter={() => setHoverStar(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-1"
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    filled ? "fill-[#d6b357] text-[#d6b357]" : "text-[#cdd2d9]"
                  }`}
                />
              </button>
            )
          })}
        </div>
        {overall > 0 && (
          <p className="text-sm font-bold text-[#b8913f] mt-2">{overall} / 5</p>
        )}
      </div>

      {/* ── Details ── */}
      <div className="bg-white border border-[#e5e8ec] p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Your Name *</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} required placeholder="Full name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Property / Transaction Ref</label>
          <input value={propertyRef} onChange={(e) => setPropertyRef(e.target.value)} maxLength={300} placeholder="e.g. Azizi Venice — Unit 1204" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Transaction Type</label>
          <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            <option value="buy">Buy</option>
            <option value="resell">Resell</option>
            <option value="rent">Rent</option>
          </select>
        </div>
        {/* Honeypot — humans never see or fill this. */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
      </div>

      {/* ── 1. Performance matrix ── */}
      <div className="bg-white border border-[#e5e8ec] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-1">
          1. Rate Your Advisor&apos;s Performance
        </h2>
        <p className="text-xs text-[#9ca3af] italic mb-5">Please pick one answer per question.</p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-[#001f3f]">
                <th className="text-left text-white text-xs font-bold px-3 py-2.5">Question</th>
                {MATRIX_COLS.map((c) => (
                  <th key={c} className="text-white text-xs font-bold px-2 py-2.5 w-[64px] text-center">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((q, qi) => (
                <tr key={q.key} className={qi % 2 ? "bg-[#f8f9fb]" : "bg-white"}>
                  <td className="text-[13px] text-[#374151] leading-snug px-3 py-3 border-b border-[#eef0f3]">
                    {q.label}
                  </td>
                  {MATRIX_COLS.map((_, ci) => {
                    const value = ci + 1
                    const active = scores[q.key] === value
                    return (
                      <td key={ci} className="text-center border-b border-[#eef0f3]">
                        <button
                          type="button"
                          onClick={() => setScore(q.key, value)}
                          aria-label={`${q.label.split(" — ")[0]}: ${MATRIX_COLS[ci]}`}
                          className="p-2"
                        >
                          <span
                            className={`block w-[18px] h-[18px] border transition-colors ${
                              active
                                ? "bg-[#001f3f] border-[#001f3f]"
                                : "bg-white border-[#c4c9cf] hover:border-[#001f3f]"
                            }`}
                          />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Likelihood to recommend ── */}
      <div className="bg-white border border-[#e5e8ec] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-1">
          2. Likelihood to Recommend
        </h2>
        <p className="text-[13px] text-[#6b7280] mb-4">
          How likely are you to recommend this advisor to a friend, family member, or colleague?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {RECOMMEND_OPTIONS.map((opt) => {
            const active = recommend === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecommend(opt.value)}
                className={`px-2 py-2.5 text-xs font-semibold border transition-colors ${
                  active
                    ? "bg-[#001f3f] border-[#001f3f] text-white"
                    : "bg-white border-[#dfe3e8] text-[#374151] hover:border-[#001f3f]"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 3. Free text ── */}
      <div className="bg-white border border-[#e5e8ec] p-6 space-y-5">
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">3. In Your Own Words</h2>
        <div>
          <label className={labelCls}>What did your advisor do particularly well?</label>
          <textarea value={didWell} onChange={(e) => setDidWell(e.target.value)} rows={3} maxLength={3000} className={`${inputCls} resize-y`} />
        </div>
        <div>
          <label className={labelCls}>What could your advisor improve on?</label>
          <textarea value={toImprove} onChange={(e) => setToImprove(e.target.value)} rows={3} maxLength={3000} className={`${inputCls} resize-y`} />
        </div>
        <div>
          <label className={labelCls}>Any other comments or suggestions for FHI Global Property?</label>
          <textarea value={otherComments} onChange={(e) => setOtherComments(e.target.value)} rows={3} maxLength={3000} className={`${inputCls} resize-y`} />
        </div>
      </div>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <div className="text-center">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 px-10 py-3.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Submit Feedback"}
        </button>
        <p className="text-xs text-[#9ca3af] italic mt-4">
          Thank you for helping us raise the standard of service at FHI Global Property.
        </p>
      </div>
    </form>
  )
}
