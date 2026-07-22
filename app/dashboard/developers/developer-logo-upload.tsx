"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Cropper from "react-easy-crop"
import type { Area, Point } from "react-easy-crop"
import { Upload, X, Check, ImageIcon, Trash2, ZoomIn, ZoomOut, ArrowLeft } from "lucide-react"
import Image from "next/image"
import { updateDeveloperLogoUrl } from "@/lib/developer-service"
import { getCroppedBlob } from "@/lib/crop-image"

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

// Aspect presets. "original" tracks the image's own ratio so the default crop
// keeps the whole logo (nothing trimmed) until the admin chooses to reframe it.
const ASPECTS = [
  { key: "original", label: "Original" },
  { key: "square", label: "1:1", value: 1 },
  { key: "landscape", label: "4:3", value: 4 / 3 },
  { key: "wide", label: "16:9", value: 16 / 9 },
] as const
type AspectKey = (typeof ASPECTS)[number]["key"]

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
  const [imageSrc, setImageSrc]   = useState<string | null>(null)
  const [crop, setCrop]           = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom]           = useState(1)
  const [aspectKey, setAspectKey] = useState<AspectKey>("original")
  const [naturalAspect, setNaturalAspect] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy]           = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const aspect =
    aspectKey === "original"
      ? naturalAspect || 1
      : (ASPECTS.find((a) => a.key === aspectKey) as { value: number }).value

  useEffect(() => {
    if (open) {
      setImageSrc(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setAspectKey("original")
      setCroppedAreaPixels(null)
    }
  }, [open])

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      onError("Only image files are allowed.")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      onError("File exceeds 10 MB limit.")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setAspectKey("original")
    }
    reader.readAsDataURL(f)
  }, [onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }, [loadFile])

  const onCropComplete = useCallback((_: Area, px: Area) => setCroppedAreaPixels(px), [])

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, "image/png")
      const fd = new FormData()
      fd.append("file", blob, "logo.png")
      fd.append("developerSlug", developerSlug)

      const res = await fetch("/api/upload/developer", { method: "POST", body: fd })
      const json = (await res.json()) as { url?: string; error?: string }

      if (!res.ok || !json.url) {
        onError(json.error ?? "Upload failed.")
        return
      }

      const { error } = await updateDeveloperLogoUrl(developerId, json.url)
      if (error) { onError(error); return }

      onUploaded(json.url)
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.")
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
            {imageSrc ? (
              /* ── Crop mode ── */
              <>
                <div className="relative w-full rounded-2xl overflow-hidden bg-[#0d1117]" style={{ height: 300 }}>
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    cropShape="rect"
                    objectFit="contain"
                    showGrid={false}
                    restrictPosition={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    onMediaLoaded={(m) => {
                      if (m.naturalWidth && m.naturalHeight) setNaturalAspect(m.naturalWidth / m.naturalHeight)
                    }}
                    style={{
                      cropAreaStyle: {
                        border: "2px solid rgba(214,179,87,0.9)",
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                      },
                    }}
                  />
                </div>

                {/* Aspect presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#9ca3af] font-semibold uppercase tracking-wider">Aspect:</span>
                  {ASPECTS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setAspectKey(a.key)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        aspectKey === a.key
                          ? "bg-[#001f3f] text-white border-[#001f3f]"
                          : "border-[#e5e5e5] text-[#6b7280] hover:border-[#001f3f] hover:text-[#001f3f]"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range" min={1} max={3} step={0.05} value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-[#e5e5e5] accent-[#001f3f] cursor-pointer"
                    aria-label="Zoom"
                  />
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#f4f6f9] hover:bg-[#e8eaed] text-[#6b7280] transition-all">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[11px] text-[#9ca3af] text-center">Drag to reposition · scroll or slider to zoom · saved as PNG</p>
              </>
            ) : (
              /* ── Select mode ── */
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                    dragOver ? "border-[#001f3f] bg-[#001f3f]/5" : "border-[#e5e5e5] hover:border-[#001f3f]/40 hover:bg-[#f8fafc]"
                  }`}
                >
                  {currentLogoUrl ? (
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
                        <p className="text-sm font-semibold text-[#374151]">Drag &amp; drop or click to upload</p>
                        <p className="text-xs mt-1">PNG, JPG, WEBP, SVG • Max 10 MB • crop before saving</p>
                      </div>
                    </div>
                  )}
                  <input ref={inputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = "" }} />
                </div>

                <p className="text-[11px] text-[#9ca3af] font-mono px-1">
                  Path: FHI_GLOBAL / {developerSlug} / [timestamp]-logo.png
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#f0f0f0]">
            <div>
              {imageSrc ? (
                <button type="button" onClick={() => setImageSrc(null)} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all disabled:opacity-50">
                  <ArrowLeft className="w-3.5 h-3.5" /> Choose different
                </button>
              ) : currentLogoUrl ? (
                <button type="button" onClick={() => void handleRemove()} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all">
                Cancel
              </button>
              {imageSrc && (
                <button type="button" onClick={() => void handleUpload()} disabled={busy || !croppedAreaPixels}
                  className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2">
                  {busy
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                    : <><Check className="w-4 h-4" /> Crop &amp; Upload</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
