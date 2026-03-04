"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react"
import type { Team } from "@/lib/team-service"
import { updateTeamLogoUrl } from "@/lib/team-service"

interface Props {
  open: boolean
  onClose: () => void
  onUploaded: (url: string) => void
  team: Team
}

export function TeamLogoUpload({ open, onClose, onUploaded, team }: Props) {
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [mounted,   setMounted]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview(null)
      setError(null)
    }
  }, [open])

  const pickFile = useCallback((picked: File) => {
    if (!picked.type.startsWith("image/")) {
      setError("Only image files are supported.")
      return
    }
    if (picked.size > 10 * 1024 * 1024) {
      setError("File must be smaller than 10 MB.")
      return
    }
    setError(null)
    setFile(picked)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(picked)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) pickFile(dropped)
    },
    [pickFile],
  )

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("teamSlug", team.slug)

      const res = await fetch("/api/upload/team", { method: "POST", body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? "Upload failed.")
        return
      }

      const { error: saveErr } = await updateTeamLogoUrl(team.id, json.url)
      if (saveErr) {
        setError(saveErr)
        return
      }

      onUploaded(json.url)
      onClose()
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setUploading(false)
    }
  }

  if (!mounted || !open) return null

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl border border-[#e8eaed] flex flex-col"
        style={{ maxWidth: "min(480px, calc(100% - 2rem))", maxHeight: "calc(100dvh - 3rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5] shrink-0">
          <div>
            <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Upload Team Logo</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">{team.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 transition-all select-none
              ${dragging
                ? "border-[#001f3f] bg-[#001f3f]/5"
                : "border-[#e8eaed] bg-[#fafbfc] hover:border-[#001f3f]/50 hover:bg-[#f4f6f9]"
              }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#001f3f]/8 flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#001f3f]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[#0d1117]">
                {dragging ? "Drop to upload" : "Drag & drop or click to browse"}
              </p>
              <p className="text-xs text-[#9ca3af] mt-1">PNG, JPG, WEBP, SVG â€” max 10 MB</p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />

          {/* Preview */}
          {preview && (
            <div className="rounded-2xl border border-[#e8eaed] bg-[#fafbfc] p-4 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="w-16 h-16 rounded-xl object-cover border border-[#e8eaed] shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0d1117] truncate">{file?.name}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">
                  {file ? (file.size / 1024).toFixed(0) + " KB" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Current logo notice */}
          {!preview && team.logo_url && (
            <div className="rounded-xl border border-[#f0f2f5] bg-[#fafbfc] p-3 flex items-center gap-3">
              <ImageIcon className="w-4 h-4 text-[#9ca3af] shrink-0" />
              <p className="text-xs text-[#6b7280]">
                A logo is already uploaded. Uploading a new one will replace it.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f2f5] bg-[#fafbfc] rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6b7280] bg-white border border-[#e8eaed] hover:bg-[#f4f6f9] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#001f3f] hover:bg-[#002a56] disabled:opacity-40 flex items-center gap-2 transition-all"
          >
            {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {uploading ? "Uploadingâ€¦" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
