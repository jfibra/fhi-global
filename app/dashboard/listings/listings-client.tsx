"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, RefreshCw, Sparkles, ImagePlus, X } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  type AgentListing,
  type AgentListingFormInput,
  type ProjectPickerOption,
  fetchMyAgentListings,
  fetchPublishedProjectsForListingForm,
  createAgentListing,
  updateAgentListing,
  replaceAgentListingImages,
  softDeleteAgentListing,
} from "@/lib/agent-listings-service"

const emptyForm: AgentListingFormInput = {
  title: "",
  description: "",
  listing_kind: "sale",
  price: null,
  currency: "AED",
  project_id: null,
  status: "draft",
}

type Toast = { id: number; variant: "success" | "error"; message: string }

export function AgentListingsClient({
  userId,
  userName,
  currentRole,
}: {
  userId: string
  userName: string
  currentRole: string
}) {
  const [rows, setRows] = useState<AgentListing[]>([])
  const [projects, setProjects] = useState<ProjectPickerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AgentListing | null>(null)
  const [form, setForm] = useState<AgentListingFormInput>(emptyForm)
  const [aiHint, setAiHint] = useState("")
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiDescError, setAiDescError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [projectGalleryUrls, setProjectGalleryUrls] = useState<string[]>([])
  const [projectGalleryLoading, setProjectGalleryLoading] = useState(false)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])

  const showToast = useCallback((variant: Toast["variant"], message: string) => {
    const id = ++toastIdRef.current
    setToasts((t) => [...t, { id, variant, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [listRes, projRes] = await Promise.all([
      fetchMyAgentListings(userId),
      fetchPublishedProjectsForListingForm(),
    ])
    setLoading(false)
    if (listRes.error) showToast("error", listRes.error)
    else setRows(listRes.data ?? [])
    if (!projRes.error && projRes.data) setProjects(projRes.data)
  }, [userId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!modalOpen) return
    if (form.project_id == null) {
      setProjectGalleryUrls([])
      return
    }
    let cancelled = false
    setProjectGalleryLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/agent-listings/project-gallery?projectId=${form.project_id}`)
        const data = (await res.json()) as { urls?: string[] }
        if (!cancelled) {
          setProjectGalleryUrls(res.ok && data.urls ? data.urls : [])
        }
      } catch {
        if (!cancelled) setProjectGalleryUrls([])
      } finally {
        if (!cancelled) setProjectGalleryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen, form.project_id])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setAiHint("")
    setAiDescError(null)
    setProjectGalleryUrls([])
    setGalleryUrls([])
    setModalOpen(true)
  }

  const openEdit = (row: AgentListing) => {
    setEditing(row)
    setAiHint("")
    setAiDescError(null)
    setForm({
      title: row.title,
      description: row.description ?? "",
      listing_kind: row.listing_kind,
      price: row.price,
      currency: row.currency || "AED",
      project_id: row.project_id,
      status: row.status,
    })
    const imgs = row.agent_listing_images ?? []
    setGalleryUrls(imgs.map((i) => i.url))
    setModalOpen(true)
  }

  const handleGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ""
    if (!files?.length) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        showToast("error", `${file.name} is not an image`)
        continue
      }
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch("/api/upload/agent-listing", { method: "POST", body: fd })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok) {
          showToast("error", data.error ?? "Upload failed")
          continue
        }
        const uploadedUrl = data.url
        if (uploadedUrl) setGalleryUrls((prev) => [...prev, uploadedUrl])
      } catch {
        showToast("error", "Upload failed — check your connection")
      }
    }
  }

  const generateDescriptionWithAi = async () => {
    if (!form.title.trim()) {
      showToast("error", "Add a title first so the AI has context.")
      return
    }
    setAiDescError(null)
    setAiDescLoading(true)
    const projectName =
      form.project_id != null ? projects.find((p) => p.id === form.project_id)?.name ?? null : null
    try {
      const res = await fetch("/api/ai/listing-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          listing_kind: form.listing_kind,
          price: form.price,
          currency: form.currency,
          projectName,
          customPrompt: aiHint.trim(),
        }),
      })
      const data = (await res.json()) as { text?: string; error?: string }
      if (!res.ok) {
        setAiDescError(data.error ?? "Generation failed")
        return
      }
      if (data.text) {
        setForm((f) => ({ ...f, description: data.text ?? "" }))
        showToast("success", "Description generated — review before saving.")
      }
    } catch {
      setAiDescError("Network error — try again.")
    } finally {
      setAiDescLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      showToast("error", "Title is required")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await updateAgentListing(editing.id, userId, form)
        if (error) {
          showToast("error", error)
          return
        }
        const { error: imgErr } = await replaceAgentListingImages(editing.id, userId, galleryUrls)
        if (imgErr) {
          showToast("error", `Saved listing but images failed: ${imgErr}`)
        } else {
          showToast("success", "Listing updated")
        }
        await load()
      } else {
        const { data, error } = await createAgentListing(userId, form)
        if (error) {
          showToast("error", error)
          return
        }
        if (data) {
          const { error: imgErr } = await replaceAgentListingImages(data.id, userId, galleryUrls)
          if (imgErr) {
            showToast("error", `Listing created but images failed: ${imgErr}`)
          } else {
            showToast("success", "Listing created")
          }
          await load()
        }
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const archive = async (row: AgentListing) => {
    if (!confirm(`Archive "${row.title}"? You can create a new listing later.`)) return
    const { error } = await softDeleteAgentListing(row.id, userId)
    if (error) {
      showToast("error", error)
      return
    }
    showToast("success", "Listing archived")
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  const roleValue = currentRole.toLowerCase().trim()

  return (
    <DashboardShell
      role={roleValue}
      roleLabel={roleToLabel(currentRole)}
      roleColor={getRoleColor(currentRole)}
      userName={userName}
    >
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">My listings</h1>
            <p className="text-sm text-[#6b7280] mt-1">
              Agents, team leaders, and unit managers can publish sale or rent listings here. Optionally link a
              published developer project for photos and map location.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New listing
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8eaed] bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-[#9ca3af]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[#6b7280] mb-4">No listings yet.</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-sm font-semibold text-[#001f3f] hover:underline"
              >
                Create your first listing
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const p = row.projects
                    const pname = p && typeof p === "object" && "name" in p ? String((p as { name?: string }).name ?? "—") : "—"
                    return (
                      <tr key={row.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]/80">
                        <td className="px-4 py-3 font-medium text-[#111827]">{row.title}</td>
                        <td className="px-4 py-3 capitalize">{row.listing_kind}</td>
                        <td className="px-4 py-3">
                          {row.price != null ? `${Number(row.price).toLocaleString()} ${row.currency}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#6b7280] max-w-[180px] truncate">{pname}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.status === "published"
                                ? "bg-emerald-50 text-emerald-800"
                                : row.status === "draft"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="p-2 rounded-lg text-[#001f3f] hover:bg-[#001f3f]/10"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void archive(row)}
                              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                              aria-label="Archive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 scrollbar-none">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f] mb-4">
              {editing ? "Edit listing" : "New listing"}
            </h2>
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">Listing type</label>
                  <select
                    value={form.listing_kind}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, listing_kind: e.target.value as AgentListingFormInput["listing_kind"] }))
                    }
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="sale">Sale</option>
                    <option value="rent">Rent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as AgentListingFormInput["status"] }))
                    }
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.price ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        price: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">Currency</label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Developer project (optional)</label>
                <select
                  value={form.project_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      project_id: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">— None —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  When you pick a project, developer photos load below. They are included on the public listing
                  automatically.
                </p>
              </div>

              {form.project_id != null && (
                <div className="rounded-xl border border-[#e8eaed] bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold text-[#374151] mb-2">Developer project photos</p>
                  {projectGalleryLoading ? (
                    <p className="text-xs text-[#9ca3af]">Loading gallery…</p>
                  ) : projectGalleryUrls.length === 0 ? (
                    <p className="text-xs text-[#9ca3af]">No images in this project gallery yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {projectGalleryUrls.map((url) => (
                        <div
                          key={url}
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#e5e5e5] shrink-0 bg-white"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-[#e8eaed] p-3">
                <p className="text-xs font-semibold text-[#374151] mb-1">Your unit / room photos (optional)</p>
                <p className="text-[10px] text-[#9ca3af] mb-2">
                  Add extra images for your listing. Public pages show developer photos first, then these.
                </p>
                <input
                  ref={galleryFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(ev) => void handleGalleryFiles(ev)}
                />
                <button
                  type="button"
                  onClick={() => galleryFileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#d6b357]/50 text-xs font-semibold text-[#001f3f] hover:bg-[#fffdf8]"
                >
                  <ImagePlus className="w-4 h-4" />
                  Upload images
                </button>
                {galleryUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {galleryUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#e5e5e5] shrink-0 group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={() => setGalleryUrls((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Notes for AI (optional)</label>
                <input
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  placeholder="e.g. Highlight marina view, handover Q4, investor-friendly"
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm placeholder:text-[#c4c4c4]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-semibold text-[#6b7280]">Description</label>
                  <button
                    type="button"
                    disabled={aiDescLoading || !form.title.trim()}
                    onClick={() => void generateDescriptionWithAi()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#001f3f] disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiDescLoading ? "animate-pulse" : ""}`} />
                    {aiDescLoading ? "Generating…" : "Generate with AI"}
                  </button>
                </div>
                {aiDescError && (
                  <p className="text-xs text-rose-600 mb-1.5" role="alert">
                    {aiDescError}
                  </p>
                )}
                <p className="text-[10px] text-[#9ca3af] mb-1.5">
                  Uses Gemini (<code className="text-[#6b7280]">GEMINI_API_KEY</code> in .env). Fill title, type, price,
                  and project first for best results.
                </p>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={5}
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm resize-y min-h-[120px]"
                  placeholder="Write your own description or click Generate with AI."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${
              t.variant === "success" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-900 border border-rose-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </DashboardShell>
  )
}
