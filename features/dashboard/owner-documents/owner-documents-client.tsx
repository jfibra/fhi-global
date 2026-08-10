"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { toast } from "sonner"
import {
  ScrollText, Plus, Link2, Eye, XCircle, Loader2, FileText, Image as ImageIcon,
  ExternalLink, Clock, CheckCircle2, Ban, Trash2, Search, ArrowLeft,
} from "lucide-react"
import { DataTable, type DataTableColumn } from "@/components/common/data-table"
import { roleToLabel } from "@/lib/app-roles"
import {
  fetchMyOwnerDocumentRequests,
  fetchAllOwnerDocumentRequestsAdmin,
  createOwnerDocumentRequest,
  fetchOwnerDocumentFiles,
  cancelOwnerDocumentRequest,
  deleteOwnerDocumentRequestAdmin,
  ownerDocumentSharePath,
  type OwnerDocumentRequest,
  type OwnerDocumentFile,
  type OwnerDocRequestStatus,
  type OwnerDocType,
} from "@/lib/owner-documents-service"
import { SaleConfirmDialog } from "@/features/dashboard/sales/sale-confirm-dialog"

// A list row: a request, plus (admin only) the creating agent's card.
type Row = OwnerDocumentRequest & {
  agent_name?: string | null
  agent_avatar?: string | null
  agent_role?: string | null
}

const DOC_LABELS: Record<OwnerDocType, string> = {
  title_deed: "Oqood Certificate / Title Deed",
  emirates_id: "Emirates ID",
  passport: "Passport",
  signed_noc: "Signed NOC",
  other: "Other document",
}

const STATUS_STYLE: Record<OwnerDocRequestStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting owner", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  submitted: { label: "Submitted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: Ban },
}

type StatusFilter = "all" | OwnerDocRequestStatus
const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "submitted", "cancelled"]
const statusFilterLabel = (s: StatusFilter) => (s === "all" ? "All statuses" : STATUS_STYLE[s].label)

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"

// ── URL <-> state ────────────────────────────────────────────────────────────
// Filters, sort, page and the open request live in the query string so a refresh
// (or a shared/bookmarked link) restores the same view instead of resetting.
type UrlState = {
  status: StatusFilter
  q: string
  scope: "mine" | "everyone"
  role: string
  person: string
  page: number
  per: number
  sortKey: string
  sortDir: "asc" | "desc"
  view: string | null
}

function readUrlState(): UrlState {
  const p = new URLSearchParams(window.location.search)
  const status = p.get("status")
  const per = Number(p.get("per"))
  return {
    status: (status && status !== "all" && status in STATUS_STYLE ? status : "all") as StatusFilter,
    q: p.get("q") ?? "",
    scope: p.get("scope") === "mine" ? "mine" : "everyone",
    role: p.get("role") ?? "all",
    person: p.get("person") ?? "all",
    page: Math.max(1, Number(p.get("page")) || 1),
    per: [10, 20, 50].includes(per) ? per : 10,
    sortKey: p.get("sort") ?? "created_at",
    sortDir: p.get("dir") === "asc" ? "asc" : "desc",
    view: p.get("view"),
  }
}

