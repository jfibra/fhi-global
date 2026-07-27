"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Search, Building2, Layers, ArrowRight } from "lucide-react"
import {
  type Project,
  PROJECT_LISTING_TYPE_SHORT,
  createProject,
  fetchProject,
  updateProject,
  publishProject,
  generateProjectSlug,
} from "@/lib/project-service"
import {
  fetchDeveloperProjects,
  toggleProjectPublish,
  softDeleteDeveloperProject,
} from "@/lib/developer-portal-service"
import { ProjectDataTab }          from "./project-data-tab"
import { ProjectOverviewTab }      from "./project-overview-tab"
import { ProjectUnitsTab }         from "./project-units-tab"
import { ProjectImagesTab }        from "./project-images-tab"
import { ProjectAmenitiesTab }     from "./project-amenities-tab"
import { ProjectPropertyTypesTab } from "./project-property-types-tab"
import { ProjectMediaTab }         from "./project-media-tab"
import { ProjectFeaturesTab }      from "./project-features-tab"
import { ProjectNearbyTab }        from "./project-nearby-tab"
import { ProjectSeoTab }           from "./project-seo-tab"
import { ProjectSettingsTab }      from "./project-settings-tab"
import { ProjectHeader }           from "./project-header"
import { DeveloperPortalPageHeader } from "@/components/developer/developer-portal-page-header"

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

// ─── Confirm dialog ──────────────────────────────────────────────────────────
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

// ─── Tab types ─────────────────────────────────────────────────────────────────
type TabId = "data" | "overview" | "units" | "images" | "amenities" | "property_types" | "media" | "features" | "nearby" | "seo" | "settings"
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
  developerId,
  onClose,
  onCreated,
  showToast,
}: {
  developerId: string
  onClose: () => void
  onCreated: (project: Project) => void
  showToast: (variant: ToastVariant, message: string) => void
}) {
  const [name, setName]     = useState("")
  const [slug, setSlug]     = useState("")
  const [status, setStatus] = useState<string>("pre_launch")
  const [saving, setSaving] = useState(false)

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
      listing_type: "sale",
      developer_id: developerId,
      is_active: true,
      is_published: false,
      is_featured: false,
      is_premium: false,
      direct_from_developer: true,
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
          <h2 className="font-['Outfit'] text-xl font-bold text-[#001f3f] mb-2">New Project</h2>
          <p className="text-xs text-[#9ca3af] mb-6">This project will be linked to your developer account.</p>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Project Name *</label>
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
                placeholder="e.g. Marina Heights"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] font-mono focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f]"
                placeholder="auto-generated"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] bg-white"
              >
                <option value="pre_launch">Pre-Launch</option>
                <option value="launch">Launch</option>
                <option value="under_construction">Under Construction</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <p className="text-[11px] text-[#6b7280] leading-relaxed rounded-xl border border-[#e8eaed] bg-[#f8fafc] px-3 py-2.5">
              New projects are listed as <strong>for sale</strong> from the developer. Agents use Buy/Rent tools for rentals and resales after purchase.
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving || !name.trim()}
                className="flex-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold transition-all disabled:opacity-50">
                {saving ? "Creating…" : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pre_launch: "Pre-Launch", launch: "Launch", under_construction: "Under Const.", completed: "Completed",
}

