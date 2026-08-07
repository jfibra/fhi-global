"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  ScrollText, Plus, Link2, Eye, XCircle, Loader2, X, FileText, Image as ImageIcon,
  ExternalLink, Clock, CheckCircle2, Ban, Trash2,
} from "lucide-react"
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
  title_deed: "Title Deed",
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

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"

export function OwnerDocumentsClient({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [label, setLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<{ kind: "delete" | "cancel"; row: Row } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [viewing, setViewing] = useState<{ request: Row; files: OwnerDocumentFile[] } | null>(null)

  const openView = useCallback(async (row: Row) => {
    const { data: files, error } = await fetchOwnerDocumentFiles(row.id)
    if (error) {
      toast.error(error)
      return
    }
    setViewing({ request: row, files })
  }, [])

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
      // Deep-link from the notification email (/owner-documents?view=<id>) opens it.
      const viewId = new URLSearchParams(window.location.search).get("view")
      if (viewId) {
        const row = data.find((r) => r.id === viewId)
        if (row) void openView(row)
      }
    })()
    return () => {
      active = false
    }
  }, [isAdmin, openView])

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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
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

      {/* List */}
      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9ca3af]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d1d5db] py-16 text-center">
            <ScrollText className="mx-auto h-8 w-8 text-[#c4c4c4]" />
            <p className="mt-3 text-sm font-medium text-[#6b7280]">No requests yet</p>
            <p className="mt-1 text-[13px] text-[#9ca3af]">Create a request to get a link you can send to a property owner.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const s = STATUS_STYLE[row.status]
              const StatusIcon = s.icon
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eef0f2] bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-['Outfit'] text-[15px] font-bold text-[#0d1117]">
                        {row.label?.trim() || row.owner_name?.trim() || "Untitled request"}
                      </p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                        <StatusIcon className="h-3 w-3" /> {s.label}
                      </span>
                      {isAdmin && row.agent_name && <AgentChip name={row.agent_name} avatar={row.agent_avatar ?? null} />}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#9ca3af]">
                      Created {fmtDate(row.created_at)}
                      {row.status === "submitted" && row.owner_name ? ` · from ${row.owner_name}` : ""}
                      {row.status === "pending" ? ` · expires ${fmtDate(row.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewing && (
        <RequestModal data={viewing} isAdmin={isAdmin} onCopyLink={copyLink} onClose={() => setViewing(null)} />
      )}

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

function RequestModal({
  data,
  isAdmin,
  onCopyLink,
  onClose,
}: {
  data: { request: Row; files: OwnerDocumentFile[] }
  isAdmin: boolean
  onCopyLink: (token: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const { request: r, files } = data
  const detail = (label: string, value: string | null) =>
    value?.trim() ? (
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</dt>
        <dd className="text-sm font-medium text-[#111827]">{value}</dd>
      </div>
    ) : null

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#f0f0f0] px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-['Outfit'] text-lg font-bold text-[#0d1117]">
              {r.owner_name || r.label || "Owner document request"}
            </h3>
            <p className="text-xs text-[#6b7280]">
              {r.status === "submitted" ? `Submitted ${fmtDate(r.submitted_at)}` : `Created ${fmtDate(r.created_at)}`}
              {isAdmin && r.agent_name ? ` · by ${r.agent_name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#e5e5e5] p-2 text-[#6b7280] hover:text-[#0d1117]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {r.status === "pending" && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13px] font-semibold text-amber-800">Awaiting the owner&apos;s submission</p>
              <p className="mt-0.5 text-[12px] text-amber-700">Share this link with the property owner:</p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}${ownerDocumentSharePath(r.token)}`}
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

          {r.status === "submitted" && (
            <dl className="grid grid-cols-2 gap-4">
              {detail("Emirates ID / Passport", r.owner_id_number)}
              {detail("Email", r.owner_email)}
              {detail("Mobile", r.owner_mobile)}
              {detail("Property / Building", r.property_building)}
              {detail("Unit", r.unit_number)}
              {detail("Community / Area", r.community_area)}
              {detail("Title Deed No.", r.title_deed_number)}
              {detail("Valid until", r.noc_valid_until)}
            </dl>
          )}

          {r.status === "submitted" && (
            <>
              <p className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Documents ({files.length})
              </p>
              <div className="space-y-2">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-[#eef0f2] px-3 py-2.5 transition-colors hover:border-[#001f3f]/40 hover:bg-[#f9fafb]"
                  >
                    {f.file_type === "image" ? (
                      <ImageIcon className="h-5 w-5 shrink-0 text-[#6b7280]" />
                    ) : (
                      <FileText className="h-5 w-5 shrink-0 text-[#6b7280]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#111827]">{DOC_LABELS[f.doc_type]}</p>
                      <p className="truncate text-[11px] text-[#9ca3af]">{f.file_name}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-[#c4c4c4]" />
                  </a>
                ))}
                {files.length === 0 && <p className="text-sm text-[#9ca3af]">No files were attached.</p>}
              </div>
            </>
          )}

          {r.status === "cancelled" && (
            <p className="text-sm text-[#6b7280]">This request was cancelled — its link no longer works.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
