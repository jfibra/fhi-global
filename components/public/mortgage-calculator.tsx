"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

/**
 * Dubai mortgage calculator — standard amortization plus the real upfront
 * costs of a Dubai purchase (same figures as the buying-costs guide: DLD 4%
 * + AED 580, trustee office, 0.25% mortgage registration + AED 290, agent
 * 2% + VAT on resales, valuation). Indicative only, and it says so.
 */

const AED = (n: number) =>
  `AED ${Math.round(n).toLocaleString("en-AE", { maximumFractionDigits: 0 })}`

function monthlyPayment(loan: number, annualRatePct: number, years: number): number {
  const n = years * 12
  if (n <= 0 || loan <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return loan / n
  const f = Math.pow(1 + r, n)
  return (loan * r * f) / (f - 1)
}

function Field({
  label,
  suffix,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">{label}</label>
        <span className="font-['Outfit'] text-lg font-bold text-[#001f3f] leading-none">
          {suffix === "AED" ? AED(value) : `${value}${suffix}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#d6b357]"
        aria-label={label}
      />
    </div>
  )
}

export function MortgageCalculator() {
  const [price, setPrice] = useState(1_500_000)
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(4.5)
  const [years, setYears] = useState(25)
  // New launches bought direct from the developer carry no agent commission.
  const [fromDeveloper, setFromDeveloper] = useState(false)

  const r = useMemo(() => {
    const down = (price * downPct) / 100
    const loan = price - down
    const monthly = monthlyPayment(loan, rate, years)
    const totalPaid = monthly * years * 12
    const totalInterest = Math.max(0, totalPaid - loan)

    const dld = price * 0.04 + 580
    const trustee = (price < 500_000 ? 2_000 : 4_000) * 1.05
    const agent = fromDeveloper ? 0 : price * 0.02 * 1.05
    const mortgageReg = loan > 0 ? loan * 0.0025 + 290 : 0
    const valuation = loan > 0 ? 3_000 : 0
    const upfront = down + dld + trustee + agent + mortgageReg + valuation

    return { down, loan, monthly, totalInterest, dld, trustee, agent, mortgageReg, valuation, upfront }
  }, [price, downPct, rate, years, fromDeveloper])

  const rows: Array<[string, number]> = [
    ["Down payment", r.down],
    ["DLD transfer fee (4% + AED 580)", r.dld],
    ["Trustee office (incl. VAT)", r.trustee],
    ...(r.agent > 0 ? ([["Agent commission (2% + VAT)", r.agent]] as Array<[string, number]>) : []),
    ...(r.loan > 0
      ? ([
          ["Mortgage registration (0.25% + AED 290)", r.mortgageReg],
          ["Bank valuation (approx.)", r.valuation],
        ] as Array<[string, number]>)
      : []),
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Inputs */}
      <div className="bg-white border border-[#e5e8ec] p-6 sm:p-8 space-y-7">
        <Field label="Property Price" suffix="AED" value={price} min={400_000} max={20_000_000} step={50_000} onChange={setPrice} />
        <Field label="Down Payment" suffix="%" value={downPct} min={10} max={80} step={5} onChange={setDownPct} />
        <Field label="Interest Rate" suffix="%" value={rate} min={2.5} max={8} step={0.1} onChange={setRate} />
        <Field label="Loan Term" suffix=" years" value={years} min={5} max={25} step={1} onChange={setYears} />

        <label className="flex items-start gap-3 pt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={fromDeveloper}
            onChange={(e) => setFromDeveloper(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#d6b357]"
          />
          <span className="text-sm text-[#374151] leading-snug">
            Buying a new launch direct from the developer{" "}
            <span className="text-[#9ca3af]">(no agent commission)</span>
          </span>
        </label>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="bg-[#001f3f] border-b-2 border-[#d6b357] p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
            Estimated Monthly Payment
          </p>
          <p className="mt-2 font-['Outfit'] text-4xl sm:text-5xl font-bold text-white leading-none">
            {AED(r.monthly)}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d6b357]/90">Loan Amount</dt>
              <dd className="mt-1 font-['Outfit'] text-lg font-bold text-white">{AED(r.loan)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d6b357]/90">Total Interest</dt>
              <dd className="mt-1 font-['Outfit'] text-lg font-bold text-white">{AED(r.totalInterest)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-[#e5e8ec] p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
            Cash Needed Upfront
          </p>
          <div className="mt-4 divide-y divide-[#eef0f3]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-sm text-[#4b5563]">{label}</span>
                <span className="text-sm font-bold text-[#001f3f] whitespace-nowrap">{AED(value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm font-bold text-[#0d1117]">Total upfront</span>
              <span className="font-['Outfit'] text-xl font-bold text-[#b8913f] whitespace-nowrap">
                {AED(r.upfront)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[#9ca3af]">
            Indicative estimates only — banks price by profile, and fees vary by transaction. Your
            consultant will run exact numbers for any project you shortlist.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
          >
            Get a Real Quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
