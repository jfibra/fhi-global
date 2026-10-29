"use client"

// The A2A Collaboration Agreement form itself — every section of the printed
// agreement, as fields. Shared by the A2A Agreement page (./a2a-client) and
// Record Your Sale, which embeds it for a shared sale so agents fill the same
// form they already know without leaving the sale. Controlled: the caller
// owns the A2AInput and decides what to do with it (save / download / attach).

import { type ReactNode, type RefObject, useState } from "react"
import Image from "next/image"
import { CheckCircle2, PenLine, RotateCcw, UserPlus, Users, X } from "lucide-react"
import type { A2AInput, A2AParty, A2AScope } from "@/lib/a2a-agreement"
import { A2A_TEXT_LIMITS as L, type A2APartyKey, type A2ARequiredField } from "@/lib/a2a-agreements/shared"
import { SignaturePad } from "./signature-pad"

export type { A2APartyKey, A2ARequiredField }

export const A2A_SCOPES: Array<{ key: A2AScope; title: string; desc: string }> = [
  { key: "inventory", title: "Inventory Sharing", desc: "Sharing available property listings for marketing" },
  { key: "client", title: "Client Sharing", desc: "Introducing prospective buyers/tenants to each other's listings" },
  { key: "both", title: "Both", desc: "Full collaboration on inventory and client sharing" },
]

/** yyyy-mm-dd in local time — toISOString would shift the day in Dubai. */
export function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The draw-to-sign pad, or — when the form is re-opened with a signature
 * already captured — a preview of it. The pad reports after every stroke, so
 * it stays mounted while someone is signing; only a remount shows the preview.
 * Read-only (a completed agreement) never shows a pad: the saved signature, or
 * a note that it wasn't signed on screen.
 */
function SignatureField({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string
  value?: string
  onChange: (dataUrl: string | undefined) => void
  readOnly?: boolean
}) {
  const [signing, setSigning] = useState(!value)
  if (readOnly && !value) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</p>
        <div className="flex items-center gap-2 border border-dashed border-[#dfe3e8] bg-[#f8fafc] p-3 text-xs text-[#6b7280]">
          <PenLine className="h-3.5 w-3.5" /> Not signed on screen
        </div>
      </div>
    )
  }
  if ((readOnly || !signing) && value) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#374151]">{label}</p>
        <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/60 p-3">
          <Image src={value} alt="" width={160} height={48} unoptimized className="h-12 w-auto bg-white" />
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Signed
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setSigning(true)
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Sign again
            </button>
          )}
        </div>
      </div>
    )
  }
  return <SignaturePad label={label} onChange={(v) => onChange(v ?? undefined)} />
}

