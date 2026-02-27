"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ExternalLink,
  FileText,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  deleteSaleAttachment,
  fetchSaleAttachments,
  insertSaleAttachment,
  type SaleRecord,
  type SaleAttachment,
} from "@/lib/sales-service"

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

function fileIcon(fileType: string | null) {
  const t = (fileType ?? "").toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(t)) return "🖼️"
  if (t === "pdf") return "📄"
  if (["doc", "docx"].includes(t)) return "📝"
  if (["xls", "xlsx", "csv"].includes(t)) return "📊"
  return "📎"
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
  const isAdmin = ["admin", "super_admin"].includes(currentRole)
  const [attachments, setAttachments] = useState<SaleAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !sale) return
    void loadAttachments()
  }, [open, sale])

  const loadAttachments = async () => {
    if (!sale) return
    setLoading(true)
    try {
      const { data, error } = await fetchSaleAttachments(sale.id)
      if (error) { setUploadError(error); return }
      setAttachments(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!sale) return
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
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
      })

      if (error) { setUploadError(error); return }

      const updated = [data!, ...attachments]
      setAttachments(updated)
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
    if (!window.confirm(`Remove "${attachment.file_name}"?`)) return
    const { error } = await deleteSaleAttachment(attachment.id)
    if (error) { setUploadError(error); return }
    const updated = attachments.filter((a) => a.id !== attachment.id)
    setAttachments(updated)
    if (sale) onCountChange(sale.id, updated.length)
  }

  if (!open || !sale) return null

  const clientName = sale.clients
    ? `${sale.clients.first_name} ${sale.clients.last_name}`
    : "—"

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-xl bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative shrink-0 px-7 pt-7 pb-5">
            <div
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]"
              style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }}
            />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-md">
                  <Paperclip className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#0d1117]">Attachments</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5 truncate max-w-[260px]">
                    {clientName} — {sale.projects?.name ?? "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />

          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => void handleDrop(e)}
              className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver
                  ? "border-[#001f3f]/40 bg-[#001f3f]/4"
                  : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                  <div className="w-4 h-4 border-2 border-[#001f3f]/20 border-t-[#001f3f] rounded-full animate-spin" />
                  Uploading…
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
                    <Upload className="w-5 h-5 text-[#9ca3af]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#374151]">Click to upload or drag & drop</p>
                    <p className="text-xs text-[#9ca3af] mt-0.5">PDF, Word, Excel, images — max 25 MB</p>
                    <p className="text-xs text-[#9ca3af] mt-1 italic">e.g. Reservation Agreement, Receipt, Contract</p>
                  </div>
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
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-700">
                <span>⚠️</span> {uploadError}
              </div>
            )}

            {/* Attachments list */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />
                ))}
              </div>
            ) : attachments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-[#9ca3af]">
                <FileText className="w-8 h-8 opacity-40" />
                <p className="text-sm">No attachments yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-2xl border border-[#f0f2f5] hover:border-[#e5e5e5] transition-all group"
                  >
                    <span className="text-xl shrink-0">{fileIcon(att.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0d1117] truncate">
                        {att.file_name}
                      </p>
                      <p className="text-xs text-[#9ca3af] mt-0.5">
                        {att.file_type && <span className="mr-2 uppercase">{att.file_type}</span>}
                        {formatDate(att.uploaded_at)}
                        {att.profiles?.fullname && ` · ${att.profiles.fullname}`}
                      </p>
                    </div>
                    {/* Action buttons — shown on row hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {/* Eye — open in new tab, always visible */}
                      <button
                        type="button"
                        title="View file"
                        onClick={() => window.open(att.file_url, "_blank")}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-50 text-[#9ca3af] hover:text-sky-500 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {/* Trash — delete, admin only */}
                      {isAdmin && (
                        <button
                          type="button"
                          title="Delete attachment"
                          onClick={() => void handleDelete(att)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />
          <div className="shrink-0 px-7 py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
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
