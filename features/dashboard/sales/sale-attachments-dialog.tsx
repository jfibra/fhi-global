"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileType2,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  canManageSaleAttachmentsForRole,
  deleteSaleAttachment,
  fetchSaleAttachments,
  insertSaleAttachment,
  type SaleRecord,
  type SaleAttachment,
} from "@/lib/sales-service"
import { isAdminStaffRole } from "@/lib/app-roles"
import { compressImageForUpload } from "@/lib/upload/compress-image"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// What the viewer can actually render. "pdf" and "image" preview inline; the
// rest have no in-browser renderer and are offered as open/download instead of
// an empty frame.
type Kind = "pdf" | "image" | "doc" | "sheet" | "other"

function fileKind(fileType: string | null, fileName: string): Kind {
  const t = (fileType ?? fileName.split(".").pop() ?? "").toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg"].includes(t)) return "image"
  if (t === "pdf") return "pdf"
  if (["doc", "docx", "rtf", "odt", "txt"].includes(t)) return "doc"
  if (["xls", "xlsx", "csv", "ods"].includes(t)) return "sheet"
  return "other"
}

// Lucide glyphs, not emoji. The emoji literals these replace had been written
// to disk with their UTF-8 bytes reinterpreted as Latin-1, so the page icon
// rendered as three garbage characters in the dialog. Icon components carry no
// encoding risk.
const KIND_ICON: Record<Kind, LucideIcon> = {
  pdf: FileType2,
  image: ImageIcon,
  doc: FileText,
  sheet: FileSpreadsheet,
  other: FileArchive,
}

