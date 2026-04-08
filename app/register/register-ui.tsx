"use client"

import {
  useState, useRef, useCallback, useEffect, ChangeEvent,
} from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Check, X, Loader2,
  Building2, TrendingUp, DollarSign, CheckCircle2, ShieldCheck,
  UploadCloud, Camera, SwitchCamera, RotateCcw, User, Mail,
  Lock, AlertCircle, FileText, ScanLine, Scan, ZoomIn,
} from "lucide-react"

// Types

type AccountType = "salesperson" | "developer" | ""

interface OcrData {
  name: string
  idNumber: string
  dateOfBirth: string
  expiryDate: string
  countryCode: string
}

interface IdFile {
  file: File | null
  preview: string
}

interface FormState {
  accountType: AccountType
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  companyName: string
  primaryId: IdFile
  secondaryId: IdFile
  ocrData: OcrData
  faceBlob: Blob | null
  facePreview: string
}

const INITIAL_OCR: OcrData = { name: "", idNumber: "", dateOfBirth: "", expiryDate: "", countryCode: "AE" }
const INITIAL_STATE: FormState = {
  accountType: "",
  firstName: "", lastName: "", email: "", password: "", confirmPassword: "", companyName: "",
  primaryId: { file: null, preview: "" },
  secondaryId: { file: null, preview: "" },
  ocrData: { ...INITIAL_OCR },
  faceBlob: null, facePreview: "",
}

// Password strength

