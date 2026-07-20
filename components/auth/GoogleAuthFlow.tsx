"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// Redirect-based Google sign-in. Navigates the whole page to Google via
// Supabase OAuth (no popup / no third-party cookies — reliable across
// browsers), returns to /auth/callback, then /auth/google/continue shows the
// Leuterio Realty account modal before provisioning.

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

export default function GoogleAuthFlow({
  variant,
  nextRedirect,
}: {
  variant: "login" | "register"
  nextRedirect?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const origin = window.location.origin
      const nextParam = nextRedirect ? `?next=${encodeURIComponent(nextRedirect)}` : ""
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback${nextParam}`,
          queryParams: { prompt: "select_account" },
        },
      })
      if (oauthError) {
        setError(oauthError.message || "Could not start Google sign-in. Please try again.")
        setLoading(false)
      }
      // On success the browser navigates away; no need to reset loading.
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-[#e5e7eb] bg-white text-sm font-semibold text-[#111827] hover:border-[#001f3f]/40 hover:bg-[#fafafa] disabled:opacity-60 transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleGlyph className="w-4 h-4" />}
        {loading ? "Redirecting…" : variant === "register" ? "Sign up with Google" : "Continue with Google"}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#9ca3af] text-center leading-relaxed px-4">
        <Sparkles className="w-3 h-3 text-[#d6b357] shrink-0" />
        Using a Leuterio Realty email? Continue with Google to auto-import your agent profile.
      </p>

      {error && <p className="text-center text-xs text-rose-600">{error}</p>}
    </div>
  )
}
