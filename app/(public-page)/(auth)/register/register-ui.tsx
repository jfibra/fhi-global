"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight, Check, Loader2, ArrowLeft,
  CheckCircle2, Mail, KeyRound, AlertCircle,
  Building2, TrendingUp, DollarSign, User, FileText, UserPlus, Sparkles,
} from "lucide-react"
import { roleToLabel } from "@/lib/app-roles"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { sendRegisterOtp, verifyRegisterOtp } from "@/app/(public-page)/(auth)/register/actions"

/** Public display info for the inviter behind ?ref (resolved server-side). */
export type Referrer = { name: string; role: string; avatarUrl: string | null } | null

const RESEND_COOLDOWN = 60

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

/** Right panel when someone arrives through an invite link (?ref resolved). */
function ReferralHero({ referrer }: { referrer: NonNullable<Referrer> }) {
  const initial = referrer.name.charAt(0).toUpperCase()
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/12 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-md mb-9">
        <Sparkles className="w-3.5 h-3.5 text-[#d6b357]" />
        Sign up under a referral
      </div>

      <div className="relative w-28 h-28 mx-auto mb-6">
        {referrer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referrer.avatarUrl}
            alt={referrer.name}
            className="w-full h-full rounded-full object-cover ring-4 ring-[#d6b357] shadow-[0_18px_50px_-12px_rgba(0,10,30,0.7)]"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-br from-[#012a55] to-[#003a73] ring-4 ring-[#d6b357] flex items-center justify-center text-[44px] font-bold text-white shadow-[0_18px_50px_-12px_rgba(0,10,30,0.7)]">
            {initial}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#d6b357] ring-4 ring-[#001f3f] flex items-center justify-center">
          <UserPlus className="w-4.5 h-4.5 text-[#001f3f]" />
        </div>
      </div>

      <p className="text-white/70 text-sm font-medium drop-shadow-[0_2px_8px_rgba(0,10,30,0.8)]">You&apos;re registering under the referral of</p>
      <h2 className="font-['Outfit'] text-4xl xl:text-[42px] font-bold text-white leading-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.7)] mt-1 mb-3">
        {referrer.name}
      </h2>
      <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#d6b357]/20 border border-[#d6b357]/45 text-[#f0d890] text-xs font-bold uppercase tracking-[0.15em] mb-8">
        {roleToLabel(referrer.role)}
      </span>

      <div className="flex items-start gap-3 text-left bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md p-5">
        <div className="w-9 h-9 rounded-full bg-[#d6b357] flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-[#001f3f]" />
        </div>
        <p className="text-sm text-white/85 leading-relaxed">
          Complete your sign-up and your account will be registered under{" "}
          <span className="font-bold text-white">{referrer.name}</span>&apos;s referral, joining their FHI Global network.
        </p>
      </div>
    </div>
  )
}

