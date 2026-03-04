"use client"

import { useEffect, useState } from "react"
import { Save, X } from "lucide-react"
import type { Project, ProjectFormData } from "@/lib/project-service"
import { fetchProjectKeywords, syncProjectKeywords } from "@/lib/project-service"

interface Props {
  project: Project
  onSave: (fields: Partial<ProjectFormData>) => Promise<void>
  showToast: (variant: "success" | "error", message: string) => void
}

export function ProjectSeoTab({ project, onSave, showToast }: Props) {
  const [metaTitle, setMetaTitle]         = useState(project.meta_title ?? "")
  const [metaDescription, setMetaDesc]   = useState(project.meta_description ?? "")
  const [keywords, setKeywords]           = useState<string[]>([])
  const [keyInput, setKeyInput]           = useState("")
  const [loading, setLoading]             = useState(false)
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    setMetaTitle(project.meta_title ?? "")
    setMetaDesc(project.meta_description ?? "")
  }, [project])

  useEffect(() => {
    setLoading(true)
    fetchProjectKeywords(project.id).then(({ data }) => {
      setLoading(false)
      setKeywords(data.map((k) => k.keyword))
    })
  }, [project.id])

  const addKeyword = () => {
    const t = keyInput.trim().toLowerCase()
    if (!t || keywords.includes(t)) { setKeyInput(""); return }
    setKeywords((prev) => [...prev, t])
    setKeyInput("")
  }

  const removeKeyword = (k: string) => setKeywords((prev) => prev.filter((x) => x !== k))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await Promise.all([
      onSave({ meta_title: metaTitle || null, meta_description: metaDescription || null }),
      syncProjectKeywords(project.id, keywords),
    ])
    setSaving(false)
    showToast("success", "SEO data saved")
  }

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6">
      <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">SEO & Meta</h3>

      <div className="bg-white rounded-2xl border border-[#f0f0f0] p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Meta Title</label>
          <input type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={70}
            placeholder="SEO page title (max 70 chars)"
            className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
          <p className="text-xs text-[#9ca3af] mt-1 text-right">{metaTitle.length}/70</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Meta Description</label>
          <textarea value={metaDescription} onChange={(e) => setMetaDesc(e.target.value)} maxLength={160} rows={3}
            placeholder="SEO description (max 160 chars)"
            className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] resize-none" />
          <p className="text-xs text-[#9ca3af] mt-1 text-right">{metaDescription.length}/160</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Keywords</label>
          <div className="flex gap-2 mb-3">
            <input type="text" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword() } }}
              placeholder="Add keyword, press Enter"
              className="flex-1 border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]" />
            <button type="button" onClick={addKeyword}
              className="px-4 py-2 rounded-xl bg-[#f3f4f6] text-sm font-semibold text-[#374151] hover:bg-[#e5e7eb] transition-colors">Add</button>
          </div>
          {loading ? (
            <div className="h-8 rounded-xl bg-[#f3f4f6] animate-pulse" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#001f3f]/10 text-[#001f3f] text-xs font-semibold">
                  {k}
                  <button type="button" onClick={() => removeKeyword(k)} className="opacity-60 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {keywords.length === 0 && <span className="text-xs text-[#9ca3af]">No keywords yet</span>}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {(metaTitle || metaDescription) && (
        <div className="bg-white rounded-2xl border border-[#f0f0f0] p-5">
          <p className="text-xs font-semibold text-[#6b7280] mb-3">Search Preview</p>
          <div className="space-y-0.5">
            <p className="text-[#1a0dab] text-base font-medium leading-tight hover:underline cursor-pointer truncate">
              {metaTitle || project.name}
            </p>
            <p className="text-[#006621] text-xs">https://fhiglobal.com/projects/{project.slug}</p>
            <p className="text-[#545454] text-sm leading-snug line-clamp-2">{metaDescription || project.description || "No description"}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
          <Save className="w-4 h-4" />{saving ? "Savingâ€¦" : "Save SEO Data"}
        </button>
      </div>
    </form>
  )
}
