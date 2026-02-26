"use client"

import { useActionState, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Eye, EyeOff, Building2, Mail, Lock, User, ArrowRight,
  CheckCircle2, ShieldCheck, Users, TrendingUp, DollarSign
} from "lucide-react"
import { registerAction, type RegisterState } from "@/app/register/actions"

const initialState: RegisterState = {}

export function RegisterUI() {
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirm,  setShowConfirm]      = useState(false)
  const [state, formAction, pending] = useActionState(registerAction, initialState)

  return (
    <div className="relative min-h-screen flex bg-[#001f3f] lg:bg-[#f4f6f9] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="blob-1 hidden lg:block fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(180,235,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="blob-2 hidden lg:block fixed bottom-0 right-[-5%] w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(255,240,200)_0%,rgba(255,255,255,0)_70%)]" />

      {/* ── Left brand panel ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-14 bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-25 blur-[130px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
        <div className="absolute bottom-[-80px] right-[-80px] w-[450px] h-[450px] rounded-full opacity-20 blur-[110px] bg-[radial-gradient(circle,#95292a,transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/60 to-transparent" />

        <div className="relative z-10">
          <Image src="/FHI_Branding_White.png" alt="FHI Global" width={160} height={48} className="object-contain" />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
            Join FHI Global
          </div>

          <h1 className="font-['Space_Grotesk'] text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
            Start Closing Deals<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">in Minutes.</span>
          </h1>

          <p className="text-white/55 text-base leading-relaxed mb-10">
            Create your FHI Global account and gain access to Dubai&apos;s most powerful real estate CRM platform.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { icon: <Building2 className="w-4 h-4 text-[#d6b357]" />, label: "Developers", value: "100+" },
              { icon: <TrendingUp className="w-4 h-4 text-[#d6b357]" />, label: "Projects", value: "500+" },
              { icon: <DollarSign className="w-4 h-4 text-[#d6b357]" />, label: "Sold Units", value: "1K+" },
            ].map(({ icon, label, value }) => (
              <div key={label} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#d6b357]/30 rounded-2xl p-4 transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  {icon}
                  <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-2xl font-bold text-white font-['Space_Grotesk']">{value}</p>
                <div className="mt-2 h-0.5 w-8 rounded-full bg-[#d6b357]/30 group-hover:w-full transition-all duration-500" />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              "Manage all your Dubai developer relationships",
              "Track purchases, commissions, and performance",
              "Access premium project listings and media",
            ].map((point) => (
              <div key={point} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#d6b357] shrink-0" />
                <span className="text-white/60 text-sm">{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-white/25" />
          <p className="text-white/25 text-xs">Accounts require admin approval before access is granted</p>
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden flex justify-center">
            <Image src="/FHI_Branding_White.png" alt="FHI Global" width={140} height={42} className="object-contain" />
          </div>

          {state.success ? (
            /* ── Success state ─────────────────────────────────── */
            <div className="bg-white/5 lg:bg-white border border-white/10 lg:border-[#e8eaed] rounded-3xl p-10 lg:shadow-[0_8px_40px_-8px_rgba(0,31,63,0.12)] text-center">
              <div className="w-16 h-16 rounded-full bg-[#d6b357]/15 border-2 border-[#d6b357]/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-[#d6b357]" />
              </div>
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white lg:text-[#0d1117] mb-2">
                Account Created!
              </h2>
              <p className="text-white/55 lg:text-[#6b7280] text-sm mb-6 leading-relaxed">
                Check your email to confirm your account. Once an admin approves your access, you can sign in.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-[#001f3f] hover:bg-[#002a52] text-white text-sm font-semibold rounded-xl transition-all shadow-[0_4px_16px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5"
              >
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            /* ── Form ──────────────────────────────────────────── */
            <div className="bg-white/5 lg:bg-white border border-white/10 lg:border-[#e8eaed] rounded-3xl p-8 lg:p-10 lg:shadow-[0_8px_40px_-8px_rgba(0,31,63,0.12)] backdrop-blur-sm lg:backdrop-blur-none">
              <div className="mb-8">
                <div className="hidden lg:flex w-10 h-10 rounded-2xl bg-[#001f3f] items-center justify-center mb-5 shadow-md">
                  <User className="w-4 h-4 text-[#d6b357]" />
                </div>
                <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white lg:text-[#0d1117] mb-1">Create your account</h2>
                <p className="text-sm text-white/55 lg:text-[#6b7280]">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#d6b357] lg:text-[#001f3f] hover:underline font-semibold">
                    Sign in
                  </Link>
                </p>
              </div>

              <form action={formAction} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60 lg:text-[#374151]">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 lg:text-[#9ca3af] pointer-events-none" />
                      <input
                        name="firstName"
                        type="text"
                        placeholder="Ahmed"
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/20 lg:border-[#e5e7eb] bg-white/8 lg:bg-[#f9fafb] text-sm text-white lg:text-[#111827] placeholder:text-white/35 lg:placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] lg:focus:border-[#001f3f] focus:bg-white/15 lg:focus:bg-white focus:ring-4 focus:ring-[#d6b357]/10 lg:focus:ring-[#001f3f]/8 transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60 lg:text-[#374151]">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 lg:text-[#9ca3af] pointer-events-none" />
                      <input
                        name="lastName"
                        type="text"
                        placeholder="Al Rashidi"
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/20 lg:border-[#e5e7eb] bg-white/8 lg:bg-[#f9fafb] text-sm text-white lg:text-[#111827] placeholder:text-white/35 lg:placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] lg:focus:border-[#001f3f] focus:bg-white/15 lg:focus:bg-white focus:ring-4 focus:ring-[#d6b357]/10 lg:focus:ring-[#001f3f]/8 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60 lg:text-[#374151]">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 lg:text-[#9ca3af] pointer-events-none" />
                    <input
                      name="email"
                      type="email"
                      placeholder="you@fhiglobal.com"
                      required
                      className="w-full pl-11 pr-5 py-3.5 rounded-xl border border-white/20 lg:border-[#e5e7eb] bg-white/8 lg:bg-[#f9fafb] text-sm text-white lg:text-[#111827] placeholder:text-white/35 lg:placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] lg:focus:border-[#001f3f] focus:bg-white/15 lg:focus:bg-white focus:ring-4 focus:ring-[#d6b357]/10 lg:focus:ring-[#001f3f]/8 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60 lg:text-[#374151]">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 lg:text-[#9ca3af] pointer-events-none" />
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-white/20 lg:border-[#e5e7eb] bg-white/8 lg:bg-[#f9fafb] text-sm text-white lg:text-[#111827] placeholder:text-white/35 lg:placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] lg:focus:border-[#001f3f] focus:bg-white/15 lg:focus:bg-white focus:ring-4 focus:ring-[#d6b357]/10 lg:focus:ring-[#001f3f]/8 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 lg:text-[#9ca3af] hover:text-[#d6b357] lg:hover:text-[#001f3f] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60 lg:text-[#374151]">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 lg:text-[#9ca3af] pointer-events-none" />
                    <input
                      name="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      required
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-white/20 lg:border-[#e5e7eb] bg-white/8 lg:bg-[#f9fafb] text-sm text-white lg:text-[#111827] placeholder:text-white/35 lg:placeholder:text-[#9ca3af] focus:outline-none focus:border-[#d6b357] lg:focus:border-[#001f3f] focus:bg-white/15 lg:focus:bg-white focus:ring-4 focus:ring-[#d6b357]/10 lg:focus:ring-[#001f3f]/8 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 lg:text-[#9ca3af] hover:text-[#d6b357] lg:hover:text-[#001f3f] transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {state.error && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="group relative w-full py-3.5 px-4 mt-1 bg-[#001f3f] hover:bg-[#002a52] text-white text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_-2px_rgba(0,31,63,0.35)] hover:shadow-[0_6px_20px_-2px_rgba(0,31,63,0.45)] hover:-translate-y-0.5 overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d6b357]/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative flex items-center justify-center gap-2">
                    {pending ? "Creating account..." : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-white/15 lg:bg-[#f0f0f0]" />
                <span className="text-[10px] text-white/35 lg:text-[#bbb] uppercase tracking-widest font-semibold">Restricted Access</span>
                <div className="flex-1 h-px bg-white/15 lg:bg-[#f0f0f0]" />
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/8 lg:bg-[#f8faff] border border-white/15 lg:border-[#e0e7ff]">
                <div className="w-7 h-7 rounded-xl bg-[#001f3f]/10 lg:bg-[#001f3f]/8 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-[#d6b357] lg:text-[#001f3f]" />
                </div>
                <p className="text-xs text-white/55 lg:text-[#6b7280] leading-relaxed">
                  New accounts must be approved by an administrator before you can sign in.
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-white/25 lg:text-[#bbb] mt-6 tracking-wide">
            © {new Date().getFullYear()} FHI Global • Dubai Operations • All rights reserved
          </p>
        </div>
      </div>
    </div>
  )
}
