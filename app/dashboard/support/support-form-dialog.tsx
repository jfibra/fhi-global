"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertCircle,
  Paperclip,
  Upload,
  X,
} from "lucide-react"
import {
  createSupportTicket,
  insertSupportTicketAttachment,
  validateSupportTicketForm,
  type SupportTicketFormData,
  type SupportTicketPriority,
  type SupportTicketRecord,
} from "@/lib/support-service"
import { isAdminStaffRole } from "@/lib/app-roles"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

const EMPTY_FORM: SupportTicketFormData = {
  title: "",
  description: "",
  ticket_type: "",
  priority: "normal",
  page_url: "",
  module: "",
  device_type: "",
  device_os: "",
  browser: "",
  browser_version: "",
  screen_resolution: "",
  ip_address: "",
  location_country: "",
  location_city: "",
  user_agent: "",
}

const PRIORITY_VALUES: SupportTicketPriority[] = ["low", "normal", "high", "critical"]
const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">
      {text}{required && " *"}
    </label>
  )
}

export function SupportFormDialog({
  open,
  currentUserId,
  currentRole,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  currentUserId: string
  currentRole: string
  onClose: () => void
  onSaved: (ticket: SupportTicketRecord) => void
  onError: (message: string) => void
}) {
  const isAdmin = isAdminStaffRole(currentRole)
  const [form, setForm] = useState<SupportTicketFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setPendingFiles([])
    setForm({
      ...EMPTY_FORM,
      page_url: typeof window !== "undefined" ? window.location.pathname : "",
      user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
      screen_resolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "",
      browser: typeof window !== "undefined" ? window.navigator.appName : "",
      browser_version: typeof window !== "undefined" ? window.navigator.appVersion : "",
      device_os: typeof window !== "undefined" ? window.navigator.platform : "",
      device_type: typeof window !== "undefined" ? (/Mobi|Android/i.test(window.navigator.userAgent) ? "mobile" : "desktop") : "",
    })
  }, [open])

  const set = <K extends keyof SupportTicketFormData>(key: K, value: SupportTicketFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: "" }))
  }

  const uploadAttachmentFile = async (ticketId: string, file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("ticketId", ticketId)

    const response = await fetch("/api/upload/support-ticket-file", {
      method: "POST",
      body: formData,
    })

    const json = await response.json() as { url?: string; file_name?: string; file_type?: string; error?: string }
    if (!response.ok || json.error) {
      return json.error ?? "Attachment upload failed"
    }

    const { error } = await insertSupportTicketAttachment({
      ticket_id: ticketId,
      file_name: json.file_name ?? file.name,
      file_url: json.url!,
      file_type: json.file_type ?? null,
      uploaded_by: currentUserId,
    })

    return error
  }

  const handleSubmit = async () => {
    const validationErrors = validateSupportTicketForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    try {
      const { data, error } = await createSupportTicket(form, currentUserId, currentRole)
      if (error || !data) {
        onError(error ?? "Failed to create ticket")
        return
      }

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const uploadError = await uploadAttachmentFile(data.id, file)
          if (uploadError) {
            onError(uploadError)
            break
          }
        }
      }

      onSaved(data)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputClass = (key: string) =>
    `w-full px-4 py-3 rounded-2xl border bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/5 transition-all ${errors[key] ? "border-rose-400" : "border-[#e5e5e5] focus:border-[#001f3f]"}`

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-4xl bg-white rounded-[28px] shadow-2xl flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
          <div className="relative shrink-0 px-7 pt-7 pb-5">
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[28px]" style={{ background: "linear-gradient(to right, #001f3f, #d6b357)" }} />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center shadow-md">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Create Support Ticket</h2>
                  <p className="text-xs text-[#9ca3af] mt-0.5">Report and track system issues.</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-[#374151] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />

          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
            <div>
              <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider mb-4">Issue Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <FieldLabel text="Title" required />
                  <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Issue title" className={inputClass("title")} />
                  {errors.title && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.title}</p>}
                </div>
                <div className="md:col-span-2">
                  <FieldLabel text="Description" required />
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the issue..." className={`${inputClass("description")} resize-none`} />
                  {errors.description && <p className="text-xs text-rose-500 mt-1 ml-1">{errors.description}</p>}
                </div>
                <div>
                  <FieldLabel text="Ticket Type" />
                  <input value={form.ticket_type} onChange={(e) => set("ticket_type", e.target.value)} placeholder="bug, ui, performance..." className={inputClass("ticket_type")} />
                </div>
                {isAdmin && (
                  <div>
                    <FieldLabel text="Priority" required />
                    <select value={form.priority} onChange={(e) => set("priority", e.target.value as SupportTicketPriority)} className={inputClass("priority")}>
                      {PRIORITY_VALUES.map((priority) => (
                        <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider mb-4">Issue Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel text="Page URL" />
                  <input value={form.page_url} disabled readOnly placeholder="/dashboard/sales" className={inputClass("page_url")} />
                </div>
                <div>
                  <FieldLabel text="Module" />
                  <input value={form.module} onChange={(e) => set("module", e.target.value)} placeholder="sales encoding module" className={inputClass("module")} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-['Outfit'] text-sm font-bold text-[#0d1117] uppercase tracking-wider mb-4">Screenshot Attachments</h3>
              <div
                onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  const files = Array.from(event.dataTransfer.files)
                  setPendingFiles((prev) => [...prev, ...files])
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  dragOver ? "border-[#001f3f]/40 bg-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/25 hover:bg-[#fafbfc]"
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-[#f0f2f5] flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#9ca3af]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#374151]">Click to add files or drag & drop</p>
                  <p className="text-xs text-[#9ca3af] mt-0.5">Images, PDFs, docs — max 25 MB each</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  setPendingFiles((prev) => [...prev, ...files])
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />

              {pendingFiles.length > 0 && (
                <div className="space-y-2 mt-3">
                  {pendingFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-2xl border border-[#f0f2f5] group">
                      <Paperclip className="w-4 h-4 text-[#9ca3af] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{file.name}</p>
                        <p className="text-xs text-[#9ca3af] mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="w-8 h-8 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-rose-50 text-[#9ca3af] hover:text-rose-500 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mx-7 h-px bg-[#f0f2f5]" />
          <div className="shrink-0 px-7 py-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f3f4f6] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-2.5 rounded-2xl text-sm font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
