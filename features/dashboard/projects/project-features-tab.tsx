"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { type ProjectFeature, fetchProjectFeatures, addProjectFeature, deleteProjectFeature } from "@/lib/project-service"

interface Props {
  projectId: number
  showToast: (variant: "success" | "error", message: string) => void
  readOnly?: boolean
}

export function ProjectFeaturesTab({ projectId, showToast, readOnly = false }: Props) {
  const [features, setFeatures]   = useState<ProjectFeature[]>([])
  const [loading, setLoading]     = useState(false)
  const [text, setText]           = useState("")
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchProjectFeatures(projectId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setFeatures(data)
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const handleAdd = async () => {
    const t = text.trim()
    if (!t) return
    setSaving(true)
    const { error } = await addProjectFeature(projectId, t)
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", "Feature added")
    setText("")
    void load()
  }

  const handleDelete = async (id: number) => {
    const { error } = await deleteProjectFeature(id)
    if (error) { showToast("error", error); return }
    showToast("success", "Deleted")
    setFeatures((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Project Features</h3>

      {/* Add */}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
            placeholder="e.g. Smart home automation…"
            className="flex-1 border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
          />
          <button type="button" onClick={() => void handleAdd()} disabled={saving || !text.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-[#f3f4f6] animate-pulse" />)
        ) : features.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#9ca3af]">{readOnly ? "No features yet." : "No features yet. Add key highlights above."}</div>
        ) : (
          features.map((f) => (
            <div key={f.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#f0f0f0] px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-[#d6b357] flex-shrink-0" />
              <span className="flex-1 text-sm text-[#374151]">{f.description}</span>
              {!readOnly && (
                <button type="button" onClick={() => void handleDelete(f.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors">
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
