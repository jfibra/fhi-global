"use client"

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Cropper from "react-easy-crop"
import type { Area, Point } from "react-easy-crop"
import { Trash2, ZoomIn, ZoomOut, X, Check, Upload } from "lucide-react"
import { getCroppedBlob } from "@/lib/crop-image"
import { compressImageForUpload } from "@/lib/upload/compress-image"

// ─── component ────────────────────────────────────────────────────────────────
export function ProfileAvatarUpload({
  userId,
  displayName,
  currentUrl,
  busy,
  open,
  onBusyChange,
  onUploaded,
  onRemoved,
  onClose,
  onError,
}: {
  userId: string
  displayName: string
  currentUrl: string | null
  busy: boolean
  open: boolean
  onBusyChange: (busy: boolean) => void
  onUploaded: (url: string) => void
  onRemoved: () => void
  onClose: () => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)

  // Close on ESC
  useEffect(() => {
    if (!open && !imageSrc) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (imageSrc) { setImageSrc(null); onClose() }
        else onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, imageSrc, onClose])

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      onError("Image must be 10 MB or smaller.")
      return
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("Only JPG, PNG, or WEBP images are allowed.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    const srcToUpload = imageSrc
    setUploading(true)
    onBusyChange(true)
    setImageSrc(null)
    onClose()

    try {
      const blob = await getCroppedBlob(srcToUpload, croppedAreaPixels, "image/jpeg", 0.92)
      // Shrink in the browser before it goes over the wire (fails open).
      const { file: toUpload } = await compressImageForUpload(
        new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" }),
      )
      const formData = new FormData()
      formData.append("file", toUpload, toUpload.name)
      formData.append("userId", userId)

      const res = await fetch("/api/upload/avatar", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || "Upload failed")
      }
      const { url } = (await res.json()) as { url: string }
      onUploaded(url)
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      onBusyChange(false)
      setUploading(false)
    }
  }

  const handleCancelCrop = () => {
    setImageSrc(null)
    onClose()
  }

  const handleRemove = () => {
    onRemoved()
    onClose()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Options Modal ── */}
      {open && !imageSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!busy ? onClose : undefined} />

          <div className="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0]">
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Profile Photo</h3>
                <p className="text-xs text-[#9ca3af] mt-0.5">Choose or update your profile picture</p>
              </div>
              <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center py-8">
              <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg shadow-[#001f3f]/10">
                {currentUrl ? (
                  <Image src={currentUrl} alt={displayName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-[#9ca3af]">JPG, PNG, WEBP · max 10 MB</p>
            </div>

            <div className="flex flex-col gap-3 px-6 pb-6">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed">
                <Upload className="w-4 h-4" />
                {busy ? "Uploading…" : "Choose Photo"}
              </button>
              {currentUrl && (
                <button type="button" onClick={handleRemove} disabled={busy} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm bg-white/50 border border-[#e5e5e5] text-[#6b7280] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  <Trash2 className="w-4 h-4" />
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Crop Modal ── */}
      {imageSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div className="relative z-10 w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0]">
              <div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Crop Profile Photo</h3>
                <p className="text-xs text-[#9ca3af] mt-0.5">Drag to reposition · scroll or slider to zoom</p>
              </div>
              <button
                onClick={handleCancelCrop}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Crop area */}
            <div className="relative w-full bg-[#0d1117]" style={{ height: 320 }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { borderRadius: 0 },
                  cropAreaStyle: {
                    border: "2px solid rgba(214,179,87,0.9)",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                  },
                }}
              />
            </div>

            {/* Zoom */}
            <div className="px-6 py-4 border-t border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-[#e5e5e5] accent-[#001f3f] cursor-pointer"
                />
                <button
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full font-semibold text-sm bg-white/50 border border-[#e5e5e5] hover:bg-white hover:border-[#001f3f] text-[#4b5563] transition-all"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCrop()}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-70 disabled:translate-y-0"
              >
                {uploading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {uploading ? "Saving…" : "Apply & Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