// ─── No developer placeholder ─────────────────────────────────────────────────
function NoDeveloperLinked({ userName }: { userName: string }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-24">
        <div className="w-16 h-16 rounded-[28px] bg-indigo-50 flex items-center justify-center mb-5">
          <Building2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">No Developer Company Linked</h2>
        <p className="text-sm text-[#6b7280] max-w-sm">Contact an administrator to link your account to a developer company.</p>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DeveloperProjectsClient({
  userId,
  userName,
  developerId,
  developerName,
  developerSlug,
}: {
  userId: string
  userName: string
  developerId: string | null
  developerName: string | null
  developerSlug: string | null
}) {
  const [projects, setProjects]       = useState<Project[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)
  const [activeTab, setActiveTab]     = useState<TabId>("overview")
  const [showNew, setShowNew]         = useState(false)
  const [confirm, setConfirm]         = useState<{ message: string; action: () => void } | null>(null)
  const [toasts, setToasts]           = useState<ToastMsg[]>([])
  const toastIdRef                    = useRef(0)

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, variant, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const PER_PAGE = 20

  const loadList = useCallback(async () => {
    if (!developerId) return
    setLoading(true)
    const { data, total: t, error } = await fetchDeveloperProjects({
      developerId,
      page,
      perPage: PER_PAGE,
      search: search || undefined,
      status: filterStatus || undefined,
    })
    setLoading(false)
    if (error) { showToast("error", error); return }
    setProjects(data ?? [])
    setTotal(t ?? 0)
  }, [developerId, page, search, filterStatus, showToast])

  useEffect(() => { void loadList() }, [loadList])

  const handleSelect = async (id: number) => {
    setLoadingProject(true)
    setActiveTab("overview")
    const { data, error } = await fetchProject(id)
    setLoadingProject(false)
    if (error) { showToast("error", error); return }
    setSelected(data)
  }

  const refreshSelected = async () => {
    if (!selected) return
    const { data } = await fetchProject(selected.id)
    if (data) setSelected(data)
  }

  const handlePublishToggle = async () => {
    if (!selected || !developerId) return
    const next = !selected.is_published
    const { error } = await toggleProjectPublish(selected.id, developerId, next)
    if (error) { showToast("error", error); return }
    showToast("success", next ? "Project published" : "Project unpublished")
    setSelected({ ...selected, is_published: next, published_at: next ? new Date().toISOString() : null })
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, is_published: next } : p))
  }

  const handleArchive = () => {
    if (!selected || !developerId) return
    setConfirm({
      message: `Archive "${selected.name}"? The project will be deactivated and unpublished. You can restore it via admin.`,
      action: async () => {
        setConfirm(null)
        const { error } = await softDeleteDeveloperProject(selected.id, developerId)
        if (error) { showToast("error", error); return }
        showToast("success", "Project archived")
        setSelected(null)
        await loadList()
      },
    })
  }

  const handleUpdateProject = async (fields: Parameters<typeof updateProject>[1]) => {
    if (!selected) return
    const { error } = await updateProject(selected.id, fields)
    if (error) { showToast("error", error); return }
    showToast("success", "Saved")
    await refreshSelected()
    setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, ...fields } : p))
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  if (!developerId) {
    return <NoDeveloperLinked userName={userName} />
  }

  return (
    <>
      <div className="space-y-5 mb-5">
        <DeveloperPortalPageHeader
          segmentLabel="My projects"
          title="My projects"
          description={
            developerName
              ? `Create and maintain projects for ${developerName}. Pick a project in the list to edit overview, units, gallery, amenities, SEO, and publishing.`
              : "Create and maintain your projects. Pick a project in the list to edit overview, units, gallery, amenities, SEO, and publishing."
          }
        />
      </div>
      <div className="flex h-full -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 min-h-[calc(100vh-11rem)]">
        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 flex flex-col border-r border-[#f0f0f0] bg-white/50 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-5 pb-3 border-b border-[#f0f0f0]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-['Outfit'] text-base font-bold text-[#0d1117]">My Projects</h3>
                <p className="text-xs text-[#9ca3af]">{developerName}</p>
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#001f3f] text-white hover:bg-indigo-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search projects…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e5e5] bg-white focus:outline-none focus:border-[#001f3f] focus:ring-2 focus:ring-[#001f3f]/10 transition-all"
              />
            </div>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
              className="mt-2 w-full text-xs rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 focus:outline-none focus:border-[#001f3f] transition-all"
            >
              <option value="">All statuses</option>
              <option value="pre_launch">Pre-Launch</option>
              <option value="launch">Launch</option>
              <option value="under_construction">Under Construction</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-[#f3f4f6] animate-pulse" />
              ))
            ) : projects.length === 0 ? (
              <div className="text-center py-10">
                <Layers className="w-8 h-8 text-[#d1d5db] mx-auto mb-3" />
                <p className="text-xs text-[#9ca3af] font-medium">No projects yet</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="mt-3 flex items-center gap-1.5 mx-auto text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Project
                </button>
              </div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void handleSelect(p.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl border transition-all duration-150 ${
                    selected?.id === p.id
                      ? "bg-[#001f3f] text-white border-[#001f3f]"
                      : "bg-white text-[#111827] border-[#f0f0f0] hover:border-indigo-200 hover:bg-indigo-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${selected?.id === p.id ? "text-white" : "text-[#0d1117]"}`}>{p.name}</p>
                      <p className={`text-[10px] mt-0.5 ${selected?.id === p.id ? "text-white/60" : "text-[#9ca3af]"}`}>{p.city ?? "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        p.is_published
                          ? selected?.id === p.id ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                          : selected?.id === p.id ? "bg-white/20 text-white/70" : "bg-gray-100 text-gray-500"
                      }`}>{p.is_published ? "Live" : "Draft"}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        selected?.id === p.id ? "bg-white/20 text-white/60" : "bg-[#f3f4f6] text-[#6b7280]"
                      }`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        selected?.id === p.id ? "bg-amber-400/25 text-white" : "bg-amber-50 text-amber-900"
                      }`}>
                        {PROJECT_LISTING_TYPE_SHORT[p.listing_type] ?? "Sale"}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
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

        {/* ── Main ────────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center mb-5">
                <Layers className="w-9 h-9 text-indigo-400" />
              </div>
              <p className="text-[#374151] font-semibold text-lg font-['Outfit']">Select a project</p>
              <p className="text-sm text-[#9ca3af] mt-1 mb-6">Choose from the sidebar or create a new one.</p>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white text-sm font-semibold hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create My First Project
              </button>
            </div>
          ) : loadingProject ? (
            <div className="flex-1 p-8 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`h-14 rounded-2xl bg-[#f3f4f6] animate-pulse ${i === 0 ? "h-24" : ""}`} />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Project header — no duplicate for developer portal */}
              <ProjectHeader
                project={selected}
                onPublishToggle={() => void handlePublishToggle()}
                onDelete={handleArchive}
                showToast={showToast}
              />

              {/* Tabs nav */}
              <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-[#f0f0f0] bg-white overflow-x-auto flex-shrink-0">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                      activeTab === t.id
                        ? "bg-[#001f3f] text-white"
                        : "text-[#6b7280] hover:text-[#111827] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "data"           && <ProjectDataTab           project={selected} onJump={(tab) => setActiveTab(tab as TabId)} showToast={showToast} />}
                {activeTab === "overview"       && <ProjectOverviewTab       project={selected} developers={[]} onSave={handleUpdateProject} showToast={showToast} />}
                {activeTab === "units"          && <ProjectUnitsTab          projectId={selected.id} showToast={showToast} />}
                {activeTab === "images"         && (
                  <ProjectImagesTab
                    project={selected}
                    showToast={showToast}
                    onMainImageChange={(url: string) => {
                      setSelected({ ...selected, main_image: url })
                      setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, main_image: url } : p))
                    }}
                  />
                )}
                {activeTab === "amenities"      && <ProjectAmenitiesTab      projectId={selected.id} showToast={showToast} />}
                {activeTab === "property_types" && <ProjectPropertyTypesTab  projectId={selected.id} showToast={showToast} />}
                {activeTab === "media"          && <ProjectMediaTab          projectId={selected.id} showToast={showToast} />}
                {activeTab === "features"       && <ProjectFeaturesTab       projectId={selected.id} showToast={showToast} />}
                {activeTab === "nearby"         && <ProjectNearbyTab         projectId={selected.id} showToast={showToast} />}
                {activeTab === "seo"            && <ProjectSeoTab            project={selected} onSave={handleUpdateProject} showToast={showToast} />}
                {activeTab === "settings"       && (
                  <ProjectSettingsTab
                    project={selected}
                    onSave={handleUpdateProject}
                    onPublishToggle={() => void handlePublishToggle()}
                    showToast={showToast}
                    listingVisibilityMode="developer_primary_sale"
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Overlays */}
      {showNew && developerId && (
        <NewProjectModal
          developerId={developerId}
          onClose={() => setShowNew(false)}
          showToast={showToast}
          onCreated={async (p) => {
            setShowNew(false)
            await loadList()
            setSelected(p)
            setActiveTab("overview")
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />
      )}

      <Portal>
        <ToastList toasts={toasts} remove={removeToast} />
      </Portal>
    </>
  )
}
