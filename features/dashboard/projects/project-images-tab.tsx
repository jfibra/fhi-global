"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Upload, Trash2, Star } from "lucide-react"
import {
  type ProjectImage,
  fetchProjectImages,
  addProjectImage,
  setMainImage,
  deleteProjectImage,
} from "@/lib/project-service"
import { compressImageForUpload } from "@/lib/upload/compress-image"

interface Props {
  project: { id: number; slug: string; developer_id: string | null; developers?: { slug?: string | null } | null }
  showToast: (variant: "success" | "error", message: string) => void
  onMainImageChange: (url: string) => void
}

export function ProjectImagesTab({ project, showToast, onMainImageChange }: Props) {
  const [images, setImages]       = useState<ProjectImage[]>([])
  const [loading, setLoading]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef                  = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchProjectImages(project.id)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setImages(data)
  }, [project.id, showToast])

  useEffect(() => { void load() }, [load])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    // Determine developer slug using relation or fallback
    const devSlug = (project.developers as Record<string,string> | null)?.slug ?? "unknown"
    const projectSlug = project.slug

    for (const file of Array.from(files)) {
      // Shrink in the browser before it goes over the wire (fails open).
      const { file: toUpload } = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append("file", toUpload, toUpload.name)
      fd.append("developer_slug", devSlug)
      fd.append("project_slug", projectSlug)

      try {
        const res = await fetch("/api/upload/project", { method: "POST", body: fd })
        if (!res.ok) { showToast("error", "Upload failed"); continue }
        const { url } = await res.json() as { url: string }
        const rank = images.length + 1
        const { error } = await addProjectImage(project.id, url, null, rank)
        if (error) showToast("error", error)
      } catch {
        showToast("error", "Upload failed")
      }
    }
    setUploading(false)
    void load()
  }

  const handleSetMain = async (img: ProjectImage) => {
    const { error } = await setMainImage(project.id, img.id)
    if (error) { showToast("error", error); return }
    showToast("success", "Main image updated")
    onMainImageChange(img.url)
    setImages((prev) => prev.map((i) => ({ ...i, is_main: i.id === img.id })))
  }

  const handleDelete = async (id: number) => {
    const { error } = await deleteProjectImage(id)
    if (error) { showToast("error", error); return }
    showToast("success", "Image deleted")
    setImages((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Project Images</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload Images"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => void handleUpload(e.target.files)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl bg-[#f3f4f6] animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[#e5e5e5] rounded-2xl py-16 flex flex-col items-center gap-3 cursor-pointer hover:border-[#001f3f]/40 transition-colors"
        >
          <Upload className="w-10 h-10 text-[#d1d5db]" />
          <p className="text-sm text-[#9ca3af]">Click or drag images here to upload</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {images.map((img) => (
            <div key={img.id} className={`relative group rounded-2xl overflow-hidden aspect-video border-2 transition-all ${img.is_main ? "border-[#d6b357]" : "border-transparent hover:border-[#001f3f]/30"}`}>
              <Image src={img.url} alt="" fill className="object-cover" />
              {img.is_main && (
                <div className="absolute top-2 left-2 bg-[#d6b357] rounded-full px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" /> Main
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.is_main && (
                  <button type="button" onClick={() => void handleSetMain(img)} title="Set as main"
                    className="w-8 h-8 bg-[#d6b357] rounded-full flex items-center justify-center text-white hover:bg-[#c4a030] transition-colors">
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(img.id)} title="Delete"
                  className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white hover:bg-rose-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {/* Upload more tile */}
          <button type="button" onClick={() => inputRef.current?.click()}
            className="aspect-video rounded-2xl border-2 border-dashed border-[#e5e5e5] flex flex-col items-center justify-center gap-1.5 hover:border-[#001f3f]/40 transition-colors text-[#d1d5db] hover:text-[#6b7280]">
            <Upload className="w-6 h-6" />
            <span className="text-xs">Add more</span>
          </button>
        </div>
      )}
    </div>
  )
}
