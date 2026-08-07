"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Eye, X, ArrowLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, roleToLabel } from "@/lib/app-roles"
import { RoleBadge } from "@/components/role-badge"
import { PREVIEWABLE_ROLES, enterViewAs, exitViewAs } from "@/lib/view-as"

// Modal that lets an admin pick a role to preview. Only ever mounts after a
// browser click (never during SSR), so document.body is always available.
function ViewAsPicker({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md max-h-[90dvh] flex flex-col bg-white rounded-[24px] border border-white/60 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#001f3f] flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Switch point of view</h3>
              <p className="text-xs text-[#6b7280]">Preview another role&apos;s dashboard</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <p className="text-xs text-[#6b7280] mb-3 px-1">
            You stay signed in as yourself — this only changes the interface you see. Any action still runs as your account.
          </p>
          <div className="space-y-1.5">
            {PREVIEWABLE_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => enterViewAs(r)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#eef0f2] hover:border-[#001f3f]/40 hover:bg-[#f9fafb] transition-all text-left"
              >
                <RoleBadge role={r} />
                <span className="flex-1 text-sm font-medium text-[#111827]">{roleToLabel(r)} dashboard</span>
                <ChevronRight className="w-4 h-4 text-[#c4c4c4]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * "Switch point of view" entry for the sidebar account dropdown. Self-gates to
 * real admin-staff accounts (returns null otherwise), so it stays hidden while
 * an admin is already previewing a non-admin role.
 */
export function ViewAsMenuItem({ onNavigate }: { onNavigate?: () => void }) {
  const { realRole } = useAuth()
  const [open, setOpen] = useState(false)
  if (!isAdminStaffRole(realRole)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); onNavigate?.() }}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl text-white/85 hover:text-white hover:bg-white/10 transition-all duration-200 group"
      >
        <span className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/15 flex items-center justify-center shrink-0 transition-all">
          <Eye className="w-[18px] h-[18px] text-white/80 group-hover:text-white" />
        </span>
        <span className="font-['Outfit'] font-semibold text-[15px]">Switch point of view</span>
      </button>
      {open && <ViewAsPicker onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Persistent banner shown while an admin is previewing a role, with a one-click
 * return to their real dashboard. Renders nothing when not previewing.
 */
export function ViewAsBanner() {
  const { isViewingAs, role, realRole } = useAuth()
  if (!isViewingAs) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200">
      <p className="text-[13px] text-amber-900 flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 shrink-0 text-amber-600" />
        <span className="truncate">
          Previewing the <strong className="font-bold">{roleToLabel(role)}</strong> view — actions still run as your admin account.
        </span>
      </p>
      <button
        type="button"
        onClick={() => exitViewAs(realRole)}
        className="inline-flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full bg-[#001f3f] text-white text-xs font-semibold hover:bg-[#002b57] transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to admin dashboard
      </button>
    </div>
  )
}