const PWD_RULES = [
  { label: "At least 8 characters",     test: (p: string) => p.length >= 8 },
  { label: "Contains a number",         test: (p: string) => /\d/.test(p) },
  { label: "Contains uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Contains special character",test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  return (
    <div className="mt-3 rounded-xl border border-[#e8eaed] bg-[#f9fafb] px-4 py-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#9ca3af]">Password Requirements</p>
      {PWD_RULES.map(rule => {
        const ok = rule.test(password)
        return (
          <div key={rule.label} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${ok ? "bg-emerald-500" : "bg-[#e5e7eb]"}`}>
              {ok ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2 h-2 text-[#9ca3af]" />}
            </span>
            <span className={`text-xs transition-colors ${ok ? "text-emerald-700 font-medium" : "text-[#6b7280]"}`}>{rule.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function allPwdRulesPassed(p: string) { return PWD_RULES.every(r => r.test(p)) }

// Stepper

const STEPS_SALESPERSON = ["Account Type", "Information", "ID Upload", "ID Scan", "Face Verify", "Complete"]
const STEPS_DEVELOPER   = ["Account Type", "Information", "Complete"]

function Stepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done   = i < current
        const active = i === current
        const last   = i === steps.length - 1
        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                done
                  ? "bg-[#001f3f] text-white"
                  : active
                  ? "bg-[#001f3f] text-white shadow-[0_0_0_4px_rgba(0,31,63,0.12)]"
                  : "bg-[#f0f2f5] text-[#adb5bd] border border-[#e4e7ec]"
              }`}>
                {done ? <Check className="w-4 h-4" /> : <span className="text-sm">{i + 1}</span>}
              </div>
              <span className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
                active ? "text-[#001f3f]" : done ? "text-[#6b7280]" : "text-[#c4c9d4]"
              }`}>{label}</span>
            </div>
            {!last && (
              <div className={`w-12 sm:w-20 h-px mt-5 mx-1 transition-colors ${done ? "bg-[#001f3f]" : "bg-[#e4e7ec]"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Card shell

function StepCard({ title, subtitle, children, onBack, onNext, nextLabel = "Continue", nextDisabled = false, loading = false, hideBack = false }:
  { title: string; subtitle?: string; children: React.ReactNode; onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean; hideBack?: boolean }) {
  return (
    <div className="bg-white rounded-[20px] border border-[#e4e7ec] shadow-[0_2px_24px_-4px_rgba(0,31,63,0.10)] overflow-hidden">
      <div className="px-7 pt-7 pb-2">
        <h2 className="font-['Outfit'] text-[21px] font-bold text-[#0d1117] mb-1.5">{title}</h2>
        {subtitle && <p className="text-sm text-[#6b7280] leading-relaxed">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {(onBack || onNext) && (
        <div className="flex items-center justify-between px-7 py-5 mt-4 border-t border-[#f0f2f5]">
          {onBack && !hideBack ? (
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#001f3f] transition-colors font-semibold">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <span />}
          {onNext && (
            <button
              onClick={onNext}
              disabled={nextDisabled || loading}
              className="flex items-center gap-2 px-7 py-3 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.50)] hover:-translate-y-0.5 transition-all duration-200"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {nextLabel}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Input

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  )
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

// Upload zone

function UploadZone({ label, idFile, onFile, onCamera }: {
  label: string;
  idFile: IdFile;
  onFile: (f: File) => void;
  onCamera: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#374151]">{label}</p>
      {idFile.preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#d6b357]/40 bg-[#f9fafb] h-36">
          {idFile.file?.type === "application/pdf" ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <FileText className="w-10 h-10 text-[#001f3f]" />
              <p className="text-xs text-[#374151] font-medium max-w-[80%] truncate">{idFile.file.name}</p>
            </div>
          ) : (
            <img src={idFile.preview} alt={label} className="w-full h-full object-cover" />
          )}
          <button
            onClick={() => ref.current?.click()}
            className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm border border-[#e5e7eb] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-white shadow-sm flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Replace
          </button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] hover:border-[#001f3f] hover:bg-[#f0f4f8] h-36 cursor-pointer transition-all group"
        >
          <UploadCloud className="w-8 h-8 text-[#c4c9d4] group-hover:text-[#001f3f] transition-colors" />
          <p className="text-xs text-[#6b7280] group-hover:text-[#374151] transition-colors font-medium">Click to upload</p>
          <p className="text-[10px] text-[#9ca3af]">JPG, PNG or PDF · max 10 MB</p>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <button
        onClick={onCamera}
        className="flex items-center gap-2 text-xs text-[#374151] hover:text-[#001f3f] font-medium transition-colors"
      >
        <Camera className="w-3.5 h-3.5" /> Use camera instead
      </button>
    </div>
  )
}

// Camera modal

function CameraModal({ onCapture, onClose, title }: { onCapture: (blob: Blob, preview: string) => void; onClose: () => void; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [preview, setPreview] = useState("")
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [facing, setFacing] = useState<"environment" | "user">("environment")

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
      setStream(s)
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play() }
    } catch { /* camera denied */ }
  }, [facing])

  useEffect(() => { startCamera(); return () => { stream?.getTracks().forEach(t => t.stop()) } }, [facing]) // eslint-disable-line

  const capture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0)
    setPreview(canvas.toDataURL("image/jpeg", 0.85))
    canvas.toBlob(b => b && setCapturedBlob(b), "image/jpeg", 0.85)
  }

  const confirmCapture = () => { if (capturedBlob && preview) { onCapture(capturedBlob, preview); onClose() } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[28px] overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="h-[3px] bg-gradient-to-r from-transparent via-[#d6b357] to-transparent" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Outfit'] text-base font-bold text-[#0d1117]">{title}</h3>
            <button onClick={onClose} className="text-[#9ca3af] hover:text-[#374151] transition-colors"><X className="w-5 h-5" /></button>
          </div>
          {preview ? (
            <div className="space-y-4">
              <img src={preview} alt="Captured" className="w-full rounded-2xl object-cover max-h-64" />
              <div className="flex gap-3">
                <button onClick={() => { setPreview(""); setCapturedBlob(null) }} className="flex-1 py-3 rounded-xl border border-[#e5e7eb] text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] flex items-center justify-center gap-2 transition-all"><RotateCcw className="w-4 h-4" /> Retake</button>
                <button onClick={confirmCapture} className="flex-1 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002a52] flex items-center justify-center gap-2 transition-all"><Check className="w-4 h-4" /> Use Photo</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <button onClick={() => setFacing(f => f === "environment" ? "user" : "environment")} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all"><SwitchCamera className="w-4 h-4" /></button>
              </div>
              <button onClick={capture} className="w-full py-3.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#002a52] flex items-center justify-center gap-2 transition-all shadow-[0_4px_16px_-2px_rgba(0,31,63,0.30)]"><Camera className="w-4 h-4" /> Capture</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Main RegisterUI

export function RegisterUI() {
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm,  setShowConfirm]    = useState(false)
  const [step,         setStep]           = useState(0)
  const [form,         setForm]           = useState<FormState>(INITIAL_STATE)
  const [errors,       setErrors]         = useState<Record<string, string>>({})
  const [globalError,  setGlobalError]    = useState("")
  const [submitting,   setSubmitting]     = useState(false)
  const [success,      setSuccess]        = useState(false)
  const [ocrLoading,   setOcrLoading]     = useState(false)
  const [ocrWarning,   setOcrWarning]     = useState("")
  const [camera,       setCamera]         = useState<{open: boolean; target: "primary"|"secondary"|"face"}>({ open: false, target: "primary" })

  const isSalesperson = form.accountType === "salesperson"
  const steps = isSalesperson ? STEPS_SALESPERSON : STEPS_DEVELOPER

  // field helpers
  const set = (key: keyof FormState, value: unknown) => setForm(f => ({ ...f, [key]: value }))
  const setOcr = (k: keyof OcrData, v: string) => setForm(f => ({ ...f, ocrData: { ...f.ocrData, [k]: v } }))

  const makeIdFile = (fileOrBlob: File | Blob, name?: string): IdFile => {
    const file = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], name ?? "capture.jpg", { type: "image/jpeg" })
    return { file, preview: URL.createObjectURL(file) }
  }

  // validation per step
  const validate = (s: number): boolean => {
    const e: Record<string, string> = {}
    if (s === 0 && !form.accountType) e.accountType = "Please select an account type"
    if (s === 1) {
      if (!form.firstName.trim())  e.firstName = "Required"
      if (!form.lastName.trim())   e.lastName  = "Required"
      if (!form.email.trim())      e.email     = "Required"
      if (!form.password)          e.password  = "Required"
      else if (!allPwdRulesPassed(form.password)) e.password = "Password does not meet requirements"
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match"
      if (form.accountType === "developer" && !form.companyName.trim()) e.companyName = "Required"
    }
    if (isSalesperson && s === 2) {
      if (!form.primaryId.file)   e.primaryId   = "Required"
      if (!form.secondaryId.file) e.secondaryId = "Required"
    }
    if (isSalesperson && s === 4) {
      if (!form.faceBlob) e.face = "Selfie required"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate(step)) setStep(s => s + 1) }
  const back = () => { setStep(s => s - 1); setErrors({}) }

  // OCR call
  const runOcr = async () => {
    if (!form.primaryId.file) return
    setOcrLoading(true); setOcrWarning("")
    try {
      const arrayBuffer = await form.primaryId.file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const res = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64, mimeType: form.primaryId.file.type }) })
      const data = await res.json()
      if (data.warning) setOcrWarning(data.warning)
      setForm(f => ({ ...f, ocrData: { name: data.name ?? "", idNumber: data.idNumber ?? "", dateOfBirth: data.dateOfBirth ?? "", expiryDate: data.expiryDate ?? "", countryCode: data.countryCode ?? "AE" } }))
    } catch { setOcrWarning("OCR service unavailable. Please fill in your details manually.") }
    finally { setOcrLoading(false) }
  }

  // submit
  const submit = async () => {
    if (!validate(isSalesperson ? 4 : 1)) return
    setSubmitting(true); setGlobalError("")
    try {
      const fd = new FormData()
      fd.append("accountType",    form.accountType)
      fd.append("firstName",      form.firstName)
      fd.append("lastName",       form.lastName)
      fd.append("email",          form.email)
      fd.append("password",       form.password)
      fd.append("companyName",    form.companyName)
      if (form.primaryId.file)  fd.append("primaryId",   form.primaryId.file)
      if (form.secondaryId.file) fd.append("secondaryId", form.secondaryId.file)
      if (form.faceBlob)        fd.append("faceBlob",    new File([form.faceBlob], "selfie.jpg", { type: "image/jpeg" }))
      fd.append("ocrData", JSON.stringify(form.ocrData))
      const res  = await fetch("/api/register", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Registration failed")
      setSuccess(true)
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Something went wrong")
    }
    setSubmitting(false)
  }

  // last step index for this flow
  const lastStep = steps.length - 1

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[130px] -z-10 bg-[radial-gradient(circle,rgb(180,235,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(255,240,200)_0%,rgba(255,255,255,0)_70%)]" />

      {/* ── Marketing header ── */}
      <div className="bg-white border-b border-[#eaecf0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#e4e7ec] rounded-full text-xs font-semibold text-[#374151] mb-5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
            Join FHI Global
          </div>
          {/* Heading */}
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0d1117] mb-3 leading-tight tracking-tight">
            Start Closing Deals{" "}
            <span className="relative inline-block">
              <span className="relative z-10">in Minutes</span>
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]" aria-hidden="true" />
            </span>
          </h1>
          <p className="text-[#6b7280] text-base leading-relaxed mb-8 max-w-xl mx-auto">
            Create your FHI Global account and gain access to Dubai&apos;s most powerful real estate CRM platform.
          </p>
          {/* Stat strip */}
          <div className="flex items-center justify-center gap-8 sm:gap-14 mb-8 py-5 border-y border-[#f0f0f0]">
            {[
              { icon: <Building2 className="w-4 h-4" />, value: "100+", label: "Developers" },
              { icon: <TrendingUp className="w-4 h-4" />, value: "500+", label: "Projects" },
              { icon: <DollarSign className="w-4 h-4" />, value: "1K+", label: "Deals Closed" },
            ].map(({ icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5 text-[#d6b357]">{icon}<span className="font-['Outfit'] text-xl font-bold text-[#001f3f]">{value}</span></div>
                <span className="text-[11px] text-[#9ca3af] font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: "Developer Network", desc: "Manage all your Dubai developer relationships.", icon: <Building2 className="w-3.5 h-3.5 text-[#001f3f]" /> },
              { title: "Sales Tracking",     desc: "Track purchases, commissions, and performance.", icon: <TrendingUp className="w-3.5 h-3.5 text-[#001f3f]" /> },
              { title: "Premium Listings",   desc: "Access premium project listings and media.",     icon: <FileText className="w-3.5 h-3.5 text-[#001f3f]" /> },
            ].map(({ title, desc, icon }) => (
              <div key={title} className="flex flex-col gap-2 bg-[#fffdf3] border border-[#f0e8c8] rounded-2xl px-4 py-4 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#d6b357] flex items-center justify-center shrink-0">{icon}</div>
                  <span className="text-sm font-bold text-[#111827]">{title}</span>
                </div>
                <p className="text-xs text-[#6b7280] leading-relaxed pl-8">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form area ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {success ? (
          <div className="bg-white rounded-[20px] border border-[#e4e7ec] shadow-[0_2px_24px_-4px_rgba(0,31,63,0.10)] overflow-hidden text-center">
            <div className="px-8 py-10">
              <div className="w-20 h-20 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#d6b357]" />
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">Account Created!</h2>
              <p className="text-[#6b7280] text-sm mb-8 leading-relaxed max-w-sm mx-auto">
                Check your email to confirm your account. Once an administrator approves your access, you can sign in.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl shadow-[0_4px_16px_-2px_rgba(0,31,63,0.35)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Stepper */}
            <Stepper current={step} steps={steps} />

            {/* ── Step 0: Account Type ── */}
            {step === 0 && (
              <StepCard
                title="Choose Account Type"
                subtitle="Select the role that best describes how you will use FHI Global."
                onNext={next}
                nextDisabled={!form.accountType}
                hideBack
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    {
                      type: "salesperson" as AccountType,
                      icon: <User className="w-5 h-5" />,
                      title: "RERA Salesperson",
                      desc: "Property agents, brokers, and sales representatives who manage clients and commissions.",
                    },
                    {
                      type: "developer" as AccountType,
                      icon: <Building2 className="w-5 h-5" />,
                      title: "Developer",
                      desc: "Real estate developers and property companies looking to list and manage projects.",
                    },
                  ] as const).map(({ type, icon, title, desc }) => {
                    const active = form.accountType === type
                    return (
                      <button
                        key={type}
                        onClick={() => set("accountType", type)}
                        className={`relative flex flex-col items-start gap-3 rounded-2xl p-5 border-2 text-left transition-all duration-200 group overflow-hidden ${
                          active
                            ? "border-[#001f3f] bg-[#f0f4fa] shadow-[0_0_0_4px_rgba(0,31,63,0.07)]"
                            : "border-[#e4e7ec] bg-[#f8fafc] hover:border-[#001f3f]/40 hover:bg-white"
                        }`}
                      >
                        {/* Faint skyline watermark */}
                        <div
                          className="absolute bottom-0 right-0 w-full h-16 opacity-[0.05] pointer-events-none"
                          style={{
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 80'%3E%3Crect x='0' y='40' width='20' height='40' fill='%23001f3f'/%3E%3Crect x='25' y='25' width='20' height='55' fill='%23001f3f'/%3E%3Crect x='50' y='10' width='15' height='70' fill='%23001f3f'/%3E%3Crect x='70' y='30' width='25' height='50' fill='%23001f3f'/%3E%3Crect x='100' y='5' width='18' height='75' fill='%23001f3f'/%3E%3Crect x='123' y='20' width='22' height='60' fill='%23001f3f'/%3E%3Crect x='150' y='35' width='16' height='45' fill='%23001f3f'/%3E%3Crect x='170' y='15' width='20' height='65' fill='%23001f3f'/%3E%3Crect x='195' y='28' width='18' height='52' fill='%23001f3f'/%3E%3Crect x='218' y='8' width='22' height='72' fill='%23001f3f'/%3E%3Crect x='245' y='22' width='16' height='58' fill='%23001f3f'/%3E%3Crect x='266' y='32' width='20' height='48' fill='%23001f3f'/%3E%3Crect x='290' y='12' width='18' height='68' fill='%23001f3f'/%3E%3Crect x='313' y='18' width='24' height='62' fill='%23001f3f'/%3E%3Crect x='342' y='38' width='14' height='42' fill='%23001f3f'/%3E%3Crect x='360' y='25' width='20' height='55' fill='%23001f3f'/%3E%3C/svg%3E\")",
                            backgroundSize: "cover",
                            backgroundPosition: "bottom",
                            backgroundRepeat: "no-repeat",
                          }}
                        />
                        {active && (
                          <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#001f3f] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active ? "bg-[#001f3f] text-white" : "bg-white text-[#374151] border border-[#e4e7ec] group-hover:bg-[#001f3f] group-hover:text-white"}`}>
                          {icon}
                        </div>
                        <div>
                          <p className={`font-['Outfit'] font-bold text-[15px] mb-1 transition-colors ${active ? "text-[#001f3f]" : "text-[#111827]"}`}>{title}</p>
                          <p className="text-xs text-[#6b7280] leading-relaxed">{desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {errors.accountType && <p className="mt-3 text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.accountType}</p>}
              </StepCard>
            )}

            {/* ── Step 1: Account Information ── */}
            {step === 1 && (
              <StepCard title="Your Information" subtitle="Enter your personal and login details." onBack={back} onNext={next}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" error={errors.firstName}>
                      <input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Ahmed" className={inputCls} />
                    </Field>
                    <Field label="Last Name" error={errors.lastName}>
                      <input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Al Rashidi" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Email Address" error={errors.email}>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                        <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" className={`${inputCls} pl-10`} />
                      </div>
                  </Field>
                  {form.accountType === "developer" && (
                    <Field label="Company Name" error={errors.companyName}>
                      <input value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="EMAAR Properties" className={inputCls} />
                    </Field>
                  )}
                  <Field label="Password" error={errors.password}>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                        <input type={showPassword ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min. 8 characters" className={`${inputCls} pl-10 pr-11`} />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={form.password} />
                  </Field>
                  <Field label="Confirm Password" error={errors.confirmPassword}>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                        <input type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Re-enter password" className={`${inputCls} pl-10 pr-11`} />
                      <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </div>
              </StepCard>
            )}

            {/* ── Step 2: ID Upload (salesperson) ── */}
            {isSalesperson && step === 2 && (
              <StepCard title="Identity Documents" subtitle="Upload a clear photo or scan of your government-issued IDs. Both front sides are required." onBack={back} onNext={next}>
                <div className="space-y-6">
                  <UploadZone
                    label="Primary ID (Emirates ID / Passport)"
                    idFile={form.primaryId}
                    onFile={f => set("primaryId", makeIdFile(f))}
                    onCamera={() => setCamera({ open: true, target: "primary" })}
                  />
                  {errors.primaryId && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.primaryId}</p>}
                  <div className="border-t border-[#f0f2f5]" />
                  <UploadZone
                    label="Secondary ID (Driver's License / Visa)"
                    idFile={form.secondaryId}
                    onFile={f => set("secondaryId", makeIdFile(f))}
                    onCamera={() => setCamera({ open: true, target: "secondary" })}
                  />
                  {errors.secondaryId && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.secondaryId}</p>}
                </div>
              </StepCard>
            )}

            {/* ── Step 3: OCR / Document Review (salesperson) ── */}
            {isSalesperson && step === 3 && (
              <StepCard
                title="ID Scan & Review"
                subtitle="We'll try to extract your details from the uploaded ID. Review and correct any information below."
                onBack={back}
                onNext={next}
              >
                <div className="space-y-5">
                  {form.primaryId.preview && form.primaryId.file?.type !== "application/pdf" && (
                    <div className="rounded-2xl overflow-hidden border border-[#e5e7eb] h-36">
                      <img src={form.primaryId.preview} alt="Primary ID" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <button
                    onClick={runOcr}
                    disabled={ocrLoading}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#001f3f]/25 hover:border-[#001f3f] bg-[#f0f4f8] hover:bg-white text-sm font-semibold text-[#001f3f] disabled:opacity-50 transition-all duration-200"
                  >
                    {ocrLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning&hellip;</> : <><ScanLine className="w-4 h-4" /> Analyze Document</>}
                  </button>
                  {ocrWarning && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{ocrWarning}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Full Name as on ID">
                      <input value={form.ocrData.name} onChange={e => setOcr("name", e.target.value)} placeholder="As shown on your document" className={inputCls} />
                    </Field>
                    <Field label="ID / Passport Number">
                      <input value={form.ocrData.idNumber} onChange={e => setOcr("idNumber", e.target.value)} placeholder="784-XXXX-XXXXXXX-X" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date of Birth">
                        <input type="date" value={form.ocrData.dateOfBirth} onChange={e => setOcr("dateOfBirth", e.target.value)} className={inputCls} />
                      </Field>
                      <Field label="Expiry Date">
                        <input type="date" value={form.ocrData.expiryDate} onChange={e => setOcr("expiryDate", e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Country Code">
                      <input value={form.ocrData.countryCode} onChange={e => setOcr("countryCode", e.target.value)} placeholder="AE" maxLength={3} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </StepCard>
            )}

            {/* ── Step 4: Face Verification (salesperson) ── */}
            {isSalesperson && step === 4 && (
              <StepCard
                title="Face Verification"
                subtitle="Capture a quick selfie to verify your identity against your submitted ID."
                onBack={back}
                onNext={next}
                nextDisabled={!form.faceBlob}
              >
                <div className="space-y-5">
                  {form.facePreview ? (
                    <div className="space-y-4">
                      <div className="relative rounded-2xl overflow-hidden border-2 border-[#d6b357]/40 bg-black aspect-square max-h-64 flex items-center justify-center mx-auto w-64">
                        <img src={form.facePreview} alt="Selfie" className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={() => { set("faceBlob", null); set("facePreview", "") }}
                        className="w-full py-3 rounded-xl border border-[#e5e7eb] text-sm font-semibold text-[#374151] hover:bg-[#f9fafb] flex items-center justify-center gap-2 transition-all"
                      ><RotateCcw className="w-4 h-4" /> Retake Selfie</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] aspect-square max-h-64 flex flex-col items-center justify-center gap-3 mx-auto w-64">
                        <Scan className="w-10 h-10 text-[#c4c9d4]" />
                        <p className="text-sm text-[#6b7280] font-medium">No selfie captured yet</p>
                      </div>
                      <button
                        onClick={() => setCamera({ open: true, target: "face" })}
                        className="w-full py-3.5 px-4 flex items-center justify-center gap-2 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl shadow-[0_4px_16px_-2px_rgba(0,31,63,0.30)] hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <Camera className="w-4 h-4" /> Open Camera
                      </button>
                    </div>
                  )}
                  {errors.face && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.face}</p>}
                </div>
              </StepCard>
            )}

            {/* ── Final step: Review & Submit ── */}
            {step === lastStep && (
              <StepCard
                title="Almost done!"
                subtitle="Review your details and submit your application for admin approval."
                onBack={back}
                onNext={submit}
                nextLabel="Create Account"
                loading={submitting}
              >
                <div className="space-y-3">
                  {[
                    ["Account Type", form.accountType === "salesperson" ? "Salesperson / Agent" : "Developer"],
                    ["Full Name", `${form.firstName} ${form.lastName}`],
                    ["Email", form.email],
                    ...(form.accountType === "developer" && form.companyName ? [["Company", form.companyName] as [string, string]] : []),
                    ...(isSalesperson && form.primaryId.file ? [["Primary ID", form.primaryId.file.name] as [string, string]] : []),
                    ...(isSalesperson && form.secondaryId.file ? [["Secondary ID", form.secondaryId.file.name] as [string, string]] : []),
                    ...(isSalesperson && form.faceBlob ? [["Selfie", "Captured ✓"] as [string, string]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-2.5 border-b border-[#f0f2f5] last:border-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">{k}</span>
                      <span className="text-sm font-medium text-[#111827] text-right truncate max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
                {globalError && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700">{globalError}</p>
                  </div>
                )}
                <div className="mt-5 flex items-start gap-3 p-4 rounded-2xl bg-[#f8faff] border border-[#e0e7ff]">
                  <ShieldCheck className="w-4 h-4 text-[#001f3f] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6b7280] leading-relaxed">New accounts must be approved by an administrator before you can sign in.</p>
                </div>
              </StepCard>
            )}

            <div className="text-center mt-6 space-y-1.5">
              <p className="text-sm text-[#374151]">
                Already have an account?{" "}
                <Link href="/login" className="text-[#d6b357] font-semibold hover:text-[#b8972e] hover:underline transition-colors">Sign in</Link>
              </p>
              <p className="text-[11px] text-[#c4c9d4]">© {new Date().getFullYear()} FHI Global &middot; Dubai, UAE</p>
            </div>
          </>
        )}
      </div>

      {/* Camera modal */}
      {camera.open && (
        <CameraModal
          title={camera.target === "face" ? "Take a Selfie" : camera.target === "primary" ? "Capture Primary ID" : "Capture Secondary ID"}
          onClose={() => setCamera(c => ({ ...c, open: false }))}
          onCapture={(blob, preview) => {
            if (camera.target === "face") {
              set("faceBlob", blob)
              set("facePreview", preview)
            } else {
              const field: keyof FormState = camera.target === "primary" ? "primaryId" : "secondaryId"
              set(field, { file: new File([blob], `${camera.target}.jpg`, { type: "image/jpeg" }), preview })
            }
          }}
        />
      )}
    </div>
  )
}