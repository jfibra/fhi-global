"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, FileText, Paperclip, Trash2, Upload, AlertTriangle } from "lucide-react"
import {
  deleteSupportTicketAttachment,
  fetchSupportTicketAttachments,
  insertSupportTicketAttachment,
  isSupportAdmin,
  type SupportTicketAttachment,
} from "@/lib/support-service"

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function TicketAttachments({
  ticketId,
  currentRole,
  currentUserId,
  onToast,
}: {
  ticketId: string
  currentRole: string
  currentUserId: string
  onToast: (type: "success" | "error", text: string) => void
}) {
  const isAdmin = isSupportAdmin(currentRole)
  const [attachments, setAttachments] = useState<SupportTicketAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadAttachments = async () => {
    setLoading(true)
    try {
      const { data, error } = await fetchSupportTicketAttachments(ticketId)
      if (error) {
        onToast("error", error)
        return
      }
      setAttachments(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAttachments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("ticketId", ticketId)

      const response = await fetch("/api/upload/support-ticket-file", { method: "POST", body: formData })
      const json = await response.json() as { url?: string; file_name?: string; file_type?: string; error?: string }

      if (!response.ok || json.error) {
        onToast("error", json.error ?? "Upload failed")
        return
      }

      const { data, error } = await insertSupportTicketAttachment({
        ticket_id: ticketId,
        file_name: json.file_name ?? file.name,
        file_url: json.url!,
        file_type: json.file_type ?? null,
        uploaded_by: currentUserId,
      })

      if (error || !data) {
        onToast("error", error ?? "Attachment save failed")
        return
      }

      setAttachments((prev) => [data, ...prev])
      onToast("success", "Attachment uploaded")
      setStagedFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (attachment: SupportTicketAttachment) => {
    setDeleteConfirmId(attachment.id)
  }

  const commitDelete = async (attachment: SupportTicketAttachment) => {
    const { error } = await deleteSupportTicketAttachment(attachment.id, currentRole)
    if (error) {
      onToast("error", error)
      return
    }

    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
    onToast("success", "Attachment deleted")
  }

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5 space-y-4">
      <div
        onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const file = event.dataTransfer.files?.[0]
          if (file) setStagedFile(file)
        }}
        onClick={() => { if (!stagedFile) fileInputRef.current?.click() }}
        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          dragOver ? "border-[#001f3f]/40 bg-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
        }`}
      >
        {stagedFile ? (
          <div className="w-full text-left">
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e5e5e5]">
              <FileText className="w-5 h-5 text-[#001f3f] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0d1117] truncate">{stagedFile.name}</p>
                <p className="text-xs text-[#9ca3af]">{(stagedFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-[#6b7280] hover:bg-[#f0f2f5] rounded-xl transition-all"
                onClick={(e) => { e.stopPropagation(); setStagedFile(null); setFileInputKey(Date.now()) }}
                disabled={uploading}
              >
                Delete
              </button>
              <button
                type="button"
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] rounded-xl transition-all shadow-sm flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  void uploadFile(stagedFile)
                }}
                disabled={uploading}
              >
                {uploading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : uploading ? (
          <div className="flex items-center gap-2 text-sm text-[#6b7280]">
            <div className="w-4 h-4 border-2 border-[#001f3f]/20 border-t-[#001f3f] rounded-full animate-spin" /> Uploading...
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#9ca3af]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#374151]">Upload screenshots</p>
              <p className="text-xs text-[#9ca3af] mt-0.5">Image, PDF, DOC - max 25 MB</p>
            </div>
          </>
        )}
      </div>

      <input
        key={fileInputKey}
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) setStagedFile(file)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
      />

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />)}</div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-[#9ca3af]">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-sm">No attachments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-2xl border border-[#f0f2f5] hover:border-[#e5e5e5] transition-all group">
              <Paperclip className="w-4 h-4 text-[#9ca3af] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0d1117] truncate">{attachment.file_name}</p>
                <p className="text-xs text-[#9ca3af] mt-0.5">{attachment.profiles?.fullname ?? "User"} Â· {formatDate(attachment.uploaded_at)}</p>
              </div>
              <div className="flex items-center gap-1 transition-all">
                <button
                  type="button"
                  onClick={() => window.open(attachment.file_url, "_blank")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all"
                  title="View file"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                {(isAdmin || attachment.uploaded_by === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(attachment)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all"
                    title="Delete file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const item = attachments.find(a => a.id === deleteConfirmId)
        if (!item) return null
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-[24px] shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-[#0d1117]">Delete File</h3>
              <p className="text-sm text-[#6b7280] mt-2 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-[#374151]">{item.file_name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-[#374151] bg-[#f8fafc] border border-[#f0f2f5] hover:bg-[#f0f2f5] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmId(null)
                    void commitDelete(item)
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-500 hover:bg-rose-600 shadow-sm shadow-rose-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
