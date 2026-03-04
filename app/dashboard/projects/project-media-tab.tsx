"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2, Video, Globe } from "lucide-react"
import { type ProjectMedia, fetchProjectMedia, upsertProjectMedia, deleteProjectMedia } from "@/lib/project-service"

interface Props {
  projectId: number
  showToast: (variant: "success" | "error", message: string) => void
}

export function ProjectMediaTab({ projectId, showToast }: Props) {
  const [media, setMedia]       = useState<ProjectMedia[]>([])
  const [loading, setLoading]   = useState(false)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<{ media_type: "video" | "virtual_tour"; url: string }>({ media_type: "video", url: "" })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchProjectMedia(projectId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setMedia(data)
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const handleAdd = async () => {
    if (!form.url.trim()) return
    setSaving(true)
    const { error } = await upsertProjectMedia({ ...form, project_id: projectId })
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", "Media added")
    setForm({ media_type: "video", url: "" })
    setAdding(false)
    void load()
  }

  const handleDelete = async (id: number) => {
    const { error } = await deleteProjectMedia(id)
    if (error) { showToast("error", error); return }
    showToast("success", "Deleted")
    setMedia((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Videos & Virtual Tours</h3>
        <button type="button" onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Media
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Type</label>
              <select value={form.media_type} onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value as "video" | "virtual_tour" }))}
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]">
                <option value="video">Video</option>
                <option value="virtual_tour">Virtual Tour</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">URL *</label>
              <input type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://â€¦"
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button type="button" onClick={() => void handleAdd()} disabled={saving || !form.url.trim()}
              className="px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#001f3f]/90 transition-all">
              {saving ? "Savingâ€¦" : "Add"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />)
        ) : media.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#9ca3af]">No media added yet.</div>
        ) : (
          media.map((m) => (
            <div key={m.id} className="flex items-center gap-4 bg-white rounded-2xl border border-[#f0f0f0] px-4 py-3">
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${m.media_type === "video" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                {m.media_type === "video" ? <Video className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#6b7280] capitalize">{m.media_type.replace("_", " ")}</p>
                <a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-[#001f3f] hover:underline truncate block">{m.url}</a>
              </div>
              <button type="button" onClick={() => void handleDelete(m.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
