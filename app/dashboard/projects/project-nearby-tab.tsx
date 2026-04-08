"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { type ProjectNeighbor, fetchProjectNeighbors, upsertProjectNeighbor, deleteProjectNeighbor } from "@/lib/project-service"

interface Props {
  projectId: number
  showToast: (variant: "success" | "error", message: string) => void
}

type Category = ProjectNeighbor["category"]
const CATEGORIES: Category[] = ["school", "hospital", "shopping", null]

const EMPTY: Partial<ProjectNeighbor> = { category: null, description: "" }

export function ProjectNearbyTab({ projectId, showToast }: Props) {
  const [items, setItems]   = useState<ProjectNeighbor[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<ProjectNeighbor> | null>(null)
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchProjectNeighbors(projectId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setItems(data)
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!editing || !editing.description?.trim()) return
    setSaving(true)
    const { error } = await upsertProjectNeighbor({ ...editing, project_id: projectId })
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", editing.id ? "Updated" : "Added")
    setEditing(null)
    void load()
  }

  const handleDelete = async (id: number) => {
    const { error } = await deleteProjectNeighbor(id)
    if (error) { showToast("error", error); return }
    showToast("success", "Deleted")
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const categoryBadge = (c: Category) => {
    const colors: Record<string, string> = {
      school: "bg-blue-100 text-blue-600",
      hospital: "bg-red-100 text-red-600",
      shopping: "bg-yellow-100 text-yellow-600",
    }
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${c ? colors[c] ?? "bg-gray-100 text-gray-500" : "bg-gray-100 text-gray-500"}`}>
        {c ?? "Other"}
      </span>
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Nearby Places</h3>
        <button type="button" onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Place
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Category</label>
              <select value={editing.category ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, category: (e.target.value as Category) || null }))}
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]">
                <option value="">Other</option>
                <option value="school">School</option>
                <option value="hospital">Hospital</option>
                <option value="shopping">Shopping</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Description *</label>
              <input type="text" value={editing.description ?? ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Dubai Mall - 5 min drive"
                className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !editing.description?.trim()}
              className="px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[#001f3f]/90 transition-all">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-2xl bg-[#f3f4f6] animate-pulse" />)
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#9ca3af]">No nearby places added yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-white rounded-2xl border border-[#f0f0f0] px-4 py-3">
              {categoryBadge(item.category)}
              <span className="flex-1 text-sm text-[#374151]">{item.description}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEditing(item)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => void handleDelete(item.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