/** Default right panel (no invite) — the marketing hero over the photo. */
function MarketingHero({ isDeveloper }: { isDeveloper: boolean }) {
  const features = isDeveloper
    ? [
        { title: "Developer network", desc: "Manage your Dubai developer relationships.", icon: Building2 },
        { title: "Sales tracking", desc: "Track purchases, commissions, and performance.", icon: TrendingUp },
        { title: "Premium listings", desc: "Access premium project listings and media.", icon: FileText },
      ]
    : [
        { title: "Browse buy & rent", desc: "Search published listings anytime after you sign in.", icon: Building2 },
        { title: "Your profile", desc: "Keep contact details current for the team.", icon: User },
        { title: "Support", desc: "Open tickets when you need help.", icon: FileText },
      ]

  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/12 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-md mb-5">
        <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
        {isDeveloper ? "Developer registration" : "Member registration"}
      </div>

      <h1 className="font-['Outfit'] text-4xl xl:text-5xl font-bold text-white drop-shadow-[0_2px_16px_rgba(0,10,30,0.6)] mb-4 leading-tight tracking-tight">
        {isDeveloper ? "List and manage projects " : "Join FHI Global "}
        <span className="relative inline-block">
          <span className="relative z-10">{isDeveloper ? "as a developer" : "as a member"}</span>
          <span
            className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]"
            aria-hidden
          />
        </span>
      </h1>

      <p className="text-white/85 drop-shadow-[0_1px_8px_rgba(0,10,30,0.7)] text-base leading-relaxed mb-8 max-w-lg mx-auto">
        {isDeveloper
          ? "Create your developer account to publish projects, manage media, and track listing performance on FHI Global."
          : "Browse properties for sale and rent, manage your profile, and use support. Sales agent accounts are created by an administrator—contact us if you need CRM and listing tools."}
      </p>

      <div className="flex items-center justify-center gap-10 xl:gap-14 mb-8 py-5 border-y border-white/15">
        {[
          { icon: Building2, value: "100+", label: "Developers" },
          { icon: TrendingUp, value: "500+", label: "Projects" },
          { icon: DollarSign, value: "1K+", label: "Deals closed" },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 text-[#d6b357]">
              <Icon className="w-4 h-4" />
              <span className="font-['Outfit'] text-xl font-bold text-white drop-shadow-[0_1px_6px_rgba(0,10,30,0.7)]">{value}</span>
            </div>
            <span className="text-[11px] text-white/70 font-medium">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        {features.map(({ title, desc, icon: Icon }) => (
          <div key={title} className="flex flex-col gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#d6b357] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#001f3f]" />
              </div>
              <span className="text-sm font-bold text-white">{title}</span>
            </div>
            <p className="text-xs text-white/75 leading-relaxed pl-8">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RegisterUI({
  defaultAccountType = "member",
  inviteRef = null,
  referrer = null,
}: {
  defaultAccountType?: "member" | "developer"
  inviteRef?: string | null
  referrer?: Referrer
}) {
  const [step, setStep]         = useState<"email" | "code">("email")
  const [email, setEmail]       = useState("")
  const [code, setCode]         = useState("")
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [pending, startTransition] = useTransition()

  const isDeveloper = defaultAccountType === "developer"

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendCode = () => {
    if (pending) return
    startTransition(async () => {
      setError("")
      const res = await sendRegisterOtp(email, defaultAccountType, inviteRef ?? undefined)
      if (res?.error) {
        setError(res.error)
      } else {
        setStep("code")
        setCode("")
        setCooldown(RESEND_COOLDOWN)
      }
    })
  }

  const verify = () => {
    if (pending) return
    startTransition(async () => {
      setError("")
      const res = await verifyRegisterOtp(email, code, defaultAccountType, inviteRef ?? undefined)
      if (res?.error) setError(res.error)
      else if (res?.success) setSuccess(true)
    })
  }

  const resend = () => {
    if (cooldown > 0 || pending) return
    sendCode()
  }

  const changeEmail = () => {
    setStep("email")
    setCode("")
    setError("")
  }

  return (
    <div className="flex min-h-screen font-sans">
      {/* ══════════════════════ LEFT: registration form ══════════════════════ */}
      <div className="w-full lg:w-[430px] xl:w-[470px] shrink-0 bg-gradient-to-b from-[#00274f] via-[#001f3f] to-[#00142a] lg:h-screen lg:overflow-y-auto">
        <div className="min-h-full flex flex-col px-6 sm:px-8 lg:px-10 py-7">

          {/* Logo */}
          <Link href="/" className="shrink-0 inline-block w-fit" aria-label="Go to homepage">
            <Image
              src="/FHI_Branding_White.png"
              alt="FHI Global Property Dubai"
              width={200}
              height={80}
              priority
              className="h-12 w-auto object-contain"
            />
          </Link>

          {/* Center: form */}
          <div className="flex-1 flex flex-col justify-center py-8">
            <div className="w-full max-w-sm mx-auto">
              {success ? (
                <div className="bg-white rounded-[20px] border border-[#e8eaed] shadow-[0_18px_50px_-24px_rgba(0,10,30,0.35)] overflow-hidden text-center">
                  <div className="px-8 py-10">
                    <div className="w-20 h-20 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-[#d6b357]" />
                    </div>
                    <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">Account created</h2>
                    <p className="text-[#6b7280] text-sm mb-8 leading-relaxed">
                      {isDeveloper
                        ? "Your email is verified. An administrator will review and approve your developer access before you can sign in."
                        : "Your email is verified. An administrator will review and approve your account before you can sign in and use the member portal."}
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
                  <div className="bg-white rounded-[20px] border border-[#e8eaed] shadow-[0_18px_50px_-24px_rgba(0,10,30,0.35)] p-6 space-y-4">
                    {/* Title */}
                    <div className="mb-1">
                      <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">
                        {step === "email" ? "Sign up" : "Enter your code"}
                      </h2>
                      <p className="text-sm text-[#6b7280] mt-1">
                        {step === "email"
                          ? (isDeveloper ? "Create your developer account with just your email." : "Create your account with just your email.")
                          : <>We emailed a verification code to <span className="font-semibold text-[#374151]">{email}</span>.</>}
                      </p>
                    </div>

                    {step === "email" ? (
                      <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-4">
                        <Field label="Email address">
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@example.com"
                              required
                              autoFocus
                              className={`${inputCls} pl-10`}
                              autoComplete="email"
                            />
                          </div>
                        </Field>

                        {error && <ErrorBox message={error} />}

                        <button
                          type="submit"
                          disabled={pending}
                          className="w-full flex items-center justify-center gap-2 px-7 py-3.5 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.50)] hover:-translate-y-0.5 transition-all duration-200"
                        >
                          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                          {pending ? "Sending code…" : "Send code"}
                          {!pending && <ArrowRight className="w-4 h-4" />}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-4">
                        <Field label="Verification code">
                          <div className="relative">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              pattern="[0-9]*"
                              maxLength={10}
                              value={code}
                              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                              placeholder="Enter code"
                              required
                              autoFocus
                              className={`${inputCls} pl-10 text-center text-lg font-semibold tracking-[0.3em]`}
                            />
                          </div>
                        </Field>

                        {error && <ErrorBox message={error} />}

                        <button
                          type="submit"
                          disabled={pending}
                          className="w-full flex items-center justify-center gap-2 px-7 py-3.5 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.50)] hover:-translate-y-0.5 transition-all duration-200"
                        >
                          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                          {pending ? "Verifying…" : "Create account"}
                          {!pending && <ArrowRight className="w-4 h-4" />}
                        </button>

                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <button
                            type="button"
                            onClick={changeEmail}
                            className="inline-flex items-center gap-1 text-[#6b7280] hover:text-[#001f3f] font-semibold transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Change email
                          </button>
                          <button
                            type="button"
                            onClick={resend}
                            disabled={cooldown > 0}
                            className="text-[#001f3f] font-semibold hover:underline disabled:text-[#9ca3af] disabled:no-underline disabled:cursor-not-allowed"
                          >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-[#f0f0f0]" />
                      <span className="text-[10px] text-[#bbb] uppercase tracking-widest font-semibold">Or continue with Google</span>
                      <div className="flex-1 h-px bg-[#f0f0f0]" />
                    </div>

                    {/* Google sign-up (auto-imports Leuterio Realty agent details) */}
                    <GoogleAuthFlow variant="register" inviteRef={inviteRef} />
                  </div>

                  {isDeveloper && (
                    <p className="text-sm text-white/70 text-center mt-5">
                      Creating a member account instead?{" "}
                      <Link href="/register" className="text-[#d6b357] font-semibold hover:underline">
                        Use member registration
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom row: homepage (left) · sign in (right) */}
          <div className="shrink-0 flex items-center justify-between gap-4 text-sm">
            <Link
              href="/"
              className="text-white/70 hover:text-white font-semibold transition-colors"
            >
              ← Homepage
            </Link>
            <p className="text-white/70">
              Already have an account?{" "}
              <Link href="/login" className="text-[#d6b357] font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════ RIGHT: photo + context ══════════════════════ */}
      <div className="hidden lg:block relative flex-1 overflow-hidden">
        <Image
          src="/background/developers.webp"
          alt="Dubai skyline"
          fill
          priority
          sizes="60vw"
          className="object-cover"
        />
        {/* Readability scrim for the overlaid content */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#00122a]/80 via-[#001f3f]/35 to-[#001f3f]/40" />
        <div className="relative z-10 h-full flex flex-col justify-center px-10 xl:px-16 py-12">
          {referrer ? <ReferralHero referrer={referrer} /> : <MarketingHero isDeveloper={isDeveloper} />}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
      <p className="text-xs text-rose-700">{message}</p>
    </div>
  )
}
