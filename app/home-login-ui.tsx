"use client"

import { useActionState, useState } from "react"
import { Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck, Star, MapPin } from "lucide-react"
import { loginAction, type LoginState } from "@/app/login/actions"

const initialState: LoginState = {}

const PILLARS = [
  { icon: Star,   label: "Exclusive Access",  desc: "Curated properties unavailable to the general market." },
  { icon: MapPin, label: "Prime Locations",   desc: "From Downtown Dubai to Palm Jumeirah and beyond." },
  { icon: ShieldCheck, label: "Trusted Network", desc: "Verified developers. Transparent process. Zero guesswork." },
]

// â”€â”€â”€ Shared login card (used by both mobile and desktop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LoginCard({
  showPassword,
  togglePassword,
  rememberMe,
  toggleRemember,
  state,
  formAction,
  pending,
}: {
  showPassword: boolean
  togglePassword: () => void
  rememberMe: boolean
  toggleRemember: () => void
  state: { error?: string }
  formAction: (payload: FormData) => void
  pending: boolean
}) {
  return (
    <div className="bg-white rounded-[28px] border border-[#e8eaed] shadow-[0_8px_48px_-8px_rgba(0,31,63,0.12)] p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#003366] flex items-center justify-center mb-5 shadow-md">
          <Lock className="w-[18px] h-[18px] text-[#d6b357]" />
        </div>
        <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-1.5">
          Welcome back
        </h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Sign in to access your private portal and everything waiting inside.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
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
              placeholder="you@fhiglobal.com"
              required
              autoComplete="email"
              className="w-full pl-11 pr-5 py-3.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"
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
              className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"
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
            <span className="text-rose-400 mt-px text-sm leading-none">âœ•</span>
            <p className="text-sm text-rose-700">{state.error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={pending}
          className="group relative w-full py-3.5 px-4 mt-1 bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_-2px_rgba(0,31,63,0.30)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 overflow-hidden"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d6b357]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative flex items-center justify-center gap-2">
            {pending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing inâ€¦
              </>
            ) : (
              <>
                Enter Portal
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </>
            )}
          </span>
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-[#f0f0f0]" />
        <span className="text-[10px] text-[#bbb] uppercase tracking-widest font-semibold">Private Access</span>
        <div className="flex-1 h-px bg-[#f0f0f0]" />
      </div>

      {/* Access note */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#f8faff] border border-[#e0e7ff]">
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

// â”€â”€â”€ Page component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function HomeLoginUI() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)
  const [state, formAction, pending]    = useActionState(loginAction, initialState)

  const cardProps = {
    showPassword,  togglePassword: () => setShowPassword(p => !p),
    rememberMe,    toggleRemember:  () => setRememberMe(p => !p),
    state, formAction, pending,
  }

  return (
    <>
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• MOBILE (< lg) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="lg:hidden flex flex-col min-h-[calc(100dvh-56px)]">

        {/* Navy brand hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] px-6 pt-10 pb-24 shrink-0">
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          {/* Glows */}
          <div className="absolute top-[-80px] left-[-80px] w-[340px] h-[340px] rounded-full opacity-30 blur-[110px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
          <div className="absolute bottom-[-40px] right-[-60px] w-[280px] h-[280px] rounded-full opacity-20 blur-[90px] bg-[radial-gradient(circle,#4a9eff,transparent)]" />
          {/* Gold top rule */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />

          <div className="relative z-10 max-w-sm mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-[11px] font-semibold text-white/80 backdrop-blur-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
              Dubai Â· UAE Real Estate
            </div>
            <h1 className="font-['Outfit'] text-[28px] font-bold text-white leading-[1.2] mb-3">
              Where Dubai's Finest<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                Properties Begin.
              </span>
            </h1>
            <p className="text-white/45 text-[13px] leading-relaxed">
              A private portal for FHI Global real estate professionals.
            </p>
          </div>
        </div>

        {/* Card floats over the navy band */}
        <div className="relative z-10 -mt-12 px-4 pb-10 flex-1 bg-transparent">
          <div className="max-w-sm mx-auto">
            <LoginCard {...cardProps} />
            <p className="text-center text-[11px] text-[#9ca3af] mt-5 tracking-wide">
              Â© {new Date().getFullYear()} FHI Global Â· Dubai, UAE Â· All rights reserved
            </p>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DESKTOP (lg+) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="hidden lg:block bg-[#f4f6f9] py-20">
        <div className="max-w-7xl mx-auto px-8 lg:px-10">
          <div className="grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] gap-10 xl:gap-16 items-center">

            {/* Left: editorial panel */}
            <div className="flex flex-col justify-center relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] p-12 xl:p-16 min-h-[600px]">
              <div
                className="absolute inset-0 opacity-[0.05]"
                style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
              />
              <div className="absolute top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full opacity-25 blur-[120px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
              <div className="absolute bottom-[-60px] right-[-60px] w-[380px] h-[380px] rounded-full opacity-20 blur-[100px] bg-[radial-gradient(circle,#4a9eff,transparent)]" />
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[32px] bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" />

              <div className="relative z-10 space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 backdrop-blur-sm w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
                  Dubai Â· UAE Real Estate
                </div>

                <div>
                  <h1 className="font-['Outfit'] text-4xl xl:text-5xl font-bold text-white leading-[1.15] mb-5">
                    Where Dubai's Finest<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                      Properties Begin.
                    </span>
                  </h1>
                  <p className="text-white/50 text-base leading-relaxed max-w-md">
                    A private portal connecting real estate professionals with premium developments across the UAE.
                    Everything you need â€” and nothing you don't.
                  </p>
                </div>

                <div className="space-y-4">
                  {PILLARS.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-4 group">
                      <div className="w-9 h-9 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#d6b357]/15 group-hover:border-[#d6b357]/30 transition-all duration-300">
                        <Icon className="w-4 h-4 text-[#d6b357]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/90">{label}</p>
                        <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-white/30 text-xs leading-relaxed italic">
                    "Access is earned, not given. Once inside, the full picture becomes clear."
                  </p>
                </div>
              </div>
            </div>

            {/* Right: login card */}
            <div>
              <LoginCard {...cardProps} />
              <p className="text-center text-[11px] text-[#bbb] mt-5 tracking-wide">
                Â© {new Date().getFullYear()} FHI Global Â· Dubai, UAE Â· All rights reserved
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
