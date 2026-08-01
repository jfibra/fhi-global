"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Mail, AlertCircle, Info, Phone,
} from "lucide-react"
import { roleToLabel } from "@/lib/app-roles"
import { nationalityFlag } from "@/lib/nationalities"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { OtpInput } from "@/components/auth/otp-input"
import { sendRegisterOtp, verifyRegisterOtp } from "@/app/(public-page)/(auth)/register/actions"

/** Public display info for the inviter behind ?ref (resolved server-side). */
export type Referrer = { name: string; role: string; avatarUrl: string | null; nationality: string | null; email: string | null; phone: string | null } | null

const RESEND_COOLDOWN = 60

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

/** Compact sponsor card (no photo) shown above the form for referral links. */
function SponsorCard({ referrer }: { referrer: NonNullable<Referrer> }) {
  const flag = nationalityFlag(referrer.nationality)
  return (
    <div className="mb-6 rounded-xl border border-[#e8eaed] bg-[#f8faff] p-4 text-left">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2.5">You&apos;re registering under</p>
      <div className="flex items-center gap-2">
        {flag && <span className="text-lg leading-none shrink-0">{flag}</span>}
        <p className="text-sm font-bold text-[#0d1117] truncate">{referrer.name}</p>
        <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#b8913f] bg-[#d6b357]/15 border border-[#d6b357]/30 rounded-full px-2 py-0.5">
          {roleToLabel(referrer.role)}
        </span>
      </div>
      {(referrer.email || referrer.phone) && (
        <div className="mt-2.5 space-y-1.5 text-xs text-[#6b7280]">
          {referrer.email && (
            <p className="flex items-center gap-1.5 break-all"><Mail className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" /> {referrer.email}</p>
          )}
          {referrer.phone && (
            <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" /> {referrer.phone}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** "Confirm your Sponsor" modal — shown once on load for a referral link. */
function ConfirmSponsorModal({ referrer, onConfirm }: { referrer: NonNullable<Referrer>; onConfirm: () => void }) {
  const flag = nationalityFlag(referrer.nationality)
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-7 pt-7">
          <p className="text-lg font-semibold text-[#0d1117]">Confirm your Sponsor:</p>
          <div className="mt-4 border-t border-[#eceef1] pt-5 pb-6 space-y-3">
            <div className="flex items-center gap-2.5">
              {flag && <span className="text-2xl leading-none">{flag}</span>}
              <p className="text-lg font-bold text-[#0d1117]">{referrer.name}</p>
            </div>
            {referrer.email && (
              <p className="flex items-center gap-2.5 text-[15px] text-[#374151] break-all">
                <Mail className="w-4 h-4 text-[#9ca3af] shrink-0" /> {referrer.email}
              </p>
            )}
            {referrer.phone && (
              <p className="flex items-center gap-2.5 text-[15px] text-[#374151]">
                <Phone className="w-4 h-4 text-[#9ca3af] shrink-0" /> {referrer.phone}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3.5 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold uppercase tracking-wide transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

/**
 * Full-page registration (invite links: /register?ref=<id>, and direct sign-up).
 * Passwordless email 6-digit OTP; a valid inviter is shown and stamped for
 * referral tracking. Minimal single-column layout — no split-screen hero.
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
  const [sponsorConfirmed, setSponsorConfirmed] = useState(false)
  const [pending, startTransition] = useTransition()

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
    <div className="min-h-screen bg-[#f6f8fb] flex flex-col items-center justify-center px-4 py-10 font-sans">
      {/* LR-style sponsor confirmation, shown once on load for referral links. */}
      {referrer && !sponsorConfirmed && (
        <ConfirmSponsorModal referrer={referrer} onConfirm={() => setSponsorConfirmed(true)} />
      )}

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-7 flex justify-center" aria-label="Go to homepage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/FHI_Branding Set_PNG Copies-02.png" alt="FHI Global" className="h-16 w-auto object-contain" />
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_10px_40px_-16px_rgba(0,31,63,0.22)] p-7 sm:p-8">
          {referrer && <SponsorCard referrer={referrer} />}

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
              <h1 className="font-['Outfit'] text-[26px] font-bold text-[#0d1117] leading-tight mb-4 text-left">
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
