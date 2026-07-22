"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, ShieldCheck, Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DeveloperLogo } from "@/components/developers/developer-logo"
import type { InviteDeveloper } from "@/lib/developer-invites"

type GoogleLite = { email: string; name: string; picture: string | null }

export function JoinContinuePanel({
  token,
  chosenDeveloperId,
  boundDeveloper,
  autoActivate,
  google,
}: {
  token: string
  chosenDeveloperId: string | null
  boundDeveloper: InviteDeveloper | null
  autoActivate: boolean
  google: GoogleLite
}) {
  const router = useRouter()
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setFinalizing(true)
    setError(null)
    try {
      const res = await fetch("/api/developer-invite/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, developerId: boundDeveloper ? null : chosenDeveloperId }),
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

  const cancel = async () => {
    try {
      await createClient().auth.signOut()
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] flex items-center justify-center p-4">
      <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#001f3f] to-[#002a52] px-6 pt-6 pb-5">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={finalizing}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-['Outfit'] text-lg font-bold text-white pr-8">Confirm your developer account</h2>
          <p className="text-white/55 text-xs mt-1 leading-relaxed">
            We&apos;ll set up your FHI Global account from your Google profile.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Google identity */}
          <div className="flex items-center gap-3">
            {google.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={google.picture} alt="" className="w-11 h-11 rounded-full border border-[#e8eaed]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#001f3f]/8 flex items-center justify-center text-[#001f3f] font-bold">
                {(google.name || google.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111827] truncate">{google.name || google.email}</p>
              <p className="text-xs text-[#6b7280] truncate">{google.email}</p>
            </div>
          </div>

          {/* Developer */}
          {boundDeveloper ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#e8eaed] bg-[#f9fafb] p-4">
              <DeveloperLogo url={boundDeveloper.logo_url} name={boundDeveloper.name} size={40} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Joining developer</p>
                <p className="text-sm font-semibold text-[#111827] truncate">{boundDeveloper.name}</p>
              </div>
              {boundDeveloper.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 ml-auto" />}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-[#001f3f]/[0.04] border border-[#001f3f]/10 px-4 py-3">
              <Building2 className="w-4 h-4 text-[#001f3f]" />
              <p className="text-sm text-[#374151]">Joining the developer from your invite.</p>
            </div>
          )}

          <div className="flex items-center gap-2.5 rounded-xl bg-[#d6b357]/10 border border-[#d6b357]/25 px-4 py-3">
            <ShieldCheck className="w-4 h-4 text-[#b48a2c]" />
            <p className="text-sm text-[#374151]">
              You&apos;ll join as <span className="font-bold text-[#001f3f]">Developer</span>
              {autoActivate ? "" : " — an admin will approve your access first"}.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={finalizing}
              className="flex-1 py-3 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f5f5f5] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={finalizing}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
            >
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {finalizing ? "Setting up…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
