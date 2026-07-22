"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Images,
  Video,
  FileText,
  ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Search,
  Building2,
  AlertCircle,
  Play,
  Globe,
  Filter,
} from "lucide-react"
import {
  fetchDeveloperMedia,
  type MediaFile,
} from "@/lib/developer-portal-service"
import { addProjectImage } from "@/lib/project-service"
import { createClient } from "@/lib/supabase/client"
import { DeveloperPortalPageHeader } from "@/components/developer/developer-portal-page-header"

// ─── Toast ─────────────────────────────────────────────────────────────────────
type ToastVariant = "success" | "error"
interface ToastMsg { id: number; variant: ToastVariant; message: string }

function ToastList({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs ${
          t.variant === "success" ? "bg-green-50 text-green-800 border border-green-100" : "bg-rose-50 text-rose-800 border border-rose-100"
        }`}>
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Media type icon ──────────────────────────────────────────────────────────
function MediaTypeIcon({ type }: { type: string }) {
  if (type === "video")        return <Video className="w-4 h-4 text-blue-500" />
  if (type === "virtual_tour") return <Globe className="w-4 h-4 text-violet-500" />
  return <ImageIcon className="w-4 h-4 text-indigo-500" />
}

// ─── Media type label ─────────────────────────────────────────────────────────
function MediaTypeLabel({ type }: { type: string }) {
  const MAP: Record<string, { label: string; cls: string }> = {
    image:        { label: "Image",        cls: "bg-indigo-100 text-indigo-700" },
    video:        { label: "Video",        cls: "bg-blue-100 text-blue-700" },
    virtual_tour: { label: "Virtual Tour", cls: "bg-violet-100 text-violet-700" },
  }
  const c = MAP[type] ?? { label: type, cls: "bg-gray-100 text-gray-600" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.cls}`}>
      {c.label}
    </span>
  )
}

