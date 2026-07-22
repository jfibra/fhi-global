"use client"

/**
 * Invite — the user's personal QR code and link to /register?ref=<their id>.
 * Registrations that arrive through it get metadata.invited_by set to the
 * inviter's profile id (see app/api/register/route.ts), so recruitment can be
 * tracked per agent.
 */

import { useEffect, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { Check, ChevronDown, Copy, Download, Loader2, MessageCircle, QrCode, RefreshCw, Users } from "lucide-react"
import { roleToLabel } from "@/lib/auth"
import { ROLE_COLORS } from "@/lib/app-roles"

type Recruit = {
  id: string
  fullname: string
  email: string | null
  role: string
  status: string
  joinedAt: string | null
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
  const [roleChoice, setRoleChoice] = useState<Record<string, "member" | "agent">>({})

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

  const roleValue = currentRole.toLowerCase().trim()

  // Team leaders and unit managers (and admin staff) can manage their own
  // recruits — but only members and agents. Anyone else sees a read-only list.
  const canApprove = ["team_leader", "unit_manager", "admin", "super_admin"].includes(roleValue)
  // Role can be set/changed for any member/agent recruit — pending OR active.
  const canEditRole = (r: Recruit) =>
    canApprove && ["member", "agent"].includes(r.role.toLowerCase().trim())

  // Effective role picked for a recruit — the explicit choice, else its current
  // role, else member.
  const roleFor = (r: Recruit): "member" | "agent" => {
    const chosen = roleChoice[r.id]
    if (chosen) return chosen
    return r.role.toLowerCase().trim() === "agent" ? "agent" : "member"
  }

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
  const handleRoleSelect = async (r: Recruit, role: "member" | "agent") => {
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
            Your personal QR code. Anyone who scans it lands on the registration page, and their
            account is credited to you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[352px_1fr] gap-6 items-start">
          {/* ── QR card (stays in view while the recruits list scrolls) ── */}
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-8 flex flex-col items-center self-start lg:sticky lg:top-0">
            <div className="rounded-2xl border-4 border-[#d6b357] p-5 bg-white">
              {inviteUrl ? (
                <QRCodeSVG value={inviteUrl} size={240} level="M" fgColor="#001f3f" />
              ) : (
                <div className="w-[240px] h-[240px] animate-pulse bg-[#f3f4f6] rounded-xl" />
              )}
            </div>
            <p className="mt-4 font-['Outfit'] font-bold text-[#001f3f] text-lg text-center">
              Scan to join FHI Global
            </p>
            <p className="text-xs text-[#9ca3af] text-center">Invited by {userName}</p>

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
              ) : (
                <ul className="divide-y divide-[#f0f2f5]">
                  {recruits.map((r) => {
                    const editRole = canEditRole(r)
                    const showApprove = editRole && r.status !== "active"
                    const busy = approvingId === r.id
                    return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      {/* Avatar */}
                      <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {r.fullname.charAt(0).toUpperCase()}
                      </span>

                      {/* Name + email */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#111827] truncate">{r.fullname}</p>
                        <p className="text-xs text-[#6b7280] truncate">{r.email ?? "—"}</p>
                      </div>

                      {/* Joined column */}
                      <div className="shrink-0 hidden sm:block text-right w-24">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Date Joined</p>
                        <p className="text-xs text-[#6b7280]">{joinedLabel(r.joinedAt)}</p>
                      </div>

                      {/* Role column — colored chip-style dropdown when editable, static chip otherwise */}
                      <div className="shrink-0 w-28 flex justify-center">
                        {editRole ? (
                          <div className="relative inline-flex">
                            <select
                              value={roleFor(r)}
                              disabled={busy}
                              onChange={(e) => void handleRoleSelect(r, e.target.value as "member" | "agent")}
                              className={`appearance-none cursor-pointer rounded-full text-[11px] font-bold uppercase tracking-wide pl-3 pr-7 py-1 border focus:outline-none transition-colors disabled:opacity-60 ${roleChipCls(roleFor(r))}`}
                            >
                              <option value="member">Member</option>
                              <option value="agent">Agent</option>
                            </select>
                            {busy ? (
                              <Loader2 className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 animate-spin opacity-70 pointer-events-none" />
                            ) : (
                              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                            )}
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${roleChipCls(r.role)}`}>
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