export function A2AFormFields({
  value,
  onChange,
  onPartyChange,
  fieldErrors,
  onClearFieldError,
  refs,
  onAddPartyC,
  onRemovePartyC,
  partyCLocked = false,
  lockNamesAndSplits = false,
  lockedNote,
  partyNameSuffix,
  referencePlaceholders,
  signatureNote = "Both parties can sign here on a phone or tablet with a finger. Leave a pad blank to print the agreement and sign it by hand instead.",
  readOnly = false,
  partyExtras,
  signatureExtras,
}: {
  value: A2AInput
  onChange: (patch: Partial<A2AInput>) => void
  onPartyChange: (party: A2APartyKey, patch: Partial<A2AParty>) => void
  /** A2A page: lets the user add / drop a third agent (Party C). */
  onAddPartyC?: () => void
  onRemovePartyC?: () => void
  /** Greys out Add / Remove Party C (e.g. while documents upload). */
  partyCLocked?: boolean
  fieldErrors?: ReadonlySet<A2ARequiredField>
  onClearFieldError?: (key: A2ARequiredField) => void
  /** Scroll targets, so a failed submit can jump to the first missing field. */
  refs?: {
    partyAName?: RefObject<HTMLInputElement | null>
    partyBName?: RefObject<HTMLInputElement | null>
    partyCName?: RefObject<HTMLInputElement | null>
    scope?: RefObject<HTMLDivElement | null>
  }
  /** Record Your Sale: the names and shares come from the sale's partner table, the ORN is FHI's. */
  lockNamesAndSplits?: boolean
  lockedNote?: string
  /** e.g. { A: " (you)" } — shown after the party heading. */
  partyNameSuffix?: { A?: string; B?: string; C?: string }
  /** Hints for the reference boxes (Record Your Sale fills them from the sale when left blank). */
  referencePlaceholders?: { propertyRef?: string; clientName?: string }
  signatureNote?: string
  /** A2A page: a completed agreement, or someone else's — every field shown, none editable. */
  readOnly?: boolean
  /** A2A page: rendered at the end of each party's section (its agency documents). */
  partyExtras?: (party: A2APartyKey) => ReactNode
  /** A2A page: rendered under the signatures (the signed-on-paper copy). */
  signatureExtras?: ReactNode
}) {
  const { partyA, partyB, partyC, scope } = value
  const clear = (key: A2ARequiredField) => onClearFieldError?.(key)

  const a = Number(value.splitA)
  const b = Number(value.splitB)
  const c = partyC ? Number(value.splitC ?? 0) : 0
  const splitTotal = Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) ? a + b + c : null

  const inputBase = "w-full px-3 py-2.5 border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none"
  const inputCls = (invalid?: boolean) =>
    `${inputBase} ${invalid ? "border-rose-400 focus:border-rose-500" : "border-[#dfe3e8] focus:border-[#001f3f]"}`
  const lockedInput = `${inputBase} border-[#dfe3e8] bg-[#f8fafc] text-[#374151] cursor-not-allowed`
  /** The class for a box: locked when the whole form is read-only or this field is fixed. */
  const boxCls = (locked: boolean, invalid?: boolean) => (readOnly || locked ? lockedInput : inputCls(invalid))
  const label = "block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5"
  const lockSplits = readOnly || lockNamesAndSplits

  const partyFields = (
    p: A2AParty,
    which: A2APartyKey,
    name: { ref?: RefObject<HTMLInputElement | null>; invalid: boolean; key: A2ARequiredField },
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={label}>Full Name *</label>
        <input
          ref={name.ref}
          value={p.fullName}
          maxLength={L.name}
          readOnly={readOnly || lockNamesAndSplits}
          onChange={(e) => {
            onPartyChange(which, { fullName: e.target.value })
            clear(name.key)
          }}
          className={boxCls(lockNamesAndSplits, name.invalid)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Agency / Brokerage</label>
        <input value={p.agency} maxLength={L.agency} readOnly={readOnly} onChange={(e) => onPartyChange(which, { agency: e.target.value })} className={boxCls(false)} />
      </div>
      <div>
        <label className={label}>BRN No.</label>
        <input value={p.brn} maxLength={L.licence} readOnly={readOnly} onChange={(e) => onPartyChange(which, { brn: e.target.value })} className={boxCls(false)} />
      </div>
      <div>
        <label className={label}>ORN No.</label>
        <input
          value={p.orn}
          maxLength={L.licence}
          readOnly={readOnly || lockNamesAndSplits}
          onChange={(e) => onPartyChange(which, { orn: e.target.value })}
          className={boxCls(lockNamesAndSplits)}
        />
      </div>
      <div>
        <label className={label}>Phone</label>
        <input type="tel" inputMode="tel" autoComplete="off" value={p.phone} maxLength={L.phone} readOnly={readOnly} onChange={(e) => onPartyChange(which, { phone: e.target.value })} className={boxCls(false)} />
      </div>
      <div>
        <label className={label}>Email</label>
        <input type="email" value={p.email} maxLength={L.email} readOnly={readOnly} onChange={(e) => onPartyChange(which, { email: e.target.value })} className={boxCls(false)} />
      </div>
    </div>
  )

  return (
    <>
      {lockNamesAndSplits && lockedNote && (
        <p className="border border-[#d6b357]/40 bg-[#d6b357]/10 px-4 py-3 text-xs leading-relaxed text-[#6b5320]">{lockedNote}</p>
      )}

      {/* Date + how many agents sign */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-xs">
            <label className={label}>Agreement Date</label>
            <input type="date" value={value.date} readOnly={readOnly} onChange={(e) => onChange({ date: e.target.value })} className={boxCls(false)} />
          </div>
          {!lockNamesAndSplits && !readOnly && (onAddPartyC || onRemovePartyC) && (
            <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
              <span className={label}>Agents on this agreement: {partyC ? "three" : "two"}</span>
              {partyC ? (
                onRemovePartyC && (
                  <button
                    type="button"
                    onClick={onRemovePartyC}
                    disabled={partyCLocked}
                    className="inline-flex items-center justify-center gap-2 border border-[#dfe3e8] bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 disabled:hover:border-[#dfe3e8] disabled:hover:text-[#374151]"
                  >
                    <X className="w-4 h-4" /> Remove Party C
                  </button>
                )
              ) : (
                onAddPartyC && (
                  <button
                    type="button"
                    onClick={onAddPartyC}
                    disabled={partyCLocked}
                    className="inline-flex items-center justify-center gap-2 bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0a3d6b] disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4 text-[#d6b357]" /> Add a third agent (Party C)
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* Parties */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-[#d6b357]" /> Party A — Introducing / Listing Agent{partyNameSuffix?.A}
        </h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        {partyFields(partyA, "A", {
          ref: refs?.partyAName,
          invalid: Boolean(fieldErrors?.has("partyA.fullName")),
          key: "partyA.fullName",
        })}
        {partyExtras?.("A")}
      </section>

      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-[#d6b357]" /> Party B — Collaborating Agent{partyNameSuffix?.B}
        </h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        {partyFields(partyB, "B", {
          ref: refs?.partyBName,
          invalid: Boolean(fieldErrors?.has("partyB.fullName")),
          key: "partyB.fullName",
        })}
        {partyExtras?.("B")}
      </section>

      {/* Party C — a third agent on the deal. Optional on the A2A page; fixed by the sale in Record Your Sale. */}
      {partyC ? (
        <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#d6b357]" /> Party C — Collaborating Agent{partyNameSuffix?.C}
            </h2>
            {!lockNamesAndSplits && !readOnly && onRemovePartyC && (
              <button
                type="button"
                onClick={onRemovePartyC}
                disabled={partyCLocked}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280] hover:text-rose-600 disabled:opacity-50 disabled:hover:text-[#6b7280]"
              >
                <X className="w-3.5 h-3.5" /> Remove Party C
              </button>
            )}
          </div>
          <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
          {partyFields(partyC, "C", {
            ref: refs?.partyCName,
            invalid: Boolean(fieldErrors?.has("partyC.fullName")),
            key: "partyC.fullName",
          })}
          {partyExtras?.("C")}
        </section>
      ) : null}

      {/* Scope */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Scope of Collaboration</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div ref={refs?.scope} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {A2A_SCOPES.map((s) => {
            const active = scope === s.key
            return (
              <button
                key={s.key}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  onChange({ scope: s.key })
                  clear("scope")
                }}
                className={`text-left p-4 border transition-colors disabled:cursor-default ${
                  active
                    ? "border-[#001f3f] bg-[#f7f9fc]"
                    : fieldErrors?.has("scope")
                      ? "border-rose-400 hover:border-rose-500"
                      : readOnly
                        ? "border-[#dfe3e8] opacity-60"
                        : "border-[#dfe3e8] hover:border-[#001f3f]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className={`w-4 h-4 border shrink-0 flex items-center justify-center ${
                    active ? "bg-[#001f3f] border-[#001f3f]" : "border-[#c4c9cf]"
                  }`}>
                    {active && <span className="w-1.5 h-1.5 bg-white" />}
                  </span>
                  <span className="text-sm font-bold text-[#0d1117]">{s.title}</span>
                </span>
                <span className="block text-xs text-[#6b7280] leading-relaxed mt-2">{s.desc}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Reference + split */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Property / Client Reference</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Property / Listing Ref.</label>
            <input
              value={value.propertyRef}
              maxLength={L.reference}
              readOnly={readOnly}
              onChange={(e) => onChange({ propertyRef: e.target.value })}
              placeholder={referencePlaceholders?.propertyRef}
              className={boxCls(false)}
            />
          </div>
          <div>
            <label className={label}>Client Name (if applicable)</label>
            <input
              value={value.clientName}
              maxLength={L.name}
              readOnly={readOnly}
              onChange={(e) => onChange({ clientName: e.target.value })}
              placeholder={referencePlaceholders?.clientName}
              className={boxCls(false)}
            />
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Commission Split Agreement</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <p className="text-sm text-[#6b7280] leading-relaxed mb-4">
          Upon successful closing of a sale or lease resulting from this collaboration, commission
          earned shall be split between the parties as follows:
        </p>
        {/* Side by side on a phone too (two or three equal columns), fixed widths from sm up. */}
        <div className={`grid items-end gap-3 sm:flex sm:flex-wrap sm:gap-4 ${partyC ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="min-w-0 sm:w-32">
            <label className={label}>Party A Share %</label>
            <input type="number" inputMode="decimal" min={0} max={100} value={value.splitA} readOnly={lockSplits} onChange={(e) => onChange({ splitA: e.target.value })} className={boxCls(lockNamesAndSplits)} />
          </div>
          <div className="min-w-0 sm:w-32">
            <label className={label}>Party B Share %</label>
            <input type="number" inputMode="decimal" min={0} max={100} value={value.splitB} readOnly={lockSplits} onChange={(e) => onChange({ splitB: e.target.value })} className={boxCls(lockNamesAndSplits)} />
          </div>
          {partyC && (
            <div className="min-w-0 sm:w-32">
              <label className={label}>Party C Share %</label>
              <input type="number" inputMode="decimal" min={0} max={100} value={value.splitC ?? ""} readOnly={lockSplits} onChange={(e) => onChange({ splitC: e.target.value })} className={boxCls(lockNamesAndSplits)} />
            </div>
          )}
          {!lockSplits && splitTotal !== null && splitTotal !== 100 && (
            <p className="col-span-full text-xs font-semibold text-amber-600 sm:pb-3">
              Shares total {splitTotal}% — usually these add up to 100%.
            </p>
          )}
        </div>
      </section>

      {/* Duration */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Duration &amp; Termination</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className={label}>Notice Period (days)</label>
            <input type="number" inputMode="numeric" min={0} value={value.noticePeriodDays} readOnly={readOnly} onChange={(e) => onChange({ noticePeriodDays: e.target.value })} className={boxCls(false)} />
          </div>
          <div>
            <label className={label}>Valid Until</label>
            <input type="date" value={value.validUntil} readOnly={readOnly} onChange={(e) => onChange({ validUntil: e.target.value })} className={boxCls(false)} />
          </div>
        </div>
        <p className="text-xs text-[#9ca3af] leading-relaxed mt-4">
          Confidentiality, non-circumvention and governing-law clauses are included in the PDF as
          standard wording.
        </p>
      </section>

      {/* Signatures */}
      <section className="bg-white border border-[#e8eaed] p-4 sm:p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Signatures</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className={`grid grid-cols-1 gap-6 ${partyC ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          <div className="space-y-3">
            <SignatureField
              label={`Party A signature${partyNameSuffix?.A ?? ""}`}
              value={partyA.signatureDataUrl}
              onChange={(v) => onPartyChange("A", { signatureDataUrl: v })}
              readOnly={readOnly}
            />
            <div>
              <label className={label}>Printed name</label>
              <input value={partyA.signedName} maxLength={L.name} readOnly={readOnly} onChange={(e) => onPartyChange("A", { signedName: e.target.value })} placeholder={partyA.fullName || "Party A name"} className={boxCls(false)} />
            </div>
          </div>
          <div className="space-y-3">
            <SignatureField
              label={`Party B signature${partyNameSuffix?.B ?? ""}`}
              value={partyB.signatureDataUrl}
              onChange={(v) => onPartyChange("B", { signatureDataUrl: v })}
              readOnly={readOnly}
            />
            <div>
              <label className={label}>Printed name</label>
              <input value={partyB.signedName} maxLength={L.name} readOnly={readOnly} onChange={(e) => onPartyChange("B", { signedName: e.target.value })} placeholder={partyB.fullName || "Party B name"} className={boxCls(false)} />
            </div>
          </div>
          {partyC && (
            <div className="space-y-3">
              <SignatureField
                label={`Party C signature${partyNameSuffix?.C ?? ""}`}
                value={partyC.signatureDataUrl}
                onChange={(v) => onPartyChange("C", { signatureDataUrl: v })}
                readOnly={readOnly}
              />
              <div>
                <label className={label}>Printed name</label>
                <input value={partyC.signedName} maxLength={L.name} readOnly={readOnly} onChange={(e) => onPartyChange("C", { signedName: e.target.value })} placeholder={partyC.fullName || "Party C name"} className={boxCls(false)} />
              </div>
            </div>
          )}
        </div>
        {!readOnly && <p className="text-xs text-[#9ca3af] leading-relaxed mt-4">{signatureNote}</p>}
        {signatureExtras}
      </section>
    </>
  )
}
