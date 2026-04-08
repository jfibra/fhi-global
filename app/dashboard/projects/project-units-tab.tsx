"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import {
  type ProjectUnit,
  fetchProjectUnits,
  upsertProjectUnit,
  deleteProjectUnit,
} from "@/lib/project-service"

interface Props {
  projectId: number
  showToast: (variant: "success" | "error", message: string) => void
}

const EMPTY: Partial<ProjectUnit> = {
  unit_type: "",
  layout_name: "",
  bedrooms: undefined,
  bathrooms: undefined,
  size_sqft: undefined,
  size_sqm: undefined,
  price_from: undefined,
  price_to: undefined,
  available_units: undefined,
  is_available: true,
}

export function ProjectUnitsTab({ projectId, showToast }: Props) {
  const [units, setUnits]   = useState<ProjectUnit[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<ProjectUnit> | null>(null)
  const [saving, setSaving]   = useState(false)
  const [delId, setDelId]     = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchProjectUnits(projectId)
    setLoading(false)
    if (error) { showToast("error", error); return }
    setUnits(data)
  }, [projectId, showToast])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!editing || !editing.unit_type) return
    setSaving(true)
    const { error } = await upsertProjectUnit({ ...editing, project_id: projectId })
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", editing.id ? "Unit updated" : "Unit added")
    setEditing(null)
    void load()
  }

  const handleDelete = async (id: number) => {
    setDelId(id)
    const { error } = await deleteProjectUnit(id)
    setDelId(null)
    if (error) { showToast("error", error); return }
    showToast("success", "Unit deleted")
    setUnits((prev) => prev.filter((u) => u.id !== id))
  }

  const set = (key: keyof ProjectUnit, value: unknown) =>
    setEditing((e) => e ? { ...e, [key]: value } : e)

  const inp = (key: keyof ProjectUnit, placeholder = "", type: "text" | "number" = "text") => (
    <input type={type} value={(editing?.[key] as string | number | undefined) ?? ""} placeholder={placeholder}
      onChange={(e) => set(key, type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
      className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
  )

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Unit Types</h3>
        <button type="button" onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Unit
        </button>
      </div>

      {/* Form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-[#e5e5e5] p-5 space-y-4">
          <h4 className="text-sm font-bold text-[#374151]">{editing.id ? "Edit Unit" : "New Unit"}</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Unit Type *</label>
              {inp("unit_type", "e.g. Studio, 1BR, Villa")}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Layout Name</label>
              {inp("layout_name", "Optional")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Bedrooms</label>
              {inp("bedrooms", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Bathrooms</label>
              {inp("bathrooms", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Size sqft</label>
              {inp("size_sqft", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Size sqm</label>
              {inp("size_sqm", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Price From</label>
              {inp("price_from", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Price To</label>
              {inp("price_to", "0", "number")}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Available Units</label>
              {inp("available_units", "0", "number")}
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input type="checkbox" id="avail" checked={Boolean(editing.is_available)}
                onChange={(e) => set("is_available", e.target.checked)} className="w-4 h-4" />
              <label htmlFor="avail" className="text-sm text-[#374151]">Available</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !editing.unit_type}
              className="px-4 py-2 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#f0f0f0] overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3].map((i) => <div key={i} className="h-10 rounded-xl bg-[#f3f4f6] animate-pulse" />)}
          </div>
        ) : units.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#9ca3af]">No units yet. Add your first unit type.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-[#6b7280] bg-[#f9fafb] text-left">
                {["Type", "Beds", "Baths", "sqft", "Price From", "Available", ""].map((h) => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t border-[#f0f0f0] hover:bg-[#f9fafb] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#111827]">{u.unit_type}</td>
                  <td className="px-4 py-3 text-[#374151]">{u.bedrooms ?? "—"}</td>
                  <td className="px-4 py-3 text-[#374151]">{u.bathrooms ?? "—"}</td>
                  <td className="px-4 py-3 text-[#374151]">{u.size_sqft ? u.size_sqft.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-[#374151]">{u.price_from ? u.price_from.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.is_available ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditing(u)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => void handleDelete(u.id)} disabled={delId === u.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
