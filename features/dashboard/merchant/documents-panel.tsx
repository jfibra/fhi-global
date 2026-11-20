"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Download, FileText, Loader2, PenLine, Upload, X } from "lucide-react"
import { SignaturePad } from "@/features/dashboard/a2a-agreement/signature-pad"
import { MERCHANT_DOCUMENT_KINDS, MERCHANT_PAY_DAY, type MerchantDocumentKind } from "@/lib/merchant/rules"
import type { MerchantMePayload } from "@/lib/merchant/types"
import { DownloadLink, btnGhost, btnPrimary, fmtDate, inputCls, labelCls } from "./shared"

/**
 * The four official requirements as cards — upload, replace, the bank
 * details form, and signing the agreement on screen. Used by the merchant's
 * Documents page (its own record) and by the agent and admin screens with
 * `merchantId` (upload on the merchant's behalf; only the merchant signs).
 */
export function DocumentsPanel({
  data,
  merchantId,
  who,
  onChanged,
}: {
  data: MerchantMePayload
  /** Someone else's merchant (agent or admin); null for the merchant's own. */
  merchantId: string | null
  who: "merchant" | "agent" | "admin"
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<MerchantDocumentKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const inputs = useRef<Partial<Record<MerchantDocumentKind, HTMLInputElement | null>>>({})
  const qs = merchantId ? `?merchant=${encodeURIComponent(merchantId)}` : ""

  const upload = async (kind: MerchantDocumentKind, file: File) => {
    setBusy(kind)
    setError(null)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("kind", kind)
      if (merchantId) form.set("merchant", merchantId)
      const res = await fetch("/api/merchant/documents", { method: "POST", body: form })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status}).`)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the file.")
    } finally {
      setBusy(null)
    }
  }

  const canUpload = data.merchant.status === "onboarding" || data.merchant.status === "submitted" || who === "admin"

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {MERCHANT_DOCUMENT_KINDS.map(({ kind, label, hint }) => {
          const item = data.checklist[kind]
          const doc = item.document
          const state = item.verified ? "verified" : item.present ? "awaiting" : "missing"
          return (
            <section key={kind} className="flex flex-col gap-3 rounded-2xl border border-[#e8eaed] bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#faf7ee] text-[#b8913f]">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{label}</h3>
                  <p className="text-[13px] text-[#6b7280]">{kind === "bank" ? `Where AED 100 per rented unit is paid on the ${MERCHANT_PAY_DAY}th of each month. Stored encrypted.` : hint}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    state === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : state === "awaiting" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {state === "verified" ? "Verified" : state === "awaiting" ? (kind === "bank" && !doc ? "Saved" : "Awaiting check") : "Missing"}
                </span>
              </div>

              {doc && (
                <div className="flex items-center gap-3 rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[#374151]" />
                  <div className="min-w-0 flex-1">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] font-semibold text-[#001f3f] hover:underline">
                      {doc.file_name}
                    </a>
                    <p className="text-[12px] text-[#6b7280]">
                      Uploaded {fmtDate(doc.created_at)}
                      {doc.uploaded_by_name ? ` by ${doc.uploaded_by_name}` : ""}
                      {doc.note ? ` · ${doc.note}` : ""}
                      {doc.verified_at ? ` · checked by FHI ${fmtDate(doc.verified_at)}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {kind === "bank" && <BankDetails data={data} qs={qs} onChanged={onChanged} disabled={!canUpload} />}

              {canUpload && (
                <div className="flex flex-wrap gap-2">
                  {kind === "agreement" && who === "merchant" && (
                    <button type="button" onClick={() => setSigning(true)} className={btnPrimary}>
                      <PenLine className="h-4 w-4" /> Sign on screen
                    </button>
                  )}
                  <button type="button" onClick={() => inputs.current[kind]?.click()} disabled={busy === kind} className={kind === "agreement" && who === "merchant" ? btnGhost : btnPrimary}>
                    {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {doc ? "Replace" : kind === "agreement" ? "Upload signed PDF" : kind === "bank" ? "Upload a bank letter instead" : "Upload"}
                  </button>
                  {kind === "agreement" && (
                    <DownloadLink href={`/api/merchant/agreement${qs}`}>
                      <Download className="h-4 w-4" /> Download the form
                    </DownloadLink>
                  )}
                  <input
                    ref={(el) => {
                      inputs.current[kind] = el
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ""
                      if (f) void upload(kind, f)
                    }}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>

      {signing && (
        <SignDialog
          data={data}
          onClose={() => setSigning(false)}
          onSigned={() => {
            setSigning(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function BankDetails({ data, qs, onChanged, disabled }: { data: MerchantMePayload; qs: string; onChanged: () => void; disabled: boolean }) {
  const m = data.merchant
  const [account, setAccount] = useState(m.bank_account_name ?? "")
  const [bank, setBank] = useState(m.bank_name ?? "")
  const [iban, setIban] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, unknown> = { bank_account_name: account, bank_name: bank }
      if (iban.trim()) body.iban = iban
      const res = await fetch(`/api/merchant/me${qs}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status}).`)
      setIban("")
      setMsg("Saved.")
      onChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelCls} htmlFor="bank-account">Account name</label>
        <input id="bank-account" className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)} placeholder={`${m.business_name} LLC`} disabled={disabled} />
      </div>
      <div>
        <label className={labelCls} htmlFor="bank-name">Bank</label>
        <input id="bank-name" className={inputCls} value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Emirates NBD" disabled={disabled} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="bank-iban">IBAN{m.iban_masked ? <span className="ml-2 font-normal text-[#6b7280]">saved: {m.iban_masked} · type a new one to replace it</span> : null}</label>
        <input id="bank-iban" className={`${inputCls} font-mono`} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="AE07 0260 0010 1234 5678 901" autoComplete="off" disabled={disabled} />
      </div>
      {!disabled && (
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="button" onClick={() => void save()} disabled={saving} className={btnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save bank details
          </button>
          {msg && <span className="text-[13px] text-[#6b7280]">{msg}</span>}
        </div>
      )}
    </div>
  )
}

function SignDialog({ data, onClose, onSigned }: { data: MerchantMePayload; onClose: () => void; onSigned: () => void }) {
  const [signature, setSignature] = useState<string | null>(null)
  const [name, setName] = useState(data.merchant.signatory_name ?? data.account.name ?? "")
  const [title, setTitle] = useState(data.merchant.signatory_title ?? "")
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!signature) return setError("Draw your signature first.")
    if (!agree) return setError("Tick the box to confirm you have read the agreement.")
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/merchant/agreement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureDataUrl: signature, signedName: name, signedTitle: title }) })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Signing failed (${res.status}).`)
      onSigned()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't sign.")
      setBusy(false)
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Sign the Merchant Partnership Agreement" className="fixed inset-0 z-[80] flex items-end justify-center bg-[#001428]/60 p-0 sm:items-center sm:p-6">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">Sign the agreement</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              The Merchant Partnership Agreement, pre-filled with your business details.{" "}
              <DownloadLink href="/api/merchant/agreement" className="font-semibold text-[#001f3f] hover:underline">Read it first (PDF)</DownloadLink>.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="sign-name">Your name</label>
            <input id="sign-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sign-title">Your title</label>
            <input id="sign-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Owner, General Manager…" />
          </div>
        </div>
        <div className="mt-4">
          <SignaturePad label="Signature" onChange={setSignature} />
        </div>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-[#374151]">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#001f3f]" />
          <span>I have read the Merchant Partnership Agreement and I am authorised to sign it for {data.merchant.business_name}.</span>
        </label>
        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Sign and file it
          </button>
        </div>
      </div>
    </div>
  )
}
