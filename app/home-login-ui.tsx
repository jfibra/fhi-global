"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck, Star, MapPin } from "lucide-react"
import { loginAction, type LoginState } from "@/app/login/actions"
import GoogleAuthFlow from "@/components/auth/GoogleAuthFlow"
import { DubaiBackdrop } from "@/components/auth/dubai-backdrop"

const initialState: LoginState = {}

const PILLARS = [
  { icon: Star,   label: "Exclusive Access",  desc: "Curated properties unavailable to the general market." },
  { icon: MapPin, label: "Prime Locations",   desc: "From Downtown Dubai to Palm Jumeirah and beyond." },
  { icon: ShieldCheck, label: "Trusted Network", desc: "Verified developers. Transparent process. Zero guesswork." },
]

// ─── Shared login card (used by both mobile and desktop) ─────────────────────

function LoginCard({
  showPassword,
  togglePassword,
  rememberMe,
  toggleRemember,
  state,
  formAction,
  pending,
  nextRedirect,
}: {
  showPassword: boolean
  togglePassword: () => void
  rememberMe: boolean
  toggleRemember: () => void
  state: { error?: string }
  formAction: (payload: FormData) => void
  pending: boolean
  nextRedirect?: string
}) {
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[28px] ring-1 ring-white/50 shadow-[0_24px_80px_-16px_rgba(0,10,30,0.55)] p-6 lg:p-7">
      {/* Header — brand logo, centered like the approved mockup */}
      <div className="mb-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/FHI_Branding Set_PNG Copies-02.png"
          alt="FHI Global Property Dubai"
          className="h-10 mx-auto object-contain mb-3"
        />
        <h2 className="font-['Outfit'] text-[22px] font-bold text-[#0d1117] mb-1">
          Welcome Back
        </h2>
        <p className="text-[13px] text-[#6b7280] leading-relaxed max-w-[300px] mx-auto">
          Sign in to access your private portal and discover exclusive opportunities.
        </p>
        <span className="block w-10 h-[3px] rounded-full bg-[#d6b357] mx-auto mt-3" />
      </div>

      <form action={formAction} className="space-y-4">
        {nextRedirect ? <input type="hidden" name="next" value={nextRedirect} /> : null}
        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="email"
              type="email"
              placeholder="you@fhiglobal.ae"
              required
              autoComplete="email"
              className="w-full pl-11 pr-5 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="w-full pl-11 pr-12 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"
            />
            <button
              type="button"
              onClick={togglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={toggleRemember}
            className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${
              rememberMe ? "bg-[#001f3f] border-[#001f3f]" : "bg-transparent border-[#d1d5db]"
            }`}
            aria-label="Remember me"
          >
            {rememberMe && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-xs text-[#6b7280] select-none">Keep me signed in for 30 days</span>
        </div>

        {/* Error */}
        {state.error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <span className="text-rose-400 mt-px text-sm leading-none">✕</span>
            <p className="text-sm text-rose-700">{state.error}</p>
          </div>
        )}

        {/* Submit — navy bar with the mockup's gold arrow chip on the right */}
        <button
          type="submit"
          disabled={pending}
          className="group relative w-full py-3 pl-4 pr-14 mt-0.5 bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_-2px_rgba(0,31,63,0.30)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d6b357]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative flex items-center justify-center gap-2">
            {pending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              "Enter Portal"
            )}
          </span>
          {!pending && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-[#d6b357] to-[#b8913f] flex items-center justify-center shadow-md">
              <ArrowRight className="w-4 h-4 text-[#001f3f] group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-[#eceef1]" />
        <span className="text-[10px] text-[#adb5bd] uppercase tracking-widest font-semibold">Or continue with</span>
        <div className="flex-1 h-px bg-[#eceef1]" />
      </div>

      {/* Google sign-in (auto-imports Leuterio Realty agent details) */}
      <GoogleAuthFlow variant="login" nextRedirect={nextRedirect} />

      {/* Access note */}
      <div className="mt-4 flex items-start gap-3 p-3.5 rounded-2xl bg-[#f8faff] border border-[#e0e7ff]">
        <div className="w-7 h-7 rounded-xl bg-[#001f3f]/8 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#001f3f]" />
        </div>
        <p className="text-xs text-[#6b7280] leading-relaxed">
          This is a private portal for authorised FHI Global professionals. If you require access, please contact your administrator.
        </p>
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function HomeLoginUI({ nextRedirect }: { nextRedirect?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)
  const [state, formAction, pending]    = useActionState(loginAction, initialState)

  const cardProps = {
    showPassword,  togglePassword: () => setShowPassword(p => !p),
    rememberMe,    toggleRemember:  () => setRememberMe(p => !p),
    state, formAction, pending,
    nextRedirect,
  }

  return (
    <>
      {/* ══════════════════════ MOBILE (< lg) ══════════════════════ */}
      <div className="lg:hidden relative flex flex-col min-h-[calc(100dvh-56px)] overflow-hidden">
        <div className="absolute inset-0">
          <DubaiBackdrop />
        </div>

        {/* Hero copy over the photo */}
        <div className="relative z-10 px-6 pt-10 pb-6 shrink-0">
          <div className="max-w-sm mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/25 rounded-full text-[11px] font-semibold text-white/90 backdrop-blur-sm mb-6">
              <MapPin className="w-3 h-3 text-[#d6b357]" />
              Dubai • UAE Real Estate
            </div>
            <h1 className="font-['Outfit'] text-[30px] font-bold text-white leading-[1.2] mb-3 drop-shadow-[0_2px_12px_rgba(0,10,30,0.5)]">
              Where Dubai&apos;s Finest<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                Properties Begin.
              </span>
            </h1>
            <p className="text-white/70 text-[13px] leading-relaxed">
              A private portal for FHI Global real estate professionals.
            </p>
          </div>
        </div>

        {/* Card over the photo */}
        <div className="relative z-10 px-4 pb-10 flex-1">
          <div className="max-w-sm mx-auto">
            <LoginCard {...cardProps} />
            <p className="text-center text-[11px] text-white/60 mt-5 tracking-wide">
              © {new Date().getFullYear()} FHI Global • Dubai, UAE. All rights reserved
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════ DESKTOP (lg+) ══════════════════════ */}
      <section className="hidden lg:block relative overflow-hidden">
        <div className="absolute inset-0">
          <DubaiBackdrop />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 lg:px-10 min-h-[calc(100dvh-128px)] flex flex-col justify-center py-8">
          <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px] gap-12 xl:gap-16 items-center">

            {/* Left: hero copy directly over the photo (mockup layout) */}
            <div className="flex flex-col justify-center space-y-9">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/25 rounded-full text-xs font-semibold text-white/90 backdrop-blur-sm w-fit">
                <MapPin className="w-3.5 h-3.5 text-[#d6b357]" />
                Dubai • UAE Real Estate
              </div>

              <div>
                <h1 className="font-['Outfit'] text-5xl xl:text-[56px] font-bold text-white leading-[1.12] mb-5 drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)]">
                  Where Dubai&apos;s Finest<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                    Properties Begin.
                  </span>
                </h1>
                <p className="text-white text-xl leading-relaxed max-w-lg font-medium drop-shadow-[0_2px_12px_rgba(0,10,30,0.9)]">
                  A private portal connecting real estate professionals with premium developments across the UAE.
                  Everything you need — and nothing you don&apos;t.
                </p>
              </div>

              {/* Pillars — horizontal row, like the mockup */}
              <div className="grid grid-cols-3 gap-6 max-w-2xl">
                {PILLARS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3.5 group">
                    <div className="w-12 h-12 rounded-full bg-white/15 border border-white/30 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:bg-[#d6b357]/20 group-hover:border-[#d6b357]/40 transition-all duration-300">
                      <Icon className="w-5 h-5 text-[#d6b357]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-bold text-white drop-shadow-[0_2px_10px_rgba(0,10,30,0.95)]">{label}</p>
                      <p className="text-[15px] text-white mt-1 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,10,30,0.95)]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-5 border-t border-white/20 max-w-2xl">
                <p className="text-white/85 text-base leading-relaxed italic drop-shadow-[0_2px_8px_rgba(0,10,30,0.9)]">
                  &quot;Access is earned, not given. Once inside, the full picture becomes clear.&quot;
                </p>
                <span className="block w-12 h-[3px] rounded-full bg-[#d6b357]/80 mt-3" />
              </div>
            </div>

            {/* Right: login card */}
            <div>
              <LoginCard {...cardProps} />
            </div>
          </div>

          <p className="text-right text-[11px] text-white/55 mt-5 tracking-wide">
            © {new Date().getFullYear()} FHI Global • Dubai, UAE. All rights reserved
          </p>
        </div>
      </section>
    </>
  )
}
