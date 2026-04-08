"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"
import {
  type Project,
  type Developer,
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  softDeleteProject,
  duplicateProject,
  publishProject,
  fetchDevelopersForSelect,
  generateProjectSlug,
} from "@/lib/project-service"

import { ProjectsSidebar } from "./projects-sidebar"
import { ProjectDataTab } from "./project-data-tab"
import { ProjectHeader } from "./project-header"
import { ProjectOverviewTab } from "./project-overview-tab"
import { ProjectUnitsTab } from "./project-units-tab"
import { ProjectImagesTab } from "./project-images-tab"
import { ProjectAmenitiesTab } from "./project-amenities-tab"
import { ProjectPropertyTypesTab } from "./project-property-types-tab"
import { ProjectMediaTab } from "./project-media-tab"
import { ProjectFeaturesTab } from "./project-features-tab"
import { ProjectNearbyTab } from "./project-nearby-tab"
import { ProjectSeoTab } from "./project-seo-tab"
import { ProjectSettingsTab } from "./project-settings-tab"

// ─── Portal ────────────────────────────────────────────────────────────────────
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
type ToastVariant = "success" | "error"
interface ToastMsg { id: number; variant: ToastVariant; message: string }

function ToastList({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold pointer-events-auto max-w-xs ${
          t.variant === "success" ? "bg-green-50 text-green-800 border border-green-100" : "bg-rose-50 text-rose-800 border border-rose-100"
        }`}>
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 text-xs ml-2">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden />
        <div className="relative bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-white/60">
          <p className="text-sm text-[#374151] leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">Cancel</button>
            <button onClick={onConfirm} className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-all">Confirm</button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
export type TabId = "data" | "overview" | "units" | "images" | "amenities" | "property_types" | "media" | "features" | "nearby" | "seo" | "settings"

const TABS: { id: TabId; label: string }[] = [
  { id: "data",            label: "Data Health" },
  { id: "overview",        label: "Overview" },
  { id: "units",           label: "Units" },
  { id: "images",          label: "Images" },
  { id: "amenities",       label: "Amenities" },
  { id: "property_types",  label: "Property Types" },
  { id: "media",           label: "Media" },
  { id: "features",        label: "Features" },
  { id: "nearby",          label: "Nearby" },
  { id: "seo",             label: "SEO" },
  { id: "settings",        label: "Settings" },
]

// ─── New Project Modal ─────────────────────────────────────────────────────────
function NewProjectModal({
  developers,
  onClose,
  onCreated,
  showToast,
}: {
  developers: Developer[]
  onClose: () => void
  onCreated: (project: Project) => void
  showToast: (variant: ToastVariant, message: string) => void
}) {
  const [name, setName]           = useState("")
  const [slug, setSlug]           = useState("")
  const [developerId, setDevId]   = useState("")
  const [status, setStatus]       = useState<string>("pre_launch")
  const [saving, setSaving]       = useState(false)

  const handleNameChange = (v: string) => {
    setName(v)
    setSlug(generateProjectSlug(v))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await createProject({
      name: name.trim(),
      slug: slug.trim() || generateProjectSlug(name.trim()),
      status: status as Project["status"],
      developer_id: developerId || null,
      is_active: true,
      is_published: false,
      is_featured: false,
      is_premium: false,
      direct_from_developer: false,
      installment_available: false,
      freehold: false,
    })
    setSaving(false)
    if (error) { showToast("error", error); return }
    showToast("success", "Project created")
    if (data) onCreated(data)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <div className="relative bg-white rounded-[28px] p-8 max-w-md w-full shadow-2xl border border-white/60">
          <h2 className="font-['Outfit'] text-xl font-bold text-[#001f3f] mb-6">New Project</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Project Name *</label>
              <input value={name} onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
                placeholder="e.g. Marina Heights" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] font-mono"
                placeholder="auto-generated" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Developer</label>
              <select value={developerId} onChange={(e) => setDevId(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] bg-white">
                <option value="">— No developer —</option>
                {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] bg-white">
                <option value="pre_launch">Pre-Launch</option>
                <option value="launch">Launch</option>
                <option value="under_construction">Under Construction</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving || !name.trim()}
                className="flex-1 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
                {saving ? "Creating…" : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function ProjectsClient({ currentRole, userId }: { currentRole: string; userId: string }) {
  const [projects, setProjects]     = useState<Project[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState("")
  const [filterDev, setFilterDev]   = useState("")
  const [filterStatus, setStatus]   = useState("")
  const [loading, setLoading]       = useState(false)

  const [selected, setSelected]         = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)
  const [activeTab, setActiveTab]       = useState<TabId>("overview")

  const [developers, setDevelopers] = useState<Developer[]>([])
  const [showNew, setShowNew]       = useState(false)
  const [confirm, setConfirm]       = useState<{ message: string; action: () => void } | null>(null)

  const [toasts, setToasts]   = useState<ToastMsg[]>([])
  const toastIdRef            = useRef(0)

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, variant, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const PER_PAGE = 20

  // ── Load list ──────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true)
    const { data, total: t, error } = await fetchProjects({
      page, perPage: PER_PAGE, search,
      developerId: filterDev || undefined,
      status: filterStatus || undefined,
    })
    setLoading(false)
    if (error) { showToast("error", error); return }
    setProjects(data)
    setTotal(t)
  }, [page, search, filterDev, filterStatus, showToast])

  useEffect(() => { void loadList() }, [loadList])

  // ── Load developers for selects ────────────────────────────────────────────
  useEffect(() => {
    fetchDevelopersForSelect().then(({ data }) => setDevelopers(data))
  }, [])

  // ── Select project ──────────────────────────────────────────────────────────
  const handleSelect = async (id: number) => {
    setLoadingProject(true)
    setActiveTab("overview")
    const { data, error } = await fetchProject(id)
    setLoadingProject(false)
    if (error) { showToast("error", error); return }
    setSelected(data)
  }

  // ── Refresh selected ─────────────────────────────────────────────────────────
  const refreshSelected = async () => {
    if (!selected) return
    const { data } = await fetchProject(selected.id)
    if (data) setSelected(data)
  }

  // ── Publish toggle ───────────────────────────────────────────────────────────
  const handlePublishToggle = async () => {
    if (!selected) return
    const next = !selected.is_published
    const { error } = await publishProject(selected.id, next)
    if (error) { showToast("error", error); return }
    showToast("success", next ? "Project published" : "Project unpublished")
    setSelected({ ...selected, is_published: next, published_at: next ? new Date().toISOString() : null })
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, is_published: next } : p))
  }

  // ── Duplicate ────────────────────────────────────────────────────────────────
  const handleDuplicate = () => {
    if (!selected) return
    setConfirm({
      message: `Duplicate "${selected.name}"? A draft copy will be created.`,
      action: async () => {
        setConfirm(null)
        const { data, error } = await duplicateProject(selected.id)
        if (error) { showToast("error", error); return }
        showToast("success", "Project duplicated")
        if (data) {
          await loadList()
          setSelected(data)
        }
      },
    })
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!selected) return
    setConfirm({
      message: `Delete "${selected.name}"? This action can be reversed later.`,
      action: async () => {
        setConfirm(null)
        const { error } = await softDeleteProject(selected.id)
        if (error) { showToast("error", error); return }
        showToast("success", "Project deleted")
        setSelected(null)
        await loadList()
      },
    })
  }

  // ── Update field ─────────────────────────────────────────────────────────────
  const handleUpdateProject = async (fields: Parameters<typeof updateProject>[1]) => {
    if (!selected) return
    const { error } = await updateProject(selected.id, fields)
    if (error) { showToast("error", error); return }
    showToast("success", "Saved")
    await refreshSelected()
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, ...fields } : p))
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="flex h-full min-h-screen bg-[#f9fafb]">
      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="w-[340px] flex-shrink-0 flex flex-col bg-white border-r border-[#f0f0f0] h-screen sticky top-0 overflow-hidden">
        {/* header */}
        <div className="px-5 pt-6 pb-4 border-b border-[#f0f0f0]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-['Outfit'] text-xl font-bold text-[#001f3f]">Projects</h1>
            <button onClick={() => setShowNew(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#001f3f] text-white hover:bg-[#001f3f]/80 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <ProjectsSidebar
            search={search}
            onSearch={(v: string) => { setSearch(v); setPage(1) }}
            filterDev={filterDev}
            onFilterDev={(v: string) => { setFilterDev(v); setPage(1) }}
            filterStatus={filterStatus}
            onFilterStatus={(v: string) => { setStatus(v); setPage(1) }}
            developers={developers}
          />
        </div>
        {/* list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[#f3f4f6] animate-pulse" />
            ))
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#9ca3af]">No projects found</div>
          ) : (
            projects.map((p) => (
              <button key={p.id} type="button"
                onClick={() => void handleSelect(p.id)}
                className={`w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                  selected?.id === p.id
                    ? "bg-[#001f3f] text-white border-[#001f3f]"
                    : "bg-white text-[#111827] border-[#f0f0f0] hover:border-[#001f3f]/30 hover:bg-[#f8fafc]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${selected?.id === p.id ? "text-white" : "text-[#111827]"}`}>{p.name}</p>
                    <p className={`text-xs mt-0.5 truncate ${selected?.id === p.id ? "text-white/60" : "text-[#6b7280]"}`}>
                      {p.city ? `${p.city}, ` : ""}{p.country ?? ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.is_published
                        ? selected?.id === p.id ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                        : selected?.id === p.id ? "bg-white/20 text-white/80" : "bg-gray-100 text-gray-500"
                    }`}>{p.is_published ? "Live" : "Draft"}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      selected?.id === p.id ? "bg-white/20 text-white/70" : "bg-[#f3f4f6] text-[#6b7280]"
                    }`}>{p.status?.replace(/_/g, " ") ?? ""}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        {/* pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f0f0] text-xs text-[#6b7280]">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-xl border border-[#e5e5e5] disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
              ← Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-xl border border-[#e5e5e5] disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
              Next →
            </button>
          </div>
        )}
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/10 to-[#d6b357]/20 flex items-center justify-center mb-5">
              <svg className="w-9 h-9 text-[#001f3f]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21V7l9-4 9 4v14M12 21V13m-4 8v-5m8 5v-5" />
              </svg>
            </div>
            <p className="text-[#374151] font-semibold text-lg font-['Outfit']">Select a project</p>
            <p className="text-sm text-[#9ca3af] mt-1">Choose a project from the sidebar or create a new one</p>
            <button onClick={() => setShowNew(true)}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        ) : loadingProject ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`h-14 rounded-2xl bg-[#f3f4f6] animate-pulse ${i === 0 ? "h-28" : ""}`} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Project header */}
            <ProjectHeader
              project={selected}
              onPublishToggle={() => void handlePublishToggle()}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />

            {/* Tabs nav */}
            <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-[#f0f0f0] bg-white overflow-x-auto flex-shrink-0">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? "bg-[#001f3f] text-white"
                      : "text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "data"           && <ProjectDataTab           project={selected} onJump={(tab) => setActiveTab(tab)} showToast={showToast} />}
              {activeTab === "overview"       && <ProjectOverviewTab       project={selected} developers={developers} onSave={handleUpdateProject} showToast={showToast} />}
              {activeTab === "units"          && <ProjectUnitsTab          projectId={selected.id} showToast={showToast} />}
              {activeTab === "images"         && <ProjectImagesTab         project={selected} showToast={showToast} onMainImageChange={(url: string) => { setSelected({ ...selected, main_image: url }); setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, main_image: url } : p)) }} />}
              {activeTab === "amenities"      && <ProjectAmenitiesTab      projectId={selected.id} showToast={showToast} />}
              {activeTab === "property_types" && <ProjectPropertyTypesTab  projectId={selected.id} showToast={showToast} />}
              {activeTab === "media"          && <ProjectMediaTab          projectId={selected.id} showToast={showToast} />}
              {activeTab === "features"       && <ProjectFeaturesTab       projectId={selected.id} showToast={showToast} />}
              {activeTab === "nearby"         && <ProjectNearbyTab         projectId={selected.id} showToast={showToast} />}
              {activeTab === "seo"            && <ProjectSeoTab            project={selected} onSave={handleUpdateProject} showToast={showToast} />}
              {activeTab === "settings"       && <ProjectSettingsTab       project={selected} onSave={handleUpdateProject} onPublishToggle={() => void handlePublishToggle()} showToast={showToast} />}
            </div>
          </div>
        )}
      </main>

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      {showNew && (
        <NewProjectModal
          developers={developers}
          onClose={() => setShowNew(false)}
          showToast={showToast}
          onCreated={async (p) => {
            setShowNew(false)
            await loadList()
            setSelected(p)
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />
      )}

      <Portal>
        <ToastList toasts={toasts} remove={removeToast} />
      </Portal>
    </div>
  )
}