// ─── Upload Modal ────────────────────────────────────────────────────────────
function UploadModal({
  developerId,
  developerSlug,
  projectId,
  projectSlug,
  projectName,
  onClose,
  onUploaded,
  onError,
}: {
  developerId: string
  developerSlug: string
  projectId: number
  projectSlug: string
  projectName: string
  onClose: () => void
  onUploaded: (file: MediaFile) => void
  onError: (msg: string) => void
}) {
  const [file, setFile]               = useState<File | null>(null)
  const [mediaType, setMediaType]     = useState<"image" | "video" | "virtual_tour" | "brochure" | "floor_plan">("image")
  const [videoUrl, setVideoUrl]       = useState("")
  const [tourUrl, setTourUrl]         = useState("")
  const [uploading, setUploading]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const inputRef                      = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const maxMb = 50
    if (f.size > maxMb * 1024 * 1024) {
      onError(`File exceeds ${maxMb} MB limit.`)
      return
    }
    setFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      const supabase = createClient()

      if (mediaType === "video" || mediaType === "virtual_tour") {
        const url = mediaType === "video" ? videoUrl.trim() : tourUrl.trim()
        if (!url) { onError("URL is required."); setUploading(false); return }

        const { data, error } = await supabase
          .from("project_media")
          .insert({ project_id: projectId, media_type: mediaType, url })
          .select()
          .single()

        if (error) { onError(error.message); setUploading(false); return }

        onUploaded({
          id:           data.id,
          project_id:   projectId,
          project_name: projectName,
          type:         mediaType,
          url:          data.url,
          thumb:        null,
        })
      } else {
        if (!file) { onError("Please select a file."); setUploading(false); return }

        const fd = new FormData()
        fd.append("file", file)
        fd.append("developer_slug", developerSlug)
        fd.append("project_slug", projectSlug)

        const res = await fetch("/api/upload/project", { method: "POST", body: fd })
        const json = await res.json() as { url?: string; error?: string }

        if (!res.ok || !json.url) {
          onError(json.error ?? "Upload failed.")
          setUploading(false)
          return
        }

        const { data, error } = await addProjectImage(projectId, json.url, null, 0)
        if (error) { onError(error); setUploading(false); return }
        if (!data) { onError("Failed to save image"); setUploading(false); return }

        onUploaded({
          id:           data.id,
          project_id:   projectId,
          project_name: projectName,
          type:         "image",
          url:          json.url,
          thumb:        null,
          is_main:      data.is_main,
          rank:         data.rank,
        })
      }
    } catch (err) {
      onError("Unexpected error occurred.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-[28px] p-7 max-w-md w-full shadow-2xl border border-white/60">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] mb-1">Upload Media</h3>
        <p className="text-xs text-[#9ca3af] mb-5">For: <span className="font-semibold text-[#374151]">{projectName}</span></p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Media Type</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as typeof mediaType)}
              className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] bg-white"
            >
              <option value="image">Image</option>
              <option value="video">Video (URL)</option>
              <option value="virtual_tour">Virtual Tour (URL)</option>
              <option value="brochure">Brochure (PDF)</option>
              <option value="floor_plan">Floor Plan (PDF/Image)</option>
            </select>
          </div>

          {/* URL input for video/tour */}
          {mediaType === "video" && (
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Video URL</label>
              <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." required
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
            </div>
          )}
          {mediaType === "virtual_tour" && (
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Virtual Tour URL</label>
              <input type="url" value={tourUrl} onChange={(e) => setTourUrl(e.target.value)} placeholder="https://tour.example.com/..." required
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
            </div>
          )}

          {/* File upload for image/brochure/floor_plan */}
          {(mediaType === "image" || mediaType === "brochure" || mediaType === "floor_plan") && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                dragOver ? "border-indigo-500 bg-indigo-50" : "border-[#e5e5e5] hover:border-indigo-300 hover:bg-indigo-50/30"
              }`}
            >
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#374151]">{file.name}</p>
                  <p className="text-xs text-[#9ca3af] mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#9ca3af]">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm font-semibold text-[#374151]">Drop file or click to upload</p>
                  <p className="text-xs">
                    {mediaType === "image" ? "PNG, JPG, WEBP • Max 50 MB" : "PDF • Max 50 MB"}
                  </p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={mediaType === "image" ? "image/*" : mediaType === "brochure" || mediaType === "floor_plan" ? ".pdf,image/*" : "*"}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">
              Cancel
            </button>
            <button type="submit" disabled={uploading}
              className="flex-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── No developer placeholder ─────────────────────────────────────────────────
function NoDeveloperLinked({ userName }: { userName: string }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-24">
        <div className="w-16 h-16 rounded-[28px] bg-indigo-50 flex items-center justify-center mb-5">
          <Building2 className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="font-semibold text-[#374151] mb-1">No Developer Linked</p>
        <p className="text-sm text-[#9ca3af]">Contact an administrator to set up your account.</p>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DeveloperMediaClient({
  userId,
  userName,
  developerId,
  developerName,
  developerSlug,
}: {
  userId: string
  userName: string
  developerId: string | null
  developerName: string | null
  developerSlug: string | null
}) {
  const [media, setMedia]           = useState<MediaFile[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterProject, setFilterProject] = useState("")
  const [uploadTarget, setUploadTarget] = useState<{ projectId: number; projectSlug: string; projectName: string } | null>(null)
  const [toasts, setToasts]         = useState<ToastMsg[]>([])

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, variant, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const loadMedia = useCallback(async () => {
    if (!developerId) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await fetchDeveloperMedia(developerId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setMedia(data)
  }, [developerId, showToast])

  useEffect(() => { void loadMedia() }, [loadMedia])

  // Delete a media file
  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`Delete this ${file.type}? This cannot be undone.`)) return

    const supabase = createClient()
    let error: string | null = null

    if (file.type === "image") {
      const { error: e } = await supabase.from("project_images").delete().eq("id", file.id)
      error = e?.message ?? null
    } else {
      const { error: e } = await supabase.from("project_media").delete().eq("id", file.id)
      error = e?.message ?? null
    }

    if (error) { showToast("error", error); return }
    showToast("success", "Media deleted")
    setMedia((prev) => prev.filter((m) => m.id !== file.id || m.type !== file.type))
  }

  if (!developerId) return <NoDeveloperLinked userName={userName} />

  // Filtered media
  const projectNames = [...new Set(media.map((m) => m.project_name))]
  const filtered = media.filter((m) => {
    const matchSearch   = !search      || m.url.toLowerCase().includes(search.toLowerCase()) || m.project_name.toLowerCase().includes(search.toLowerCase())
    const matchType     = !filterType  || m.type === filterType
    const matchProject  = !filterProject || m.project_name === filterProject
    return matchSearch && matchType && matchProject
  })

  return (
    <>
      <div className="space-y-6">
        <DeveloperPortalPageHeader
          segmentLabel="Media / files"
          title="Media and files"
          description="Browse every image, video link, and virtual tour attached to your projects. Upload new assets from each project under the Images or Media tab; delete items here when you need to clean up."
          actions={
            <span className="inline-flex items-center rounded-2xl border border-[#e5e5e5] bg-white/80 px-4 py-2 text-sm font-semibold text-[#374151]">
              {media.length} file{media.length === 1 ? "" : "s"}
            </span>
          }
        />

        {/* Filters bar */}
        <div className="bg-white/70 backdrop-blur-xl rounded-[20px] border border-white/60 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search media…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#e5e5e5] bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition-all"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border border-[#e5e5e5] bg-white focus:outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="virtual_tour">Virtual Tours</option>
          </select>

          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border border-[#e5e5e5] bg-white focus:outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">All projects</option>
            {projectNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Upload helper card */}
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-[20px] border border-indigo-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
            <Images className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#374151]">Upload Media to a Project</p>
            <p className="text-xs text-[#9ca3af]">
              Files are stored in: <span className="font-mono">FHI_GLOBAL / {developerSlug ?? "developer"} / project-slug /</span>
            </p>
          </div>
          <p className="text-xs text-[#9ca3af] hidden sm:block">
            Use the <span className="text-indigo-600 font-semibold">Images</span> or <span className="text-indigo-600 font-semibold">Media</span> tabs inside each project.
          </p>
        </div>

        {/* Media grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-[#f3f4f6] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 p-16 text-center">
            <div className="w-16 h-16 rounded-[24px] bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Images className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="font-semibold text-[#374151] mb-1">
              {media.length === 0 ? "No media files yet" : "No results found"}
            </p>
            <p className="text-sm text-[#9ca3af]">
              {media.length === 0
                ? "Upload images, videos, and brochures through your project pages."
                : "Try adjusting your filters."
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((file) => (
              <div
                key={`${file.type}-${file.id}`}
                className="group relative bg-white rounded-[20px] border border-[#f0f0f0] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-[#f8fafc] overflow-hidden relative">
                  {file.type === "image" && file.url ? (
                    <Image
                      src={file.url}
                      alt={file.project_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  ) : file.type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50">
                      <Play className="w-10 h-10 text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-violet-50">
                      <Globe className="w-10 h-10 text-violet-400" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDelete(file)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-rose-500/80 hover:bg-rose-500 text-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 border-t border-[#f5f5f5]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MediaTypeIcon type={file.type} />
                    <MediaTypeLabel type={file.type} />
                  </div>
                  <p className="text-xs font-semibold text-[#374151] truncate">{file.project_name}</p>
                  {file.thumb && (
                    <p className="text-[10px] text-[#9ca3af] mt-0.5">Has thumbnail</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastList toasts={toasts} remove={removeToast} />
    </>
  )
}
