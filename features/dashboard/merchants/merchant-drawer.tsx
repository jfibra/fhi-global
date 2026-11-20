"use client"

import { useCallback, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { CheckCircle2, Eye, EyeOff, Loader2, X, XCircle } from "lucide-react"
import type { AdminMerchantDetail } from "@/app/api/admin/merchants/[id]/route"
import { MERCHANT_DOCUMENT_KINDS, MERCHANT_INCENTIVE_AED, AGENT_INCENTIVE_AED, fmtAed, type MerchantDocumentKind } from "@/lib/merchant/rules"
import type { MerchantMePayload } from "@/lib/merchant/types"
import { BusinessForm } from "@/features/dashboard/merchant/business-page"
import { DocumentsPanel } from "@/features/dashboard/merchant/documents-panel"
import { Card, ErrorNote, Loading, StatusPill, ValidationPill, btnGhost, btnGold, fmtDate, inputCls, labelCls } from "@/features/dashboard/merchant/shared"

/**
 * One merchant in a slide-over: for the signing agent (Invite › Merchants)
 * the record, the figures and the documents with upload-on-behalf; for admin
 * staff (Accounts & Invites › Merchants) the same plus the review: tick each
 * document, reveal the IBAN, accept with a note, decline with a reason.
 */
export function MerchantDrawer({ merchantId, mode, onClose, onChanged }: { merchantId: string; mode: "agent" | "admin"; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<(MerchantMePayload & { iban?: string | null }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"review" | "documents" | "business">("review")

  const load = useCallback(
    (reveal = false) => {
      const url = mode === "admin" ? `/api/admin/merchants/${merchantId}${reveal ? "?reveal=1" : ""}` : `/api/merchant/me?merchant=${encodeURIComponent(merchantId)}`
      return fetch(url, { cache: "no-store" })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as AdminMerchantDetail & { error?: string }
          if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
          return json
        })
        .then((json) => {
          setData(json)
          setError(null)
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the merchant."))
    },
    [merchantId, mode],
  )
  useEffect(() => {
    void load()
  }, [load])

  const changed = () => {
    void load()
    onChanged()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[#001428]/50" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Merchant" className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[#f4f6f9] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-[#e8eaed] bg-white px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">{mode === "admin" ? "Review" : "My merchant"}</p>
            <h2 className="truncate font-['Outfit'] text-xl font-bold text-[#0d1117]">{data?.merchant.business_name ?? "Merchant"}</h2>
            {data && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#6b7280]">
                <StatusPill status={data.merchant.status} />
                {data.merchant.category && <span>{data.merchant.category}</span>}
                {data.merchant.code && <span className="font-mono text-[#001f3f]">{data.merchant.code}</span>}
                {data.agent?.name && <span>· signed by {data.agent.name}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-lg border border-[#e8eaed] p-1.5 text-[#374151] hover:bg-[#f3f4f6]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1 border-b border-[#e8eaed] bg-white px-6">
          {(["review", "documents", "business"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-bold ${tab === t ? "border-[#001f3f] text-[#001f3f]" : "border-transparent text-[#6b7280] hover:text-[#374151]"}`}>
              {t === "review" ? (mode === "admin" ? "Review" : "Overview") : t === "documents" ? "Documents" : "Business"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {error && <ErrorNote text={error} />}
          {!data && !error && <Loading />}
          {data && tab === "review" && <ReviewTab data={data} mode={mode} merchantId={merchantId} onChanged={changed} onReveal={() => void load(true)} />}
          {data && tab === "documents" && <DocumentsPanel data={data} merchantId={merchantId} who={mode} onChanged={changed} />}
          {data && tab === "business" && <BusinessForm key={data.merchant.updated_at} merchant={data.merchant} merchantId={merchantId} onSaved={changed} />}
        </div>
      </aside>
    </div>
  )
}

function ReviewTab({ data, mode, merchantId, onChanged, onReveal }: { data: MerchantMePayload & { iban?: string | null }; mode: "agent" | "admin"; merchantId: string; onChanged: () => void; onReveal: () => void }) {
  const m = data.merchant
  const f = data.figures
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  const [declining, setDeclining] = useState(false)
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const complete = MERCHANT_DOCUMENT_KINDS.every(({ kind }) => data.checklist[kind].present)

  const post = async (path: string, body: unknown, label: string) => {
    setBusy(label)
    setMsg(null)
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string; emailed?: string[] }
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`)
      setMsg({ ok: true, text: json.code ? `Accepted as ${json.code}. Emailed: ${(json.emailed ?? []).join(", ") || "nobody (no email on file)"}.` : "Done." })
      setDeclining(false)
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." })
    } finally {
      setBusy(null)
    }
  }

  const verify = async (kind: MerchantDocumentKind, verified: boolean) => {
    const doc = data.checklist[kind].document
    if (!doc) return
    setBusy(kind)
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}/documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verified }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the tick.")
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save the tick." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Scans this month" value={f.scans.month} />
        <Mini label="Validated deals" value={`${f.month.validated} / ${f.all_time.validated}`} hint="this month / all time" />
        <Mini label={mode === "admin" ? "Merchant incentive" : "Your incentive"} value={fmtAed(mode === "admin" ? f.month.merchant_incentive : f.month.agent_incentive)} hint={`this month · AED ${mode === "admin" ? MERCHANT_INCENTIVE_AED : AGENT_INCENTIVE_AED} per deal`} />
        <Mini label="Agreement" value={m.agreement_ends_on ? fmtDate(m.agreement_ends_on) : "—"} hint={m.agreement_starts_on ? `from ${fmtDate(m.agreement_starts_on)}` : "dated on acceptance"} />
      </div>

      <Card title="The business">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 text-[13px] sm:grid-cols-2">
          {[
            ["Authorised signatory", [m.signatory_name, m.signatory_title].filter(Boolean).join(" · ")],
            ["Contact", [data.account.email, data.account.whatsapp].filter(Boolean).join(" · ")],
            ["Trade licence", [m.trade_licence_number, m.trade_licence_authority, m.trade_licence_expires_on ? `expires ${fmtDate(m.trade_licence_expires_on)}` : null].filter(Boolean).join(" · ")],
            ["Emirates ID", [m.emirates_id_number, m.emirates_id_expires_on ? `valid to ${fmtDate(m.emirates_id_expires_on)}` : null].filter(Boolean).join(" · ")],
            ["Address", [m.address, m.emirate].filter(Boolean).join(", ")],
            ["Customer voucher", m.voucher_offer],
            ["Signed by", data.agent ? [data.agent.name, data.agent.email].filter(Boolean).join(" · ") : null],
            ["Registered", fmtDate(m.created_at)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[#6b7280]">{k}</dt>
              <dd className="font-semibold text-[#0d1117]">{(v as string) || "—"}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-[#6b7280]">Bank</dt>
            <dd className="flex flex-wrap items-center gap-2 font-semibold text-[#0d1117]">
              {[m.bank_account_name, m.bank_name].filter(Boolean).join(" · ") || "—"}
              {m.iban_masked && <span className="font-mono">{data.iban ?? m.iban_masked}</span>}
              {mode === "admin" && m.iban_masked && (
                <button type="button" onClick={data.iban ? () => onChanged() : onReveal} className="inline-flex items-center gap-1 rounded-lg border border-[#e5e8ec] px-2 py-1 text-[12px] font-semibold text-[#001f3f]">
                  {data.iban ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {data.iban ? "Hide" : "Show IBAN"}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title={mode === "admin" ? "Documents · tick each one you checked" : "Documents"}>
        <ul className="divide-y divide-[#f0f2f5]">
          {MERCHANT_DOCUMENT_KINDS.map(({ kind, label }) => {
            const c = data.checklist[kind]
            return (
              <li key={kind} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14px]">
                {mode === "admin" && c.document ? (
                  <label className="flex items-center gap-2.5">
                    <input type="checkbox" checked={c.verified} disabled={busy === kind} onChange={(e) => void verify(kind, e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                    <span className="text-[#0d1117]">{label}</span>
                  </label>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold ${c.present ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{c.present ? "✓" : "!"}</span>
                    <span className="text-[#0d1117]">{label}</span>
                  </span>
                )}
                <span className="ml-auto text-[12px] text-[#6b7280]">
                  {c.document ? `${c.document.note ? `${c.document.note} · ` : ""}${fmtDate(c.document.created_at)}${c.document.uploaded_by_name ? ` by ${c.document.uploaded_by_name}` : ""}` : kind === "bank" && c.present ? `typed in · ${m.iban_masked}` : "missing"}
                </span>
                {c.document && (
                  <a href={c.document.file_url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#001f3f] hover:underline">
                    View
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {data.qr.url && (
        <Card title="QR">
          <div className="flex flex-wrap items-center gap-4 p-5">
            <QRCodeSVG value={data.qr.url} size={96} level="M" fgColor="#001f3f" />
            <div className="min-w-0 text-[13px] text-[#4b5563]">
              <p className="font-mono">{data.qr.url}</p>
              <p className="mt-1">Forwards to {data.qr.landing}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`/api/merchant/qr?format=png&merchant=${merchantId}`} className={btnGhost}>QR (PNG)</a>
                <a href={`/api/merchant/qr?format=flyer&merchant=${merchantId}`} className={btnGhost}>Flyer A5</a>
                <a href={`/api/merchant/qr?format=banner&merchant=${merchantId}`} className={btnGhost}>Roll-up banner</a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {f.recent.length > 0 && (
        <Card title="Newest rentals through the QR">
          <ul className="divide-y divide-[#f0f2f5]">
            {f.recent.slice(0, 8).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="text-[#374151]">{fmtDate(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-[#0d1117]">{d.unit}</span>
                <span className="text-[#6b7280]">{d.agent.name}</span>
                <ValidationPill status={d.validation_status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mode === "admin" && (m.status === "submitted" || m.status === "onboarding" || m.status === "declined") && (
        <Card title="Decision">
          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-[#faf7ee] px-4 py-3 text-[13px] leading-relaxed text-[#4b5563]">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a6d2b]">When you accept</p>
              <ul className="mt-1 list-disc pl-5">
                <li>The login is active and the agreement is dated one year from today.</li>
                <li>A code and the QR are issued; the QR and A5 flyer are emailed to the merchant, and the agent is told.</li>
                <li>The merchant stays in {data.agent?.name ?? "the signing agent"}&apos;s name for the whole agreement.</li>
              </ul>
            </div>
            {!complete && (
              <label className="flex items-start gap-2.5 text-[13px] text-[#374151]">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#001f3f]" />
                <span>Not all four requirements are in. Accept anyway because the paperwork came another way.</span>
              </label>
            )}
            <div>
              <label className={labelCls} htmlFor="accept-note">Note to the merchant (optional, goes in the email)</label>
              <textarea id="accept-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Welcome aboard. Your flyer and banner are attached…" />
            </div>
            {declining && (
              <div>
                <label className={labelCls} htmlFor="decline-reason">Reason (the merchant and the agent are told)</label>
                <textarea id="decline-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="The trade licence has expired…" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {m.status !== "declined" && (
                declining ? (
                  <>
                    <button type="button" onClick={() => void post(`/api/admin/merchants/${merchantId}/decline`, { reason }, "decline")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50">
                      {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Decline
                    </button>
                    <button type="button" onClick={() => setDeclining(false)} className={btnGhost}>Keep reviewing</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setDeclining(true)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-50">
                    Decline with a reason
                  </button>
                )
              )}
              <button type="button" onClick={() => void post(`/api/admin/merchants/${merchantId}/accept`, { note, force }, "accept")} disabled={busy !== null || (!complete && !force)} className={`ml-auto ${btnGold}`}>
                {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept and issue QR
              </button>
            </div>
            {msg && <p className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
          </div>
        </Card>
      )}
      {mode === "admin" && m.status === "accepted" && msg && <p className={`text-[13px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
      {mode === "admin" && m.status === "declined" && m.decline_reason && <ErrorNote text={`Declined ${fmtDate(m.declined_at)}: ${m.decline_reason}`} />}
      {mode === "agent" && m.status !== "accepted" && (
        <p className="text-[13px] text-[#6b7280]">
          {m.status === "submitted" ? "All four requirements are in. FHI reviews within two working days." : m.status === "declined" ? `FHI declined this application${m.decline_reason ? `: ${m.decline_reason}` : "."}` : "Upload the missing requirements for them under Documents, or remind them to."}
        </p>
      )}
    </div>
  )
}

function Mini({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e8eaed] bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7280]">{label}</p>
      <p className="mt-1 font-['Outfit'] text-[20px] font-bold tabular-nums text-[#0d1117]">{value}</p>
      {hint && <p className="text-[12px] text-[#6b7280]">{hint}</p>}
    </div>
  )
}
