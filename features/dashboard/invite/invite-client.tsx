"use client"

/**
 * Invite — the user's personal QR code and link to /register?ref=<their id>.
 * Registrations that arrive through it get metadata.invited_by set to the
 * inviter's profile id (see app/api/register/route.ts), so recruitment can be
 * tracked per agent.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet,
  FileText, Loader2, MessageCircle, Phone, QrCode, RefreshCw, Search, Users,
} from "lucide-react"
import { roleToLabel } from "@/lib/auth"
import { ROLE_COLORS, invitableRolesFor, roleInList } from "@/lib/app-roles"

type Recruit = {
  id: string
  fullname: string
  email: string | null
  role: string
  status: string
  joinedAt: string | null
  phone: string | null
  whatsapp: string | null
  birthday: string | null
  incomplete?: boolean
}

// Module-level cache of the recruits list. Survives client-side (next/link)
// navigation within the session, so leaving the page and coming back reuses the
// data instead of refetching. `null` means "never fetched yet". Cleared on a
// full page reload (which is the intended way to force a cold fetch); the
// in-page Refresh button also re-fetches on demand.
let recruitsCache: Recruit[] | null = null

function joinedLabel(joinedAt: string | null): string {
  if (!joinedAt) return "—"
  const d = new Date(joinedAt)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function birthdayLabel(birthday: string | null): string {
  if (!birthday) return "—"
  const d = new Date(birthday)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

// lucide has no WhatsApp brand mark — inline the official glyph.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.12.82.83-3.04-.2-.32a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.27-8.24 8.27zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>
    </svg>
  )
}

export function InviteClient({
  userId,
  userName,
  currentRole,
}: {
  userId: string
  userName: string
  currentRole: string
}) {
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  const [recruits, setRecruits] = useState<Recruit[]>(() => recruitsCache ?? [])
  const [recruitsLoading, setRecruitsLoading] = useState(recruitsCache === null)
  const [recruitsError, setRecruitsError] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // Role chosen for each pending recruit at approval time (member | agent).
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({})

  // Search + pagination over the recruits list.
  const PAGE_SIZE = 10
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recruits
    return recruits.filter(
      (r) => r.fullname.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q),
    )
  }, [recruits, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    // Already fetched earlier this session — reuse the cache, don't refetch.
    if (recruitsCache !== null) return
    let alive = true
    void fetch("/api/invite/recruits")
      .then(async (res) => {
        if (!res.ok) throw new Error("failed")
        const data = (await res.json()) as { recruits?: Recruit[] }
        if (alive) setRecruits(data.recruits ?? [])
      })
      .catch(() => {
        if (alive) setRecruitsError(true)
      })
      .finally(() => {
        if (alive) setRecruitsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // Keep the module cache in sync with the current list so navigating away and
  // back restores the latest data (including approvals / role changes).
  useEffect(() => {
    if (!recruitsLoading) recruitsCache = recruits
  }, [recruits, recruitsLoading])

  const inviteUrl = origin ? `${origin}/register?ref=${userId}` : ""

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (http / old browser) — select-and-copy fallback not needed here.
    }
  }

  const handleDownload = () => {
    const canvas = downloadRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "fhi-invite-qr.png"
    a.click()
  }

  const waText = encodeURIComponent(
    `Join me on FHI Global — Dubai's premier real estate portal. Create your account here: ${inviteUrl}`,
  )

  // What this user's rank may set on a recruit, mirroring the ladder the two API
  // routes enforce (INVITE_GRANTABLE_ROLES in app-roles.ts): team leaders reach
  // unit manager, unit managers reach agent, agents and members reach member.
  // An empty set means a read-only list.
  const grantable = invitableRolesFor(currentRole)
  const canGrant = (role: string) => roleInList(role, grantable)

  // Approving is allowed whenever the recruit's rank is one this user could have
  // granted — so a member can still confirm their own member referral even
  // though there is nothing else for them to pick.
  const canApprove = (r: Recruit) => canGrant(r.role)
  // The dropdown only appears when there is an actual choice to make.
  const canEditRole = (r: Recruit) => grantable.length > 1 && canGrant(r.role)

  // Effective role picked for a recruit — the explicit choice, else its current
  // role, else the lowest rank this user can grant.
  const roleFor = (r: Recruit): string => {
    const chosen = roleChoice[r.id]
    if (chosen) return chosen
    const current = r.role.toLowerCase().trim()
    return canGrant(current) ? current : (grantable[grantable.length - 1] ?? "member")
  }

  // "Team Secretary" is twice the width of "Member", so the column is sized to
  // the longest label this caller can actually put in it rather than to a fixed
  // guess — an agent's column stays narrow, an admin's gets the room it needs.
  // Both what this caller can pick AND what the recruits already are — a recruit
  // can carry a rank the viewer can't grant (an admin set it), and that one
  // renders as a plain chip with no truncation.
  const longestRoleLabel = Math.max(
    6,
    ...grantable.map((r) => roleToLabel(r).length),
    ...recruits.map((r) => roleToLabel(r.role).length),
  )
  const roleColWidth = longestRoleLabel > 12 ? "w-32" : longestRoleLabel > 6 ? "w-28" : "w-20"

  // Distinct chip colors per role so members vs agents are easy to scan.
  const roleChipCls = (role: string) => {
    const c = ROLE_COLORS[role.toLowerCase().trim()] ?? ROLE_COLORS.member
    return `${c.bg} ${c.text} ${c.border}`
  }

  // Re-fetch only the recruits data (no full page reload).
  const handleRefresh = async () => {
    setRefreshing(true)
    setApproveError(null)
    try {
      const res = await fetch("/api/invite/recruits", { cache: "no-store" })
      if (!res.ok) throw new Error("failed")
      const data = (await res.json()) as { recruits?: Recruit[] }
      setRecruits(data.recruits ?? [])
      setRecruitsError(false)
    } catch {
      setRecruitsError(true)
    } finally {
      setRefreshing(false)
    }
  }

  // ── Exports (always the full filtered list, not just the visible page) ──

  const exportExcel = () => {
    const rows = [
      ["Name", "Email", "Role", "Contact Number", "WhatsApp Number", "Status", "Date Joined"],
      ...filtered.map((r) => [r.fullname, r.email ?? "", roleToLabel(r.role), r.phone ?? "", r.whatsapp ?? "", r.status, joinedLabel(r.joinedAt)]),
    ]
    // BOM so Excel opens UTF-8 names (ñ, Arabic, …) correctly.
    const csv = "﻿" + rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `my-recruits-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportPdf = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=900,height=700")
    if (!w) return
    const generated = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
    const body = filtered
      .map(
        (r, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td><strong>${esc(r.fullname)}</strong></td>
          <td>${esc(r.email ?? "—")}</td>
          <td>${esc(roleToLabel(r.role))}</td>
          <td>${esc(r.phone ?? "—")}</td>
          <td>${esc(r.whatsapp ?? "—")}</td>
          <td><span class="pill ${r.status === "active" ? "ok" : "wait"}">${r.status === "active" ? "Active" : "Pending"}</span></td>
          <td>${esc(joinedLabel(r.joinedAt))}</td>
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>My Recruits — ${esc(userName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #ffffff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; gap: 24px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12.5px; }
  th { background: #001f3f; color: #ffffff; text-align: left; padding: 9px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 9px 12px; border-bottom: 1px solid #eef0f3; }
  tr:nth-child(even) td { background: #fafbfc; }
  .n { color: #9ca3af; width: 34px; }
  .pill { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .ok { background: #d1fae5; color: #065f46; }
  .wait { background: #fef3c7; color: #92400e; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { margin: 14mm; }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Recruitment Report</p><h1>My Recruits</h1></div>
  <div class="meta">
    <span>Recruiter: <strong>${esc(userName)}</strong></span>
    <span>Generated: <strong>${esc(generated)}</strong></span>
    <span>Total recruits: <strong>${filtered.length}</strong></span>
    ${query.trim() ? `<span>Filter: <strong>“${esc(query.trim())}”</strong></span>` : ""}
  </div>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Contact Number</th><th>WhatsApp</th><th>Status</th><th>Date Joined</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">Generated from the FHI Global dashboard · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    // Give the new window a beat to render before the print dialog opens.
    setTimeout(() => w.print(), 350)
  }

  const handleApprove = async (id: string) => {
    const recruit = recruits.find((r) => r.id === id)
    const role = recruit ? roleFor(recruit) : "member"
    setApprovingId(id)
    setApproveError(null)
    try {
      const res = await fetch(`/api/invite/recruits/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Couldn't approve this recruit.")
      }
      setRecruits((prev) => prev.map((r) => (r.id === id ? { ...r, status: "active", role } : r)))
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "Couldn't approve this recruit.")
    } finally {
      setApprovingId(null)
    }
  }

  // Change role from the dropdown — persists immediately for any recruit
  // (pending or active) without approving them. Approval stays a separate action.
  const handleRoleSelect = async (r: Recruit, role: string) => {
    setRoleChoice((prev) => ({ ...prev, [r.id]: role }))
    if (role === r.role.toLowerCase().trim()) return

    const prevRole = r.role
    setApprovingId(r.id)
    setApproveError(null)
    setRecruits((prev) => prev.map((x) => (x.id === r.id ? { ...x, role } : x))) // optimistic
    try {
      const res = await fetch(`/api/invite/recruits/${r.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Couldn't update the role.")
      }
    } catch (e) {
      setRecruits((prev) => prev.map((x) => (x.id === r.id ? { ...x, role: prevRole } : x))) // revert
      setApproveError(e instanceof Error ? e.message : "Couldn't update the role.")
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <>
      <div className="w-full space-y-6">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
            <QrCode className="w-6 h-6 text-[#001f3f]" />
            Invite 
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            This QR code is for sharing. Let others scan to connect with you and explore opportunities to join your growing real estate team
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ── QR card (stays in view while the recruits list scrolls) ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 flex flex-col items-center self-start lg:sticky lg:top-0">
            <div className="rounded-2xl border-4 border-[#d6b357] p-4 bg-white">
              {inviteUrl ? (
                <QRCodeSVG value={inviteUrl} size={190} level="M" fgColor="#001f3f" />
              ) : (
                <div className="w-[190px] h-[190px] animate-pulse bg-[#f3f4f6] rounded-xl" />
              )}
            </div>
            <p className="mt-4 font-['Outfit'] font-bold text-[#001f3f] text-lg text-center">
              Scan to join FHI Global
            </p>

            {/* Hidden high-resolution canvas used for the PNG download. */}
            <div ref={downloadRef} className="hidden" aria-hidden>
              {inviteUrl && (
                <QRCodeCanvas value={inviteUrl} size={1024} level="M" fgColor="#001f3f" marginSize={4} />
              )}
            </div>

            <div className="mt-5 w-full space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!inviteUrl}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b] transition-colors disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                Download QR
              </button>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#25d366] text-[#128c4b] text-sm font-bold hover:bg-[#25d366]/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!inviteUrl}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
                  copied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy invite link"}
              </button>
            </div>
          </div>

          {/* ── My recruits ── */}
          <div className="space-y-5">
            {/* ── My recruits ── */}
            <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
              <div className="flex items-center justify-between gap-2.5 mb-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b7280] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#d6b357]" />
                  My recruits ({recruits.length})
                </p>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing || recruitsLoading}
                  title="Refresh recruits"
                  aria-label="Refresh recruits"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#f4f6f9] text-[#6b7280] text-xs font-semibold hover:text-[#001f3f] hover:bg-[#e8eaed] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {/* ── Search + exports toolbar ── */}
              {!recruitsLoading && !recruitsError && recruits.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setPage(1)
                      }}
                      placeholder="Search by name or email…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] transition-colors"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={exportExcel}
                      disabled={filtered.length === 0}
                      title="Download as Excel (CSV)"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-40"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      type="button"
                      onClick={exportPdf}
                      disabled={filtered.length === 0}
                      title="Download report as PDF"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#001f3f]/15 bg-[#001f3f]/5 text-[#001f3f] text-xs font-bold hover:bg-[#001f3f]/10 transition-colors disabled:opacity-40"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
              )}

              {recruitsLoading ? (
                <p className="text-sm text-[#9ca3af] flex items-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading your recruits…
                </p>
              ) : recruitsError ? (
                <p className="text-sm text-[#9ca3af] py-4">
                  Couldn&apos;t load recruits right now — refresh to try again.
                </p>
              ) : recruits.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-4">
                  No sign-ups through your link yet — share your QR and they&apos;ll appear here.
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-4">
                  No recruits match <span className="font-semibold text-[#374151]">&ldquo;{query.trim()}&rdquo;</span> — try another name or email.
                </p>
              ) : (
                <ul className="divide-y divide-[#f0f2f5]">
                  {pageItems.map((r) => {
                    const editRole = canEditRole(r)
                    const showApprove = canApprove(r) && r.status !== "active"
                    const busy = approvingId === r.id
                    return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      {/* Avatar — turns amber with a warning icon when the recruit's profile is incomplete */}
                      {r.incomplete ? (
                        <span
                          title="This recruit hasn't completed their required profile details yet."
                          className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 border border-amber-300 flex items-center justify-center shrink-0"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-white text-sm font-bold flex items-center justify-center shrink-0">
                          {r.fullname.charAt(0).toUpperCase()}
                        </span>
                      )}

                      {/* Name + email */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#111827] truncate">{r.fullname}</p>
                        <p className="text-xs text-[#6b7280] truncate">{r.email ?? "—"}</p>
                      </div>

                      {/* Phone + WhatsApp column */}
                      <div className="shrink-0 hidden sm:block min-w-0 w-44 space-y-0.5">
                        <p className="text-xs text-[#6b7280] truncate flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
                          {r.phone ?? "—"}
                        </p>
                        <p className="text-xs text-[#6b7280] truncate flex items-center gap-1.5">
                          <WhatsAppIcon className="w-3.5 h-3.5 text-[#25d366] shrink-0" />
                          {r.whatsapp ?? "—"}
                        </p>
                      </div>

                      {/* Birth date column — hidden when the Approve button is
                          shown, so pending rows stay column-aligned. */}
                      {!showApprove && (
                        <div className="shrink-0 hidden sm:block text-right w-24">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Date of Birth</p>
                          <p className="text-xs text-[#6b7280]">{birthdayLabel(r.birthday)}</p>
                        </div>
                      )}

                      {/* Role column — colored chip-style dropdown when editable, static chip otherwise */}
                      <div className={`shrink-0 flex justify-center ${roleColWidth}`}>
                        {editRole ? (
                          <div className="relative inline-flex w-full">
                            <select
                              value={roleFor(r)}
                              disabled={busy}
                              onChange={(e) => void handleRoleSelect(r, e.target.value)}
                              className={`w-full appearance-none cursor-pointer rounded-full text-center text-[11px] font-bold capitalize pl-2.5 pr-6 py-1 border focus:outline-none transition-colors disabled:opacity-60 ${roleChipCls(roleFor(r))}`}
                            >
                              {grantable.map((role) => (
                                <option key={role} value={role}>
                                  {roleToLabel(role)}
                                </option>
                              ))}
                            </select>
                            {busy ? (
                              <Loader2 className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 animate-spin opacity-70 pointer-events-none" />
                            ) : (
                              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                            )}
                          </div>
                        ) : (
                          <span className={`w-full text-center px-2.5 py-1 rounded-full border text-[11px] font-bold capitalize ${roleChipCls(r.role)}`}>
                            {roleToLabel(r.role)}
                          </span>
                        )}
                      </div>

                      {/* Status column */}
                      <span
                        className={`shrink-0 w-20 text-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          r.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {r.status === "active" ? "Active" : "Pending"}
                      </span>

                      {/* Approve column (last) */}
                      {showApprove && (
                        <button
                          type="button"
                          onClick={() => void handleApprove(r.id)}
                          disabled={busy}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Approve
                        </button>
                      )}
                    </li>
                    )
                  })}
                </ul>
              )}

              {/* ── Pagination ── */}
              {!recruitsLoading && !recruitsError && totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-[#f0f2f5]">
                  <p className="text-xs text-[#9ca3af]">
                    Showing <span className="font-bold text-[#374151]">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of{" "}
                    <span className="font-bold text-[#374151]">{filtered.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(safePage - 1)}
                      disabled={safePage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </button>
                    <span className="text-xs font-bold text-[#001f3f] px-1">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(safePage + 1)}
                      disabled={safePage >= totalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-bold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {approveError && (
                <p className="text-xs text-rose-600 mt-3">{approveError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
