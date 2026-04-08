"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, FileText, Paperclip, Trash2, Upload } from "lucide-react"
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachment: SupportTicketAttachment) => {
    if (!isAdmin) return
    if (!window.confirm(`Delete "${attachment.file_name}"?`)) return

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
          if (file) void uploadFile(file)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
          dragOver ? "border-[#001f3f]/40 bg-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
        }`}
      >
        {uploading ? (
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
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void uploadFile(file)
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
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  onClick={() => window.open(attachment.file_url, "_blank")}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-50 text-[#9ca3af] hover:text-sky-500 transition-all"
                  title="View file"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(attachment)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all"
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
    </div>
  )
}
