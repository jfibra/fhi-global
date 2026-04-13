"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Check, X, Loader2,
  Building2, TrendingUp, DollarSign, CheckCircle2, ShieldCheck,
  User, Mail, Lock, AlertCircle, FileText,
} from "lucide-react"

type AccountType = "member" | "developer" | ""

interface FormState {
  accountType: AccountType
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  companyName: string
}

const INITIAL_STATE: FormState = {
  accountType: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  companyName: "",
}

const PWD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Contains special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  return (
    <div className="mt-3 rounded-xl border border-[#e8eaed] bg-[#f9fafb] px-4 py-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#9ca3af]">Password Requirements</p>
      {PWD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <div key={rule.label} className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                ok ? "bg-emerald-500" : "bg-[#e5e7eb]"
              }`}
            >
              {ok ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2 h-2 text-[#9ca3af]" />}
            </span>
            <span className={`text-xs transition-colors ${ok ? "text-emerald-700 font-medium" : "text-[#6b7280]"}`}>
              {rule.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function allPwdRulesPassed(p: string) {
  return PWD_RULES.every((r) => r.test(p))
}

const STEPS = ["Information", "Complete"]

function Stepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        const last = i === steps.length - 1
        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  done
                    ? "bg-[#001f3f] text-white"
                    : active
                      ? "bg-[#001f3f] text-white shadow-[0_0_0_4px_rgba(0,31,63,0.12)]"
                      : "bg-[#f0f2f5] text-[#adb5bd] border border-[#e4e7ec]"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <span className="text-sm">{i + 1}</span>}
              </div>
              <span
                className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors ${
                  active ? "text-[#001f3f]" : done ? "text-[#6b7280]" : "text-[#c4c9d4]"
                }`}
              >
                {label}
              </span>
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

function StepCard({
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
  hideBack = false,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  hideBack?: boolean
}) {
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
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#001f3f] transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {onNext && (
            <button
              type="button"
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

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  )
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

