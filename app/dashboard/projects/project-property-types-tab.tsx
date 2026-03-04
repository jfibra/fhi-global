"use client"

import { useCallback, useEffect, useState } from "react"
import { Save } from "lucide-react"
import { fetchPropertyTypes, fetchProjectPropertyTypes, syncProjectPropertyTypes, type PropertyType } from "@/lib/project-service"

interface Props {
  projectId: number
  showToast: (variant: "success" | "error", message: string) => void
}

export function ProjectPropertyTypesTab({ projectId, showToast }: Props) {
  const [types, setTypes]       = useState<PropertyType[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [allRes, projRes] = await Promise.all([
      fetchPropertyTypes(),
      fetchProjectPropertyTypes(projectId),
    ])
    setLoading(false)
    if (allRes.error) { showToast("error", allRes.error); return }
    setTypes(allRes.data)
    setSelected(new Set(projRes.data))
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleSave = async () => {
    setSaving(true)
    const { error } = await syncProjectPropertyTypes(projectId, Array.from(selected))
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", "Property types saved")
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-[#f3f4f6] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Property Types</h3>
        <span className="text-xs text-[#6b7280]">{selected.size} selected</span>
      </div>

      {types.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#9ca3af]">No property types configured in the database yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#f0f0f0] p-5 grid grid-cols-3 gap-3">
          {types.map((t) => (
            <label key={t.id}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                selected.has(t.id)
                  ? "border-[#001f3f] bg-[#001f3f]/5 text-[#001f3f]"
                  : "border-[#f0f0f0] hover:border-[#001f3f]/30 text-[#374151]"
              }`}
            >
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 accent-[#001f3f]" />
              <span className="text-sm font-medium">{t.name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? "Savingâ€¦" : "Save Property Types"}
        </button>
      </div>
    </div>
  )
}
