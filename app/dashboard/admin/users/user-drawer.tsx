"use client"

import { useState } from "react"
import {
  X, Mail, Shield, Clock3, CalendarDays, Phone, MessageSquare,
  Edit3, KeyRound, UserCheck, UserX, Trash2, Eye, EyeOff, CheckCircle,
} from "lucide-react"
import type { UserRecord } from "@/lib/user-service"
import { getUserDisplayName } from "@/lib/user-service"
import { UserAvatar } from "@/components/user-avatar"
import { RoleBadge } from "@/components/role-badge"
import { StatusBadge } from "@/components/status-badge"

type BannerType = "success" | "error"

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(date: string | null | undefined) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })
}
function metaStr(meta: Record<string, unknown> | null, key: string) {
  const v = meta?.[key]
  return typeof v === "string" && v.trim() ? v.trim() : null
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function UserDrawer({
  user,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  onUpdated,
  onBanner,
}: {
  user: UserRecord
  onClose: () => void
  onEdit: (u: UserRecord) => void
  onDelete: (id: string) => void
  onToggleStatus: (u: UserRecord) => void
  onUpdated: (u: UserRecord) => void
  onBanner: (type: BannerType, msg: string) => void
}) {
  const [resetTab, setResetTab] = useState(false)
  const [newPwd,   setNewPwd]   = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [busy,     setBusy]     = useState(false)

  const displayName = getUserDisplayName(user)
  const isDeleted   = user.is_deleted === true
  const isActive    = user.status === "active"

  const phone     = metaStr(user.metadata, "phone_country_code") && metaStr(user.metadata, "phone_number")
    ? `${metaStr(user.metadata, "phone_country_code")} ${metaStr(user.metadata, "phone_number")}` : null
  const whatsapp  = metaStr(user.metadata, "whatsapp_country_code") && metaStr(user.metadata, "whatsapp_number")
    ? `${metaStr(user.metadata, "whatsapp_country_code")} ${metaStr(user.metadata, "whatsapp_number")}` : null
  const linkedDeveloperId = metaStr(user.metadata, "developer_id")

  // ── Reset password handler ───────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPwd || newPwd.length < 8) {
      onBanner("error", "Password must be at least 8 characters.")
      return
    }
    setBusy(true)
    const res = await fetch(`/api/admin/users/${user.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPwd }),
    })
    setBusy(false)
    if (res.ok) {
      onBanner("success", "Password reset successfully.")
      setNewPwd("")
      setResetTab(false)
    } else {
      const data = await res.json().catch(() => ({}))
      onBanner("error", (data as { error?: string }).error ?? "Failed to reset password.")
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-[210] w-full max-w-md bg-white shadow-2xl shadow-black/20 flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[#f0f2f5] shrink-0">
          <h2 className="font-['Space_Grotesk'] font-bold text-[#0d1117]">User Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Identity card ── */}
          <div className="flex flex-col items-center text-center py-4 bg-gradient-to-b from-[#f8f9fb] to-white rounded-[20px] border border-[#f0f2f5]">
            <UserAvatar name={displayName} imageUrl={user.profile_url} size={72} />
            <h3 className="mt-3 font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">{displayName}</h3>
            <p className="text-sm text-[#9ca3af] mt-0.5">{user.email ?? "—"}</p>
            <div className="flex items-center gap-2 mt-3">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} isDeleted={user.is_deleted} />
            </div>
          </div>

          {/* ── Info rows ── */}
          <div className="space-y-2.5">
            <InfoRow icon={Mail}        label="Email"    value={user.email} />
            <InfoRow icon={Shield}      label="Role"     value={<RoleBadge role={user.role} />} />
            {user.role === "developer" && (
              <InfoRow icon={Shield} label="Linked Developer" value={linkedDeveloperId ?? "Not linked"} />
            )}
            <InfoRow icon={CalendarDays} label="Joined"  value={fmt(user.joined_at)} />
            <InfoRow icon={Clock3}      label="Timezone" value={user.timezone} />
            {phone    && <InfoRow icon={Phone}          label="Phone"    value={phone} />}
            {whatsapp && <InfoRow icon={MessageSquare}  label="WhatsApp" value={whatsapp} />}
            {user.birthday && <InfoRow icon={CalendarDays} label="Birthday" value={fmt(user.birthday)} />}
            {user.gender   && <InfoRow icon={Shield}       label="Gender"   value={user.gender} />}
          </div>

          {/* ── Reset password panel ── */}
          {resetTab && (
            <div className="rounded-[20px] border border-[#e5e5e5] bg-[#f8f9fb] p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">New Password</p>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-2xl border border-[#e5e5e5] text-sm focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResetTab(false); setNewPwd("") }}
                  className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-medium border border-[#e5e5e5] text-[#6b7280] hover:bg-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all disabled:opacity-70"
                >
                  {busy ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {busy ? "Saving…" : "Set Password"}
                </button>
              </div>
            </div>
          )}

          {/* ── Updated at ── */}
          {user.updated_at && (
            <p className="text-center text-[11px] text-[#c4c9d4]">Last updated {fmt(user.updated_at)}</p>
          )}
        </div>

        {/* ── Action footer ── */}
        <div className="shrink-0 border-t border-[#f0f2f5] px-6 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn icon={Edit3} label="Edit Profile"
              onClick={() => onEdit(user)}
            />
            <ActionBtn icon={KeyRound} label="Reset Password"
              onClick={() => setResetTab((v) => !v)}
              active={resetTab}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn
              icon={isActive ? UserX : UserCheck}
              label={isActive ? "Deactivate" : "Activate"}
              variant={isActive ? "warn" : "success"}
              onClick={() => { onToggleStatus(user); onClose() }}
            />
            {!isDeleted && (
              <ActionBtn
                icon={Trash2}
                label="Delete User"
                variant="danger"
                onClick={() => { onDelete(user.id); onClose() }}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  if (!value && typeof value !== "object") return null
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="w-7 h-7 rounded-xl bg-[#f4f6f9] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[#001f3f]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">{label}</p>
        <div className="text-[#374151] mt-0.5 truncate">{value ?? "—"}</div>
      </div>
    </div>
  )
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  variant,
  active,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: "warn" | "danger" | "success"
  active?: boolean
}) {
  const base = "flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-medium border transition-all"
  const cls =
    variant === "danger"  ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" :
    variant === "warn"    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" :
    variant === "success" ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" :
    active ? "bg-[#001f3f]/5 border-[#001f3f]/20 text-[#001f3f]" :
    "bg-white border-[#e5e5e5] text-[#374151] hover:bg-[#f8f9fa] hover:border-[#d0d5dd]"

  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
