"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Upload, X, Check, ImageIcon, AlertCircle, Trash2 } from "lucide-react"
import Image from "next/image"
import { updateDeveloperLogoUrl } from "@/lib/developer-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

interface Props {
  open: boolean
  developerId: string
  developerSlug: string
  developerName: string
  currentLogoUrl: string | null
  onClose: () => void
  onUploaded: (url: string) => void
  onRemoved: () => void
  onError: (msg: string) => void
}

export function DeveloperLogoUpload({
  open,
  developerId,
  developerSlug,
  developerName,
  currentLogoUrl,
  onClose,
  onUploaded,
  onRemoved,
  onError,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile]             = useState<File | null>(null)
  const [busy, setBusy]             = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPreviewUrl(null)
      setFile(null)
    }
  }, [open])

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      onError("Only image files are allowed.")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      onError("File exceeds 10 MB limit.")
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleUpload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("developerSlug", developerSlug)

      const res = await fetch("/api/upload/developer", { method: "POST", body: fd })
      const json = await res.json() as { url?: string; error?: string }

      if (!res.ok || !json.url) {
        onError(json.error ?? "Upload failed.")
        return
      }

      const { error } = await updateDeveloperLogoUrl(developerId, json.url)
      if (error) { onError(error); return }

      onUploaded(json.url)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    const { error } = await updateDeveloperLogoUrl(developerId, null)
    if (error) { onError(error); setBusy(false); return }
    onRemoved()
    setBusy(false)
  }

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

        <div className="relative w-full sm:max-w-lg flex flex-col bg-white/90 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Upload Logo</h3>
                <p className="text-xs text-[#6b7280] truncate max-w-[180px]">{developerName}</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                dragOver ? "border-[#001f3f] bg-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/40 hover:bg-[#f8fafc]"
              }`}
            >
              {previewUrl ? (
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-[#e5e5e5]">
                  <Image src={previewUrl} alt="Preview" fill className="object-contain p-2" />
                </div>
              ) : currentLogoUrl ? (
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-[#e5e5e5]">
                  <Image src={currentLogoUrl} alt="Current logo" fill className="object-contain p-2" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                    <span className="text-white text-xs font-semibold">Replace</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-[#9ca3af]">
                  <div className="w-14 h-14 rounded-2xl bg-[#f3f4f6] flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#374151]">Drag & drop or click to upload</p>
                    <p className="text-xs mt-1">PNG, JPG, WEBP, SVG • Max 10 MB</p>
                  </div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {file && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#f8fafc] border border-[#e5e5e5]">
                <div className="w-8 h-8 rounded-xl bg-white border border-[#e5e5e5] flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-4 h-4 text-[#6b7280]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#374151] truncate">{file.name}</p>
                  <p className="text-xs text-[#9ca3af]">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => { setFile(null); setPreviewUrl(null) }}
                  className="text-[#9ca3af] hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* S3 path hint */}
            <p className="text-[11px] text-[#9ca3af] font-mono px-1">
              Path: FHI_GLOBAL / {developerSlug} / [timestamp]-logo.*
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#f0f0f0]">
            <div>
              {currentLogoUrl && !previewUrl && (
                <button type="button" onClick={() => void handleRemove()} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
                Cancel
              </button>
              <button type="button" onClick={() => void handleUpload()} disabled={!file || busy}
                className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2">
                {busy
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                  : <><Check className="w-4 h-4" /> Upload</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
