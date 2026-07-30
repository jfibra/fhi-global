"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  FileText,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  deleteAttachment,
  fetchAttachments,
  insertAttachment,
  type Purchase,
  type PurchaseAttachment,
} from "@/lib/purchase-service"
import { compressImageForUpload } from "@/lib/upload/compress-image"

// ─── Portal ───────────────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fileIcon(fileType: string | null) {
  const t = (fileType ?? "").toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(t)) return "ðŸ–¼ï¸"
  if (t === "pdf") return "ðŸ“„"
  if (["doc", "docx"].includes(t)) return "ðŸ“"
  if (["xls", "xlsx", "csv"].includes(t)) return "ðŸ“Š"
  return "ðŸ“Ž"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseAttachmentsDialog({
  open,
  purchase,
  currentUserId,
  onClose,
  onCountChange,
}: {
  open: boolean
  purchase: Purchase | null
  currentUserId: string
  onClose: () => void
  onCountChange: (id: string, count: number) => void
}) {
  const [attachments, setAttachments] = useState<PurchaseAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !purchase) return
    void loadAttachments()
  }, [open, purchase])

  const loadAttachments = async () => {
    if (!purchase) return
    setLoading(true)
    try {
      const { data, error } = await fetchAttachments(purchase.id)
      if (error) { setUploadError(error); return }
      setAttachments(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!purchase) return
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      const { file: toUpload } = await compressImageForUpload(file)
      formData.append("file", toUpload, toUpload.name)
      formData.append("purchaseId", purchase.id)

      const res = await fetch("/api/upload/purchase-file", {
        method: "POST",
        body: formData,
      })
      const json = await res.json() as { url?: string; file_name?: string; file_type?: string; error?: string }

      if (!res.ok || json.error) {
        setUploadError(json.error ?? "Upload failed")
        return
      }

      const { data, error } = await insertAttachment({
        purchase_id: purchase.id,
        file_name:   json.file_name ?? file.name,
        file_url:    json.url!,
        file_type:   json.file_type ?? null,
        uploaded_by: currentUserId,
      })

      if (error) { setUploadError(error); return }

      const updated = [data!, ...attachments]
      setAttachments(updated)
      onCountChange(purchase.id, updated.length)
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

  const handleDelete = async (attachment: PurchaseAttachment) => {
    if (!window.confirm(`Remove "${attachment.file_name}"?`)) return
    const { error } = await deleteAttachment(attachment.id)
    if (error) { setUploadError(error); return }
    const updated = attachments.filter((a) => a.id !== attachment.id)
    setAttachments(updated)
    if (purchase) onCountChange(purchase.id, updated.length)
  }

  if (!open || !purchase) return null

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
              style={{ background: "linear-gradient(to bottom, #0a3d6b, #001f3f)" }}
            />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center shadow-md">
                  <Paperclip className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Attachments</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5 truncate max-w-[240px]">
                    {purchase.invoice_number} — {purchase.company_tax_entities?.registered_name ?? "—"}
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

            {/* Drop zone / upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer
                ${dragOver
                  ? "border-[#001f3f]/40 bg-[#001f3f]/4"
                  : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
                }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-[#001f3f]/30 border-t-[#001f3f] rounded-full animate-spin" />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-[#001f3f]/8 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#001f3f]/60" />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-semibold text-[#374151]">
                  {uploading ? "Uploading…" : "Click or drag file to upload"}
                </p>
                <p className="text-xs text-[#9ca3af] mt-0.5">PDF, JPG, PNG, DOCX, XLSX — max 25 MB</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={handleFileSelect}
            />

            {uploadError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
                {uploadError}
              </p>
            )}

            {/* Attachment list */}
            <div>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 rounded-2xl bg-[#f0f2f5] animate-pulse" />
                  ))}
                </div>
              ) : attachments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-[#9ca3af]">
                  <FileText className="w-9 h-9 opacity-40" />
                  <p className="text-sm font-medium text-[#6b7280]">No attachments yet.</p>
                  <p className="text-xs">Upload files using the area above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#fafbfc] border border-[#f0f2f5] hover:bg-white hover:border-[#e5e5e5] transition-all group"
                    >
                      <span className="text-xl shrink-0">{fileIcon(att.file_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{att.file_name}</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {att.file_type ?? "File"} &bull; {att.profiles?.fullname ?? "System"} &bull; {formatDate(att.uploaded_at)}
                        </p>
                      </div>
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#001f3f] hover:underline px-2 py-1 rounded-lg hover:bg-[#001f3f]/5 transition-all shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(att)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-7 pb-7 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-5 py-3 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] bg-white hover:bg-[#f8fafc] transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
