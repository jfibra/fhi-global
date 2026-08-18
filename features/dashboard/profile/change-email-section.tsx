"use client"

import { useState } from "react"
import { Mail } from "lucide-react"

// Self-service email change, OTP-confirmed like the login flow: enter the new
// address → a 6-digit code is emailed to it → entering the code rotates the
// sign-in email. Posts to /api/account/email (uniqueness enforced server-side).
export function ChangeEmailSection({
  currentEmail,
  onSuccess,
  onError,
}: {
  currentEmail: string
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const [step, setStep] = useState<"input" | "code">("input")
  const [newEmail, setNewEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const inputClass =
    "w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"

  const post = async (payload: Record<string, string>): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: res.ok, error: json.error }
  }

  const sendCode = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) {
      onError("Enter your new email.")
      return
    }
    setBusy(true)
    try {
      const { ok, error } = await post({ action: "send", newEmail: email })
      if (!ok) {
        onError(error || "Could not send the code.")
        return
      }
      setCode("")
      setStep("code")
      onSuccess(`We emailed a 6-digit code to ${email}.`)
    } catch {
      onError("Could not send the code. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const confirmChange = async () => {
    if (code.trim().length !== 6) {
      onError("Enter the 6-digit code we emailed you.")
      return
    }
    setBusy(true)
    try {
      const { ok, error } = await post({ action: "verify", code: code.trim() })
      if (!ok) {
        onError(error || "Could not update your email.")
        return
      }
      onSuccess("Email updated. Refreshing…")
      setTimeout(() => window.location.reload(), 900)
    } catch {
      onError("Could not update your email. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const busySpinner = (
    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  )
  const buttonClass =
    "bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-[#001f3f]" />
        <h3 className="text-lg font-bold text-[#0d1117] font-['Outfit']">Change Email</h3>
      </div>
      <p className="text-sm text-[#6b7280] -mt-2">
        Update the email you sign in with. We&apos;ll send a 6-digit code to the new address to confirm it&apos;s yours.
      </p>

      <div className="space-y-4 max-w-md">
        {step === "input" ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">New Email</label>
              <input
                type="email"
                className={inputClass}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={currentEmail}
                autoComplete="email"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => void sendCode()} disabled={busy} className={buttonClass}>
                {busy ? <>{busySpinner} Sending…</> : "Send Code"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">
                6-digit code sent to {newEmail.trim().toLowerCase()}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className={`${inputClass} tracking-[0.5em] text-center font-bold text-lg`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-[#9ca3af] ml-1">The code expires in 10 minutes.</p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => { setStep("input"); setCode("") }}
                  disabled={busy}
                  className="text-sm font-semibold text-[#6b7280] hover:text-[#0d1117] disabled:opacity-60"
                >
                  Change address
                </button>
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy}
                  className="text-sm font-semibold text-[#6b7280] hover:text-[#0d1117] disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
              <button type="button" onClick={() => void confirmChange()} disabled={busy} className={buttonClass}>
                {busy ? <>{busySpinner} Confirming…</> : "Confirm Change"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
