"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Mail, AlertCircle, Info, Phone, MapPin, ChevronDown, MessageCircle,
} from "lucide-react"
import { isoFlagEmoji, nationalityFlag } from "@/lib/nationalities"
import { COUNTRIES, countryByIso, countryByName, countryFlag } from "@/lib/countries"
import { checkPartnerSignupInfo, type PartnerSignupInfo } from "@/lib/partner-signup"
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-2.5">Sponsor</p>
      <div className="flex items-center gap-2">
        {flag && <span className="text-lg leading-none shrink-0">{flag}</span>}
        <p className="text-sm font-bold text-[#0d1117] truncate">{referrer.name}</p>
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
        <div className="px-7 pb-7">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold uppercase tracking-wide transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Full-page registration (invite links: /register?ref=<id>, and direct sign-up).
 * Passwordless email 6-digit OTP; a valid inviter is shown and stamped for
 * referral tracking. Minimal single-column layout — no split-screen hero.
 *
 * The Global Partner invite starts one step earlier (boss, 2026-10-04): "Where
 * are you based?" — the country they live in now and their WhatsApp — so the
 * admins approving them can see where they came from (lib/partner-signup.ts).
 * Both the email code and Google sign-up come after it and carry it along.
 */
export function RegisterUI({
  defaultAccountType = "member",
  inviteRef = null,
  referrer = null,
}: {
  defaultAccountType?: "member" | "developer" | "global_partner"
  inviteRef?: string | null
  referrer?: Referrer
}) {
  const isPartner = defaultAccountType === "global_partner"
  const [step, setStep]         = useState<"info" | "email" | "code">(isPartner ? "info" : "email")
  const [email, setEmail]       = useState("")
  const [code, setCode]         = useState("")
  const [challenge, setChallenge] = useState("")
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sponsorConfirmed, setSponsorConfirmed] = useState(false)
  const [pending, startTransition] = useTransition()

  // Global Partner "Where are you based?" — the WhatsApp code follows the
  // country until they pick another one (kept as an ISO: +1 is shared).
  const [country, setCountry]   = useState("")
  const [waIso, setWaIso]       = useState("")
  const [waNumber, setWaNumber] = useState("")
  const [partnerInfo, setPartnerInfo] = useState<PartnerSignupInfo | null>(null)
  const waCountry = countryByIso(waIso)

  const continueFromInfo = () => {
    const res = checkPartnerSignupInfo({ country, whatsappCode: waCountry?.dial ?? "", whatsappNumber: waNumber })
    if (!res.ok) {
      setError(res.error)
      return
    }
    setError("")
    setPartnerInfo(res.info)
    setStep("email")
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendCode = () => {
    if (pending) return
    startTransition(async () => {
      setError("")
      const res = await sendRegisterOtp(email, defaultAccountType, inviteRef ?? undefined, partnerInfo ?? undefined)
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
      const res = await verifyRegisterOtp(email, code, challenge, defaultAccountType, inviteRef ?? undefined, partnerInfo ?? undefined)
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
                {step === "code" ? "Enter your code" : isPartner ? "Join as a Global Partner" : "Create your account"}
              </h1>

              {/* Info box */}
              <div className="flex items-start gap-2.5 rounded-xl bg-[#eaf3fb] border border-[#d3e6f5] px-4 py-3 mb-5 text-left">
                <Info className="w-4 h-4 text-[#2f6fb0] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#3a5a78] leading-relaxed">
                  {step === "code"
                    ? <>Enter the 6-digit code we sent to <span className="font-semibold">{email}</span>.</>
                    : step === "info"
                      ? <>{referrer ? <>You&apos;re joining <span className="font-semibold">{referrer.name}</span>&apos;s network as an FHI Global Partner. </> : null}First, tell us where you&apos;re based and your WhatsApp number.</>
                    : referrer && defaultAccountType === "global_partner"
                      ? <>You&apos;re joining <span className="font-semibold">{referrer.name}</span>&apos;s network as an FHI Global Partner — enter your email and we&apos;ll send you a code.</>
                    : referrer
                      ? <>You&apos;re joining <span className="font-semibold">{referrer.name}</span>&apos;s network — enter your email and we&apos;ll send you a code.</>
                      : "Enter your email and we'll send you a 6-digit code to finish signing up."}
                </p>
              </div>

              {step === "info" ? (
                <form onSubmit={(e) => { e.preventDefault(); continueFromInfo() }} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="partner-country" className="mb-1.5 block text-xs font-semibold text-[#374151]">Country you live in</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                      <select
                        id="partner-country"
                        value={country}
                        onChange={(e) => {
                          setCountry(e.target.value)
                          const c = countryByName(e.target.value)
                          if (c) setWaIso(c.iso)
                          setError("")
                        }}
                        className={`${inputCls} appearance-none pl-10 pr-9 ${country ? "" : "text-[#9ca3af]"}`}
                      >
                        <option value="" disabled>Select your country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.iso} value={c.name} className="text-[#111827]">{isoFlagEmoji(c.iso)} {c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="partner-whatsapp" className="mb-1.5 block text-xs font-semibold text-[#374151]">WhatsApp number</label>
                    <div className="flex items-stretch gap-2">
                      {/* The code: a native picker under a "🇵🇭 +63" face — easy to use on a phone. */}
                      <div className="relative w-[104px] shrink-0">
                        <select
                          aria-label="WhatsApp country code"
                          value={waIso}
                          onChange={(e) => {
                            setWaIso(e.target.value)
                            setError("")
                          }}
                          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        >
                          <option value="" disabled>Code</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.iso} value={c.iso}>{c.name} ({c.dial})</option>
                          ))}
                        </select>
                        <span className="flex h-full items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] pl-3 pr-7 text-sm tabular-nums text-[#111827] transition-all peer-focus-visible:border-[#001f3f] peer-focus-visible:bg-white peer-focus-visible:ring-4 peer-focus-visible:ring-[#001f3f]/6" aria-hidden>
                          {waCountry ? <>{isoFlagEmoji(waCountry.iso)} {waCountry.dial}</> : <span className="text-[#9ca3af]">Code</span>}
                        </span>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                        <input
                          id="partner-whatsapp"
                          type="tel"
                          inputMode="tel"
                          value={waNumber}
                          onChange={(e) => {
                            setWaNumber(e.target.value)
                            setError("")
                          }}
                          placeholder="917 123 4567"
                          autoComplete="tel-national"
                          maxLength={24}
                          className={`${inputCls} pl-10`}
                        />
                      </div>
                    </div>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton pending={false} label="Continue" busy="" />
                </form>
              ) : step === "email" ? (
                <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-4">
                  {/* A partner's answers from the step before, with a way back to fix them. */}
                  {isPartner && partnerInfo && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8eaed] bg-[#f9fafb] px-3.5 py-2.5 text-xs text-[#4b5563]">
                      <span className="min-w-0">
                        {countryFlag(partnerInfo.country)} Based in <span className="font-semibold text-[#111827]">{partnerInfo.country}</span>
                        <span className="mx-1.5 text-[#d1d5db]">·</span>
                        WhatsApp <span className="tabular-nums">{partnerInfo.whatsappCode} {partnerInfo.whatsappNumber}</span>
                      </span>
                      <button type="button" onClick={() => { setStep("info"); setError("") }} className="shrink-0 font-semibold text-[#001f3f] hover:underline">
                        Edit
                      </button>
                    </div>
                  )}
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

              {/* Google comes after the partner step too, and carries it along. */}
              {step !== "info" && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-[#eceef1]" />
                    <span className="text-[10px] text-[#adb5bd] uppercase tracking-widest font-semibold">or</span>
                    <div className="flex-1 h-px bg-[#eceef1]" />
                  </div>

                  <GoogleAuthFlow
                    variant="register"
                    inviteRef={inviteRef}
                    accountType={isPartner ? "global_partner" : null}
                    signupInfo={isPartner ? partnerInfo : null}
                  />
                </>
              )}

              <p className="text-center text-sm text-[#6b7280] mt-6">
                Already have an account?{" "}
                <Link href="/staff-login" className="text-[#001f3f] font-bold hover:underline">Sign in</Link>
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
