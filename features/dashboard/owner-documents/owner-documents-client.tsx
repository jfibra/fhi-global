"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  ScrollText, Plus, Link2, Eye, XCircle, Loader2, X, FileText, Image as ImageIcon,
  ExternalLink, Clock, CheckCircle2, Ban,
} from "lucide-react"
import {
  fetchMyOwnerDocumentRequests,
  createOwnerDocumentRequest,
  fetchOwnerDocumentRequest,
  cancelOwnerDocumentRequest,
  ownerDocumentSharePath,
  type OwnerDocumentRequest,
  type OwnerDocumentFile,
  type OwnerDocRequestStatus,
  type OwnerDocType,
} from "@/lib/owner-documents-service"

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

export function OwnerDocumentsClient() {
  const [rows, setRows] = useState<OwnerDocumentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [label, setLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<{ request: OwnerDocumentRequest; files: OwnerDocumentFile[] } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await fetchMyOwnerDocumentRequests()
      if (!active) return
      if (error) toast.error(error)
      setRows(data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  async function refresh() {
    const { data, error } = await fetchMyOwnerDocumentRequests()
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
    setRows((prev) => [data, ...prev])
    await copyLink(data.token)
  }

  async function openView(id: string) {
    const { request, files, error } = await fetchOwnerDocumentRequest(id)
    if (error || !request) {
      toast.error(error ?? "Could not open the request.")
      return
    }
    setViewing({ request, files })
  }

  async function handleCancel(row: OwnerDocumentRequest) {
    if (!window.confirm("Cancel this request? The owner's link will stop working.")) return
    const { error } = await cancelOwnerDocumentRequest(row.id)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Request cancelled.")
    await refresh()
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
            <p className="text-sm text-[#6b7280]">Collect NOC / Trakheesi documents from property owners via a link.</p>
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
                    <div className="flex items-center gap-2">
                      <p className="truncate font-['Outfit'] text-[15px] font-bold text-[#0d1117]">
                        {row.label?.trim() || row.owner_name?.trim() || "Untitled request"}
                      </p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                        <StatusIcon className="h-3 w-3" /> {s.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#9ca3af]">
                      Created {fmtDate(row.created_at)}
                      {row.status === "submitted" && row.owner_name ? ` · from ${row.owner_name}` : ""}
                      {row.status === "pending" ? ` · expires ${fmtDate(row.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {row.status === "submitted" ? (
                      <button
                        type="button"
                        onClick={() => void openView(row.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#001f3f] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#002b57]"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    ) : row.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void copyLink(row.token)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3.5 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#001f3f]"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Copy link
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel(row)}
                          title="Cancel request"
                          className="inline-flex items-center rounded-full border border-[#e5e7eb] p-1.5 text-[#9ca3af] hover:border-rose-300 hover:text-rose-500"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewing && <SubmissionModal data={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function SubmissionModal({
  data,
  onClose,
}: {
  data: { request: OwnerDocumentRequest; files: OwnerDocumentFile[] }
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
          <div>
            <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{r.owner_name || "Owner submission"}</h3>
            <p className="text-xs text-[#6b7280]">Submitted {fmtDate(r.submitted_at)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#e5e5e5] p-2 text-[#6b7280] hover:text-[#0d1117]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
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
        </div>
      </div>
    </div>,
    document.body,
  )
}