export function SaleAttachmentsDialog({
  open,
  sale,
  currentUserId,
  currentRole,
  onClose,
  onCountChange,
}: {
  open: boolean
  sale: SaleRecord | null
  currentUserId: string
  currentRole: string
  onClose: () => void
  onCountChange: (id: string, count: number) => void
}) {
  const isAdmin = isAdminStaffRole(currentRole)
  const canManageAttachments = canManageSaleAttachmentsForRole(currentRole, sale)
  const [attachments, setAttachments] = useState<SaleAttachment[]>([])
  // Which sale's attachments are in `attachments`. Doubles as the loading flag,
  // so nothing has to be set synchronously inside the effect below.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loading = Boolean(open && sale && loadedFor !== sale.id)

  useEffect(() => {
    if (!open || !sale || loadedFor === sale.id) return
    let alive = true
    void (async () => {
      const { data, error } = await fetchSaleAttachments(sale.id)
      if (!alive) return
      if (error) setUploadError(error)
      setAttachments(data ?? [])
      setLoadedFor(sale.id)
    })()
    return () => { alive = false }
  }, [open, sale, loadedFor])

  // Closing resets the cache so reopening shows a fresh list. Done here rather
  // than in an effect because a handler may set state freely.
  const closeAndReset = () => {
    setLoadedFor(null)
    setAttachments([])
    setSelectedId(null)
    setUploadError(null)
    onClose()
  }

  const uploadFile = async (file: File) => {
    if (!sale) return
    if (!canManageAttachments) {
      setUploadError("You can only manage attachments when validation is Invalid Sale or Under Review")
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      const { file: toUpload } = await compressImageForUpload(file)
      formData.append("file", toUpload, toUpload.name)
      formData.append("saleId", sale.id)

      const res = await fetch("/api/upload/sale-file", {
        method: "POST",
        body: formData,
      })
      const json = await res.json() as { url?: string; file_name?: string; file_type?: string; error?: string }

      if (!res.ok || json.error) {
        setUploadError(json.error ?? "Upload failed")
        return
      }

      const { data, error } = await insertSaleAttachment({
        sales_report_id: sale.id,
        file_name:       json.file_name ?? file.name,
        file_url:        json.url!,
        file_type:       json.file_type ?? null,
        uploaded_by:     currentUserId,
        uploaded_role:   currentRole,
      })

      if (error) { setUploadError(error); return }

      const updated = [data!, ...attachments]
      setAttachments(updated)
      setSelectedId(data!.id) // preview what was just uploaded
      onCountChange(sale.id, updated.length)
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  const handleDelete = async (attachment: SaleAttachment) => {
    if (!canManageAttachments) {
      setUploadError("You can only manage attachments when validation is Invalid Sale or Under Review")
      return
    }
    if (!window.confirm(`Remove "${attachment.file_name}"?`)) return
    const { error } = await deleteSaleAttachment(attachment.id, currentUserId, currentRole)
    if (error) { setUploadError(error); return }
    const updated = attachments.filter((a) => a.id !== attachment.id)
    setAttachments(updated)
    if (selectedId === attachment.id) setSelectedId(null)
    if (sale) onCountChange(sale.id, updated.length)
  }

  if (!open || !sale) return null

  const clientName = sale.clients
    ? `${sale.clients.first_name} ${sale.clients.last_name}`
    : "—"

  // Selection is derived, not stored in an effect: if the chosen file is gone
  // (deleted, or a different sale loaded) it falls back to the first one, so a
  // preview is always showing without a synchronising effect.
  const selected = attachments.find((a) => a.id === selectedId) ?? attachments[0] ?? null

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={closeAndReset} />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-5xl bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-7 pt-7 pb-5">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px] bg-[#001f3f]" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#001f3f] flex items-center justify-center shadow-md shrink-0">
                  <Paperclip className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Attachments</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5 truncate">
                    {clientName} — {sale.projects?.name ?? "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                aria-label="Close"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />

          {/* Body: file list on the left, live preview on the right. Stacks on
              narrow screens, where the preview goes under the list. */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

            {/* ── File list ─────────────────────────────────────────────── */}
            <div className="lg:w-[300px] shrink-0 lg:border-r border-[#f0f2f5] overflow-y-auto px-5 py-5 space-y-3">
              <div
                onDragOver={(e) => {
                  if (!canManageAttachments) return
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  if (!canManageAttachments) return
                  void handleDrop(e)
                }}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all ${
                  canManageAttachments ? "cursor-pointer" : "cursor-not-allowed"
                } ${
                  dragOver
                    ? "border-[#001f3f]/40 bg-[#001f3f]/[0.04]"
                    : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
                }`}
                onClick={() => {
                  if (!canManageAttachments) return
                  fileInputRef.current?.click()
                }}
              >
                {uploading ? (
                  <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                    <div className="w-4 h-4 border-2 border-[#001f3f]/20 border-t-[#001f3f] rounded-full animate-spin" />
                    Uploading…
                  </div>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
                      <Upload className="w-4 h-4 text-[#9ca3af]" />
                    </div>
                    <p className="text-xs font-semibold text-[#374151] text-center leading-snug">
                      {canManageAttachments ? "Click to upload or drag & drop" : "Read-only for this validation status"}
                    </p>
                    <p className="text-[11px] text-[#9ca3af] text-center">
                      {canManageAttachments ? "PDF, Word, Excel, images — max 25 MB" : "Set Invalid Sale or Under Review to manage"}
                    </p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,.txt"
                className="hidden"
                onChange={(e) => void handleFileSelect(e)}
              />

              {uploadError && (
                <div className="px-3 py-2.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700">
                  {uploadError}
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />
                  ))}
                </div>
              ) : attachments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-[#9ca3af]">
                  <FileText className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No attachments yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attachments.map((att) => {
                    const Icon = KIND_ICON[fileKind(att.file_type, att.file_name)]
                    const active = selected?.id === att.id
                    return (
                      <div
                        key={att.id}
                        className={`group flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                          active
                            ? "bg-[#001f3f]/[0.05] border-[#001f3f]/25"
                            : "bg-[#f8fafc] border-[#f0f2f5] hover:border-[#e5e5e5]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(att.id)}
                          aria-current={active}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#001f3f]" : "text-[#9ca3af]"}`} />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-[#0d1117] truncate">
                              {att.file_name}
                            </span>
                            <span className="block text-[11px] text-[#9ca3af] mt-0.5 truncate">
                              {att.file_type && <span className="mr-1.5 uppercase">{att.file_type}</span>}
                              {formatDate(att.uploaded_at)}
                              {att.profiles?.fullname && ` · ${att.profiles.fullname}`}
                            </span>
                          </span>
                        </button>
                        {(isAdmin || canManageAttachments) && (
                          <button
                            type="button"
                            title="Delete attachment"
                            aria-label={`Delete ${att.file_name}`}
                            onClick={() => void handleDelete(att)}
                            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Preview ───────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 min-h-[320px] lg:min-h-0 flex flex-col bg-[#f7f8fa]">
              {selected ? (
                <>
                  <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-[#eceef1] bg-white">
                    <p className="flex-1 min-w-0 truncate text-sm font-semibold text-[#0d1117]">
                      {selected.file_name}
                    </p>
                    <a
                      href={selected.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in a new tab"
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-50 text-[#9ca3af] hover:text-sky-600 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a
                      href={selected.file_url}
                      download={selected.file_name}
                      title="Download"
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f2f5] text-[#9ca3af] hover:text-[#001f3f] transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <FilePreview attachment={selected} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#9ca3af]">
                  <Paperclip className="w-9 h-9 opacity-30" />
                  <p className="text-sm">{loading ? "Loading…" : "Nothing to preview"}</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-[#f0f2f5]" />
          <div className="shrink-0 px-7 py-4 flex justify-end">
            <button
              type="button"
              onClick={closeAndReset}
              className="px-6 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// PDFs and images render in place. Everything else (Word, Excel) has no
// in-browser renderer, so it says so and offers the file rather than showing an
// empty frame the reader would take for a broken preview.
//
// The iframe is keyed by url so switching files replaces the frame instead of
// navigating it — a navigated PDF frame keeps the previous document's scroll
// position and, in some browsers, its zoom.
function FilePreview({ attachment }: { attachment: SaleAttachment }) {
  const kind = fileKind(attachment.file_type, attachment.file_name)

  if (kind === "pdf") {
    return (
      <iframe
        key={attachment.file_url}
        src={attachment.file_url}
        title={attachment.file_name}
        className="w-full h-full min-h-[420px] border-0 bg-white"
      />
    )
  }

  if (kind === "image") {
    return (
      <div className="min-h-full flex items-center justify-center p-5">
        {/* Plain <img>: these are arbitrary uploads on S3, and next/image would
            route each one through the optimizer for a preview that is viewed
            once. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.file_url}
          alt={attachment.file_name}
          className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm"
        />
      </div>
    )
  }

  const Icon = KIND_ICON[kind]
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#eceef1] flex items-center justify-center">
        <Icon className="w-6 h-6 text-[#9ca3af]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#374151]">No in-browser preview</p>
        <p className="text-xs text-[#9ca3af] mt-1">
          {(attachment.file_type ?? "This file type").toUpperCase()} opens in its own app.
        </p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <a
          href={attachment.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-xs font-bold hover:bg-[#00152b] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open
        </a>
        <a
          href={attachment.file_url}
          download={attachment.file_name}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#e5e5e5] bg-white text-xs font-bold text-[#374151] hover:border-[#001f3f]/25 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
      </div>
    </div>
  )
}
