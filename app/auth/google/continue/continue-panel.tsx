"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/**
 * Post-OAuth landing: finish provisioning immediately and redirect. Every new
 * Google account is created as member + pending (no external role lookup);
 * returning users just pass through to their dashboard.
 */
export default function GoogleContinuePanel({
  next,
  inviteRef,
}: {
  next: string | null
  inviteRef: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const finalize = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/auth/google/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next, ref: inviteRef }),
      })
      const json = (await res.json()) as { redirect?: string; error?: string }
      if (!res.ok || !json.redirect) {
        setError(json.error ?? "Could not finish setting up your account.")
        return
      }
      router.push(json.redirect)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    }
  }, [next, inviteRef, router])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void finalize()
  }, [finalize])

  // Bail out: don't provision; sign out and return to the homepage.
  const handleCancel = useCallback(async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.push("/")
      router.refresh()
    }
  }, [router])

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] flex items-center justify-center p-4">
      {error ? (
        <div className="text-center max-w-sm">
          <p className="text-white/80 text-sm mb-4">{error}</p>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => void finalize()}
              className="text-[#d6b357] text-sm font-semibold hover:underline"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="text-white/60 text-sm font-semibold hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 text-white/70 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Finishing sign-in…
        </div>
      )}
    </div>
  )
}
