"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Mail, AlertCircle,
  Sparkles, UserPlus, Check, Building2, TrendingUp, User, FileText, Info,
} from "lucide-react"
import { roleToLabel } from "@/lib/app-roles"
import { nationalityFlag } from "@/lib/nationalities"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { OtpInput } from "@/components/auth/otp-input"
import { sendRegisterOtp, verifyRegisterOtp } from "@/app/(public-page)/(auth)/register/actions"

/** Public display info for the inviter behind ?ref (resolved server-side). */
export type Referrer = { name: string; role: string; avatarUrl: string | null; nationality: string | null } | null

const RESEND_COOLDOWN = 60

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

function Avatar({ referrer, size }: { referrer: NonNullable<Referrer>; size: number }) {
  const initial = referrer.name.charAt(0).toUpperCase()
  return referrer.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={referrer.avatarUrl} alt={referrer.name} width={size} height={size} className="rounded-full object-cover w-full h-full" />
  ) : (
    <div
      className="w-full h-full rounded-full bg-gradient-to-br from-[#012a55] to-[#0a4a86] flex items-center justify-center font-bold text-white"
      style={{ fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}

/** Compact "invited by" strip shown above the form on mobile. */
function InvitedByChip({ referrer }: { referrer: NonNullable<Referrer> }) {
  return (
    <div className="lg:hidden flex items-center gap-3 rounded-2xl border border-[#e8eaed] bg-[#f8faff] px-4 py-3 mb-5">
      <span className="relative w-11 h-11 shrink-0">
        <span className="block w-full h-full rounded-full ring-2 ring-[#d6b357]"><Avatar referrer={referrer} size={44} /></span>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Invited by</p>
        <p className="text-sm font-bold text-[#0d1117] truncate">
          {nationalityFlag(referrer.nationality) && <span className="mr-1.5">{nationalityFlag(referrer.nationality)}</span>}
          {referrer.name}
        </p>
      </div>
      <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#b8913f] bg-[#d6b357]/15 border border-[#d6b357]/30 rounded-full px-2.5 py-1">
        {roleToLabel(referrer.role)}
      </span>
    </div>
  )
}

/** Right panel over the photo — the inviter (referral links). */
function ReferralHero({ referrer }: { referrer: NonNullable<Referrer> }) {
  return (
    <div className="max-w-md mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/12 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-md mb-9">
        <Sparkles className="w-3.5 h-3.5 text-[#d6b357]" />
        Sign up under a referral
      </div>

      <div className="relative w-28 h-28 mx-auto mb-6">
        <span className="block w-full h-full rounded-full ring-4 ring-[#d6b357] shadow-[0_18px_50px_-12px_rgba(0,10,30,0.7)] overflow-hidden">
          <Avatar referrer={referrer} size={112} />
        </span>
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#d6b357] ring-4 ring-[#001f3f] flex items-center justify-center">
          <UserPlus className="w-4.5 h-4.5 text-[#001f3f]" />
        </div>
      </div>

      <p className="text-white/70 text-sm font-medium drop-shadow-[0_2px_8px_rgba(0,10,30,0.8)]">You&apos;re registering under the referral of</p>
      <h2 className="font-['Outfit'] text-4xl xl:text-[42px] font-bold text-white leading-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.7)] mt-1 mb-3">
        {referrer.name}
      </h2>
      <div className="flex items-center justify-center flex-wrap gap-2 mb-8">
        <span className="inline-block px-3.5 py-1.5 rounded-full bg-[#d6b357]/20 border border-[#d6b357]/45 text-[#f0d890] text-xs font-bold uppercase tracking-[0.15em]">
          {roleToLabel(referrer.role)}
        </span>
        {nationalityFlag(referrer.nationality) && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/12 border border-white/25 text-white/90 text-xs font-semibold backdrop-blur-md">
            <span className="text-base leading-none">{nationalityFlag(referrer.nationality)}</span>
            {referrer.nationality}
          </span>
        )}
      </div>

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

/** Right panel over the photo — the marketing hero (no valid inviter). */
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
          <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#d6b357] to-[#f0d890]" aria-hidden />
        </span>
      </h1>

      <p className="text-white/85 drop-shadow-[0_1px_8px_rgba(0,10,30,0.7)] text-base leading-relaxed mb-8 max-w-lg mx-auto">
        {isDeveloper
          ? "Create your developer account to publish projects, manage media, and track listing performance on FHI Global."
          : "Browse properties for sale and rent, manage your profile, and use support."}
      </p>

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

/**
 * Full-page registration (invite links: /register?ref=<id>, and direct sign-up).
 * Passwordless email 6-digit OTP; a valid inviter is shown and stamped for
 * referral tracking.
 */
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
  const [challenge, setChallenge] = useState("")
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [pending, startTransition] = useTransition()

  const isDeveloper = defaultAccountType === "developer"

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
        setChallenge(res?.challenge ?? "")
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
      const res = await verifyRegisterOtp(email, code, challenge, defaultAccountType, inviteRef ?? undefined)
      if (res?.error) setError(res.error)
      else if (res?.success) setSuccess(true)
    })
  }

  const resend = () => { if (cooldown === 0 && !pending) sendCode() }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(440px,36%)_1fr] font-sans bg-white">
      {/* ══════════ LEFT: form ══════════ */}
      <div className="relative flex flex-col lg:justify-center px-6 sm:px-10 lg:px-16 py-10 min-h-screen lg:min-h-0">
        {/* Logo: in flow on mobile, absolute at top on desktop (so the form centers over full height) */}
        <div className="mb-8 lg:mb-0 lg:absolute lg:top-20 lg:inset-x-0 lg:px-14">
          <Link href="/" className="inline-block w-fit" aria-label="Go to homepage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/FHI_Branding Set_PNG Copies-02.png" alt="FHI Global" className="h-20 w-auto object-contain mx-auto" />
          </Link>
        </div>

        {/* Form vertically centered in the full panel height */}
        <div className="w-full max-w-[400px] mx-auto text-center">
          {referrer && <InvitedByChip referrer={referrer} />}

          {success ? (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#d6b357]" />
              </div>
              <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">You&apos;re all set</h1>
              <p className="text-[#6b7280] text-sm leading-relaxed mb-8">
                Your email is verified{referrer ? <> and your account is linked to <span className="font-semibold text-[#374151]">{referrer.name}</span></> : ""}.
                An administrator will approve it before you can sign in.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl transition-colors"
              >
                Back to homepage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-['Outfit'] text-[28px] font-bold text-[#0d1117] leading-tight mb-4 text-left">
                {step === "email" ? "Create your account" : "Enter your code"}
              </h1>

              {/* Info box */}
              <div className="flex items-start gap-2.5 rounded-xl bg-[#eaf3fb] border border-[#d3e6f5] px-4 py-3 mb-5 text-left">
                <Info className="w-4 h-4 text-[#2f6fb0] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#3a5a78] leading-relaxed">
                  {step === "code"
                    ? <>Enter the 6-digit code we sent to <span className="font-semibold">{email}</span>.</>
                    : referrer
                      ? <>You&apos;re joining <span className="font-semibold">{referrer.name}</span>&apos;s network — enter your email and we&apos;ll send you a code.</>
                      : "Enter your email and we'll send you a 6-digit code to finish signing up."}
                </p>
              </div>

              {step === "email" ? (
                <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required autoFocus autoComplete="email" className={`${inputCls} pl-10`} />
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton pending={pending} label="Send code" busy="Sending code…" />
                </form>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-4">
                  <OtpInput value={code} onChange={setCode} disabled={pending} autoFocus />

                  {error && <ErrorBox message={error} />}

                  <SubmitButton pending={pending} label="Create account" busy="Verifying…" />

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <button type="button" onClick={() => { setStep("email"); setCode(""); setError("") }} className="inline-flex items-center gap-1 text-[#6b7280] hover:text-[#001f3f] font-semibold transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> Change email
                    </button>
                    <button type="button" onClick={resend} disabled={cooldown > 0} className="text-[#001f3f] font-semibold hover:underline disabled:text-[#9ca3af] disabled:no-underline disabled:cursor-not-allowed">
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#eceef1]" />
                <span className="text-[10px] text-[#adb5bd] uppercase tracking-widest font-semibold">or</span>
                <div className="flex-1 h-px bg-[#eceef1]" />
              </div>

              <GoogleAuthFlow variant="register" inviteRef={inviteRef} />

              <p className="text-center text-sm text-[#6b7280] mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-[#001f3f] font-bold hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ══════════ RIGHT: photo + context (like before) ══════════ */}
      <div className="relative hidden lg:block overflow-hidden">
        <Image src="/background/home.webp" alt="Dubai home" fill priority sizes="50vw" className="object-cover object-right" />
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

function SubmitButton({ pending, label, busy }: { pending: boolean; label: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 px-7 py-3.5 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 transition-all duration-200"
    >
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> {busy}</> : <>{label} <ArrowRight className="w-4 h-4" /></>}
    </button>
  )
}
