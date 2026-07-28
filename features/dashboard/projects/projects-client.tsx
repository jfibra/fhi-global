"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Plus, Search, Sparkles } from "lucide-react"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import {
  type Project,
  type Developer,
  type ProjectListingType,
  PROJECT_LISTING_TYPE_LABELS,
  fetchProjects,
  fetchProject,
  fetchProjectBySlug,
  createProject,
  updateProject,
  softDeleteProject,
  duplicateProject,
  publishProject,
  fetchDevelopersForSelect,
  generateProjectSlug,
} from "@/lib/project-service"

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
  const [listingType, setListingType] = useState<ProjectListingType>("sale")
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
      listing_type: listingType,
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
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Public listings</label>
              <p className="text-[10px] text-[#9ca3af] mb-1.5">Buy page, Rent page, or both.</p>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value as ProjectListingType)}
                className="w-full border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#001f3f]/20 focus:border-[#001f3f] bg-white"
              >
                {(Object.keys(PROJECT_LISTING_TYPE_LABELS) as ProjectListingType[]).map((k) => (
                  <option key={k} value={k}>{PROJECT_LISTING_TYPE_LABELS[k]}</option>
                ))}
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
export function ProjectsClient({
  currentRole,
  userId,
  readOnly = false,
}: {
  currentRole: string
  userId: string
  // Read-only browse for agents/members: published projects only, no
  // create/edit/publish/delete — the detail view exposes just the
  // Poster & Reels studios from the header.
  readOnly?: boolean
}) {
  const [projects, setProjects]     = useState<Project[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState("")
  const [filterDev, setFilterDev]   = useState("")
  const [filterStatus, setStatus]   = useState("")
  const [loading, setLoading]       = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  // /{role}/projects        → the list
  // /{role}/projects/{slug} → that project's page (a real route, not a param)
  const routeParams = useParams<{ slug?: string | string[] }>()
  const slug = typeof routeParams?.slug === "string" ? routeParams.slug : null
  // The list route, derived by dropping the slug segment when we're on a detail.
  const listPath = slug ? pathname.slice(0, -(slug.length + 1)) : pathname

  const [selected, setSelected]         = useState<Project | null>(null)
  const loadingProject = slug !== null && selected?.slug !== slug
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
      isPublished: readOnly ? true : undefined,
    })
    setLoading(false)
    if (error) { showToast("error", error); return }
    setProjects(data)
    setTotal(t)
  }, [page, search, filterDev, filterStatus, readOnly, showToast])

  // Only the list route needs the list — a detail route would waste the query.
  useEffect(() => { if (slug === null) void loadList() }, [loadList, slug])

  // ── Load developers for selects ────────────────────────────────────────────
  useEffect(() => {
    fetchDevelopersForSelect().then(({ data }) => setDevelopers(data))
  }, [])

  // ── Select project ──────────────────────────────────────────────────────────
  const openProject = (project: Pick<Project, "slug">) => {
    setActiveTab("overview")
    router.push(`${listPath}/${project.slug}`, { scroll: false })
  }
  const closeProject = () => router.push(listPath, { scroll: false })

  // ── `?project=<id>` IS the detail view ──────────────────────────────────────
  // The URL is the single source of truth, not a mirror of local state. That
  // matters because the breadcrumb's "Projects" crumb links to the bare path:
  // it's the same route, so this component never remounts, and if `selected`
  // were authoritative the detail would stay open (and an effect syncing state
  // → URL would put the param straight back). Driving it the other way round —
  // URL → state — means the crumb, a refresh, a shared link and browser-back
  // all behave the same way, with no ping-pong between two effects.
  useEffect(() => {
    let alive = true
    if (slug === null) {
      // Back on the list route (breadcrumb crumb, browser back) — drop the detail.
      Promise.resolve().then(() => { if (alive) setSelected(null) })
      return () => { alive = false }
    }
    fetchProjectBySlug(slug).then(({ data, error }) => {
      if (!alive) return
      if (error) { showToast("error", error); return }
      if (data) setSelected(data)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

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
        closeProject()
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

  const statusLabel = (s: string | null) => (s ?? "").replace(/_/g, " ")

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      {!selected && !loadingProject ? (
        /* ══ BROWSE — card grid with search & filters ═══════════════════════ */
        <div className="max-w-[1400px] mx-auto px-6 py-8">
          {/* heading row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold text-[#001f3f]">Projects</h1>
              <p className="text-sm text-[#9ca3af] mt-0.5">
                {loading ? "Loading…" : `${total} project${total === 1 ? "" : "s"}`}
              </p>
            </div>
            {!readOnly && (
              <button onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
                <Plus className="w-4 h-4" /> New Project
              </button>
            )}
          </div>

          {/* toolbar */}
          <div className="bg-white rounded-2xl border border-[#e5e5e5] p-3 mb-6 flex flex-col sm:flex-row gap-2.5">
            <div className="flex items-center gap-2 bg-[#f3f4f6] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#001f3f]/25 transition-all flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search projects by name or city…"
                className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none min-w-0"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setPage(1) }} className="text-[#9ca3af] hover:text-[#374151] text-xs">✕</button>
              )}
            </div>
            <div className="flex gap-2.5">
              <div className="w-60">
                <DeveloperCombobox
                  developers={developers}
                  value={filterDev}
                  onChange={(id) => { setFilterDev(id); setPage(1) }}
                  clearLabel="All Developers"
                />
              </div>
              <div className="flex items-center bg-[#f3f4f6] rounded-xl px-3 py-2.5">
                <select
                  value={filterStatus}
                  onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                  className="bg-transparent text-sm text-[#374151] outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="pre_launch">Pre-Launch</option>
                  <option value="launch">Launch</option>
                  <option value="under_construction">Under Construction</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* card grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 rounded-3xl bg-[#f3f4f6] animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/10 to-[#d6b357]/20 flex items-center justify-center mb-5">
                <svg className="w-9 h-9 text-[#001f3f]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21V7l9-4 9 4v14M12 21V13m-4 8v-5m8 5v-5" />
                </svg>
              </div>
              <p className="text-[#374151] font-semibold text-lg font-['Outfit']">No projects found</p>
              <p className="text-sm text-[#9ca3af] mt-1">
                {readOnly ? "Try a different search or filter" : "Try a different search, or create a new project"}
              </p>
              {!readOnly && (
                <button onClick={() => setShowNew(true)}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
                  <Plus className="w-4 h-4" /> New Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProject(p)}
                  className="group text-left bg-white rounded-3xl border border-[#eceef2] overflow-hidden shadow-[0_2px_12px_-6px_rgba(0,31,63,0.10)] hover:shadow-[0_16px_40px_-12px_rgba(0,31,63,0.28)] hover:-translate-y-1 hover:border-[#d6b357]/60 transition-all duration-200"
                >
                  {/* cover */}
                  <div className="relative h-40 bg-gradient-to-br from-[#001f3f] to-[#0a3a66] overflow-hidden">
                    {p.main_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.main_image} alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21V7l9-4 9 4v14M12 21V13m-4 8v-5m8 5v-5" />
                        </svg>
                      </div>
                    )}
                    <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      p.is_published ? "bg-emerald-500/95 text-white" : "bg-white/90 text-[#6b7280]"
                    }`}>
                      {p.is_published ? "Live" : "Draft"}
                    </span>
                    <span className="absolute top-3 right-3 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-[#001f3f]/85 text-[#d6b357] capitalize">
                      {statusLabel(p.status)}
                    </span>
                  </div>
                  {/* body */}
                  <div className="p-4">
                    <p className="text-[15px] font-bold text-[#111827] font-['Outfit'] truncate group-hover:text-[#001f3f]">{p.name}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5 truncate">
                      {p.developers?.name ?? "—"}
                      {p.city ? ` · ${p.city}` : ""}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#001f3f]">
                        {p.launch_price_from
                          ? `${p.currency?.trim() || "AED"} ${Number(p.launch_price_from).toLocaleString("en-US")}`
                          : "Price on request"}
                      </span>
                      <span className="text-[11px] font-semibold text-[#8a6a10] bg-[#fdf6e3] border border-[#f0e8c8] rounded-full px-2.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open →
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 text-sm text-[#6b7280]">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl border border-[#e5e5e5] bg-white disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
                ← Prev
              </button>
              <span className="font-semibold">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl border border-[#e5e5e5] bg-white disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
                Next →
              </button>
            </div>
          )}
        </div>
      ) : loadingProject ? (
        /* ══ DETAIL — loading ═══════════════════════════════════════════════ */
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-14 rounded-2xl bg-[#f3f4f6] animate-pulse ${i === 0 ? "h-28" : ""}`} />
          ))}
        </div>
      ) : selected ? (
        /* ══ DETAIL — info + edit tabs ══════════════════════════════════════ */
        <div className="flex flex-col h-screen overflow-hidden">
          {/* back row */}
          {/* Project header */}
          <ProjectHeader
            project={selected}
            onPublishToggle={() => void handlePublishToggle()}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            showToast={showToast}
            readOnly={readOnly}
          />

          {readOnly ? (
            /* Read-only detail — the studios in the header are the whole point. */
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-xl mx-auto mt-10 rounded-3xl border border-[#e8eaed] bg-white p-8 text-center shadow-[0_2px_12px_-2px_rgba(0,31,63,0.06)]">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#fdf6e3] border border-[#f0e8c8] flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-[#8a6a10]" />
                </div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Create marketing content</h3>
                <p className="text-sm text-[#6b7280] mt-2 leading-relaxed">
                  Use the <span className="font-semibold text-[#8a6a10]">Poster</span> and{" "}
                  <span className="font-semibold text-[#8a6a10]">Reels</span> buttons above to generate a
                  branded poster or a 9:16 video reel for {selected.name} — photos, pricing, and details
                  are filled in automatically from the project.
                </p>
                {selected.about_project && (
                  <p className="text-xs text-[#9ca3af] mt-4 leading-relaxed line-clamp-4">{selected.about_project}</p>
                )}
              </div>
            </div>
          ) : (
          <>
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
          </>
          )}
        </div>
      ) : null}

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      {showNew && (
        <NewProjectModal
          developers={developers}
          onClose={() => setShowNew(false)}
          showToast={showToast}
          onCreated={async (p) => {
            setShowNew(false)
            await loadList()
            openProject(p)
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
