"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { X, Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { OtpInput } from "@/components/auth/otp-input"
import { sendLoginOtp, verifyLoginOtp } from "@/app/(public-page)/(auth)/login/actions"
import { sendRegisterOtp, verifyRegisterOtp } from "@/app/(public-page)/(auth)/register/actions"

const RESEND_COOLDOWN = 60

type Mode = "login" | "register"
type Step = "email" | "code" | "done"

/**
 * Public auth modal (navbar). Passwordless: email 6-digit OTP + Google, with a
 * login/register toggle. Password sign-in lives on /login for admins only.
 * Mounted only while open (by the parent), so state starts fresh each time.
 */
export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("login")
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [challenge, setChallenge] = useState("")
  const [error, setError] = useState<string | null>(null)
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
      setError(null)
      const res = mode === "register"
        ? await sendRegisterOtp(email)
        : await sendLoginOtp(email)
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
      setError(null)
      if (mode === "register") {
        const res = await verifyRegisterOtp(email, code, challenge)
        if (res?.error) setError(res.error)
        else if (res?.success) setStep("done")
      } else {
        const res = await verifyLoginOtp(email, code, challenge)
        // Login success redirects server-side; only errors return here.
        if (res?.error) setError(res.error)
      }
    })
  }

  const resend = () => { if (cooldown === 0 && !pending) sendCode() }

  const switchMode = (next: Mode) => {
    setMode(next); setStep("email"); setError(null); setCode("")
  }

  const title =
    step === "done" ? "Check your inbox"
    : mode === "register" ? "Create your FHI Global account"
    : "Log in to your FHI Global account"

  return (
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[420px] my-8 bg-white rounded-2xl shadow-[0_30px_90px_-20px_rgba(0,10,30,0.6)] overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-[#9ca3af] hover:text-[#001f3f] hover:bg-[#f2f4f7] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-7 pt-9 pb-8">
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/FHI_Branding Set_PNG Copies-02.png"
            alt="FHI Global"
            className="h-9 mx-auto object-contain mb-5"
          />

          <h2 className="text-center font-['Outfit'] text-[20px] font-bold text-[#0d1117] mb-6">
            {title}
          </h2>

          {/* ── Success ── */}
          {step === "done" ? (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-[#d6b357]/12 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#d6b357]" />
              </div>
              <p className="text-sm text-[#4b5563] leading-relaxed mb-6">
                Your account was created and is pending approval. An administrator will activate it before you can sign in.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold transition-colors"
              >
                Done
              </button>
            </div>
          ) : step === "email" ? (
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

                {error && <ErrorBox message={error} />}

                <SubmitButton pending={pending} label={mode === "register" ? "Sign up with Email" : "Continue with Email"} busy="Sending code…" />
              </form>

              {/* Divider + Google below */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="flex-1 h-px bg-[#eceef1]" />
                <span className="text-[11px] text-[#adb5bd] font-semibold uppercase tracking-wide">or continue with</span>
                <div className="flex-1 h-px bg-[#eceef1]" />
              </div>

              <GoogleAuthFlow variant={mode} />

              <p className="text-center text-sm text-[#6b7280] pt-2">
                {mode === "register" ? (
                  <>Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("login")} className="text-[#001f3f] font-bold hover:underline">Log in</button>
                  </>
                ) : (
                  <>New to FHI Global?{" "}
                    <button type="button" onClick={() => switchMode("register")} className="text-[#001f3f] font-bold hover:underline">Create an account</button>
                  </>
                )}
              </p>
            </div>
          ) : (
            /* step === "code" */
            <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-4">
              <p className="text-center text-[13px] text-[#6b7280] -mt-2 mb-1">
                We emailed a 6-digit code to <span className="font-semibold text-[#374151]">{email}</span>.
              </p>
              <OtpInput value={code} onChange={setCode} disabled={pending} autoFocus />

              {error && <ErrorBox message={error} />}

              <SubmitButton pending={pending} label={mode === "register" ? "Create account" : "Log in"} busy="Verifying…" />

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setError(null) }}
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

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <span className="text-rose-400 mt-px text-sm leading-none">✕</span>
      <p className="text-sm text-rose-700">{message}</p>
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
