"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { X, Mail, ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { OtpInput } from "@/components/auth/otp-input"
import { toast } from "sonner"
import { sendAuthOtp, verifyLoginOtp } from "@/app/(public-page)/(auth)/staff-login/actions"

const RESEND_COOLDOWN = 60

type Step = "email" | "code"

/**
 * Public auth modal (navbar). One passwordless flow that logs in an existing
 * email or creates a new account, via a 6-digit email code + Google. Password
 * sign-in lives on /staff-login for admins only.
 * Mounted only while open (by the parent), so state starts fresh each time.
 */
export function AuthModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [challenge, setChallenge] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [pending, startTransition] = useTransition()

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Lock body scroll while mounted + close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendCode = () => {
    if (pending) return
    startTransition(async () => {
      const res = await sendAuthOtp(email)
      if (res?.error) {
        toast.error(res.error)
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
      // Verify redirects on success (dashboard / complete-profile / account-inactive).
      const res = await verifyLoginOtp(email, code, challenge)
      if (res?.error) toast.error(res.error)
    })
  }

  const resend = () => { if (cooldown === 0 && !pending) sendCode() }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign In to FHI Global Property"
        className="relative w-full max-w-[420px] my-8 bg-white rounded-2xl shadow-[0_30px_90px_-20px_rgba(0,10,30,0.6)] overflow-hidden"
      >
        {/* Navy header band with the brand logo + circular close button */}
        <div className="relative bg-[#001f3f] px-7 py-8 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/FHI_Branding_White.png"
            alt="FHI Global"
            className="h-12 w-auto object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 pt-7 pb-8">
          <h2 className="text-center font-['Outfit'] text-[20px] font-bold text-[#0d1117] mb-6">
            {step === "email" ? "Sign In to FHI Global Property" : "Enter your code"}
          </h2>

          {step === "email" ? (
            <div className="space-y-4">
              {/* Email first */}
              <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full pl-11 pr-5 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
                  />
                </div>

                <SubmitButton pending={pending} label="Continue with Email" busy="Sending code…" />
              </form>

              {/* Divider + Google below */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="flex-1 h-px bg-[#eceef1]" />
                <span className="text-[11px] text-[#adb5bd] font-semibold uppercase tracking-wide">or continue with</span>
                <div className="flex-1 h-px bg-[#eceef1]" />
              </div>

              <GoogleAuthFlow variant="login" />

              <p className="text-center text-xs text-[#9ca3af] pt-1 leading-relaxed">
                New here? Just enter your email — we&apos;ll create your account.
              </p>
            </div>
          ) : (
            /* step === "code" */
            <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-4">
              <p className="text-center text-[13px] text-[#6b7280] -mt-2 mb-1">
                We emailed a 6-digit code to <span className="font-semibold text-[#374151]">{email}</span>.
              </p>

              <OtpInput value={code} onChange={setCode} disabled={pending} autoFocus />

              <SubmitButton pending={pending} label="Continue" busy="Verifying…" />

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode("") }}
                  className="inline-flex items-center gap-1 text-[#6b7280] hover:text-[#001f3f] font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change email
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
        </div>
      </div>
    </div>
  )
}

function SubmitButton({ pending, label, busy }: { pending: boolean; label: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.4)]"
    >
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> {busy}</> : <>{label} <ArrowRight className="w-4 h-4" /></>}
    </button>
  )
}
