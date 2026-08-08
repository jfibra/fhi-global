"use client"

// Agent-to-Agent (A2A) Collaboration Agreement — fill the form, both parties
// sign on screen, download the branded PDF. Nothing is stored: the agreement
// is generated in the browser and handed straight to the user, so no client
// or commercial terms leave the device.

import { useCallback, useMemo, useState } from "react"
import { Download, FileSignature, Loader2, Users } from "lucide-react"
import { type A2AParty, type A2AScope, downloadA2APdf } from "@/lib/a2a-agreement"
import { SignaturePad } from "./signature-pad"

const SCOPES: Array<{ key: A2AScope; title: string; desc: string }> = [
  { key: "inventory", title: "Inventory Sharing", desc: "Sharing available property listings for marketing" },
  { key: "client", title: "Client Sharing", desc: "Introducing prospective buyers/tenants to each other's listings" },
  { key: "both", title: "Both", desc: "Full collaboration on inventory and client sharing" },
]

const emptyParty = (): A2AParty => ({
  fullName: "", agency: "", brn: "", phone: "", email: "",
  signatureDataUrl: undefined, signedName: "", signedDate: "",
})

/** yyyy-mm-dd in local time — toISOString would shift the day in Dubai. */
function todayLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function A2AClient({ defaultParty }: { defaultParty?: Partial<A2AParty> }) {
  const [date, setDate] = useState(todayLocal)
  // Party A pre-fills with the signed-in agent — they're normally the one
  // introducing the listing.
  const [partyA, setPartyA] = useState<A2AParty>(() => ({ ...emptyParty(), ...defaultParty }))
  const [partyB, setPartyB] = useState<A2AParty>(emptyParty)
  const [scope, setScope] = useState<A2AScope | "">("")
  const [propertyRef, setPropertyRef] = useState("")
  const [clientName, setClientName] = useState("")
  const [splitA, setSplitA] = useState("50")
  const [splitB, setSplitB] = useState("50")
  const [noticePeriodDays, setNoticePeriodDays] = useState("30")
  const [validUntil, setValidUntil] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const splitTotal = useMemo(() => {
    const a = Number(splitA)
    const b = Number(splitB)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    return a + b
  }, [splitA, splitB])

  const patchA = (patch: Partial<A2AParty>) => setPartyA((p) => ({ ...p, ...patch }))
  const patchB = (patch: Partial<A2AParty>) => setPartyB((p) => ({ ...p, ...patch }))

  const generate = useCallback(async () => {
    setError(null)
    if (!partyA.fullName.trim() || !partyB.fullName.trim()) {
      setError("Both parties need a full name.")
      return
    }
    if (!scope) {
      setError("Pick the scope of collaboration.")
      return
    }
    setBusy(true)
    try {
      const stamp = date || todayLocal()
      await downloadA2APdf(
        {
          date: stamp,
          partyA: { ...partyA, signedDate: partyA.signedDate || stamp },
          partyB: { ...partyB, signedDate: partyB.signedDate || stamp },
          scope,
          propertyRef,
          clientName,
          splitA,
          splitB,
          noticePeriodDays,
          validUntil,
        },
        `A2A-Agreement-${(partyA.fullName || "party-a").replace(/\s+/g, "-")}-${(partyB.fullName || "party-b").replace(/\s+/g, "-")}.pdf`,
      )
    } catch (err) {
      setError((err as Error).message || "Could not build the PDF.")
    } finally {
      setBusy(false)
    }
  }, [date, partyA, partyB, scope, propertyRef, clientName, splitA, splitB, noticePeriodDays, validUntil])

  const input = "w-full px-3 py-2.5 border border-[#dfe3e8] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
  const label = "block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1.5"

  const partyFields = (p: A2AParty, patch: (v: Partial<A2AParty>) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={label}>Full Name *</label>
        <input value={p.fullName} onChange={(e) => patch({ fullName: e.target.value })} className={input} placeholder="Agent's full name" />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Agency / Brokerage</label>
        <input value={p.agency} onChange={(e) => patch({ agency: e.target.value })} className={input} />
      </div>
      <div>
        <label className={label}>BRN / ORN No.</label>
        <input value={p.brn} onChange={(e) => patch({ brn: e.target.value })} className={input} />
      </div>
      <div>
        <label className={label}>Phone</label>
        <input value={p.phone} onChange={(e) => patch({ phone: e.target.value })} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Email</label>
        <input type="email" value={p.email} onChange={(e) => patch({ email: e.target.value })} className={input} />
      </div>
    </div>
  )

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

      {/* Date */}
      <section className="bg-white border border-[#e8eaed] p-6">
        <div className="max-w-xs">
          <label className={label}>Agreement Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
      </section>

      {/* Parties */}
      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-[#d6b357]" /> Party A — Introducing / Listing Agent
        </h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        {partyFields(partyA, patchA)}
      </section>

      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-[#d6b357]" /> Party B — Collaborating Agent
        </h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        {partyFields(partyB, patchB)}
      </section>

      {/* Scope */}
      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Scope of Collaboration</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCOPES.map((s) => {
            const active = scope === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className={`text-left p-4 border transition-colors ${
                  active ? "border-[#001f3f] bg-[#f7f9fc]" : "border-[#dfe3e8] hover:border-[#001f3f]"
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
      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Property / Client Reference</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Property / Listing Ref.</label>
            <input value={propertyRef} onChange={(e) => setPropertyRef(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Client Name (if applicable)</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={input} />
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Commission Split Agreement</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <p className="text-sm text-[#6b7280] leading-relaxed mb-4">
          Upon successful closing of a sale or lease resulting from this collaboration, commission
          earned shall be split between the parties as follows:
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-32">
            <label className={label}>Party A Share %</label>
            <input type="number" min={0} max={100} value={splitA} onChange={(e) => setSplitA(e.target.value)} className={input} />
          </div>
          <div className="w-32">
            <label className={label}>Party B Share %</label>
            <input type="number" min={0} max={100} value={splitB} onChange={(e) => setSplitB(e.target.value)} className={input} />
          </div>
          {splitTotal !== null && splitTotal !== 100 && (
            <p className="text-xs font-semibold text-amber-600 pb-3">
              Shares total {splitTotal}% — usually these add up to 100%.
            </p>
          )}
        </div>
      </section>

      {/* Duration */}
      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Duration &amp; Termination</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className={label}>Notice Period (days)</label>
            <input type="number" min={0} value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Valid Until</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={input} />
          </div>
        </div>
        <p className="text-xs text-[#9ca3af] leading-relaxed mt-4">
          Confidentiality, non-circumvention and governing-law clauses are included in the PDF as
          standard wording.
        </p>
      </section>

      {/* Signatures */}
      <section className="bg-white border border-[#e8eaed] p-6">
        <h2 className="font-['Outfit'] text-base font-bold text-[#001f3f] mb-1">Signatures</h2>
        <span className="block w-full h-px bg-[#d6b357] mb-5" aria-hidden="true" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <SignaturePad label="Party A signature" onChange={(v) => patchA({ signatureDataUrl: v ?? undefined })} />
            <div>
              <label className={label}>Printed name</label>
              <input value={partyA.signedName} onChange={(e) => patchA({ signedName: e.target.value })} placeholder={partyA.fullName || "Party A name"} className={input} />
            </div>
          </div>
          <div className="space-y-3">
            <SignaturePad label="Party B signature" onChange={(v) => patchB({ signatureDataUrl: v ?? undefined })} />
            <div>
              <label className={label}>Printed name</label>
              <input value={partyB.signedName} onChange={(e) => patchB({ signedName: e.target.value })} placeholder={partyB.fullName || "Party B name"} className={input} />
            </div>
          </div>
        </div>
        <p className="text-xs text-[#9ca3af] leading-relaxed mt-4">
          Both parties can sign here on a phone or tablet with a finger. Leave a pad blank to print
          the agreement and sign it by hand instead.
        </p>
      </section>

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
