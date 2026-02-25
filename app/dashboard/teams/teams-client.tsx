"use client"

import {
  useCallback, useEffect, useRef, useState,
} from "react"
import { createPortal } from "react-dom"
import {
  ChevronRight, ChevronDown, Plus, Search, Filter, ArrowUpDown,
  Building2, Users, Settings, Upload, Pencil, Trash2, ToggleLeft,
  ToggleRight, MoreHorizontal, UserPlus, ArrowRight, UserMinus,
  RefreshCw, Image as ImageIcon, CheckCircle2, XCircle,
  Loader2, AlertTriangle,
} from "lucide-react"
import {
  type Team,
  type TeamMemberProfile,
  type TeamFormData,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  toggleTeamActive,
  fetchTeamMembers,
  updateMemberRole,
  deactivateMembership,
  removeMembership,
} from "@/lib/team-service"
import { TeamFormDialog } from "./team-form-dialog"
import { TeamLogoUpload } from "./team-logo-upload"
import { AddMemberDialog, TransferMemberDialog } from "./add-member-dialog"

// ─── Toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string; variant: "success" | "error" }
let toastId = 0

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(teams: Team[]) {
  const roots  = teams.filter(t => !t.parent_id)
  const byParent: Record<string, Team[]> = {}
  teams.filter(t => t.parent_id).forEach(t => {
    ;(byParent[t.parent_id!] ??= []).push(t)
  })
  return { roots, byParent }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

// ─── Main Client ───────────────────────────────────────────────────────────────

export function TeamsClient({ currentRole: _role }: { currentRole: string; userId: string }) {
  const [teams,           setTeams]           = useState<Team[]>([])
  const [teamsLoading,    setTeamsLoading]     = useState(true)
  const [selectedId,      setSelectedId]       = useState<string | null>(null)
  const [expanded,        setExpanded]         = useState<Set<string>>(new Set())
  const [toasts,          setToasts]           = useState<Toast[]>([])

  // Member table state
  const [members,         setMembers]          = useState<TeamMemberProfile[]>([])
  const [membersTotal,    setMembersTotal]      = useState(0)
  const [membersLoading,  setMembersLoading]    = useState(false)
  const [memberPage,      setMemberPage]        = useState(1)
  const [memberPerPage,   setMemberPerPage]     = useState(10)
  const [memberSearch,    setMemberSearch]      = useState("")
  const [memberSort,      setMemberSort]        = useState<{ field: "fullname" | "joined_at" | "role_in_team"; dir: "asc" | "desc" }>({ field: "joined_at", dir: "desc" })
  const [showInactive,    setShowInactive]      = useState(false)

  // Dialogs
  const [teamFormOpen,    setTeamFormOpen]      = useState(false)
  const [editingTeam,     setEditingTeam]       = useState<Team | null>(null)
  const [logoUploadOpen,  setLogoUploadOpen]    = useState(false)
  const [logoTeam,        setLogoTeam]          = useState<Team | null>(null)
  const [addMemberOpen,   setAddMemberOpen]     = useState(false)
  const [transferOpen,    setTransferOpen]      = useState(false)
  const [transferMembership, setTransferMembership] = useState<TeamMemberProfile | null>(null)
  const [editRoleOpen,    setEditRoleOpen]      = useState(false)
  const [editRoleMembership, setEditRoleMembership] = useState<TeamMemberProfile | null>(null)

  // Confirm delete
  const [confirmDelete, setConfirmDelete]       = useState<{ type: "team" | "member"; id: string; label: string } | null>(null)

  // ── Load teams ───────────────────────────────────────────────────────────────

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true)
    const { data, error } = await fetchTeams()
    setTeamsLoading(false)
    if (error) { addToast(error, "error"); return }
    setTeams(data ?? [])
    if (data && data.length && !selectedId) {
      setSelectedId(data[0].id)
    }
  }, [selectedId])

  useEffect(() => { loadTeams() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load members for selected team ───────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    if (!selectedId) return
    setMembersLoading(true)
    const { data, total, error } = await fetchTeamMembers({
      teamId:     selectedId,
      page:       memberPage,
      perPage:    memberPerPage,
      search:     memberSearch,
      activeOnly: !showInactive,
      sortField:  memberSort.field,
      sortDir:    memberSort.dir,
    })
    setMembersLoading(false)
    if (error) { addToast(error, "error"); return }
    setMembers(data ?? [])
    setMembersTotal(total ?? 0)
  }, [selectedId, memberPage, memberPerPage, memberSearch, memberSort, showInactive])

  useEffect(() => { loadMembers() }, [loadMembers])

  useEffect(() => { setMemberPage(1) }, [selectedId, memberSearch, memberSort, showInactive])

  // ── Toast helper ─────────────────────────────────────────────────────────────

  function addToast(message: string, variant: "success" | "error") {
    const id = ++toastId
    setToasts(p => [...p, { id, message, variant }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }

  // ── Team tree helpers ─────────────────────────────────────────────────────────

  const { roots, byParent } = buildTree(teams)
  const selectedTeam = teams.find(t => t.id === selectedId) ?? null

  const toggleExpand = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectTeam = (id: string) => {
    setSelectedId(id)
    setMemberPage(1)
    setMemberSearch("")
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────────

  const handleSaveTeam = async (data: TeamFormData) => {
    if (editingTeam) {
      const { error } = await updateTeam(editingTeam.id, data)
      if (error) { addToast(error, "error"); throw error }
      addToast("Team updated", "success")
    } else {
      const { data: created, error } = await createTeam(data)
      if (error) { addToast(error, "error"); throw error }
      if (created) setSelectedId(created.id)
      addToast("Team created", "success")
    }
    await loadTeams()
  }

  const handleToggleTeam = async (team: Team) => {
    const { error } = await toggleTeamActive(team)
    if (error) { addToast(error, "error"); return }
    addToast(`Team ${team.is_active ? "deactivated" : "activated"}`, "success")
    await loadTeams()
  }

  const handleDeleteTeam = async (id: string) => {
    const { error } = await deleteTeam(id)
    if (error) { addToast(error, "error"); return }
    addToast("Team deleted", "success")
    if (selectedId === id) setSelectedId(null)
    await loadTeams()
  }

  const handleLogoUploaded = (url: string) => {
    setTeams(prev => prev.map(t => t.id === logoTeam?.id ? { ...t, logo_url: url } : t))
    addToast("Logo uploaded successfully", "success")
  }

  const handleTransferred = () => {
    addToast("Member transferred", "success")
    loadMembers()
  }

  const handleMemberAdded = () => {
    addToast("Member added", "success")
    loadMembers()
  }

  // ── Sorting helper ────────────────────────────────────────────────────────────

  const toggleSort = (field: typeof memberSort.field) =>
    setMemberSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }))

  const subteams = selectedTeam ? (byParent[selectedTeam.id] ?? []) : []

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#0d1117]">Teams & Departments</h2>
          <p className="text-sm text-[#9ca3af] mt-0.5">Manage teams, subteams, and members</p>
        </div>
        <button
          onClick={() => { setEditingTeam(null); setTeamFormOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#001f3f] text-white rounded-2xl text-sm font-semibold hover:bg-[#002a56] shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-5 min-h-0" style={{ minHeight: "calc(100vh - 220px)" }}>

        {/* ── Sidebar tree ─────────────────────────────────────────────────── */}
        <aside className="w-56 xl:w-64 shrink-0 flex flex-col rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#f0f2f5]">
            <p className="text-xs font-bold text-[#374151] uppercase tracking-wider">Departments</p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {teamsLoading ? (
              <div className="space-y-2 px-3 py-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-8 rounded-xl bg-[#f4f6f9] animate-pulse" />
                ))}
              </div>
            ) : teams.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Building2 className="w-8 h-8 text-[#d1d5db] mx-auto mb-2" />
                <p className="text-xs text-[#9ca3af]">No teams yet</p>
              </div>
            ) : (
              <ul className="px-2">
                {roots.map(team => (
                  <TreeNode
                    key={team.id}
                    team={team}
                    children={byParent[team.id] ?? []}
                    selectedId={selectedId}
                    expanded={expanded}
                    onSelect={selectTeam}
                    onToggleExpand={toggleExpand}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {!selectedTeam ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center rounded-2xl bg-white border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-12">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-[#f4f6f9] flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-7 h-7 text-[#9ca3af]" />
                </div>
                <h3 className="font-['Space_Grotesk'] text-base font-bold text-[#0d1117] mb-1">No team selected</h3>
                <p className="text-sm text-[#9ca3af] mb-5">
                  {teams.length === 0
                    ? "No teams created yet. Create your first team to start organising members."
                    : "Select a team from the sidebar to view details."}
                </p>
                {teams.length === 0 && (
                  <button
                    onClick={() => { setEditingTeam(null); setTeamFormOpen(true) }}
                    className="px-4 py-2 bg-[#001f3f] text-white rounded-2xl text-sm font-semibold hover:bg-[#002a56] transition-all"
                  >
                    Create Team
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ── Team header card ─────────────────────────────────────── */}
              <TeamHeaderCard
                team={selectedTeam}
                subteamCount={subteams.length}
                memberCount={membersTotal}
                onEdit={() => { setEditingTeam(selectedTeam); setTeamFormOpen(true) }}
                onUploadLogo={() => { setLogoTeam(selectedTeam); setLogoUploadOpen(true) }}
                onToggleActive={() => handleToggleTeam(selectedTeam)}
                onDelete={() => setConfirmDelete({ type: "team", id: selectedTeam.id, label: selectedTeam.name })}
              />

              {/* ── Members table card ───────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
                {/* Table header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5] flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0d1117]">Members</h3>
                    <p className="text-xs text-[#9ca3af] mt-0.5">{membersTotal} {showInactive ? "total" : "active"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
                      <input
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        placeholder="Search members…"
                        className="pl-8 pr-3 py-2 rounded-xl border border-[#e8eaed] text-xs bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none placeholder:text-[#9ca3af] text-[#0d1117] w-44 transition-all"
                      />
                    </div>

                    {/* Active / All toggle */}
                    <button
                      onClick={() => setShowInactive(p => !p)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        showInactive
                          ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]"
                          : "border-[#e8eaed] bg-white text-[#6b7280] hover:bg-[#f4f6f9]"
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      {showInactive ? "All" : "Active"}
                    </button>

                    {/* Per-page */}
                    <select
                      value={memberPerPage}
                      onChange={e => { setMemberPerPage(Number(e.target.value)); setMemberPage(1) }}
                      className="px-2 py-2 rounded-xl border border-[#e8eaed] text-xs bg-white text-[#6b7280] outline-none cursor-pointer"
                    >
                      {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                    </select>

                    {/* Add member */}
                    <button
                      onClick={() => setAddMemberOpen(true)}
                      disabled={!selectedTeam.is_active}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#001f3f] text-white rounded-xl text-xs font-semibold hover:bg-[#002a56] disabled:opacity-40 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Member
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-[#6b7280] w-10">#</th>
                        <SortTh label="Name"      field="fullname"    current={memberSort} onToggle={toggleSort} />
                        <SortTh label="Role"      field="role_in_team" current={memberSort} onToggle={toggleSort} />
                        <SortTh label="Joined"    field="joined_at"   current={memberSort} onToggle={toggleSort} />
                        <th className="text-left px-6 py-3 text-xs font-semibold text-[#6b7280]">Status</th>
                        <th className="px-6 py-3 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {membersLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-[#f0f2f5]">
                            {[1,2,3,4,5,6].map(j => (
                              <td key={j} className="px-6 py-4">
                                <div className="h-3.5 bg-[#f0f2f5] rounded-xl animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : members.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <Users className="w-8 h-8 text-[#d1d5db] mx-auto mb-2" />
                            <p className="text-sm text-[#9ca3af]">No members found.</p>
                            {memberSearch && <p className="text-xs text-[#9ca3af] mt-1">Try clearing your search.</p>}
                          </td>
                        </tr>
                      ) : (
                        members.map((m, idx) => (
                          <MemberRow
                            key={m.id}
                            membership={m}
                            index={(memberPage - 1) * memberPerPage + idx + 1}
                            teams={teams}
                            currentTeamId={selectedId!}
                            onEditRole={() => { setEditRoleMembership(m); setEditRoleOpen(true) }}
                            onTransfer={() => { setTransferMembership(m); setTransferOpen(true) }}
                            onDeactivate={async () => {
                              const { error } = await deactivateMembership(m.id)
                              error ? addToast(error, "error") : addToast("Membership deactivated", "success")
                              loadMembers()
                            }}
                            onRemove={() => setConfirmDelete({ type: "member", id: m.id, label: m.profiles?.fullname ?? "member" })}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {membersTotal > memberPerPage && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-[#f0f2f5] bg-[#fafbfc]">
                    <p className="text-xs text-[#9ca3af]">
                      {((memberPage - 1) * memberPerPage) + 1}–{Math.min(memberPage * memberPerPage, membersTotal)} of {membersTotal}
                    </p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(membersTotal / memberPerPage) }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === Math.ceil(membersTotal / memberPerPage) || Math.abs(p - memberPage) <= 1)
                        .reduce<(number | "…")[]>((acc, p, i, arr) => {
                          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…")
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, i) =>
                          p === "…" ? (
                            <span key={`ellipsis-${i}`} className="px-2 text-xs text-[#9ca3af]">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setMemberPage(p as number)}
                              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                                memberPage === p
                                  ? "bg-[#001f3f] text-white"
                                  : "text-[#6b7280] hover:bg-[#f4f6f9]"
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Subteams list ─────────────────────────────────────────── */}
              {!selectedTeam.parent_id && (
                <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5]">
                    <div>
                      <h3 className="text-sm font-bold text-[#0d1117]">Subteams</h3>
                      <p className="text-xs text-[#9ca3af] mt-0.5">{subteams.length} subteam{subteams.length !== 1 ? "s" : ""}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingTeam(null)
                        setTeamFormOpen(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#e8eaed] rounded-xl text-xs font-semibold text-[#6b7280] hover:bg-[#f4f6f9] transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Subteam
                    </button>
                  </div>
                  <div className="p-5">
                    {subteams.length === 0 ? (
                      <p className="text-xs text-[#9ca3af] text-center py-6">No subteams for this team yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {subteams.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => selectTeam(sub.id)}
                            className="text-left p-4 rounded-2xl border border-[#f0f2f5] bg-[#fafbfc] hover:border-[#e8eaed] hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              {sub.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={sub.logo_url} alt={sub.name} className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-[#001f3f]/8 flex items-center justify-center">
                                  <Building2 className="w-4 h-4 text-[#001f3f]" />
                                </div>
                              )}
                              <span className="text-xs font-bold text-[#0d1117] group-hover:text-[#001f3f] transition-colors flex-1 truncate">
                                {sub.name}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#d1d5db] group-hover:text-[#001f3f] transition-colors shrink-0" />
                            </div>
                            <div className="flex items-center gap-2">
                              {sub.team_type && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f4f6f9] text-[#6b7280] font-semibold">
                                  {sub.team_type}
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                sub.is_active ? "bg-emerald-50 text-emerald-600" : "bg-[#f4f6f9] text-[#9ca3af]"
                              }`}>
                                {sub.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}

      <TeamFormDialog
        open={teamFormOpen}
        onClose={() => setTeamFormOpen(false)}
        onSave={handleSaveTeam}
        initialData={editingTeam}
        teams={teams}
      />

      {logoTeam && (
        <TeamLogoUpload
          open={logoUploadOpen}
          onClose={() => setLogoUploadOpen(false)}
          onUploaded={handleLogoUploaded}
          team={logoTeam}
        />
      )}

      {selectedTeam && (
        <AddMemberDialog
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onAdded={handleMemberAdded}
          team={selectedTeam}
        />
      )}

      {transferMembership && selectedId && (
        <TransferMemberDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          onTransferred={handleTransferred}
          membership={transferMembership}
          teams={teams}
          currentTeamId={selectedId}
        />
      )}

      {editRoleMembership && (
        <EditRoleModal
          open={editRoleOpen}
          onClose={() => setEditRoleOpen(false)}
          membership={editRoleMembership}
          onSaved={async (role) => {
            const { error } = await updateMemberRole(editRoleMembership.id, role)
            if (error) { addToast(error, "error"); return }
            addToast("Role updated", "success")
            setEditRoleOpen(false)
            loadMembers()
          }}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type === "team" ? "Team" : "Membership"}`}
          description={`Are you sure you want to delete "${confirmDelete.label}"? This action cannot be undone.`}
          onConfirm={async () => {
            if (confirmDelete.type === "team") {
              await handleDeleteTeam(confirmDelete.id)
            } else {
              const { error } = await removeMembership(confirmDelete.id)
              error ? addToast(error, "error") : addToast("Member removed", "success")
              loadMembers()
            }
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Toasts */}
      <ToastList toasts={toasts} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── TreeNode ─────────────────────────────────────────────────────────────────

function TreeNode({
  team, children, selectedId, expanded, onSelect, onToggleExpand,
}: {
  team: Team
  children: Team[]
  selectedId: string | null
  expanded: Set<string>
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}) {
  const isSelected = selectedId === team.id
  const isExpanded = expanded.has(team.id)
  const hasSubs    = children.length > 0

  return (
    <li>
      <div className={`flex items-center rounded-xl px-2 py-2 cursor-pointer transition-all text-sm group
        ${isSelected ? "bg-[#001f3f]/8 text-[#001f3f]" : "text-[#374151] hover:bg-[#f4f6f9]"}`}>
        {/* expand toggle */}
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center shrink-0 mr-1"
          onClick={e => { e.stopPropagation(); if (hasSubs) onToggleExpand(team.id) }}
        >
          {hasSubs
            ? isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af]" />
              : <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
            : <span className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => { onSelect(team.id); if (hasSubs) onToggleExpand(team.id) }}
        >
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt={team.name} className="w-6 h-6 rounded-lg object-cover shrink-0" />
          ) : (
            <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-[#001f3f]" : "text-[#9ca3af]"}`} />
          )}
          <span className={`truncate text-xs font-semibold ${isSelected ? "text-[#001f3f]" : "text-[#374151]"}`}>
            {team.name}
          </span>
          {!team.is_active && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f0f2f5] text-[#9ca3af] font-semibold shrink-0">off</span>
          )}
        </button>
      </div>

      {hasSubs && isExpanded && (
        <ul className="ml-4 border-l border-[#f0f2f5] pl-1">
          {children.map(child => (
            <TreeNode
              key={child.id}
              team={child}
              children={[]}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── TeamHeaderCard ─────────────────────────────────────────────────────────────

function TeamHeaderCard({
  team, subteamCount, memberCount,
  onEdit, onUploadLogo, onToggleActive, onDelete,
}: {
  team: Team
  subteamCount: number
  memberCount: number
  onEdit: () => void
  onUploadLogo: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setMenuOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const actionItem = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      key={label}
      onMouseDown={e => { e.stopPropagation(); action(); setMenuOpen(false) }}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
        danger ? "text-rose-500 hover:bg-rose-50" : "text-[#374151] hover:bg-[#f4f6f9]"
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)] p-6">
      <div className="flex items-start gap-5 flex-wrap">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl border border-[#e8eaed] bg-[#fafbfc] flex items-center justify-center shrink-0 overflow-hidden">
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-7 h-7 text-[#9ca3af]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h3 className="font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">{team.name}</h3>
            {team.team_type && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#f4f6f9] text-[#6b7280] font-semibold border border-[#e8eaed]">
                {team.team_type}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${
              team.is_active
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-[#f4f6f9] text-[#9ca3af] border-[#e8eaed]"
            }`}>
              {team.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {team.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          {team.description && (
            <p className="text-xs text-[#6b7280] leading-relaxed mb-2 line-clamp-2">{team.description}</p>
          )}
          <div className="flex items-center gap-4 text-[11px] text-[#9ca3af] flex-wrap">
            <span className="flex items-center gap-1.5"><Users className="w-3 h-3" />{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
            {!team.parent_id && <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />{subteamCount} subteam{subteamCount !== 1 ? "s" : ""}</span>}
            <span>Created {fmtDate(team.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#e8eaed] text-xs font-semibold text-[#374151] hover:bg-[#f4f6f9] transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            ref={btnRef}
            onClick={openMenu}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#e8eaed] bg-white text-[#6b7280] hover:bg-[#f4f6f9] transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dropdown via portal */}
      {menuOpen && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "absolute", top: pos.top, right: pos.right, zIndex: 300 }}
          className="w-52 bg-white rounded-2xl border border-[#e8eaed] shadow-xl py-1 overflow-hidden"
        >
          {actionItem(<Upload className="w-3.5 h-3.5" />, "Upload Logo", onUploadLogo)}
          {actionItem(
            team.is_active
              ? <ToggleLeft className="w-3.5 h-3.5" />
              : <ToggleRight className="w-3.5 h-3.5" />,
            team.is_active ? "Deactivate Team" : "Activate Team",
            onToggleActive,
          )}
          <div className="border-t border-[#f0f2f5] my-1" />
          {actionItem(<Trash2 className="w-3.5 h-3.5" />, "Delete Team", onDelete, true)}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── SortTh ─────────────────────────────────────────────────────────────────────

function SortTh({
  label, field, current, onToggle,
}: {
  label: string
  field: "fullname" | "joined_at" | "role_in_team"
  current: { field: string; dir: string }
  onToggle: (f: "fullname" | "joined_at" | "role_in_team") => void
}) {
  const active = current.field === field
  return (
    <th className="text-left px-6 py-3">
      <button
        onClick={() => onToggle(field)}
        className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
          active ? "text-[#001f3f]" : "text-[#6b7280] hover:text-[#374151]"
        }`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  )
}

// ── MemberRow ─────────────────────────────────────────────────────────────────

function MemberRow({
  membership, index, teams, currentTeamId,
  onEditRole, onTransfer, onDeactivate, onRemove,
}: {
  membership: TeamMemberProfile
  index: number
  teams: Team[]
  currentTeamId: string
  onEditRole: () => void
  onTransfer: () => void
  onDeactivate: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const profile = membership.profiles
  const name    = (profile?.fullname ?? `${(profile?.fname ?? "")} ${(profile?.lname ?? "")}`.trim()) || "—"
  const initials = name.charAt(0).toUpperCase()

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const hasOtherTeams = teams.some(t => t.id !== currentTeamId && t.is_active)

  const menuItem = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      key={label}
      onMouseDown={e => { e.stopPropagation(); action(); setOpen(false) }}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
        danger ? "text-rose-500 hover:bg-rose-50" : "text-[#374151] hover:bg-[#f4f6f9]"
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <tr className="border-b border-[#f0f2f5] hover:bg-[#fafbfc] transition-colors">
      <td className="px-6 py-3.5 text-xs text-[#9ca3af]">{index}</td>
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          {profile?.profile_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_url} alt={name} className="w-8 h-8 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#001f3f]/8 flex items-center justify-center text-xs font-bold text-[#001f3f] shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0d1117] truncate">{name}</p>
            {profile?.role && <p className="text-[11px] text-[#9ca3af]">{profile.role}</p>}
          </div>
        </div>
      </td>
      <td className="px-6 py-3.5">
        <span className="text-xs text-[#374151] font-medium">
          {membership.role_in_team ?? <span className="text-[#9ca3af] italic">—</span>}
        </span>
      </td>
      <td className="px-6 py-3.5 text-xs text-[#6b7280]">{fmtDate(membership.joined_at)}</td>
      <td className="px-6 py-3.5">
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
          membership.is_active
            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
            : "bg-[#f4f6f9] text-[#9ca3af] border border-[#e8eaed]"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${membership.is_active ? "bg-emerald-400" : "bg-[#d1d5db]"}`} />
          {membership.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-6 py-3.5 text-right">
        <button
          ref={btnRef}
          onClick={openMenu}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6f9] text-[#9ca3af] hover:text-[#374151] transition-all"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {open && typeof window !== "undefined" && createPortal(
          <div
            ref={menuRef}
            style={{ position: "absolute", top: pos.top, right: pos.right, zIndex: 300 }}
            className="w-48 bg-white rounded-2xl border border-[#e8eaed] shadow-xl py-1 overflow-hidden"
          >
            {menuItem(<Pencil className="w-3.5 h-3.5" />, "Edit Role", onEditRole)}
            {hasOtherTeams && menuItem(<ArrowRight className="w-3.5 h-3.5" />, "Transfer", onTransfer)}
            {membership.is_active && menuItem(<ToggleLeft className="w-3.5 h-3.5" />, "Deactivate", onDeactivate)}
            <div className="border-t border-[#f0f2f5] my-1" />
            {menuItem(<UserMinus className="w-3.5 h-3.5" />, "Remove from Team", onRemove, true)}
          </div>,
          document.body,
        )}
      </td>
    </tr>
  )
}

// ── EditRoleModal ──────────────────────────────────────────────────────────────

function EditRoleModal({
  open, onClose, membership, onSaved,
}: {
  open: boolean
  onClose: () => void
  membership: TeamMemberProfile
  onSaved: (role: string) => Promise<void>
}) {
  const [role,    setRole]    = useState(membership.role_in_team ?? "")
  const [saving,  setSaving]  = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (open) setRole(membership.role_in_team ?? "") }, [open, membership])

  if (!mounted || !open) return null

  const handle = async () => {
    setSaving(true)
    await onSaved(role)
    setSaving(false)
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#e8eaed]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5]">
          <h2 className="font-['Space_Grotesk'] text-base font-bold text-[#0d1117]">Edit Role</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-xs font-semibold text-[#374151] mb-1.5">Role in Team</label>
          <div className="relative">
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full appearance-none px-3 py-2.5 pr-10 rounded-xl border border-[#e8eaed] text-sm bg-white focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 outline-none text-[#0d1117] transition-all"
            >
              <option value="">— No specific role —</option>
              {["Agent","Secretary","Team Leader","Unit Manager","Member","Observer"].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">▾</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f2f5] bg-[#fafbfc] rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all">Cancel</button>
          <button onClick={handle} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#001f3f] hover:bg-[#002a56] disabled:opacity-40 flex items-center gap-2 transition-all">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, onConfirm, onCancel,
}: {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#e8eaed] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[#0d1117]">{title}</h3>
            <p className="text-xs text-[#9ca3af] mt-0.5 leading-snug">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all">Cancel</button>
          <button
            onMouseDown={onConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 flex items-center gap-2 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── ToastList ─────────────────────────────────────────────────────────────────

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return createPortal(
    <div className="fixed bottom-6 right-6 z-[400] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold border text-white animate-in slide-in-from-bottom-2 duration-300 min-w-0 max-w-xs
            ${t.variant === "success"
              ? "bg-[#001f3f] border-[#002a56]"
              : "bg-rose-500 border-rose-600"
            }`}
        >
          {t.variant === "success"
            ? <CheckCircle2 className="w-4 h-4 text-[#d6b357] shrink-0" />
            : <XCircle className="w-4 h-4 text-white shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
