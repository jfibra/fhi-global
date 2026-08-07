"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FileText, UploadCloud, CheckCircle2, Loader2, X, Download } from "lucide-react"
import { uploadOwnerDoc, type UploadedDoc } from "@/lib/owner-documents/upload-client"
import { downloadNocPdf } from "@/lib/owner-documents/noc-pdf"

const MAX_MB = 25
const ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Slot = {
  file: File
  status: "uploading" | "done" | "error"
  progress: number
  uploaded?: UploadedDoc
  error?: string
}

const fmtDate = (d: Date) =>
  Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

export function IntakeForm({
  token,
  agentName,
  agentAvatarUrl,
  agencyName,
}: {
  token: string
  agentName: string
  agentAvatarUrl: string | null
  agencyName: string
}) {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [website, setWebsite] = useState("") // honeypot

  // Owner + property fields
  const [ownerName, setOwnerName] = useState("")
  const [ownerIdNumber, setOwnerIdNumber] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerMobile, setOwnerMobile] = useState("")
  const [building, setBuilding] = useState("")
  const [unitNumber, setUnitNumber] = useState("")
  const [community, setCommunity] = useState("")
  const [titleDeedNumber, setTitleDeedNumber] = useState("")
  const [validUntil, setValidUntil] = useState("")

  // Document slots
  const [titleDeed, setTitleDeed] = useState<Slot | null>(null)
  const [idType, setIdType] = useState<"emirates_id" | "passport">("emirates_id")
  const [idDoc, setIdDoc] = useState<Slot | null>(null)
  const [signedNoc, setSignedNoc] = useState<Slot | null>(null)
  const [others, setOthers] = useState<Slot[]>([])

  const today = fmtDate(new Date())
  const requiredDone =
    titleDeed?.status === "done" && idDoc?.status === "done" && signedNoc?.status === "done"
  const anyUploading =
    titleDeed?.status === "uploading" ||
    idDoc?.status === "uploading" ||
    signedNoc?.status === "uploading" ||
    others.some((o) => o.status === "uploading")
  const detailsDone =
    !!ownerName.trim() && !!ownerIdNumber.trim() && EMAIL_RE.test(ownerEmail.trim()) && ownerMobile.trim().length >= 4
  const canSubmit = detailsDone && requiredDone && !anyUploading && !submitting

  function validateFile(file: File): string | null {
    if (!ALLOWED.has(file.type)) return "Only JPG, PNG, or PDF files are allowed."
    if (file.size > MAX_MB * 1024 * 1024) return `File is too large (max ${MAX_MB} MB).`
    return null
  }

  async function runUpload(file: File, docType: string, set: (s: Slot | null) => void) {
    const err = validateFile(file)
    if (err) return toast.error(err)
    set({ file, status: "uploading", progress: 0 })
    const { data, error } = await uploadOwnerDoc(token, docType, file, (pct) =>
      set({ file, status: "uploading", progress: pct }),
    )
    if (error || !data) {
      set({ file, status: "error", progress: 0, error: error ?? "Upload failed." })
      return toast.error(error ?? "Upload failed.")
    }
    set({ file, status: "done", progress: 100, uploaded: data })
  }

  async function addOther(file: File) {
    const err = validateFile(file)
    if (err) return toast.error(err)
    const index = others.length
    setOthers((prev) => [...prev, { file, status: "uploading", progress: 0 }])
    const patch = (s: Slot) => setOthers((prev) => prev.map((o, i) => (i === index ? s : o)))
    const { data, error } = await uploadOwnerDoc(token, "other", file, (pct) =>
      patch({ file, status: "uploading", progress: pct }),
    )
    if (error || !data) {
      patch({ file, status: "error", progress: 0, error: error ?? "Upload failed." })
      return toast.error(error ?? "Upload failed.")
    }
    patch({ file, status: "done", progress: 100, uploaded: data })
  }

  function handleDownloadNoc() {
    if (!ownerName.trim() || !ownerIdNumber.trim()) {
      toast.error("Fill in your name and ID number first.")
      return
    }
    void downloadNocPdf(
      {
        date: today,
        ownerName,
        ownerIdNumber,
        building,
        unitNumber,
        community,
        titleDeedNumber,
        agencyName,
        validUntil: validUntil ? fmtDate(new Date(validUntil)) : "",
      },
      `NOC-${(building || "property").replace(/[^a-z0-9]+/gi, "-")}-${unitNumber || ""}.pdf`.replace(/-+\.pdf$/, ".pdf"),
    )
  }

  async function handleSubmit() {
    if (!detailsDone) return toast.error("Please complete your details (name, ID, email, mobile).")
    if (!requiredDone) return toast.error("Please upload the Title Deed, your ID, and the signed NOC.")
    setSubmitting(true)
    const files: Array<{ path: string; docType: string; fileName: string; fileType: string; fileSize: number }> = []
    const push = (slot: Slot | null, docType: string) => {
      if (slot?.uploaded) {
        files.push({
          path: slot.uploaded.path,
          docType,
          fileName: slot.uploaded.fileName,
          fileType: slot.uploaded.fileType,
          fileSize: slot.uploaded.fileSize,
        })
      }
    }
    push(titleDeed, "title_deed")
    push(idDoc, idType)
    push(signedNoc, "signed_noc")
    others.forEach((o) => push(o, "other"))

    try {
      const res = await fetch(`/api/owner-documents/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName, ownerIdNumber, ownerEmail, ownerMobile,
          building, unitNumber, community, titleDeedNumber,
          nocValidUntil: validUntil, files, website,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not submit. Please try again.")
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch {
      toast.error("Could not submit. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f5]">
      {/* FHI letterhead */}
      <div className="bg-gradient-to-b from-[#001228] to-[#012a53]">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element -- local public brand asset */}
          <img src="/FHI_Branding.png" alt="FHI Global Property" className="h-16 w-auto" />
        </div>
      </div>
      <div className="h-[3px] bg-[#d6b357]" />

      {/* Requested-by bar */}
      <div className="border-b border-[#eef0f2] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {agentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar host varies (Google/S3/legacy)
            <img src={agentAvatarUrl} alt={agentName} className="h-9 w-9 rounded-full object-cover ring-2 ring-[#d6b357]/40" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#001f3f] text-xs font-bold text-white">
              {agentName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="text-[13px] text-[#6b7280]">
            Requested by <span className="font-semibold text-[#0d1117]">{agentName}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-6 shadow-xl sm:p-10">
          {submitted ? (
            <SuccessPanel agentName={agentName} />
          ) : (
            <>
              <h1 className="text-center font-['Outfit'] text-2xl font-extrabold tracking-tight text-[#001f3f]">
                NO OBJECTION CERTIFICATE
              </h1>
              <p className="mt-1 text-center text-[13px] font-medium text-[#9ca3af]">Owner&apos;s Authorization to Advertise</p>
              <div className="mx-auto mt-4 h-px w-24 bg-[#d6b357]" />

              {/* The letter — fields fill into the blanks as you type */}
              <div className="mt-7 space-y-4 text-[15px] leading-[2.1] text-[#1f2937]">
                <p>Date: <DocValue>{today}</DocValue></p>
                <p>To Whom It May Concern,</p>
                <p>
                  I, <InlineInput value={ownerName} onChange={setOwnerName} placeholder="Full name (as on title deed)" width="17rem" />, holder of Emirates ID/Passport No. <InlineInput value={ownerIdNumber} onChange={setOwnerIdNumber} placeholder="ID / Passport no." width="14rem" />, being the legal owner of the property described below:
                </p>
                <div>
                  <p className="font-bold text-[#0d1117]">Property Details:</p>
                  <ul className="mt-2 space-y-2.5 pl-1">
                    <Bullet label="Property Name/Building:"><InlineInput value={building} onChange={setBuilding} placeholder="e.g. Azizi Venice" width="16rem" /></Bullet>
                    <Bullet label="Unit Number:"><InlineInput value={unitNumber} onChange={setUnitNumber} placeholder="e.g. 1203" width="9rem" /></Bullet>
                    <Bullet label="Community/Area:"><InlineInput value={community} onChange={setCommunity} placeholder="e.g. Dubai South" width="13rem" /></Bullet>
                    <Bullet label="Title Deed Number:"><InlineInput value={titleDeedNumber} onChange={setTitleDeedNumber} placeholder="e.g. 1234/2027" width="12rem" /></Bullet>
                  </ul>
                </div>
                <p>
                  Hereby authorize and grant my full consent to <span className="font-semibold text-[#001f3f]">{agencyName}</span> to advertise, market, and arrange viewings of the above-mentioned property for the purpose of sale and/or lease.
                </p>
                <p>
                  I confirm that I have no objection to prospective buyers or tenants being accompanied by the authorized real estate agent for property inspections and viewings at mutually agreed times.
                </p>
                <p className="flex flex-wrap items-center gap-x-1">
                  <span>This authorization shall remain valid until</span>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="rounded-md border border-[#d1d5db] bg-white px-2 py-1 text-[13px] outline-none focus:border-[#001f3f]"
                  />
                  <span>or until revoked by me in writing.</span>
                </p>
              </div>

              {/* Contact details (not part of the letter, but needed) */}
              <div className="mt-8 rounded-xl border border-[#eef0f2] bg-[#f9fafb] p-4">
                <p className="text-[13px] font-semibold text-[#374151]">Your contact details</p>
                <p className="text-[12px] text-[#9ca3af]">So your agent can reach you about this authorization.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Email" type="email" value={ownerEmail} onChange={setOwnerEmail} placeholder="you@example.com" />
                  <Field label="Mobile" value={ownerMobile} onChange={setOwnerMobile} placeholder="+971 5X XXX XXXX" />
                </div>
              </div>

              {/* Download + sign */}
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e7d9a8] bg-[#fdf9ee] p-4">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#a8842a]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1f2937]">Download &amp; sign your NOC</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b7280]">
                    We&apos;ve filled the certificate above from your details. Download it, sign it, then upload the signed copy below.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadNoc}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#001f3f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#002b57]"
                  >
                    <Download className="h-3.5 w-3.5" /> Download NOC letter
                  </button>
                </div>
              </div>

              {/* Uploads */}
              <p className="mt-8 text-sm font-bold text-[#0d1117]">Upload your documents</p>
              <div className="mt-3 space-y-4">
                <UploadField label="Title Deed" required slot={titleDeed} onPick={(f) => runUpload(f, "title_deed", setTitleDeed)} onClear={() => setTitleDeed(null)} />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#374151]">Identification <span className="text-rose-500">*</span></span>
                    <div className="inline-flex overflow-hidden rounded-full border border-[#e5e7eb] text-[11px] font-semibold">
                      {(["emirates_id", "passport"] as const).map((t) => (
                        <button key={t} type="button" onClick={() => { setIdType(t); setIdDoc(null) }}
                          className={idType === t ? "bg-[#001f3f] px-3 py-1 text-white" : "px-3 py-1 text-[#6b7280]"}>
                          {t === "emirates_id" ? "Emirates ID" : "Passport"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <UploadField label="ID" hideLabel slot={idDoc} onPick={(f) => runUpload(f, idType, setIdDoc)} onClear={() => setIdDoc(null)} />
                </div>
                <UploadField label="Signed NOC" required slot={signedNoc} onPick={(f) => runUpload(f, "signed_noc", setSignedNoc)} onClear={() => setSignedNoc(null)} />
                {others.map((o, i) => (
                  <UploadField key={i} label={`Additional document ${i + 1}`} slot={o} onPick={() => {}} onClear={() => setOthers((prev) => prev.filter((_, idx) => idx !== i))} locked />
                ))}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d1d5db] py-2.5 text-[13px] font-medium text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]">
                  <UploadCloud className="h-4 w-4" /> Add another document (optional)
                  <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addOther(f); e.target.value = "" }} />
                </label>
              </div>

              {/* Submit */}
              <div className="mt-8 border-t border-[#eef0f2] pt-6">
                {!canSubmit && (
                  <p className="mb-3 text-center text-[12px] text-[#9ca3af]">
                    Complete your details and upload the Title Deed, your ID, and the signed NOC to submit.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#001f3f] px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-[#002b57] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit documents"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#9ca3af]">
          Your documents are transmitted securely and shared only with your agent for the property listing.
        </p>
      </div>

      {/* Honeypot */}
      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DocValue({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[#0d1117] underline decoration-[#c9ccd1] decoration-1 underline-offset-4">{children}</span>
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-[#d6b357]">•</span>
      <span className="font-medium text-[#374151]">{label}</span>
      {children}
    </li>
  )
}

function InlineInput({
  value, onChange, placeholder, width,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: width ?? "12rem", maxWidth: "100%" }}
      className="inline-block border-b border-[#c9ccd1] bg-transparent px-1 align-baseline text-[15px] font-semibold text-[#0d1117] outline-none transition-colors placeholder:font-normal placeholder:text-[#b6bcc4] focus:border-[#001f3f]"
    />
  )
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-[#374151]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#b6bcc4] focus:border-[#001f3f]"
      />
    </div>
  )
}

function UploadField({
  label, slot, onPick, onClear, required, hideLabel, locked,
}: {
  label: string
  slot: Slot | null
  onPick: (file: File) => void
  onClear: () => void
  required?: boolean
  hideLabel?: boolean
  locked?: boolean
}) {
  return (
    <div>
      {!hideLabel && (
        <label className="mb-1.5 block text-[13px] font-semibold text-[#374151]">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {slot ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
          {slot.status === "done" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : slot.status === "error" ? (
            <X className="h-5 w-5 shrink-0 text-rose-500" />
          ) : (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#001f3f]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#111827]">{slot.file.name}</p>
            {slot.status === "uploading" && (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
                <div className="h-full rounded-full bg-[#001f3f] transition-all" style={{ width: `${slot.progress}%` }} />
              </div>
            )}
            {slot.status === "error" && <p className="text-[11px] text-rose-500">{slot.error}</p>}
            {slot.status === "done" && <p className="text-[11px] text-emerald-600">Uploaded</p>}
          </div>
          <button type="button" onClick={onClear} className="text-[#9ca3af] hover:text-rose-500" aria-label="Remove">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : locked ? null : (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#d1d5db] px-4 py-3 transition-colors hover:border-[#001f3f]">
          <UploadCloud className="h-5 w-5 text-[#9ca3af]" />
          <span className="text-[13px] text-[#6b7280]">Tap to upload — JPG, PNG or PDF (max {MAX_MB} MB)</span>
          <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = "" }} />
        </label>
      )}
    </div>
  )
}

function SuccessPanel({ agentName }: { agentName: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-9 w-9 text-emerald-500" />
      </div>
      <h2 className="mt-5 font-['Outfit'] text-xl font-bold text-[#0d1117]">Documents submitted</h2>
      <p className="mt-2 max-w-sm text-sm text-[#6b7280]">
        Thank you! Your details and documents have been securely sent to <strong>{agentName}</strong>. They&apos;ll
        proceed with your property&apos;s NOC / Trakheesi advertising permit. You can close this page.
      </p>
    </div>
  )
}
