"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import Link from "next/link"
import { Plus, Pencil, Trash2, RefreshCw, Sparkles, ImagePlus, X, Megaphone, Clapperboard } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import MarketingActionsModal from "@/components/dashboard/listings/marketing/MarketingActionsModal"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  type AgentListing,
  type AgentListingFormInput,
  type ProjectPickerOption,
  UNASSIGNED_DEVELOPER_KEY,
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
  project_id: null,
  status: "published",
  unit_type: null,
}

type ProjectPickerExtras = {
  unitTypes: string[]
  currency: string
  launchPriceFrom: number | null
  launchPriceTo: number | null
  projectDescription: string | null
  projectAbout: string | null
}

type ProjectGalleryApi = {
  urls?: string[]
  unitTypes?: string[]
  currency?: string
  launchPriceFrom?: number | null
  launchPriceTo?: number | null
  projectDescription?: string | null
  projectAbout?: string | null
}

function extrasFromProjectGalleryPayload(data: ProjectGalleryApi): ProjectPickerExtras {
  return {
    unitTypes: Array.isArray(data.unitTypes) ? data.unitTypes : [],
    currency: (data.currency ?? "AED").trim() || "AED",
    launchPriceFrom: data.launchPriceFrom ?? null,
    launchPriceTo: data.launchPriceTo ?? null,
    projectDescription:
      typeof data.projectDescription === "string" && data.projectDescription.trim()
        ? data.projectDescription.trim()
        : null,
    projectAbout:
      typeof data.projectAbout === "string" && data.projectAbout.trim() ? data.projectAbout.trim() : null,
  }
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
  const [marketingListing, setMarketingListing] = useState<AgentListing | null>(null)
  const [form, setForm] = useState<AgentListingFormInput>(emptyForm)
  const [aiHint, setAiHint] = useState("")
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiDescError, setAiDescError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [projectGalleryUrls, setProjectGalleryUrls] = useState<string[]>([])
  const [projectGalleryLoading, setProjectGalleryLoading] = useState(false)
  const [projectPickerExtras, setProjectPickerExtras] = useState<ProjectPickerExtras | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  /** UI only: which developer's projects are shown. "" = no project link; UNASSIGNED = projects without developer_id */
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>("")

  const developerOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of projects) {
      if (!p.developer_id) continue
      const label = p.developerName?.trim() || "Developer"
      if (!m.has(p.developer_id)) m.set(p.developer_id, label)
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  const hasUnassignedDeveloperProjects = useMemo(
    () => projects.some((p) => p.developer_id == null),
    [projects],
  )

  const filteredProjects = useMemo(() => {
    if (selectedDeveloperId === "") return []
    if (selectedDeveloperId === UNASSIGNED_DEVELOPER_KEY) {
      return projects.filter((p) => p.developer_id == null)
    }
    return projects.filter((p) => p.developer_id === selectedDeveloperId)
  }, [projects, selectedDeveloperId])

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
      setProjectPickerExtras(null)
      return
    }
    let cancelled = false
    setProjectGalleryLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/agent-listings/project-gallery?projectId=${form.project_id}`)
        const data = (await res.json()) as ProjectGalleryApi
        if (!cancelled) {
          setProjectGalleryUrls(res.ok && data.urls ? data.urls : [])
          if (res.ok) {
            setProjectPickerExtras(extrasFromProjectGalleryPayload(data))
          } else {
            setProjectPickerExtras(null)
          }
        }
      } catch {
        if (!cancelled) {
          setProjectGalleryUrls([])
          setProjectPickerExtras(null)
        }
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
    setSelectedDeveloperId("")
    setAiHint("")
    setAiDescError(null)
    setProjectGalleryUrls([])
    setProjectPickerExtras(null)
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
      project_id: row.project_id,
      status: row.status,
      unit_type: row.unit_type ?? null,
    })
    const p = row.projects
    if (row.project_id != null && p && typeof p === "object") {
      const did = "developer_id" in p ? (p as { developer_id?: string | null }).developer_id : null
      setSelectedDeveloperId(
        did != null && String(did).trim() !== "" ? String(did) : UNASSIGNED_DEVELOPER_KEY,
      )
    } else {
      setSelectedDeveloperId("")
    }
    const imgs = row.agent_listing_images ?? []
    setGalleryUrls(imgs.map((i) => i.url))
    setModalOpen(true)
  }

  const handleGalleryFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const picked = input.files
    if (!picked?.length) return
    // Copy before clearing: `FileList` is live — resetting the input can empty it immediately.
    const files = Array.from(picked)
    input.value = ""
    for (const file of files) {
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
    let extras = projectPickerExtras
    if (form.project_id != null && extras == null) {
      try {
        const res = await fetch(`/api/agent-listings/project-gallery?projectId=${form.project_id}`)
        if (res.ok) {
          const data = (await res.json()) as ProjectGalleryApi
          extras = extrasFromProjectGalleryPayload(data)
        }
      } catch {
        /* keep extras null */
      }
    }
    const projectName =
      form.project_id != null ? projects.find((p) => p.id === form.project_id)?.name ?? null : null
    const pricingNote = (() => {
      if (form.project_id == null) return null
      const from = extras?.launchPriceFrom
      const to = extras?.launchPriceTo
      const cur = (extras?.currency ?? "AED").trim() || "AED"
      if (from == null && to == null) {
        return "Pricing follows the linked developer project (launch prices on the project record)."
      }
      const locale = cur === "AED" ? "en-AE" : "en-US"
      const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
      if (from != null && to != null && to !== from) {
        return `Developer launch pricing: ${cur} ${fmt(from)} – ${fmt(to)}`
      }
      if (from != null) return `Developer launch pricing from: ${cur} ${fmt(from)}`
      if (to != null) return `Developer launch pricing: ${cur} ${fmt(to)}`
      return null
    })()
    try {
      const res = await fetch("/api/ai/listing-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          listing_kind: form.listing_kind,
          projectName,
          unitType: form.unit_type,
          pricingNote,
          projectDescription: extras?.projectDescription ?? null,
          projectAbout: extras?.projectAbout ?? null,
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

  const submit = async (e: FormEvent) => {
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
              Create a listing by title and type, then choose a developer, one of their published projects, and an
              optional unit type they configured. Photos and pricing follow the project record.
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

        {loading ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white shadow-sm p-12 text-center text-sm text-[#9ca3af]">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-[#e8eaed] bg-white shadow-sm p-12 text-center">
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
          /* Photo-first cards so agents see each listing's pictures at a glance. */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {rows.map((row) => {
              const p = row.projects
              const pname = p && typeof p === "object" && "name" in p ? String((p as { name?: string }).name ?? "—") : "—"
              const dname =
                p && typeof p === "object" && "developers" in p
                  ? String(
                      (p as { developers?: { name?: string | null } | null }).developers?.name ?? "",
                    ).trim() || "—"
                  : "—"
              const cover = row.agent_listing_images?.[0]?.url ?? null
              const photoCount = row.agent_listing_images?.length ?? 0
              return (
                <div
                  key={row.id}
                  className="group rounded-2xl border border-[#e8eaed] bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-[#d6b357]/60 transition-all"
                >
                  <div className="relative h-44 bg-[#eef1f5] overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt={row.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 text-[#b8bfc9]">
                        <ImagePlus className="w-7 h-7" />
                        <span className="text-xs font-medium">No photos yet</span>
                      </div>
                    )}
                    <span
                      className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow ${
                        row.listing_kind === "rent" ? "bg-[#2f6fe4]" : "bg-[#d6b357]"
                      }`}
                    >
                      {row.listing_kind === "rent" ? "FOR RENT" : "FOR SALE"}
                    </span>
                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow ${
                        row.status === "published"
                          ? "bg-emerald-50 text-emerald-800"
                          : row.status === "draft"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.status}
                    </span>
                    {photoCount > 1 && (
                      <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/55 text-white text-[11px] font-semibold">
                        {photoCount} photos
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[#111827] truncate">{row.title}</h3>
                    <p className="mt-0.5 text-xs text-[#6b7280] truncate">
                      {dname} · {pname}
                    </p>
                    <p className="mt-1 text-xs text-[#6b7280] truncate">
                      {row.unit_type?.trim() || "—"} ·{" "}
                      {row.project_id != null
                        ? "Developer project"
                        : row.price != null
                          ? `${Number(row.price).toLocaleString()} ${row.currency}`
                          : "—"}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-[#f0f0f0] pt-3">
                      <Link
                        href={`/dashboard/reels-maker?listing=${row.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed]/10 text-[#7c3aed] text-xs font-bold hover:bg-[#7c3aed]/20 transition-colors"
                        title="Create reel from this listing"
                      >
                        <Clapperboard className="w-3.5 h-3.5" />
                        Reel
                      </Link>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setMarketingListing(row)}
                          className="p-2 rounded-lg text-[#d6b357] hover:bg-[#d6b357]/10"
                          aria-label="Marketing (flyer, just listed/sold)"
                          title="Marketing"
                        >
                          <Megaphone className="w-4 h-4" />
                        </button>
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
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Developer</label>
                <select
                  value={selectedDeveloperId}
                  onChange={(e) => {
                    const v = e.target.value
                    setSelectedDeveloperId(v)
                    setForm((f) => ({ ...f, project_id: null, unit_type: null }))
                  }}
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">— No developer project —</option>
                  {developerOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  {hasUnassignedDeveloperProjects ? (
                    <option value={UNASSIGNED_DEVELOPER_KEY}>Other (project not tied to a developer)</option>
                  ) : null}
                </select>
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Choose the developer first. Their published projects appear in the next step.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Project</label>
                <select
                  disabled={selectedDeveloperId === ""}
                  value={form.project_id ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value
                    const id = raw === "" ? null : Number(raw)
                    setForm((f) => ({
                      ...f,
                      project_id: id,
                      unit_type: id === null || id !== f.project_id ? null : f.unit_type,
                    }))
                  }}
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white disabled:bg-[#f9fafb] disabled:text-[#9ca3af]"
                >
                  <option value="">
                    {selectedDeveloperId === ""
                      ? "Select a developer first"
                      : filteredProjects.length === 0
                        ? "No published projects for this developer"
                        : "— Select project —"}
                  </option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Launch price, currency, photos, and AI context follow the project you select.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Unit type (optional)</label>
                {form.project_id == null ? (
                  <p className="text-xs text-[#9ca3af] border border-[#e5e5e5] rounded-xl px-3 py-2 bg-[#fafafa]">
                    Select a project to choose a unit type from the developer&apos;s inventory.
                  </p>
                ) : (projectPickerExtras?.unitTypes.length ?? 0) > 0 ? (
                  <select
                    value={form.unit_type ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit_type: e.target.value === "" ? null : e.target.value }))
                    }
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Not specified —</option>
                    {(projectPickerExtras?.unitTypes ?? []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#9ca3af] border border-[#e5e5e5] rounded-xl px-3 py-2 bg-[#fafafa]">
                    This project has no unit lines yet in the developer portal.
                  </p>
                )}
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Unit options are defined on the project by the developer.
                </p>
              </div>

              {form.project_id != null && (
                <div className="rounded-xl border border-[#e8eaed] bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold text-[#374151] mb-1">Developer project photos</p>
                  <p className="text-[10px] text-[#9ca3af] mb-2 leading-relaxed">
                    Read-only preview from the developer&apos;s project record (main image + project gallery in the
                    developer portal). Files you upload on this form do{" "}
                    <span className="font-semibold text-[#6b7280]">not</span> appear here — they go in{" "}
                    <span className="font-semibold text-[#6b7280]">Your unit / room photos</span> below.
                  </p>
                  {projectGalleryLoading ? (
                    <p className="text-xs text-[#9ca3af]">Loading gallery…</p>
                  ) : projectGalleryUrls.length === 0 ? (
                    <div className="text-xs text-[#9ca3af] space-y-1.5">
                      <p>No images are stored on this project in the database yet (no main image / gallery rows).</p>
                      {galleryUrls.length > 0 ? (
                        <p className="text-[#6b7280]">
                          Your folder uploads are in <span className="font-semibold">Your unit / room photos</span>{" "}
                          below; they still show on the public listing after you save.
                        </p>
                      ) : (
                        <p>
                          The developer (or admin) needs to add images under that project&apos;s media in the
                          dashboard. Your own listing photos can be added in the next section.
                        </p>
                      )}
                    </div>
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
                <p className="text-[10px] text-[#9ca3af] mb-2 leading-relaxed">
                  Upload from your device here — these are saved on <span className="font-semibold">this agent listing</span>{" "}
                  only. On the public site, developer project photos (above) show first when present, then these.
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
                  Uses Gemini (<code className="text-[#6b7280]">GEMINI_API_KEY</code> in .env). With a linked project,
                  the model uses the developer&apos;s project description and about text (plus launch pricing) to
                  create or refine your copy; add title, unit type, and notes for best results.
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

      {marketingListing && (
        <MarketingActionsModal
          listingId={marketingListing.id}
          listingTitle={marketingListing.title}
          listingStatus={marketingListing.status}
          listingKind={marketingListing.listing_kind}
          agentId={userId}
          initialOgOptions={marketingListing.og_card_options ?? null}
          onOgSaved={(opts) => {
            setRows((rs) => rs.map((r) => (r.id === marketingListing.id ? { ...r, og_card_options: opts } : r)))
            setMarketingListing((m) => (m ? { ...m, og_card_options: opts } : m))
            showToast("success", "Share card saved")
          }}
          onClose={() => setMarketingListing(null)}
        />
      )}

      <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
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
