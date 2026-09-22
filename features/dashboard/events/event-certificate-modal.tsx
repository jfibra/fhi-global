"use client"

/**
 * Certificates of attendance — design once per event, preview live, then
 * email to everyone not yet sent, to a selection, or to one person.
 *
 * Sending is one request per attendee, driven from here in sequence, so each
 * row shows its own result and a slow mail server can never fail a batch.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Award, CheckCircle2, Copy, Download, Loader2, Mail, QrCode, Save, X } from "lucide-react"
import { CERTIFICATE_DEFAULTS, parseCertificateSettings, type CertificateSettings, type SelfService } from "@/lib/events/certificate"

export type CertificateRegistration = {
  id: string
  fullName: string
  email: string
  certificateSentAt: string | null
}

type RowState = { status: "sending" | "sent" | "failed"; message?: string }

const sentLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "short", timeZone: "Asia/Dubai" })

export function EventCertificateModal({
  event,
  registrations,
  onClose,
  onSaved,
  onSent,
}: {
  event: { id: string; slug: string | null; title: string; certificate?: CertificateSettings }
  registrations: CertificateRegistration[]
  onClose: () => void
  /** Design saved — parent keeps its event row in sync. */
  onSaved: (settings: CertificateSettings) => void
  /** One certificate emailed — parent stamps the registration row. */
  onSent: (registrationId: string, sentAt: string) => void
}) {
  // ── design ──
  const saved = event.certificate ?? CERTIFICATE_DEFAULTS
  const [heading, setHeading] = useState(saved.heading)
  const [line, setLine] = useState(saved.line)
  const [note, setNote] = useState(saved.note)
  const [s1n, setS1n] = useState(saved.signatories[0]?.name ?? "")
  const [s1t, setS1t] = useState(saved.signatories[0]?.title ?? "")
  const [s2n, setS2n] = useState(saved.signatories[1]?.name ?? "")
  const [s2t, setS2t] = useState(saved.signatories[1]?.title ?? "")
  const [selfService, setSelfService] = useState<SelfService>(saved.selfService)
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const draft = useMemo<CertificateSettings>(
    () =>
      parseCertificateSettings({
        heading,
        line,
        note,
        signatories: [
          { name: s1n, title: s1t },
          { name: s2n, title: s2t },
        ],
        selfService,
      }),
    [heading, line, note, s1n, s1t, s2n, s2t, selfService],
  )
  const dirty = JSON.stringify(draft) !== JSON.stringify(parseCertificateSettings(saved))

  const saveDesign = async (): Promise<boolean> => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/events/${event.id}/certificate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificate: draft }),
      })
      if (!res.ok) throw new Error("Save failed")
      onSaved(draft)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed")
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── preview (debounced so typing does not fire a render per keystroke) ──
  const [previewFor, setPreviewFor] = useState<string>(registrations[0]?.id ?? "")
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [previewLoading, setPreviewLoading] = useState(true)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      const p = new URLSearchParams({ heading, line, note, s1n, s1t, s2n, s2t })
      if (previewFor) p.set("registrationId", previewFor)
      p.set("t", String(Date.now()))
      setPreviewLoading(true)
      setPreviewUrl(`/api/admin/events/${event.id}/certificate/preview?${p.toString()}`)
    }, 450)
    return () => clearTimeout(previewTimer.current)
  }, [event.id, heading, line, note, s1n, s1t, s2n, s2t, previewFor])

  const selfServiceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/events/${event.slug ?? event.id}/certificate`

  // ── recipients ──
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [sending, setSending] = useState(false)
  const cancelRef = useRef(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const notSent = registrations.filter((r) => !r.certificateSentAt)
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const sendOne = async (r: CertificateRegistration): Promise<boolean> => {
    setRows((m) => ({ ...m, [r.id]: { status: "sending" } }))
    try {
      const res = await fetch(`/api/admin/events/${event.id}/certificate/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: r.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { sentAt?: string; error?: string }
      if (!res.ok || !data.sentAt) throw new Error(data.error ?? "Send failed")
      setRows((m) => ({ ...m, [r.id]: { status: "sent" } }))
      onSent(r.id, data.sentAt)
      return true
    } catch (e) {
      setRows((m) => ({ ...m, [r.id]: { status: "failed", message: e instanceof Error ? e.message : "Send failed" } }))
      return false
    }
  }

  const sendMany = async (list: CertificateRegistration[]) => {
    if (list.length === 0) return
    // The saved design is what gets emailed — never a stale one.
    if (dirty && !(await saveDesign())) return
    const already = list.filter((r) => r.certificateSentAt).length
    const msg =
      `Email ${list.length} certificate${list.length === 1 ? "" : "s"}?` +
      (already ? `\n\n${already} of these already received one and will get it again.` : "")
    if (!window.confirm(msg)) return
    setSending(true)
    cancelRef.current = false
    setProgress({ done: 0, total: list.length })
    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) break
      await sendOne(list[i])
      setProgress({ done: i + 1, total: list.length })
    }
    setSending(false)
    setSelected(new Set())
  }

  const inputCls =
    "w-full px-3 py-2 border border-[#e5e5e5] bg-white text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f]"
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-1"

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className="relative bg-white border border-[#e8eaed] shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Certificates"
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="font-['Outfit'] font-bold text-[#001f3f] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#b8913f]" /> Certificates
            </h3>
            <p className="text-xs text-[#6b7280] mt-0.5 truncate">
              {event.title} · {registrations.length} registered · {registrations.length - notSent.length} sent
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-2 text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Design + preview ── */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Heading</label>
              <input className={inputCls} value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={60} placeholder="Certificate of Attendance" />
            </div>
            <div>
              <label className={labelCls}>Line before the event title</label>
              <input className={inputCls} value={line} onChange={(e) => setLine(e.target.value)} maxLength={80} placeholder="for attending" />
            </div>
            <div>
              <label className={labelCls}>Note (optional)</label>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. 4 hours · Career development" />
            </div>
            <div className="border-t border-[#f0f0f0] pt-3">
              <p className={labelCls}>Signatory 1</p>
              <div className="grid grid-cols-1 gap-2">
                <input className={inputCls} value={s1n} onChange={(e) => setS1n(e.target.value)} maxLength={60} placeholder="Full name" />
                <input className={inputCls} value={s1t} onChange={(e) => setS1t(e.target.value)} maxLength={60} placeholder="Title, e.g. Founder & CEO" />
              </div>
            </div>
            <div>
              <p className={labelCls}>Signatory 2 (optional)</p>
              <div className="grid grid-cols-1 gap-2">
                <input className={inputCls} value={s2n} onChange={(e) => setS2n(e.target.value)} maxLength={60} placeholder="Full name" />
                <input className={inputCls} value={s2t} onChange={(e) => setS2t(e.target.value)} maxLength={60} placeholder="Title" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveDesign()}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#001f3f] text-white text-xs font-bold hover:bg-[#00305f] disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {dirty ? "Save design" : "Design saved"}
              </button>
              {saveError && <span className="text-xs text-rose-600">{saveError}</span>}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <p className={labelCls}>Preview</p>
              <select
                value={previewFor}
                onChange={(e) => setPreviewFor(e.target.value)}
                className="text-xs border border-[#e5e5e5] px-2 py-1.5 bg-white max-w-[260px]"
                aria-label="Preview for attendee"
              >
                <option value="">Sample name</option>
                {registrations.map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName}</option>
                ))}
              </select>
            </div>
            <div className="relative border border-[#e8eaed] bg-[#f6f8fb] aspect-[1754/1240]">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Certificate preview"
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => setPreviewLoading(false)}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity ${previewLoading ? "opacity-40" : "opacity-100"}`}
                />
              )}
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#001f3f]" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1.5">
              Exactly what the attendee receives, as an A4 landscape PDF attached to a branded email.
            </p>
          </div>
        </div>

        {/* ── Self-service (QR at the venue) ── */}
        <div className="mt-6 border-t border-[#f0f0f0] pt-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <div>
              <p className={labelCls}>Self-service certificates</p>
              <p className="text-[11px] text-[#9ca3af] mb-3">
                Attendees scan a QR (or open the link), enter their details and download their own certificate. Switch it on when
                the event ends; saving the design saves this too.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["off", "Off", "Nobody can self-serve. Certificates go out by email only."],
                    ["registered", "Registered attendees", "They enter the email they registered with. Name comes from the registration."],
                    ["open", "Anyone", "They type a name and download. No check — best for walk-ins."],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label
                    key={key}
                    className={`flex flex-col gap-1 p-3 border cursor-pointer transition-colors ${
                      selfService === key ? "border-[#001f3f] bg-[#001f3f]/5" : "border-[#e5e5e5] hover:bg-[#fafafa]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                      <input type="radio" name="selfService" value={key} checked={selfService === key} onChange={() => setSelfService(key)} />
                      {label}
                    </span>
                    <span className="text-[11px] text-[#6b7280] leading-snug">{hint}</span>
                  </label>
                ))}
              </div>
              {selfService !== "off" && dirty && (
                <p className="text-[11px] text-amber-700 mt-2">Not live until you click <strong>Save design</strong>.</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 border border-[#e5e5e5] p-4 bg-[#fafafa]">
              <p className={`${labelCls} self-start`}>QR for the venue screen</p>
              <div ref={qrRef} className="bg-white p-2 border border-[#e5e5e5]">
                <QRCodeCanvas value={selfServiceUrl} size={168} level="M" fgColor="#001f3f" includeMargin={false} />
              </div>
              <p className="text-[10px] text-[#6b7280] break-all text-center">{selfServiceUrl}</p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => { void navigator.clipboard.writeText(selfServiceUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#e5e5e5] bg-white text-xs font-bold text-[#374151] hover:border-[#001f3f]"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const canvas = qrRef.current?.querySelector("canvas")
                    if (!canvas) return
                    const a = document.createElement("a")
                    a.href = canvas.toDataURL("image/png")
                    a.download = `${event.slug ?? "event"}-certificate-qr.png`
                    a.click()
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#001f3f] text-white text-xs font-bold hover:bg-[#00305f]"
                >
                  <Download className="w-3.5 h-3.5" /> QR
                </button>
              </div>
              <p className="text-[10px] text-[#9ca3af] text-center inline-flex items-center gap-1"><QrCode className="w-3 h-3" /> Prints large and clean — it is a plain PNG.</p>
            </div>
          </div>
        </div>

        {/* ── Recipients ── */}
        <div className="mt-6 border-t border-[#f0f0f0] pt-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className={`${labelCls} mb-0 mr-auto`}>
              Recipients{selected.size ? ` · ${selected.size} selected` : ""}
            </p>
            <button type="button" onClick={() => setSelected(new Set(notSent.map((r) => r.id)))} disabled={sending || notSent.length === 0}
              className="px-3 py-1.5 border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] disabled:opacity-40">
              Select not yet sent ({notSent.length})
            </button>
            <button type="button" onClick={() => setSelected(new Set(registrations.map((r) => r.id)))} disabled={sending}
              className="px-3 py-1.5 border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] disabled:opacity-40">
              Select all
            </button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={sending || selected.size === 0}
              className="px-3 py-1.5 border border-[#e5e5e5] text-xs font-semibold text-[#6b7280] hover:border-[#001f3f] disabled:opacity-40">
              Clear
            </button>
            {sending ? (
              <button type="button" onClick={() => { cancelRef.current = true }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending {progress?.done ?? 0} / {progress?.total ?? 0} — stop
              </button>
            ) : (
              <button type="button" onClick={() => void sendMany(registrations.filter((r) => selected.has(r.id)))} disabled={selected.size === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#d6b357] text-[#001f3f] text-xs font-bold hover:bg-[#c8a544] disabled:opacity-40">
                <Mail className="w-3.5 h-3.5" /> Email selected ({selected.size})
              </button>
            )}
          </div>

          {registrations.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-6 text-center">No registrations yet.</p>
          ) : (
            <div className="border border-[#e8eaed] max-h-[40vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[#f0f0f0] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Certificate</th>
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r) => {
                    const st = rows[r.id]
                    return (
                      <tr key={r.id} className="border-b border-[#f7f7f7]">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} disabled={sending} aria-label={`Select ${r.fullName}`} />
                        </td>
                        <td className="px-3 py-2 font-semibold text-[#111827]">{r.fullName}</td>
                        <td className="px-3 py-2 text-[#374151]">{r.email}</td>
                        <td className="px-3 py-2">
                          {st?.status === "sending" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[#6b7280]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</span>
                          ) : st?.status === "failed" ? (
                            <span className="text-xs text-rose-600" title={st.message}>Failed — {st.message}</span>
                          ) : r.certificateSentAt ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Sent {sentLabel(r.certificateSentAt)}</span>
                          ) : (
                            <span className="text-xs text-[#9ca3af]">Not sent</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => void sendMany([r])} disabled={sending || st?.status === "sending"}
                            className="px-3 py-1 border border-[#e5e5e5] text-[11px] font-bold text-[#001f3f] hover:border-[#001f3f] disabled:opacity-40">
                            {r.certificateSentAt ? "Resend" : "Send"}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
