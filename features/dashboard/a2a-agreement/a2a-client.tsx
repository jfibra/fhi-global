"use client"

// Agent-to-Agent (A2A) Collaboration Agreement — fill the form, both parties
// sign on screen, download the branded PDF. Nothing is stored: the agreement
// is generated in the browser and handed straight to the user, so no client
// or commercial terms leave the device. The form itself lives in ./a2a-form,
// which Record Your Sale also embeds for a shared sale.

import { useCallback, useRef, useState } from "react"
import { Download, FileSignature, Loader2 } from "lucide-react"
import { type A2AInput, type A2AParty, downloadA2APdf } from "@/lib/a2a-agreement"
import { A2AFormFields, todayLocal, type A2ARequiredField } from "./a2a-form"

const emptyParty = (): A2AParty => ({
  fullName: "", agency: "", brn: "", phone: "", email: "",
  signatureDataUrl: undefined, signedName: "", signedDate: "",
})

const emptyAgreement = (): A2AInput => ({
  date: todayLocal(),
  partyA: emptyParty(),
  partyB: emptyParty(),
  scope: "",
  propertyRef: "",
  clientName: "",
  splitA: "50",
  splitB: "50",
  noticePeriodDays: "30",
  validUntil: "",
})

export function A2AClient() {
  const [value, setValue] = useState<A2AInput>(emptyAgreement)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Set<A2ARequiredField>>(() => new Set())

  // Scroll targets for the required fields, so a failed download jumps the user
  // straight to the first thing that needs filling in.
  const partyANameRef = useRef<HTMLInputElement>(null)
  const partyBNameRef = useRef<HTMLInputElement>(null)
  const scopeRef = useRef<HTMLDivElement>(null)

  const clearFieldError = (key: A2ARequiredField) => {
    setFieldErrors((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setError(null)
  }

  const generate = useCallback(async () => {
    const { partyA, partyB, scope, date } = value
    const invalid = new Set<A2ARequiredField>()
    if (!partyA.fullName.trim()) invalid.add("partyA.fullName")
    if (!partyB.fullName.trim()) invalid.add("partyB.fullName")
    if (!scope) invalid.add("scope")

    if (invalid.size > 0) {
      setFieldErrors(invalid)
      const needs: string[] = []
      if (invalid.has("partyA.fullName") || invalid.has("partyB.fullName")) needs.push("a full name for both parties")
      if (invalid.has("scope")) needs.push("a scope of collaboration")
      setError(`Please add ${needs.join(" and ")} before downloading.`)

      // Jump to the first missing field (top-to-bottom) and focus it.
      const first = invalid.has("partyA.fullName")
        ? partyANameRef.current
        : invalid.has("partyB.fullName")
          ? partyBNameRef.current
          : scopeRef.current
      if (first) {
        first.scrollIntoView({ behavior: "smooth", block: "center" })
        const focusTarget =
          first instanceof HTMLInputElement ? first : first.querySelector<HTMLElement>("button")
        focusTarget?.focus({ preventScroll: true })
      }
      return
    }

    setError(null)
    setFieldErrors(new Set())
    setBusy(true)
    try {
      const stamp = date || todayLocal()
      await downloadA2APdf(
        {
          ...value,
          date: stamp,
          partyA: { ...partyA, signedDate: partyA.signedDate || stamp },
          partyB: { ...partyB, signedDate: partyB.signedDate || stamp },
        },
        `A2A-Agreement-${(partyA.fullName || "party-a").replace(/\s+/g, "-")}-${(partyB.fullName || "party-b").replace(/\s+/g, "-")}.pdf`,
      )
    } catch (err) {
      setError((err as Error).message || "Could not build the PDF.")
    } finally {
      setBusy(false)
    }
  }, [value])

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="bg-[#001f3f] p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357] mb-2">
          Agent Resource
        </p>
        <h1 className="font-['Outfit'] text-2xl font-bold text-white tracking-tight">
          Agent-to-Agent (A2A) Collaboration Agreement
        </h1>
        <p className="text-white/65 text-sm leading-relaxed mt-2 max-w-2xl">
          Fill in both parties, agree the split, sign on screen, and download the signed PDF.
          Nothing is saved — the agreement is built on your device and downloaded straight to you.
        </p>
      </div>

      {error && (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      )}

      <A2AFormFields
        value={value}
        onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
        onPartyChange={(which, patch) =>
          setValue((v) =>
            which === "A" ? { ...v, partyA: { ...v.partyA, ...patch } } : { ...v, partyB: { ...v.partyB, ...patch } },
          )
        }
        fieldErrors={fieldErrors}
        onClearFieldError={clearFieldError}
        refs={{ partyAName: partyANameRef, partyBName: partyBNameRef, scope: scopeRef }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#0a3d6b] disabled:opacity-60 transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {busy ? "Building PDF…" : "Download Agreement PDF"}
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-[#9ca3af]">
          <FileSignature className="w-3.5 h-3.5" /> Two pages, FHI letterhead, ready to print or email.
        </span>
      </div>
    </div>
  )
}
