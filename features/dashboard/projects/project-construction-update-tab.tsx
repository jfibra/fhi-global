"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Trash2, FileText, ImageIcon, ExternalLink, Upload } from "lucide-react"
import {
  type ConstructionUpdate,
  fetchConstructionUpdates,
  createConstructionUpdate,
  deleteConstructionUpdate,
  uploadConstructionFile,
} from "@/lib/construction-updates"

interface Props {
  projectId: number
  projectSlug: string
  developerSlug: string
  showToast: (variant: "success" | "error", message: string) => void
  readOnly?: boolean
}

function fileTypeOf(file: File): "pdf" | "image" {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image"
}

export function ProjectConstructionUpdateTab({ projectId, projectSlug, developerSlug, showToast, readOnly = false }: Props) {
  const [updates, setUpdates] = useState<ConstructionUpdate[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchConstructionUpdates(projectId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setUpdates(data)
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const pickFile = (f: File | null) => {
    setFile(f)
    // Default the title from the filename (without extension) when empty.
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""))
  }

  const handleAdd = async () => {
    const t = title.trim()
    if (!t) { showToast("error", "Add a title for this update."); return }
    if (!file) { showToast("error", "Choose a PDF or image to upload."); return }

    setSaving(true)
    setProgress(0)
    const { url, error: uploadError } = await uploadConstructionFile(file, developerSlug, projectSlug, (pct) => setProgress(pct))
    if (uploadError || !url) { setSaving(false); setProgress(null); showToast("error", uploadError ?? "Upload failed."); return }

    setProgress(100) // uploaded — the server now relocates it to S3
    const { error } = await createConstructionUpdate(projectId, { title: t, file_url: url, file_type: fileTypeOf(file) })
    setSaving(false)
    setProgress(null)
    if (error) { showToast("error", error); return }

    showToast("success", "Construction update added")
    setTitle("")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    void load()
  }

  const handleDelete = async (u: ConstructionUpdate) => {
    const { error } = await deleteConstructionUpdate(projectId, u.id)
    if (error) { showToast("error", error); return }
    showToast("success", "Deleted")
    setUpdates((prev) => prev.filter((x) => x.id !== u.id))
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Construction Updates</h3>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Share construction-progress files (PDF or image). Published files appear on the public project page.
        </p>
      </div>

      {/* Add */}
      {!readOnly && (
        <div className="rounded-2xl border border-[#e5e5e5] bg-[#f9fafb] p-4 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title — e.g. Phase 1 · February 2026"
            className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#cbd2da] bg-white text-sm text-[#374151] cursor-pointer hover:border-[#001f3f]/50 transition-colors">
              <Upload className="w-4 h-4 text-[#9ca3af] shrink-0" />
              <span className="truncate">{file ? file.name : "Choose a PDF or image…"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving || !title.trim() || !file}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {progress !== null && progress >= 100 ? "Finalizing…" : "Uploading…"}</>
                : <><Plus className="w-3.5 h-3.5" /> Add update</>}
            </button>
          </div>

          {saving && progress !== null && (
            <div className="pt-0.5">
              <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                <span className="text-[#374151]">{progress < 100 ? "Uploading…" : "Finalizing…"}</span>
                <span className="tabular-nums font-bold text-[#001f3f]">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#e5e7eb] overflow-hidden">
                <div
                  className={`h-full rounded-full bg-[#001f3f] transition-all duration-200 ${progress >= 100 ? "animate-pulse" : ""}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#9ca3af]">PDF or image · up to 30 MB.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-[#f3f4f6] animate-pulse" />)
        ) : updates.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#9ca3af]">
            {readOnly ? "No construction updates yet." : "No construction updates yet. Add the first one above."}
          </div>
        ) : (
          updates.map((u) => (
            <div key={u.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#f0f0f0] px-3 py-2.5">
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#f3f4f6] flex items-center justify-center shrink-0">
                {u.file_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.file_url} alt={u.title} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-5 h-5 text-[#001f3f]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827] truncate">{u.title}</p>
                <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide flex items-center gap-1">
                  {u.file_type === "image" ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {u.file_type}
                </p>
              </div>
              <a
                href={u.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void handleDelete(u)}
                  aria-label="Delete update"
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
