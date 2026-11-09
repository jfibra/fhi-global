"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { fetchBroker, formatDate, licenceStatus, type BrokerFetchState } from "./broker-details-modal"

const INPUT_CLS =
  "w-full px-5 py-2.5 border border-[#e5e7eb] bg-white transition-colors focus:outline-none focus:border-[#001f3f] text-sm"
const READONLY_CLS = "w-full px-5 py-2.5 border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] min-h-[42px]"
const LABEL_CLS = "text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]"

export type BrnLookupState = { kind: "idle" } | BrokerFetchState
/** A lookup result tagged with the BRN it was for — stale once the input changes. */
export type BrnLookup = { brn: string; state: BrnLookupState }
export const EMPTY_BRN_LOOKUP: BrnLookup = { brn: "", state: { kind: "idle" } }

export const isBrn = (v: string) => /^\d{1,10}$/.test(v)

/**
 * RERA BRN (stored as metadata.license_number) — OPTIONAL, since not every
 * member is a broker — with a Search button that checks it against the Dubai
 * Land Department broker register (GET /api/brokers/<brn>, saved in the
 * `brokers` table). A found BRN gets a check inside the input (broker name
 * as its tooltip); not-found / errors float under it. The licence end date
 * sits on the right and the office's ORN + brokerage name underneath —
 * read-only, from DLD.
 *
 * The lookup lives in the parent (`lookup` / `onLookup`) so Save Profile
 * Info can refuse a BRN that isn't in the register. On load it shows a BRN
 * that was already looked up (saved copy only — it never calls DLD by
 * itself).
 */
export function BrnField({
  value,
  onChange,
  lookup: tagged,
  onLookup,
  notBroker,
  onNotBrokerChange,
  required = false,
}: {
  value: string
  onChange: (v: string) => void
  lookup: BrnLookup
  onLookup: (next: BrnLookup) => void
  /** "I'm not a broker" is ticked: BRN cleared and locked, nothing to search. */
  notBroker: boolean
  onNotBrokerChange: (next: boolean) => void
  /** The account still owes a BRN answer: a red tooltip points at the empty input. */
  required?: boolean
}) {
  const brn = value.trim()
  // A result for another number (the input was edited since) doesn't count.
  const lookup: BrnLookupState = !notBroker && tagged.brn === brn ? tagged.state : { kind: "idle" }

  // Saved copy for the BRN the profile loaded with — no DLD call.
  const [initialBrn] = useState(brn)
  useEffect(() => {
    if (!isBrn(initialBrn)) return
    let cancelled = false
    void fetchBroker(initialBrn, false, true).then((next) => {
      if (!cancelled && next.kind === "ok") onLookup({ brn: initialBrn, state: next })
    })
    return () => { cancelled = true }
  }, [initialBrn, onLookup])

  const search = () => {
    if (!isBrn(brn)) {
      onLookup({ brn, state: { kind: "error", message: "Enter the BRN as numbers only — it's on your RERA broker card." } })
      return
    }
    onLookup({ brn, state: { kind: "loading" } })
    void fetchBroker(brn, false).then((next) => onLookup({ brn, state: next }))
  }

  const broker = lookup.kind === "ok" ? lookup.broker : null
  const status = broker ? licenceStatus(broker.license_end_date) : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="rera-brn" className={LABEL_CLS}>
            BRN (Broker Registration Number)
          </label>
          <div className="relative">
            {/* Required: a red tooltip above the input's left end (above, so it never covers the
                not-found tooltip or the "I'm not a broker" box below). Gone once they type or tick. */}
            {required && !notBroker && !brn && (
              <div
                role="alert"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-full whitespace-nowrap rounded-md bg-[#dc2626] px-3 py-1.5 text-xs font-bold text-white shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)]"
              >
                BRN required — or tick “I&apos;m not a broker”
                <span className="absolute left-5 top-full border-[5px] border-transparent border-t-[#dc2626]" aria-hidden />
              </div>
            )}
            <div className="flex">
              <div className="relative min-w-0 flex-1">
                <input
                  id="rera-brn"
                  className={`${INPUT_CLS} border-r-0 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#9ca3af] ${broker || lookup.kind === "loading" ? "pr-11" : ""}`}
                  value={notBroker ? "" : value}
                  disabled={notBroker}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      search()
                    }
                  }}
                  inputMode="numeric"
                  placeholder={notBroker ? "Not a broker" : "For broker only"}
                />
                {/* Searching: a spinner where the check will appear. */}
                {lookup.kind === "loading" && (
                  <Loader2
                    className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#001f3f]"
                    aria-label="Searching the broker register"
                  />
                )}
                {/* Found: a check inside the input; the broker's name shows on hover / focus. */}
                {broker && (
                  <span
                    tabIndex={0}
                    aria-label={`BRN found — ${broker.broker_en ?? "registered broker"}`}
                    className="group absolute right-3 top-1/2 -translate-y-1/2 cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#166534]/40"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[#166534]" aria-hidden />
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-max max-w-[260px] rounded-md bg-[#0d1117] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      BRN found — {broker.broker_en ?? "registered broker"}
                      <span className="absolute right-1.5 top-full border-4 border-transparent border-t-[#0d1117]" aria-hidden />
                    </span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={search}
                disabled={notBroker || lookup.kind === "loading"}
                className="flex shrink-0 items-center gap-1.5 bg-[#001f3f] px-4 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
              >
                {lookup.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>

            {/* Not found / error: a floating tooltip under the input, so the form's gaps never move. */}
            <div className="absolute left-0 top-full z-20 mt-2 empty:hidden" aria-live="polite">
              {lookup.kind === "error" && (
                <div
                  role="alert"
                  className="relative flex max-w-[380px] items-start gap-2 rounded-md border border-[#fecaca] bg-white px-3 py-2 text-xs font-semibold text-[#b91c1c] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]"
                >
                  {/* arrow */}
                  <span className="absolute -top-[5px] left-5 h-2.5 w-2.5 rotate-45 border-l border-t border-[#fecaca] bg-white" aria-hidden />
                  {lookup.notFound ? <XCircle className="mt-px h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-px h-4 w-4 shrink-0" />}
                  <span>
                    {lookup.notFound
                      ? "BRN not found in the Dubai Land Department register. Check the number on your broker card."
                      : lookup.message}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Not everyone is a broker — ticking this clears and locks the BRN. */}
          <label className="ml-1 flex w-fit cursor-pointer select-none items-center gap-2 text-xs font-semibold text-[#374151]">
            <input
              type="checkbox"
              checked={notBroker}
              onChange={(e) => onNotBrokerChange(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[#001f3f]"
            />
            I&apos;m not a broker
          </label>
        </div>

        <div className="space-y-2">
          <span className={LABEL_CLS}>Licence end</span>
          <div className={`${READONLY_CLS} flex items-center justify-between gap-2`}>
            <span>{broker ? formatDate(broker.license_end_date) : "—"}</span>
            {status && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.cls}`}>{status.label}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <span className={LABEL_CLS}>ORN (Office Registration Number)</span>
          <div className={READONLY_CLS}>{broker?.real_estate_number ?? "—"}</div>
        </div>
        <div className="space-y-2">
          <span className={LABEL_CLS}>Brokerage</span>
          <div className={READONLY_CLS}>{broker?.real_estate_en ?? "—"}</div>
        </div>
      </div>
    </div>
  )
}