export function OwnerDocumentsClient({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [label, setLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: "delete" | "cancel"; row: Row } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [viewing, setViewing] = useState<{ request: Row; files: OwnerDocumentFile[] } | null>(null)

  // ── Filters + table state ──────────────────────────────────────────────────
  // Admins default to "everyone" (the whole team's requests); the toggle narrows
  // to their own. Role + person filters compose on top. Status is for everyone.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [scope, setScope] = useState<"mine" | "everyone">("everyone")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" })

  // The query string captured on first render — used to restore state below and
  // to open the deep-linked request once rows load (captured before the write
  // effect can overwrite window.location).
  const [initialUrl] = useState<UrlState | null>(() => (typeof window === "undefined" ? null : readUrlState()))
  const [restored, setRestored] = useState(false)

  const openView = useCallback(async (row: Row) => {
    const { data: files, error } = await fetchOwnerDocumentFiles(row.id)
    if (error) {
      toast.error(error)
      return
    }
    setViewing({ request: row, files })
    if (typeof window !== "undefined") window.scrollTo({ top: 0 })
  }, [])

  // Restore filters/sort/page from the URL once, on mount. Deliberately in an
  // effect, not lazy initial state: this component server-renders (the auth
  // context has the role via server props), so both the server and the client
  // first render must use the defaults — reading the URL during render would
  // desync hydration. Applying it post-hydration is the safe moment.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time URL restore, post-hydration */
  useEffect(() => {
    if (initialUrl) {
      setStatusFilter(initialUrl.status)
      setSearch(initialUrl.q)
      if (isAdmin) {
        setScope(initialUrl.scope)
        setRoleFilter(initialUrl.role)
        setAgentFilter(initialUrl.person)
      }
      setPage(initialUrl.page)
      setPerPage(initialUrl.per)
      setSort({ key: initialUrl.sortKey, dir: initialUrl.sortDir })
    }
    setRestored(true)
  }, [initialUrl, isAdmin])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = isAdmin
        ? await fetchAllOwnerDocumentRequestsAdmin()
        : await fetchMyOwnerDocumentRequests()
      if (!active) return
      if (error) toast.error(error)
      setRows(data)
      setLoading(false)
      // Deep-link (?view=<id>) from the notification email or a refresh opens it.
      const viewId = initialUrl?.view
      if (viewId) {
        const row = data.find((r) => r.id === viewId)
        if (row) void openView(row)
      }
    })()
    return () => {
      active = false
    }
  }, [isAdmin, openView, initialUrl])

  async function refresh() {
    const { data, error } = isAdmin
      ? await fetchAllOwnerDocumentRequestsAdmin()
      : await fetchMyOwnerDocumentRequests()
    if (error) toast.error(error)
    setRows(data)
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}${ownerDocumentSharePath(token)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied — send it to the property owner.")
    } catch {
      toast.error("Could not copy automatically.")
      window.prompt("Copy this link:", url)
    }
  }

  async function handleCreate() {
    setCreating(true)
    const { data, error } = await createOwnerDocumentRequest(label || null)
    setCreating(false)
    if (error || !data) {
      toast.error(error ?? "Could not create the request.")
      return
    }
    setLabel("")
    setShowNew(false)
    if (isAdmin) await refresh()
    else setRows((prev) => [data, ...prev])
    await copyLink(data.token)
  }

  async function runConfirm() {
    if (!confirm) return
    const { kind, row } = confirm
    setConfirmBusy(true)
    const { error } =
      kind === "delete"
        ? await deleteOwnerDocumentRequestAdmin(row.id)
        : await cancelOwnerDocumentRequest(row.id)
    setConfirmBusy(false)
    setConfirm(null)
    if (error) {
      toast.error(error)
      return
    }
    if (kind === "delete") {
      toast.success("Request deleted.")
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } else {
      toast.success("Request cancelled.")
      await refresh()
    }
  }

  // ── Derived: filter → sort → paginate (all client-side; the list is small) ──
  // Distinct people who have requests, for the person dropdown (admins only).
  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string | null }>()
    for (const r of rows) {
      if (r.agent_id && !map.has(r.agent_id)) {
        map.set(r.agent_id, { id: r.agent_id, name: r.agent_name?.trim() || "Unknown", role: r.agent_role ?? null })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  // Roles present in the data, for the role dropdown.
  const roleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.agent_role) set.add(r.agent_role)
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (isAdmin && scope === "mine") {
      list = list.filter((r) => r.agent_id === currentUserId)
    } else if (isAdmin) {
      if (roleFilter !== "all") list = list.filter((r) => r.agent_role === roleFilter)
      if (agentFilter !== "all") list = list.filter((r) => r.agent_id === agentFilter)
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          (r.label ?? "").toLowerCase().includes(q) ||
          (r.owner_name ?? "").toLowerCase().includes(q) ||
          // Agent is only a dimension in the admin view — sales roles see only
          // their own requests, so matching agent name there is meaningless.
          (isAdmin && (r.agent_name ?? "").toLowerCase().includes(q)),
      )
    }
    const dir = sort.dir === "asc" ? 1 : -1
    const keyOf = (r: Row) =>
      sort.key === "label"
        ? (r.label ?? r.owner_name ?? "").toLowerCase()
        : sort.key === "status"
          ? r.status
          : r.created_at
    return [...list].sort((a, b) => {
      const av = keyOf(a)
      const bv = keyOf(b)
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [rows, isAdmin, scope, currentUserId, roleFilter, agentFilter, statusFilter, search, sort])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  // Mirror the live view into the URL (replace, not push — no history spam) so a
  // refresh lands back here. Held until the one-time restore has run so it can't
  // clobber the incoming query string first.
  useEffect(() => {
    if (!restored || typeof window === "undefined") return
    const p = new URLSearchParams()
    if (statusFilter !== "all") p.set("status", statusFilter)
    if (search.trim()) p.set("q", search.trim())
    if (isAdmin && scope !== "everyone") p.set("scope", scope)
    if (isAdmin && roleFilter !== "all") p.set("role", roleFilter)
    if (isAdmin && agentFilter !== "all") p.set("person", agentFilter)
    if (safePage > 1) p.set("page", String(safePage))
    if (perPage !== 10) p.set("per", String(perPage))
    if (sort.key !== "created_at" || sort.dir !== "desc") {
      p.set("sort", sort.key)
      p.set("dir", sort.dir)
    }
    if (viewing) p.set("view", viewing.request.id)
    const qs = p.toString()
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [restored, statusFilter, search, isAdmin, scope, roleFilter, agentFilter, safePage, perPage, sort, viewing])

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created_at" ? "desc" : "asc" },
    )

  const columns: DataTableColumn[] = [
    { label: "Request", sortKey: "label" },
    { label: "Status", sortKey: "status" },
    ...(isAdmin ? [{ label: "Agent" }] : []),
    { label: "Created", sortKey: "created_at" },
    { label: "", className: "text-right" },
  ]

  const selectCls =
    "h-9 rounded-xl border border-[#e5e7eb] bg-white pl-3 pr-8 text-sm text-[#374151] outline-none focus:border-[#001f3f] cursor-pointer"

  // ── Detail (full view) — replaces the list until you go back ────────────────
  if (viewing) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <RequestDetail data={viewing} isAdmin={isAdmin} onCopyLink={copyLink} onBack={() => setViewing(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#001f3f]">
            <ScrollText className="h-5 w-5 text-[#d6b357]" />
          </div>
          <div>
            <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">Owner Documents</h1>
            <p className="text-sm text-[#6b7280]">
              {isAdmin
                ? "Every agent's NOC / Trakheesi document requests."
                : "Collect NOC / Trakheesi documents from property owners via a link."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-[#001f3f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#002b57]"
        >
          <Plus className="h-4 w-4" /> New request
        </button>
      </div>

      {/* New request panel */}
      {showNew && (
        <div className="mt-4 rounded-2xl border border-[#eef0f2] bg-[#f9fafb] p-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-[#374151]">
            Label <span className="font-normal text-[#9ca3af]">(optional — only you see this)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Azizi Venice – Unit 1203"
              className="min-w-0 flex-1 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#001f3f]"
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate() }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d6b357] px-5 py-2.5 text-sm font-bold text-[#001428] transition-colors hover:bg-[#c9a449] disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Create &amp; copy link
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <div className="inline-flex rounded-full border border-[#e5e7eb] bg-white p-0.5">
            {(["mine", "everyone"] as const).map((sVal) => (
              <button
                key={sVal}
                type="button"
                onClick={() => { setScope(sVal); setPage(1) }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  scope === sVal ? "bg-[#001f3f] text-white" : "text-[#6b7280] hover:text-[#001f3f]"
                }`}
              >
                {sVal === "mine" ? "My requests" : "Everyone"}
              </button>
            ))}
          </div>
        )}
        {isAdmin && scope === "everyone" && (
          <>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setAgentFilter("all"); setPage(1) }}
              className={selectCls}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              {roleOptions.map((r) => <option key={r} value={r}>{roleToLabel(r)}</option>)}
            </select>
            <select
              value={agentFilter}
              onChange={(e) => { setAgentFilter(e.target.value); setPage(1) }}
              className={selectCls}
              aria-label="Filter by person"
            >
              <option value="all">All people</option>
              {people
                .filter((p) => roleFilter === "all" || p.role === roleFilter)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.role ? ` · ${roleToLabel(p.role)}` : ""}
                  </option>
                ))}
            </select>
          </>
        )}
        {/* Status filter — available to every role. */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1) }}
          className={selectCls}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{statusFilterLabel(s)}</option>)}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={isAdmin ? "Search request, owner, agent…" : "Search request or owner…"}
            className="h-9 w-full rounded-xl border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#001f3f]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4">
        <DataTable
          columns={columns}
          loading={loading}
          empty={total === 0}
          emptyState={
            <div>
              <ScrollText className="mx-auto h-8 w-8 text-[#c4c4c4]" />
              <p className="mt-3 text-sm font-medium text-[#6b7280]">
                {rows.length === 0 ? "No requests yet" : "No requests match your filters"}
              </p>
              <p className="mt-1 text-[13px] text-[#9ca3af]">
                {rows.length === 0
                  ? "Create a request to get a link you can send to a property owner."
                  : "Try a different status, scope, person, or search."}
              </p>
            </div>
          }
          page={safePage}
          perPage={perPage}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
          sort={sort}
          onSort={toggleSort}
        >
          {pageRows.map((row) => {
            const s = STATUS_STYLE[row.status]
            const StatusIcon = s.icon
            return (
              <tr key={row.id} className="transition-colors hover:bg-[#fcfdff]">
                <td className="px-3 py-3 align-middle first:pl-6">
                  <p className="max-w-[260px] truncate font-['Outfit'] text-sm font-bold text-[#0d1117]">
                    {row.label?.trim() || row.owner_name?.trim() || "Untitled request"}
                  </p>
                  {(row.status === "submitted" && row.owner_name) ? (
                    <p className="text-[11px] text-[#9ca3af]">from {row.owner_name}</p>
                  ) : row.status === "pending" ? (
                    <p className="text-[11px] text-[#9ca3af]">expires {fmtDate(row.expires_at)}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-middle">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                    <StatusIcon className="h-3 w-3" /> {s.label}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-3 py-3 align-middle">
                    {row.agent_name ? (
                      <AgentChip name={row.agent_name} avatar={row.agent_avatar ?? null} />
                    ) : (
                      <span className="text-[#c4c4c4]">—</span>
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3 align-middle text-[13px] text-[#6b7280]">
                  {fmtDate(row.created_at)}
                </td>
                <td className="px-3 py-3 align-middle last:pr-6">
                  <div className="flex items-center justify-end gap-1.5">
                    {(isAdmin || row.status === "submitted") && (
                      <button
                        type="button"
                        onClick={() => void openView(row)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#001f3f] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#002b57]"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    )}
                    {row.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void copyLink(row.token)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3.5 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#001f3f]"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Copy link
                      </button>
                    )}
                    {!isAdmin && row.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "cancel", row })}
                        title="Cancel request"
                        className="inline-flex items-center rounded-full border border-[#e5e7eb] p-1.5 text-[#9ca3af] hover:border-rose-300 hover:text-rose-500"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "delete", row })}
                        title="Delete request"
                        className="inline-flex items-center rounded-full border border-[#e5e7eb] p-1.5 text-[#9ca3af] hover:border-rose-300 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </DataTable>
      </div>

      {confirm && (
        <SaleConfirmDialog
          title={confirm.kind === "delete" ? "Delete request" : "Cancel request"}
          message={
            confirm.kind === "delete"
              ? "This permanently removes the request and its uploaded files. This cannot be undone."
              : "The owner's link will stop working. You can always create a new request."
          }
          confirmLabel={confirm.kind === "delete" ? "Hold to delete" : "Cancel request"}
          tone="danger"
          hold={confirm.kind === "delete"}
          busy={confirmBusy}
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function AgentChip({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] py-0.5 pl-0.5 pr-2.5 text-[11px] font-medium text-[#4b5563]">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar host varies (Google/S3/legacy)
        <img src={avatar} alt={name} className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#001f3f] text-[8px] font-bold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {name}
    </span>
  )
}

// ── Detail view ────────────────────────────────────────────────────────────────
function RequestDetail({
  data,
  isAdmin,
  onCopyLink,
  onBack,
}: {
  data: { request: Row; files: OwnerDocumentFile[] }
  isAdmin: boolean
  onCopyLink: (token: string) => void
  onBack: () => void
}) {
  const { request: r, files } = data
  const s = STATUS_STYLE[r.status]
  const StatusIcon = s.icon

  const detail = (dl: string, value: string | null) =>
    value?.trim() ? (
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{dl}</dt>
        <dd className="mt-0.5 text-sm font-medium text-[#111827]">{value}</dd>
      </div>
    ) : null

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${ownerDocumentSharePath(r.token)}`

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] transition-colors hover:text-[#001f3f]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </button>

      {/* Header card */}
      <div className="rounded-2xl border border-[#eef0f2] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">
              {r.owner_name?.trim() || r.label?.trim() || "Owner document request"}
            </h1>
            <p className="mt-0.5 text-[13px] text-[#6b7280]">
              {r.status === "submitted" ? `Submitted ${fmtDate(r.submitted_at)}` : `Created ${fmtDate(r.created_at)}`}
              {isAdmin && r.agent_name ? ` · by ${r.agent_name}` : ""}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
            <StatusIcon className="h-3.5 w-3.5" /> {s.label}
          </span>
        </div>

        {r.status === "pending" && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] font-semibold text-amber-800">Awaiting the owner&apos;s submission</p>
            <p className="mt-0.5 text-[12px] text-amber-700">Share this link with the property owner:</p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[12px] text-[#374151]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => onCopyLink(r.token)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#002b57]"
              >
                <Link2 className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        )}

        {r.status === "cancelled" && (
          <p className="mt-4 text-sm text-[#6b7280]">This request was cancelled — its link no longer works.</p>
        )}

        {r.status === "submitted" && (
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {detail("Emirates ID / Passport", r.owner_id_number)}
            {detail("Email", r.owner_email)}
            {detail("Mobile", r.owner_mobile)}
            {detail("Property / Building", r.property_building)}
            {detail("Unit", r.unit_number)}
            {detail("Community / Area", r.community_area)}
            {detail("Title Deed / Oqood No.", r.title_deed_number)}
            {detail("Valid until", r.noc_valid_until)}
          </dl>
        )}
      </div>

      {/* Documents with inline previews */}
      {r.status === "submitted" && (
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Documents ({files.length})
          </h2>
          {files.length === 0 ? (
            <p className="rounded-2xl border border-[#eef0f2] bg-white px-4 py-8 text-center text-sm text-[#9ca3af]">
              No files were attached.
            </p>
          ) : (
            <div className="space-y-4">
              {files.map((f) => <DocumentPreview key={f.id} file={f} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One document, previewed inline. Images render straight into an <img>; PDFs go
 * to the browser's built-in viewer via an <iframe> (same approach as the ebook
 * reader) with an "open in a new tab" fallback behind it in case framing fails.
 */
function DocumentPreview({ file }: { file: OwnerDocumentFile }) {
  const isImage = file.file_type === "image"
  const Icon = isImage ? ImageIcon : FileText

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eef0f2] bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#f0f0f0] px-4 py-3">
        <Icon className="h-5 w-5 shrink-0 text-[#6b7280]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#111827]">{DOC_LABELS[file.doc_type]}</p>
          <p className="truncate text-[11px] text-[#9ca3af]">{file.file_name}</p>
        </div>
        <a
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
      </div>

      {isImage ? (
        <div className="flex justify-center bg-[#f7f8fa] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner uploads (S3/Supabase); not a static asset for next/image */}
          <img
            src={file.file_url}
            alt={DOC_LABELS[file.doc_type]}
            loading="lazy"
            className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
          />
        </div>
      ) : (
        <div className="relative h-[75vh] min-h-[420px] bg-[#525659]">
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-white/70">
              Preparing the preview…{" "}
              <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#d6b357] underline">
                open it in a new tab
              </a>{" "}
              if nothing appears.
            </p>
          </div>
          <iframe
            // #view=FitH opens fitted to the page width rather than zoomed in.
            src={`${file.file_url}#view=FitH`}
            title={file.file_name}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
    </div>
  )
}
