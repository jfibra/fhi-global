"use client"

import { useActionState, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, User, Lock, ArrowRight, Info } from "lucide-react"
import { developerLoginAction, type DeveloperLoginState } from "@/app/(public-page)/(auth)/developer-login/actions"

const initialState: DeveloperLoginState = {}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all duration-200"

/**
 * /developer-login — username + password sign-in for developer partners
 * (accessed by URL; not linked publicly). Mirrors the staff sign-in shell but
 * keys on a username instead of an email. Left form panel; right Dubai backdrop.
 */
export function DeveloperLoginUI() {
  const [showPassword, setShowPassword] = useState(false)
  const [state, formAction, pending] = useActionState(developerLoginAction, initialState)

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
          <h1 className="font-['Outfit'] text-[28px] font-bold text-[#0d1117] leading-tight mb-4 text-left">Developer Sign In</h1>

          {/* Info box */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#eaf3fb] border border-[#d3e6f5] px-4 py-3 mb-5 text-left">
            <Info className="w-4 h-4 text-[#2f6fb0] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#3a5a78] leading-relaxed">
              Developer access — sign in with your username and password. Contact your FHI Global admin if you need an account.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <input name="username" type="text" placeholder="Username" required autoComplete="username" autoCapitalize="none" spellCheck={false} className={`${inputCls} pl-10`} />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                autoComplete="current-password"
                className={`${inputCls} pl-10 pr-11`}
              />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            {state.error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-400 mt-px text-sm leading-none">✕</span>
                <p className="text-sm text-rose-700">{state.error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 px-7 py-3.5 bg-[#001f3f] hover:bg-[#002952] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_14px_-2px_rgba(0,31,63,0.40)] hover:-translate-y-0.5 transition-all duration-200"
            >
              {pending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ══════════ RIGHT: photo ══════════ */}
      <div className="relative hidden lg:block overflow-hidden">
        <Image src="/background/home.webp" alt="Dubai home" fill priority sizes="50vw" className="object-cover object-right" />
      </div>
    </div>
  )
}
