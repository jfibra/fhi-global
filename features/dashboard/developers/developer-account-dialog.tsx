"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Check, UserPlus, User, Lock, Building2, Eye, EyeOff, IdCard } from "lucide-react"

// ─── Portal ────────────────────────────────────────────────────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

type DeveloperOption = { id: string; name: string; slug: string }

/** A developer company preselected when the dialog is opened from a row. */
export type AccountPreset = { id: string; name: string } | null

interface Props {
  open: boolean
  preset: AccountPreset
  onClose: () => void
  onSaved: (username: string) => void
  onError: (msg: string) => void
}

const FieldLabel = ({ text, required }: { text: string; required?: boolean }) => (
  <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
    {text}{required && " *"}
  </label>
)

const inp =
  "w-full px-5 py-3.5 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm"

/**
 * Admin-only "Create Developer Account" modal (replaces the removed invite flow).
 * Provisions a username + password login bound to a developer company via
 * POST /api/admin/developer-accounts. The username maps to a synthetic email
 * server-side; the developer signs in at /developer-login.
 */
export function DeveloperAccountDialog({ open, preset, onClose, onSaved, onError }: Props) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [developerId, setDeveloperId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [developers, setDevelopers] = useState<DeveloperOption[]>([])
  const [busy, setBusy] = useState(false)

  // Reset on open; preselect the company if launched from a row.
  useEffect(() => {
    if (!open) return
    setUsername("")
    setPassword("")
    setDisplayName("")
    setShowPassword(false)
    setDeveloperId(preset?.id ?? "")
  }, [open, preset])

  // Load active companies for the picker (same source as the user form).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/developers")
        const json = (await res.json()) as { developers?: DeveloperOption[] }
        if (!cancelled && res.ok) setDevelopers(json.developers ?? [])
      } catch {
        /* non-fatal — the picker just stays empty */
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const handleSubmit = async () => {
    const uname = username.trim().toLowerCase()
    if (!uname || !password || !developerId) {
      onError("Username, password, and developer company are required.")
      return
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(uname)) {
      onError("Username must be 3–32 characters: lowercase letters, numbers, dot, underscore, or hyphen.")
      return
    }
    if (password.length < 8) {
      onError("Password must be at least 8 characters.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/admin/developer-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: uname,
          password,
          developer_id: developerId,
          display_name: displayName.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { username?: string; error?: string }
      if (!res.ok) {
        onError(json.error ?? "Failed to create developer account.")
        return
      }
      onSaved(json.username ?? uname)
    } catch {
      onError("Failed to create developer account. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

        <div className="relative w-full sm:max-w-[560px] max-h-[95dvh] flex flex-col bg-white/90 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#001f3f] flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Create Developer Account</h3>
                <p className="text-xs text-[#6b7280]">Username + password login for a developer partner</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Developer company */}
            <div>
              <FieldLabel text="Developer Company" required />
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <select
                  className={`${inp} pl-11 appearance-none`}
                  value={developerId}
                  onChange={(e) => setDeveloperId(e.target.value)}
                >
                  <option value="">Select developer…</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.slug})</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1 ml-1">The account will be linked to this company.</p>
            </div>

            {/* Username */}
            <div>
              <FieldLabel text="Username" required />
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  className={`${inp} pl-11`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. danube_admin"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1 ml-1">3–32 chars · lowercase letters, numbers, and . _ -</p>
            </div>

            {/* Password */}
            <div>
              <FieldLabel text="Password" required />
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  className={`${inp} pl-11 pr-12`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#001f3f] transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1 ml-1">Share these credentials with the developer securely. Resets are admin-managed.</p>
            </div>

            {/* Display name (optional) */}
            <div>
              <FieldLabel text="Display Name" />
              <div className="relative">
                <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  className={`${inp} pl-11`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Optional — defaults to the company name"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
            <button type="button" onClick={onClose}
              className="px-6 py-3 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSubmit()} disabled={busy}
              className="bg-[#001f3f] hover:bg-[#002b57] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2">
              {busy
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                : <><Check className="w-4 h-4" /> Create Account</>
              }
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
