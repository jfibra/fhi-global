"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import LrAccountModal, { type GoogleIdentityLite } from "./LrAccountModal"
import type { NormalizedLrAgent } from "@/lib/lr/lr-api"

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""

type LookupResponse = {
  google: GoogleIdentityLite
  lr: NormalizedLrAgent | null
  mappedRole: string
  mappedRoleLabel: string
}

function Flow({ variant, nextRedirect }: { variant: "login" | "register"; nextRedirect?: string }) {
  const router = useRouter()
  const [credential, setCredential] = useState<string | null>(null)
  const [lookup, setLookup] = useState<LookupResponse | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Google button → verify + LR lookup (no account created yet).
  const handleSuccess = async (resp: CredentialResponse) => {
    const cred = resp.credential
    if (!cred) {
      setError("Google sign-in failed. Please try again.")
      return
    }
    setError(null)
    setInspecting(true)
    setCredential(cred)
    try {
      const res = await fetch("/api/lr/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: cred }),
      })
      const json = (await res.json()) as LookupResponse & { error?: string }
      if (!res.ok) {
        setError(json.error ?? "Could not verify your Google account.")
        setCredential(null)
        return
      }
      setLookup(json)
    } catch {
      setError("Network error — please try again.")
      setCredential(null)
    } finally {
      setInspecting(false)
    }
  }

  // Modal "Continue" → establish the Supabase session, then provision the profile.
  const handleConfirm = async () => {
    if (!credential) return
    setFinalizing(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credential,
      })
      if (signInError) {
        setError(signInError.message || "Sign-in failed. Please try again.")
        setFinalizing(false)
        return
      }
      const res = await fetch("/api/auth/google/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: nextRedirect ?? null }),
      })
      const json = (await res.json()) as { redirect?: string; error?: string }
      if (!res.ok || !json.redirect) {
        setError(json.error ?? "Could not finish setting up your account.")
        setFinalizing(false)
        return
      }
      router.push(json.redirect)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setFinalizing(false)
    }
  }

  const handleCancel = () => {
    setCredential(null)
    setLookup(null)
    setError(null)
    setFinalizing(false)
  }

  return (
    <div className="space-y-2.5">
      <div className="flex justify-center min-h-[44px] items-center">
        {inspecting ? (
          <div className="flex items-center gap-2 text-sm text-[#6b7280] py-2.5">
            <span className="w-4 h-4 border-2 border-[#001f3f]/30 border-t-[#001f3f] rounded-full animate-spin" />
            Checking your account…
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google sign-in was cancelled.")}
            theme="outline"
            size="large"
            shape="pill"
            text={variant === "register" ? "signup_with" : "continue_with"}
            width="320"
          />
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#9ca3af] text-center leading-relaxed px-4">
        <Sparkles className="w-3 h-3 text-[#d6b357] shrink-0" />
        Using a Leuterio Realty email? Continue with Google to auto-import your agent profile.
      </p>

      {error && !lookup && <p className="text-center text-xs text-rose-600">{error}</p>}

      {lookup && credential && (
        <LrAccountModal
          google={lookup.google}
          lr={lookup.lr}
          mappedRoleLabel={lookup.mappedRoleLabel}
          loading={finalizing}
          error={error}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

export default function GoogleAuthFlow(props: { variant: "login" | "register"; nextRedirect?: string }) {
  if (!CLIENT_ID) return null
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <Flow {...props} />
    </GoogleOAuthProvider>
  )
}