export function RegisterUI({ defaultAccountType = "member" }: { defaultAccountType?: "member" | "developer" }) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>({ ...INITIAL_STATE, accountType: defaultAccountType })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const isDeveloper = form.accountType === "developer"

  const set = (key: keyof FormState, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!form.firstName.trim()) e.firstName = "Required"
      if (!form.lastName.trim()) e.lastName = "Required"
      if (!form.email.trim()) e.email = "Required"
      if (!form.password) e.password = "Required"
      else if (!allPwdRulesPassed(form.password)) e.password = "Password does not meet requirements"
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match"
      if (form.accountType === "developer" && !form.companyName.trim()) e.companyName = "Required"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validate(step)) setStep((s) => s + 1)
  }
  const back = () => {
    setStep((s) => s - 1)
    setErrors({})
  }

  const submit = async () => {
    if (!validate(0)) return
    setSubmitting(true)
    setGlobalError("")
    try {
      const fd = new FormData()
      fd.append("accountType", form.accountType)
      fd.append("firstName", form.firstName)
      fd.append("lastName", form.lastName)
      fd.append("email", form.email)
      fd.append("password", form.password)
      fd.append("companyName", form.companyName)
      const res = await fetch("/api/register", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Registration failed")
      setSuccess(true)
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Something went wrong")
    }
    setSubmitting(false)
  }

  const lastStep = STEPS.length - 1

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] font-sans overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[130px] -z-10 bg-[radial-gradient(circle,rgb(180,235,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(255,240,200)_0%,rgba(255,255,255,0)_70%)]" />

      <div className="bg-white border-b border-[#eaecf0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#e4e7ec] rounded-full text-xs font-semibold text-[#374151] mb-5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
            {isDeveloper ? "Developer registration" : "Member registration"}
          </div>
          <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-bold text-[#0d1117] mb-3 leading-tight tracking-tight">
            {isDeveloper ? (
              <>
                List and manage projects{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">as a developer</span>
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]"
                    aria-hidden
                  />
                </span>
              </>
            ) : (
              <>
                Join FHI Global{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">as a member</span>
                  <span
                    className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]"
                    aria-hidden
                  />
                </span>
              </>
            )}
          </h1>
          <p className="text-[#6b7280] text-base leading-relaxed mb-8 max-w-xl mx-auto">
            {isDeveloper
              ? "Create your developer account to publish projects, manage media, and track listing performance on FHI Global."
              : "Browse properties for sale and rent, manage your profile, and use support. Sales agent accounts are created by an administrator—contact us if you need CRM and listing tools."}
          </p>
          <div className="flex items-center justify-center gap-8 sm:gap-14 mb-8 py-5 border-y border-[#f0f0f0]">
            {[
              { icon: <Building2 className="w-4 h-4" />, value: "100+", label: "Developers" },
              { icon: <TrendingUp className="w-4 h-4" />, value: "500+", label: "Projects" },
              { icon: <DollarSign className="w-4 h-4" />, value: "1K+", label: "Deals closed" },
            ].map(({ icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5 text-[#d6b357]">
                  {icon}
                  <span className="font-['Outfit'] text-xl font-bold text-[#001f3f]">{value}</span>
                </div>
                <span className="text-[11px] text-[#9ca3af] font-medium">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              isDeveloper
                ? [
                    {
                      title: "Developer network",
                      desc: "Manage your Dubai developer relationships.",
                      icon: <Building2 className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                    {
                      title: "Sales tracking",
                      desc: "Track purchases, commissions, and performance.",
                      icon: <TrendingUp className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                    {
                      title: "Premium listings",
                      desc: "Access premium project listings and media.",
                      icon: <FileText className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                  ]
                : [
                    {
                      title: "Browse buy & rent",
                      desc: "Search published listings anytime after you sign in.",
                      icon: <Building2 className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                    {
                      title: "Your profile",
                      desc: "Keep contact details current for the team.",
                      icon: <User className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                    {
                      title: "Support",
                      desc: "Open tickets when you need help.",
                      icon: <FileText className="w-3.5 h-3.5 text-[#001f3f]" />,
                    },
                  ]
            ).map(({ title, desc, icon }) => (
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

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {success ? (
          <div className="bg-white rounded-[20px] border border-[#e4e7ec] shadow-[0_2px_24px_-4px_rgba(0,31,63,0.10)] overflow-hidden text-center">
            <div className="px-8 py-10">
              <div className="w-20 h-20 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#d6b357]" />
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">Account created</h2>
              <p className="text-[#6b7280] text-sm mb-8 leading-relaxed max-w-md mx-auto">
                {isDeveloper
                  ? "Check your email to confirm your account. An administrator will review and approve your developer access before you can sign in."
                  : "Check your email to confirm your account. After approval, you can sign in to browse buy/rent listings and use the member portal. Ask your admin if you need a sales agent account."}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl shadow-[0_4px_16px_-2px_rgba(0,31,63,0.35)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Go to sign in <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Stepper current={step} steps={STEPS} />

            {step === 0 && (
              <StepCard
                title="Your information"
                subtitle="Enter your personal and login details."
                onBack={back}
                onNext={next}
                hideBack
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name" error={errors.firstName}>
                      <input
                        value={form.firstName}
                        onChange={(e) => set("firstName", e.target.value)}
                        placeholder="Ahmed"
                        className={inputCls}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label="Last name" error={errors.lastName}>
                      <input
                        value={form.lastName}
                        onChange={(e) => set("lastName", e.target.value)}
                        placeholder="Al Rashidi"
                        className={inputCls}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>
                  <Field label="Email address" error={errors.email}>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="you@example.com"
                        className={`${inputCls} pl-10`}
                        autoComplete="email"
                      />
                    </div>
                  </Field>
                  {form.accountType === "developer" && (
                    <Field label="Company name" error={errors.companyName}>
                      <input
                        value={form.companyName}
                        onChange={(e) => set("companyName", e.target.value)}
                        placeholder="EMAAR Properties"
                        className={inputCls}
                        autoComplete="organization"
                      />
                    </Field>
                  )}
                  <Field label="Password" error={errors.password}>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        placeholder="Min. 8 characters"
                        className={`${inputCls} pl-10 pr-11`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={form.password} />
                  </Field>
                  <Field label="Confirm password" error={errors.confirmPassword}>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) => set("confirmPassword", e.target.value)}
                        placeholder="Re-enter password"
                        className={`${inputCls} pl-10 pr-11`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </div>
              </StepCard>
            )}

            {step === lastStep && (
              <StepCard
                title="Almost done"
                subtitle="Review your details and submit your application for admin approval."
                onBack={back}
                onNext={submit}
                nextLabel="Create account"
                loading={submitting}
              >
                <div className="space-y-3">
                  {[
                    ["Account type", isDeveloper ? "Developer" : "Member"],
                    ["Full name", `${form.firstName} ${form.lastName}`],
                    ["Email", form.email],
                    ...(form.accountType === "developer" && form.companyName
                      ? ([["Company", form.companyName]] as [string, string][])
                      : []),
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-4 py-2.5 border-b border-[#f0f2f5] last:border-0"
                    >
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
                  <p className="text-xs text-[#6b7280] leading-relaxed">
                    New accounts must be approved by an administrator before you can sign in.
                  </p>
                </div>
              </StepCard>
            )}

            <div className="text-center mt-6 space-y-1.5">
              {isDeveloper && (
                <p className="text-sm text-[#374151]">
                  Creating a member account instead?{" "}
                  <Link href="/register" className="text-[#d6b357] font-semibold hover:text-[#b8972e] hover:underline transition-colors">
                    Use member registration
                  </Link>
                </p>
              )}
              <p className="text-sm text-[#374151]">
                Already have an account?{" "}
                <Link href="/login" className="text-[#d6b357] font-semibold hover:text-[#b8972e] hover:underline transition-colors">
                  Sign in
                </Link>
              </p>
              <p className="text-[11px] text-[#c4c9d4]">© {new Date().getFullYear()} FHI Global · Dubai, UAE</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
