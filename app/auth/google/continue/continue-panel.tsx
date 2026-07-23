"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import LrAccountModal, { type GoogleIdentityLite } from "@/components/auth/LrAccountModal"
import type { NormalizedLrAgent } from "@/lib/lr/lr-api"

type LookupResponse = {
  google: GoogleIdentityLite
  lr: NormalizedLrAgent | null
  mappedRole: string
  mappedRoleLabel: string
}

export default function GoogleContinuePanel({
  next,
  inviteRef,
}: {
  next: string | null
  inviteRef: string | null
}) {
  const router = useRouter()
  const [data, setData] = useState<LookupResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Session-based LR lookup (slow — the LR v2 endpoint can take ~10s), so we
  // render a loading state and fetch after mount rather than blocking the page.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/lr/lookup", { method: "POST" })
        const json = (await res.json()) as LookupResponse & { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setLoadError(json.error ?? "Could not load your account details.")
          return
        }
        setData(json)
      } catch {
        if (!cancelled) setLoadError("Network error — please try again.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    setFinalizing(true)
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
        setFinalizing(false)
        return
      }
      router.push(json.redirect)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setFinalizing(false)
    }
  }, [next, inviteRef, router])

  // Cancel = don't provision; sign out and return to the homepage.
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
      {loadError ? (
        <div className="text-center">
          <p className="text-white/80 text-sm mb-4">{loadError}</p>
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="text-[#d6b357] text-sm font-semibold hover:underline"
          >
            Back to sign in
          </button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2.5 text-white/70 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking your Leuterio Realty account…
        </div>
      ) : (
        <LrAccountModal
          google={data.google}
          lr={data.lr}
          mappedRoleLabel={data.mappedRoleLabel}
          loading={finalizing}
          error={error}
          onConfirm={() => void handleConfirm()}
          onCancel={() => void handleCancel()}
        />
      )}
    </div>
  )
}
