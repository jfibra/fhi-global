"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  FileText, UploadCloud, CheckCircle2, Loader2, X, Download, ChevronRight, ChevronLeft, ShieldCheck,
} from "lucide-react"
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
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1)
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

  const contactValid =
    ownerName.trim() && ownerIdNumber.trim() && EMAIL_RE.test(ownerEmail.trim()) && ownerMobile.trim().length >= 4
  const requiredDone =
    titleDeed?.status === "done" && idDoc?.status === "done" && signedNoc?.status === "done"
  const anyUploading =
    titleDeed?.status === "uploading" ||
    idDoc?.status === "uploading" ||
    signedNoc?.status === "uploading" ||
    others.some((o) => o.status === "uploading")

  function validateFile(file: File): string | null {
    if (!ALLOWED.has(file.type)) return "Only JPG, PNG, or PDF files are allowed."
    if (file.size > MAX_MB * 1024 * 1024) return `File is too large (max ${MAX_MB} MB).`
    return null
  }

  async function runUpload(file: File, docType: string, set: (s: Slot | null) => void) {
    const err = validateFile(file)
    if (err) {
      toast.error(err)
      return
    }
    set({ file, status: "uploading", progress: 0 })
    const { data, error } = await uploadOwnerDoc(token, docType, file, (pct) =>
      set({ file, status: "uploading", progress: pct }),
    )
    if (error || !data) {
      set({ file, status: "error", progress: 0, error: error ?? "Upload failed." })
      toast.error(error ?? "Upload failed.")
      return
    }
    set({ file, status: "done", progress: 100, uploaded: data })
  }

  async function addOther(file: File) {
    const err = validateFile(file)
    if (err) {
      toast.error(err)
      return
    }
    const index = others.length
    setOthers((prev) => [...prev, { file, status: "uploading", progress: 0 }])
    const patch = (s: Slot) => setOthers((prev) => prev.map((o, i) => (i === index ? s : o)))
    const { data, error } = await uploadOwnerDoc(token, "other", file, (pct) =>
      patch({ file, status: "uploading", progress: pct }),
    )
    if (error || !data) {
      patch({ file, status: "error", progress: 0, error: error ?? "Upload failed." })
      toast.error(error ?? "Upload failed.")
      return
    }
    patch({ file, status: "done", progress: 100, uploaded: data })
  }

  function handleDownloadNoc() {
    void downloadNocPdf(
      {
        date: fmtDate(new Date()),
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
    if (!requiredDone) {
      toast.error("Please upload the Title Deed, your ID, and the signed NOC.")
      return
    }
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
          ownerName,
          ownerIdNumber,
          ownerEmail,
          ownerMobile,
          building,
          unitNumber,
          community,
          titleDeedNumber,
          nocValidUntil: validUntil,
          files,
          website,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not submit. Please try again.")
        setSubmitting(false)
        return
      }
      setStep("done")
    } catch {
      toast.error("Could not submit. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001228] to-[#012a53] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Brand header */}
        <div className="mb-5 flex items-center justify-center gap-2 text-white/90">
          <ShieldCheck className="h-5 w-5 text-[#d6b357]" />
          <span className="font-['Outfit'] text-sm font-semibold tracking-wide">FHI Global · Secure Document Upload</span>
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-2xl">
          {/* Requesting-agent chip */}
          <div className="flex items-center gap-3 border-b border-[#eef0f2] bg-[#f9fafb] px-6 py-4">
            {agentAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar host varies (Google/S3/legacy) on this public page
              <img
                src={agentAvatarUrl}
                alt={agentName}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-[#d6b357]/40"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#001f3f] text-sm font-bold text-white">
                {agentName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Requested by</p>
              <p className="truncate font-['Outfit'] text-[15px] font-bold text-[#0d1117]">{agentName}</p>
            </div>
          </div>

          {step === "done" ? (
            <SuccessPanel agentName={agentName} />
          ) : (
            <div className="px-6 py-6 sm:px-8">
              <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">Property Owner Documents</h1>
              <p className="mt-1 text-sm text-[#6b7280]">
                Please provide your details and upload your documents so we can process the NOC / Trakheesi
                advertising permit for your property.
              </p>

              <StepDots step={step} />

              {step === 1 && (
                <div className="mt-6 space-y-4">
                  <Field label="Full name (as on title deed)" value={ownerName} onChange={setOwnerName} placeholder="e.g. Ahmed Al Mansouri" />
                  <Field label="Emirates ID / Passport No." value={ownerIdNumber} onChange={setOwnerIdNumber} placeholder="784-XXXX-XXXXXXX-X" />
                  <Field label="Email address" type="email" value={ownerEmail} onChange={setOwnerEmail} placeholder="you@example.com" />
                  <Field label="Mobile number" value={ownerMobile} onChange={setOwnerMobile} placeholder="+971 5X XXX XXXX" />
                  <div className="flex justify-end pt-2">
                    <PrimaryButton disabled={!contactValid} onClick={() => setStep(2)}>
                      Continue <ChevronRight className="h-4 w-4" />
                    </PrimaryButton>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="mt-6 space-y-4">
                  <Field label="Property name / building" value={building} onChange={setBuilding} placeholder="e.g. Azizi Venice" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Unit number" value={unitNumber} onChange={setUnitNumber} placeholder="e.g. 1203" />
                    <Field label="Community / area" value={community} onChange={setCommunity} placeholder="e.g. Dubai South" />
                  </div>
                  <Field label="Title deed number" value={titleDeedNumber} onChange={setTitleDeedNumber} placeholder="e.g. 1234/2024" />
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-[#374151]">Authorization valid until <span className="font-normal text-[#9ca3af]">(optional)</span></label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#001f3f]"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <GhostButton onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /> Back</GhostButton>
                    <PrimaryButton onClick={() => setStep(3)}>Continue <ChevronRight className="h-4 w-4" /></PrimaryButton>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="mt-6 space-y-5">
                  {/* NOC letter */}
                  <div className="rounded-2xl border border-[#e7d9a8] bg-[#fdf9ee] p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#a8842a]" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1f2937]">Step 1 — Download &amp; sign your NOC</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-[#6b7280]">
                          We&apos;ve pre-filled the No Objection Certificate from your details. Download it, sign it,
                          then upload the signed copy below.
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
                  </div>

                  <p className="text-sm font-semibold text-[#1f2937]">Step 2 — Upload your documents</p>

                  <UploadField
                    label="Title Deed"
                    required
                    slot={titleDeed}
                    onPick={(f) => runUpload(f, "title_deed", setTitleDeed)}
                    onClear={() => setTitleDeed(null)}
                  />

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#374151]">Identification <span className="text-rose-500">*</span></span>
                      <div className="inline-flex overflow-hidden rounded-full border border-[#e5e7eb] text-[11px] font-semibold">
                        {(["emirates_id", "passport"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setIdType(t); setIdDoc(null) }}
                            className={idType === t ? "bg-[#001f3f] px-3 py-1 text-white" : "px-3 py-1 text-[#6b7280]"}
                          >
                            {t === "emirates_id" ? "Emirates ID" : "Passport"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <UploadField
                      label={idType === "emirates_id" ? "Emirates ID" : "Passport"}
                      slot={idDoc}
                      onPick={(f) => runUpload(f, idType, setIdDoc)}
                      onClear={() => setIdDoc(null)}
                      hideLabel
                    />
                  </div>

                  <UploadField
                    label="Signed NOC"
                    required
                    slot={signedNoc}
                    onPick={(f) => runUpload(f, "signed_noc", setSignedNoc)}
                    onClear={() => setSignedNoc(null)}
                  />

                  {others.map((o, i) => (
                    <UploadField
                      key={i}
                      label={`Additional document ${i + 1}`}
                      slot={o}
                      onPick={() => {}}
                      onClear={() => setOthers((prev) => prev.filter((_, idx) => idx !== i))}
                      locked
                    />
                  ))}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d1d5db] py-2.5 text-[13px] font-medium text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]">
                    <UploadCloud className="h-4 w-4" /> Add another document (optional)
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void addOther(f); e.target.value = "" }}
                    />
                  </label>

                  <div className="flex items-center justify-between pt-2">
                    <GhostButton onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" /> Back</GhostButton>
                    <PrimaryButton disabled={!requiredDone || anyUploading || submitting} onClick={handleSubmit}>
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <>Submit documents</>}
                    </PrimaryButton>
                  </div>
                </div>
              )}

              {/* Honeypot — hidden from humans */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                aria-hidden
              />
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-white/50">
          Your documents are transmitted securely and shared only with your agent for the property listing.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Your details", "Property", "Documents"]
  return (
    <div className="mt-5 flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const active = step === n
        const done = step > n
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                active ? "bg-[#001f3f] text-white" : done ? "bg-[#d6b357] text-[#001428]" : "bg-[#e5e7eb] text-[#9ca3af]"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <span className={`hidden text-[11px] font-semibold sm:block ${active ? "text-[#0d1117]" : "text-[#9ca3af]"}`}>{label}</span>
            {i < labels.length - 1 && <div className="h-px flex-1 bg-[#e5e7eb]" />}
          </div>
        )
      })}
    </div>
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
      <label className="mb-1.5 block text-[13px] font-semibold text-[#374151]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#b6bcc4] focus:border-[#001f3f]"
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
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = "" }}
          />
        </label>
      )}
    </div>
  )
}

function SuccessPanel({ agentName }: { agentName: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
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

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full bg-[#001f3f] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#002b57] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold text-[#6b7280] transition-colors hover:text-[#0d1117]"
    >
      {children}
    </button>
  )
}
