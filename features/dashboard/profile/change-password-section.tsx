"use client"

import { useState } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"

// Self-service password change for developer accounts (username + admin-set
// password). Posts to /api/account/password, which re-verifies the current
// password server-side before rotating it.
export function ChangePasswordSection({
  onSuccess,
  onError,
}: {
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const inputClass =
    "w-full px-5 py-2.5 border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm pr-12"

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword) {
      onError("Current and new password are required.")
      return
    }
    if (newPassword.length < 8) {
      onError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      onError("New password and confirmation do not match.")
      return
    }
    if (newPassword === currentPassword) {
      onError("New password must be different from the current one.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        onError(json.error || "Failed to change password.")
        return
      }
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      onSuccess("Password updated.")
    } catch {
      onError("Failed to change password. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#001f3f]" />
        <h3 className="text-lg font-bold text-[#0d1117] font-['Outfit']">Change Password</h3>
      </div>
      <p className="text-sm text-[#6b7280] -mt-2">
        Update the password you use to sign in at the developer login.
      </p>

      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Current Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">New Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors"
              aria-label={show ? "Hide passwords" : "Show passwords"}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-[#9ca3af] ml-1">At least 8 characters.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider ml-1 text-[#374151]">Confirm New Password</label>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-7 py-3 font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
          >
            {busy ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
            ) : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  )
}
