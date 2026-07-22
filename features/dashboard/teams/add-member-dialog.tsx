"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Loader2, Search, User } from "lucide-react"
import {
  type Team,
  type ProfileSearchResult,
  searchProfiles,
  addTeamMember,
  transferMember,
  type TeamMemberProfile,
} from "@/lib/team-service"

// ─── Add Member dialog ─────────────────────────────────────────────────────────

interface AddMemberProps {
  open: boolean
  onClose: () => void
  onAdded: () => void
  team: Team
}

const TEAM_ROLES = ["Agent", "Secretary", "Team Leader", "Unit Manager", "Member", "Observer"]

export function AddMemberDialog({ open, onClose, onAdded, team }: AddMemberProps) {
  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<ProfileSearchResult[]>([])
  const [selected,  setSelected]  = useState<ProfileSearchResult | null>(null)
  const [roleStr,   setRoleStr]   = useState("")
  const [searching, setSearching] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [mounted,   setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setSelected(null)
      setRoleStr(""); setError(null)
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    setSearching(true)
    const { data } = await searchProfiles(q, 15)
    setResults(data)
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { if (open) doSearch(query) }, 300)
    return () => clearTimeout(t)
  }, [query, open, doSearch])

  const handleSave = async () => {
    if (!selected) { setError("Please select a user."); return }
    if (!team.is_active) { setError("Cannot add members to an inactive team."); return }
    setSaving(true); setError(null)
    const { error: err } = await addTeamMember(team.id, {
      user_id:      selected.id,
      role_in_team: roleStr,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onAdded()
    onClose()
  }

  if (!mounted || !open) return null

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl border border-[#e8eaed] flex flex-col"
        style={{ maxWidth: "min(520px, calc(100% - 2rem))", maxHeight: "calc(100dvh - 3rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5] shrink-0">
          <div>
            <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Add Member</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">Add a user to {team.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">
              User <span className="text-rose-500">*</span>
            </label>
            {selected ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#001f3f]/30 bg-[#001f3f]/4">
                <div className="w-8 h-8 rounded-xl bg-[#001f3f]/10 flex items-center justify-center text-xs font-bold text-[#001f3f]">
                  {(selected.fullname ?? "U").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0d1117] truncate">{selected.fullname ?? "—"}</p>
                  <p className="text-[11px] text-[#9ca3af]">{selected.role ?? "—"}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[#9ca3af] hover:text-rose-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e8eaed] text-sm bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none placeholder:text-[#9ca3af] text-[#0d1117] transition-all"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#9ca3af]" />}
                </div>
                {results.length > 0 && (
                  <div className="mt-1 border border-[#e8eaed] rounded-xl bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {results.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelected(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f4f6f9] transition-colors text-sm"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#001f3f]/8 flex items-center justify-center text-xs font-bold text-[#001f3f] shrink-0">
                          {(r.fullname ?? "U").charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#0d1117] truncate">{r.fullname ?? "—"}</p>
                          {r.role && <p className="text-[11px] text-[#9ca3af]">{r.role}</p>}
                        </div>
                        <User className="w-3.5 h-3.5 text-[#d1d5db] shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {!searching && results.length === 0 && query.length > 1 && (
                  <p className="text-xs text-[#9ca3af] mt-2 text-center">No users found.</p>
                )}
              </>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Role in Team</label>
            <div className="relative">
              <select
                value={roleStr}
                onChange={e => setRoleStr(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-10 rounded-xl border border-[#e8eaed] text-sm bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none text-[#0d1117] transition-all"
              >
                <option value="">— Select a role —</option>
                {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">▾</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f2f5] bg-[#fafbfc] rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selected}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#001f3f] hover:bg-[#002a56] disabled:opacity-40 flex items-center gap-2 transition-all"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Add Member
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

// ─── Transfer Member dialog ────────────────────────────────────────────────────

interface TransferProps {
  open: boolean
  onClose: () => void
  onTransferred: () => void
  membership: TeamMemberProfile
  teams: Team[]
  currentTeamId: string
}

export function TransferMemberDialog({
  open, onClose, onTransferred, membership, teams, currentTeamId,
}: TransferProps) {
  const [targetTeamId, setTargetTeamId] = useState("")
  const [roleInTeam,   setRoleInTeam]   = useState(membership.role_in_team ?? "")
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [mounted,      setMounted]      = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!open) { setTargetTeamId(""); setError(null) }
  }, [open])

  const memberName = membership.profiles?.fullname ?? "Member"
  const available  = teams.filter(t => t.id !== currentTeamId && t.is_active)

  const handleTransfer = async () => {
    if (!targetTeamId) { setError("Please select a target team."); return }
    setSaving(true); setError(null)
    const { error: err } = await transferMember({
      membershipId: membership.id,
      userId:       membership.user_id,
      fromTeamId:   currentTeamId,
      toTeamId:     targetTeamId,
      roleInTeam,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onTransferred()
    onClose()
  }

  if (!mounted || !open) return null

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl border border-[#e8eaed] flex flex-col"
        style={{ maxWidth: "min(480px, calc(100% - 2rem))", maxHeight: "calc(100dvh - 3rem)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5] shrink-0">
          <div>
            <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Transfer Member</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">Move {memberName} to another team</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-snug">
            The membership in the current team will be closed and a new one will be created in the destination team.
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">
              Transfer to <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={targetTeamId}
                onChange={e => setTargetTeamId(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-10 rounded-xl border border-[#e8eaed] text-sm bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none text-[#0d1117] transition-all"
              >
                <option value="">— Select destination team —</option>
                {available.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.parent_id ? `  ↳ ${t.name}` : t.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">▾</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Role in New Team</label>
            <div className="relative">
              <select
                value={roleInTeam}
                onChange={e => setRoleInTeam(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-10 rounded-xl border border-[#e8eaed] text-sm bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none text-[#0d1117] transition-all"
              >
                <option value="">— Same role —</option>
                {["Agent","Secretary","Team Leader","Unit Manager","Member","Observer"].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">▾</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f2f5] bg-[#fafbfc] rounded-b-2xl shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all">
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={saving || !targetTeamId}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#d6b357] hover:bg-[#c4a245] disabled:opacity-40 flex items-center gap-2 transition-all"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Transfer
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
