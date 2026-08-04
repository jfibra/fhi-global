"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Plus, Search, Upload, Image as ImageIcon, LayoutTemplate, Clapperboard, Loader2, Building2, ArrowUpRight, Layers } from "lucide-react"
import { DeveloperCombobox } from "@/components/developers/developer-combobox"
import { TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import {
  fetchDevelopers as fetchDeveloperDirectory,
  type Developer as DirectoryDeveloper,
} from "@/lib/developer-service"
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
  fetchProjectCountsByDeveloper,
  generateProjectSlug,
  addProjectImage,
} from "@/lib/project-service"

import { ProjectDataTab } from "./project-data-tab"
import { ProjectHeader, StudioModal } from "./project-header"
import { ProjectPosterTab } from "./project-poster-tab"
import { ProjectReelsTab } from "./project-reels-tab"
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
import { compressImageForUpload } from "@/lib/upload/compress-image"
import { sampleLogoBgFromUrl } from "@/lib/logo-bg"

/** Title-case regardless of how the value is cased in the DB. */
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

// ─── Developer card cover ───────────────────────────────────────────────────────
// Background adapts to the logo's own baked-in background color (sampled from
// its corner pixels); white when there's no confident answer. The bottom border
// keeps a visible separation when that color is white like the card body.
function DevLogoCover({
  url,
  name,
  verified,
  active,
  showStatus,
}: {
  url: string | null
  name: string
  /** Show the Verified badge — only when the Verifications filter is applied. */
  verified: boolean
  active: boolean
  /** Show the Active/Inactive badge — only when the Status filter is applied. */
  showStatus: boolean
}) {
  const [bg, setBg] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    void sampleLogoBgFromUrl(url).then((c) => {
      if (alive) setBg(c)
    })
    return () => {
      alive = false
    }
  }, [url])

  return (
    <div
      className="relative m-3 mb-0 h-44 border border-[#e5e7eb] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: bg ?? "#ffffff" }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <Building2 className="w-10 h-10 text-[#001f3f]/20" />
      )}
      {verified && (
        <span className="absolute top-3 left-3 text-[11px] px-3 py-1 font-bold uppercase tracking-wider bg-emerald-500/95 text-white">
          Verified
        </span>
      )}
      {showStatus && (
        <span className="absolute top-3 right-3 text-[11px] px-3 py-1 font-bold tracking-wider bg-[#232d3b]/95 text-white">
          {active ? "Active" : "Inactive"}
        </span>
      )}
    </div>
  )
}

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

// Tabs agents/members may browse read-only — content only, no Data Health / SEO / Settings.
const READONLY_TAB_IDS = new Set<TabId>([
  "overview", "units", "images", "amenities", "property_types", "media", "features", "nearby",
])

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
  // Cover photo is held here and uploaded straight after the insert — the S3
  // key is built from the developer + project slugs, so the row must exist.
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const clearCover = () => {
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setCoverFile(null)
    if (coverInputRef.current) coverInputRef.current.value = ""
  }

  const pickCover = (f: File) => {
    if (!f.type.startsWith("image/")) { showToast("error", "Only image files are allowed."); return }
    if (f.size > 10 * 1024 * 1024) { showToast("error", "File exceeds the 10 MB limit."); return }
    setCoverPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    setCoverFile(f)
  }

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

    if (error || !data) {
      setSaving(false)
      showToast("error", error ?? "Failed to create the project.")
      return
    }

    // Upload the cover now that the project has an id and slug. A failure here
    // never loses the project — it's reported and the photo can be added from
    // the Images tab.
    let created = data
    if (coverFile) {
      const devSlug = developers.find((d) => d.id === developerId)?.slug ?? "unknown"
      // Shrink in the browser before it goes over the wire (fails open).
      const { file: toUpload } = await compressImageForUpload(coverFile)
      const fd = new FormData()
      fd.append("file", toUpload, toUpload.name)
      fd.append("developer_slug", devSlug)
      fd.append("project_slug", created.slug)
      try {
        const res = await fetch("/api/upload/project", { method: "POST", body: fd })
        const json = (await res.json()) as { url?: string }
        if (!res.ok || !json.url) throw new Error()
        // First image becomes the main image and syncs projects.main_image.
        const { error: imgError } = await addProjectImage(created.id, json.url, null, 1)
        if (imgError) showToast("error", `Project created, but the photo could not be saved: ${imgError}`)
        else created = { ...created, main_image: json.url }
      } catch {
        showToast("error", "Project created, but the photo upload failed. Add it from the Images tab.")
      }
    }

    setSaving(false)
    clearCover()
    showToast("success", "Project created")
    onCreated(created)
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
            {/* Cover photo */}
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">Cover photo</label>
              <div className="flex items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5">
                <div className="w-16 h-12 rounded-lg border border-[#eef0f2] bg-[#f9fafb] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Selected cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-[#c0c6cf]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => coverInputRef.current?.click()} disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all disabled:opacity-50">
                      <Upload className="w-3.5 h-3.5" /> {coverFile ? "Change" : "Choose image"}
                    </button>
                    {coverFile && (
                      <button type="button" onClick={clearCover} disabled={saving}
                        className="text-xs font-semibold text-rose-500 hover:underline disabled:opacity-50">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1 truncate">
                    {coverFile ? `${coverFile.name} — set as the main image.` : "Optional · more photos in the Images tab."}
                  </p>
                </div>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCover(f) }} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 px-5 py-2.5 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving || !name.trim()}
                className="flex-1 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all disabled:opacity-50">
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
  const [sort, setSort] = useState<"" | "newest" | "oldest" | "name_asc" | "name_desc">("")
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
      sortField: sort === "name_asc" || sort === "name_desc" ? "name" : "created_at",
      sortDir: sort === "oldest" || sort === "name_asc" ? "asc" : "desc",
    })
    setLoading(false)
    if (error) { showToast("error", error); return }
    setProjects(data)
    setTotal(t)
  }, [page, search, filterDev, filterStatus, readOnly, sort, showToast])

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

  // ── Browse mode: the project grid, or an all-developers grid whose cards
  // drill into that developer's projects. ─────────────────────────────────────
  const [viewMode, setViewMode] = useState<"projects" | "developers">("projects")
  const openDeveloperProjects = (developerId: string) => {
    setFilterDev(developerId)
    setPage(1)
    setViewMode("projects")
  }

  // Developer directory for the Developers view — richer than the combobox list
  // (is_active + created_at for the status filter and sorting). Loaded once,
  // lazily, the first time the view is opened; filtered/sorted client-side.
  const [devDirectory, setDevDirectory] = useState<DirectoryDeveloper[] | null>(null)
  const [devProjectCounts, setDevProjectCounts] = useState<Record<string, number>>({})
  const [devVerified, setDevVerified] = useState("all")
  const [devStatus, setDevStatus] = useState("all")
  useEffect(() => {
    if (viewMode !== "developers" || devDirectory !== null) return
    void fetchDeveloperDirectory({ perPage: 500 }).then(({ data }) => setDevDirectory(data ?? []))
    void fetchProjectCountsByDeveloper({ isPublished: readOnly ? true : undefined }).then(setDevProjectCounts)
  }, [viewMode, devDirectory, readOnly])

  // ── Poster / Reels studios straight from a list card ────────────────────────
  const [cardStudio, setCardStudio] = useState<{ kind: "poster" | "reels"; project: Project } | null>(null)
  const [cardStudioOpening, setCardStudioOpening] = useState<number | null>(null)
  const openCardStudio = async (projectId: number, kind: "poster" | "reels") => {
    if (cardStudioOpening !== null) return
    setCardStudioOpening(projectId)
    const { data } = await fetchProject(projectId)
    setCardStudioOpening(null)
    if (data) setCardStudio({ kind, project: data })
    else showToast("error", "Could not load that project.")
  }

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

  // Title-case regardless of how the status is cased in the DB.
  const statusLabel = (s: string | null) =>
    (s ?? "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div>
      {!selected && !loadingProject ? (
        /* ══ BROWSE — card grid with search & filters ═══════════════════════ */
        <div className="max-w-[1400px] mx-auto">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
                <Plus className="w-4 h-4" /> New Project
              </button>
            )}
          </div>

          {/* toolbar */}
          <div className="bg-white border border-[#e5e5e5] p-3 mb-6 flex flex-col sm:flex-row gap-2.5">
            <div className="flex items-center gap-2 bg-[#f3f4f6] px-3.5 py-2.5 border border-transparent focus-within:border-[#001f3f]/25 transition-all flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder={viewMode === "developers" ? "Search developers…" : "Search projects by name or city…"}
                className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none min-w-0"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setPage(1) }} className="text-[#9ca3af] hover:text-[#374151] text-xs">✕</button>
              )}
            </div>
            {/* view-mode switch: browse projects directly, or drill in per developer */}
            <div className="flex shrink-0 items-stretch gap-1 border border-[#e0e3e8] bg-white p-1">
              {(
                [
                  { mode: "projects", label: "Projects", Icon: Layers },
                  { mode: "developers", label: "Developers", Icon: Building2 },
                ] as const
              ).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-2 px-4 py-2 text-[15px] font-semibold transition-colors ${
                    viewMode === mode
                      ? `${TOOLBAR_GRADIENT} text-white`
                      : "bg-white text-[#6b7280] hover:bg-[#f6f7f9]"
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${viewMode === mode ? "text-white" : "text-[#9ca3af]"}`} />
                  {label}
                </button>
              ))}
            </div>
            {/* sort — applies to whichever grid is showing */}
            <div className="flex items-center bg-white border border-[#e5e7eb] px-3 py-2.5 hover:border-[#001f3f]/40 transition-all">
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1) }}
                className="w-[105px] truncate bg-transparent text-sm font-semibold text-[#374151] outline-none cursor-pointer"
              >
                <option value="">Sort by</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
            </div>
            {viewMode === "projects" ? (
              <div className="flex gap-2.5">
                <div className="w-[172px]">
                  <DeveloperCombobox
                    developers={developers}
                    value={filterDev}
                    onChange={(id) => { setFilterDev(id); setPage(1) }}
                    clearLabel="All Developers"
                    flat
                    bare
                  />
                </div>
                <div className="flex items-center bg-white border border-[#e5e7eb] px-3 py-2.5 hover:border-[#001f3f]/40 transition-all">
                  <select
                    value={filterStatus}
                    onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                    className="w-[80px] truncate bg-transparent text-sm font-semibold text-[#374151] outline-none cursor-pointer"
                  >
                    <option value="">Status</option>
                    <option value="pre_launch">Pre-Launch</option>
                    <option value="launch">Launch</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <div className="flex items-center bg-white border border-[#e5e7eb] px-3 py-2.5 hover:border-[#001f3f]/40 transition-all">
                  <select
                    value={devVerified}
                    onChange={(e) => setDevVerified(e.target.value)}
                    className="w-[115px] truncate bg-transparent text-sm font-semibold text-[#374151] outline-none cursor-pointer"
                  >
                    <option value="all">Verifications</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
                <div className="flex items-center bg-white border border-[#e5e7eb] px-3 py-2.5 hover:border-[#001f3f]/40 transition-all">
                  <select
                    value={devStatus}
                    onChange={(e) => setDevStatus(e.target.value)}
                    className="w-[80px] truncate bg-transparent text-sm font-semibold text-[#374151] outline-none cursor-pointer"
                  >
                    <option value="all">Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* card grid */}
          {viewMode === "developers" ? (
            /* All developers — same card language as the project grid; clicking
               one drills into that developer's projects. */
            (() => {
              if (devDirectory === null) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-72 bg-[#f3f4f6] animate-pulse" />
                    ))}
                  </div>
                )
              }
              const q = search.trim().toLowerCase()
              const visibleDevs = devDirectory
                .filter((d) => !q || d.name.toLowerCase().includes(q))
                .filter((d) => devVerified === "all" || d.is_verified === (devVerified === "verified"))
                .filter((d) => devStatus === "all" || d.is_active === (devStatus === "active"))
                .sort((a, b) => {
                  if (sort === "name_asc") return a.name.localeCompare(b.name)
                  if (sort === "name_desc") return b.name.localeCompare(a.name)
                  const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  return sort === "oldest" ? diff : -diff
                })
              return visibleDevs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#001f3f]/10 to-[#d6b357]/20 flex items-center justify-center mb-5">
                    <Building2 className="w-9 h-9 text-[#001f3f]/40" />
                  </div>
                  <p className="text-[#374151] font-semibold text-lg font-['Outfit']">No developers found</p>
                  <p className="text-sm text-[#9ca3af] mt-1">Try a different search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {visibleDevs.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openDeveloperProjects(d.id)}
                      className="group text-left bg-white border border-[#eceef2] overflow-hidden shadow-[0_2px_12px_-6px_rgba(0,31,63,0.10)] hover:shadow-[0_16px_40px_-12px_rgba(0,31,63,0.28)] hover:-translate-y-1 hover:border-[#d6b357]/60 transition-all duration-200"
                    >
                      <DevLogoCover
                        url={d.logo_url}
                        name={d.name}
                        verified={devVerified !== "all" && d.is_verified}
                        active={d.is_active}
                        showStatus={devStatus !== "all"}
                      />
                      <div className="p-4 pt-3.5">
                        <p className="font-['Outfit'] text-[17px] font-bold text-[#0f2940] truncate">{d.name}</p>
                        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#6b7280]">
                          <Layers className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {devProjectCounts[d.id] ?? 0} Project{(devProjectCounts[d.id] ?? 0) === 1 ? "" : "s"}
                          </span>
                        </p>
                        <div className="mt-3.5 flex items-center">
                          <span className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-2 text-[12px] font-semibold text-white transition-all group-hover:brightness-110 ${TOOLBAR_GRADIENT}`}>
                            View Projects <ArrowUpRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 bg-[#f3f4f6] animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#001f3f]/10 to-[#d6b357]/20 flex items-center justify-center mb-5">
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
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all">
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
                  className="group text-left bg-white border border-[#eceef2] overflow-hidden shadow-[0_2px_12px_-6px_rgba(0,31,63,0.10)] hover:shadow-[0_16px_40px_-12px_rgba(0,31,63,0.28)] hover:-translate-y-1 hover:border-[#d6b357]/60 transition-all duration-200"
                >
                  {/* cover — inset on the studio browser (flat, no radius) */}
                  <div className={`relative bg-gradient-to-br from-[#001f3f] to-[#0a3a66] overflow-hidden ${
                    readOnly ? "m-3 mb-0 h-44" : "h-40"
                  }`}>
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
                    <span className={`absolute top-3 left-3 font-bold uppercase tracking-wider ${
                      readOnly ? "text-[11px] px-3 py-1" : "text-[10px] px-2.5 py-1"
                    } ${
                      p.is_published ? "bg-emerald-500/95 text-white" : "bg-white/90 text-[#6b7280]"
                    }`}>
                      {p.is_published ? "Live" : "Draft"}
                    </span>
                    <span className={`absolute top-3 right-3 font-bold tracking-wider bg-[#232d3b]/95 text-white ${
                      readOnly ? "text-[11px] px-3 py-1" : "text-[10px] px-2.5 py-1"
                    }`}>
                      {statusLabel(p.status)}
                    </span>
                  </div>
                  {/* body */}
                  {readOnly ? (
                    /* Studio browser card (agents/members) — mockup layout:
                       bold title, developer line, always-visible action row. */
                    <div className="p-4 pt-3.5">
                      <p className="font-['Outfit'] text-[17px] font-bold text-[#0f2940] truncate">
                        {p.name}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#6b7280]">
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{p.developers?.name ? titleCase(p.developers.name) : "—"}</span>
                      </p>
                      <div className="mt-3.5 flex items-center gap-2">
                        {cardStudioOpening === p.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-[#001f3f]" />
                        ) : (
                          <>
                            {p.main_image && (
                              <>
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void openCardStudio(p.id, "poster")
                                  }}
                                  className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-[#cfe0f1] bg-[#eaf2fb] px-2 py-2 text-[12px] font-semibold text-[#0a3d6b] transition-colors hover:bg-[#ddebf7]"
                                >
                                  <LayoutTemplate className="w-4 h-4" /> Poster
                                </span>
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void openCardStudio(p.id, "reels")
                                  }}
                                  className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-[#e1e4ea] bg-white px-2 py-2 text-[12px] font-semibold text-[#0d1b2e] transition-colors hover:bg-[#f3f6fa]"
                                >
                                  <Clapperboard className="w-4 h-4" /> Reels
                                </span>
                              </>
                            )}
                            <span className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 py-2 text-[12px] font-semibold text-white transition-all hover:brightness-110 ${TOOLBAR_GRADIENT}`}>
                              Open <ArrowUpRight className="w-4 h-4" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className="p-4">
                    <p className="text-[15px] font-bold text-[#111827] font-['Outfit'] truncate group-hover:text-[#001f3f]">{p.name}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5 truncate">
                      {p.developers?.name ?? "—"}
                      {p.city ? ` · ${p.city}` : ""}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {p.launch_price_from ? (
                        <span className="text-sm font-bold text-[#001f3f]">
                          {`${p.currency?.trim() || "AED"} ${Number(p.launch_price_from).toLocaleString("en-US")}`}
                        </span>
                      ) : p.main_image ? (
                        <span className="flex items-center gap-1.5">
                          {cardStudioOpening === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#001f3f]" />
                          ) : (
                            <>
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void openCardStudio(p.id, "poster")
                                }}
                                className="inline-flex items-center gap-1 bg-[#001f3f] text-white text-[10px] font-bold px-2.5 py-1 hover:bg-[#00284f] transition-colors"
                              >
                                <LayoutTemplate className="w-3 h-3" /> Poster
                              </span>
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void openCardStudio(p.id, "reels")
                                }}
                                className="inline-flex items-center gap-1 border border-[#001f3f]/25 text-[#001f3f] text-[10px] font-bold px-2.5 py-1 hover:bg-[#f3f6fa] transition-colors"
                              >
                                <Clapperboard className="w-3 h-3" /> Reels
                              </span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span aria-hidden />
                      )}
                      <span className="text-[11px] font-semibold text-[#8a6a10] bg-[#fdf6e3] border border-[#f0e8c8] px-2.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open →
                      </span>
                    </div>
                  </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* pagination */}
          {viewMode === "projects" && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 text-sm text-[#6b7280]">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 border border-[#e5e5e5] bg-white disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
                ← Prev
              </button>
              <span className="font-semibold">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 border border-[#e5e5e5] bg-white disabled:opacity-40 hover:border-[#001f3f] transition-colors font-medium">
                Next →
              </button>
            </div>
          )}

          {/* Poster / Reels studio opened from a card */}
          {cardStudio && (
            <StudioModal
              title={`${cardStudio.kind === "poster" ? "Poster" : "Reels"} Studio — ${cardStudio.project.name}`}
              onClose={() => setCardStudio(null)}
            >
              {cardStudio.kind === "poster" ? (
                <ProjectPosterTab project={cardStudio.project} showToast={showToast} />
              ) : (
                <ProjectReelsTab project={cardStudio.project} showToast={showToast} />
              )}
            </StudioModal>
          )}
        </div>
      ) : loadingProject ? (
        /* ══ DETAIL — loading ═══════════════════════════════════════════════ */
        <div className="max-w-[1400px] mx-auto space-y-4">
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

          {/* Tabs nav — agents/members (readOnly) get the content tabs only. */}
          <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-[#f0f0f0] bg-white overflow-x-auto flex-shrink-0">
            {(readOnly ? TABS.filter((t) => READONLY_TAB_IDS.has(t.id)) : TABS).map((t) => (
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

          {/* Tab content — panels render read-only when `readOnly`; Data Health /
              SEO / Settings stay admin-only. */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "data"           && !readOnly && <ProjectDataTab           project={selected} onJump={(tab) => setActiveTab(tab)} showToast={showToast} />}
            {activeTab === "overview"       && <ProjectOverviewTab       project={selected} developers={developers} onSave={handleUpdateProject} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "units"          && <ProjectUnitsTab          projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "images"         && <ProjectImagesTab         project={selected} showToast={showToast} readOnly={readOnly} onMainImageChange={(url: string) => { setSelected({ ...selected, main_image: url }); setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, main_image: url } : p)) }} />}
            {activeTab === "amenities"      && <ProjectAmenitiesTab      projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "property_types" && <ProjectPropertyTypesTab  projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "media"          && <ProjectMediaTab          projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "features"       && <ProjectFeaturesTab       projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "nearby"         && <ProjectNearbyTab         projectId={selected.id} showToast={showToast} readOnly={readOnly} />}
            {activeTab === "seo"            && !readOnly && <ProjectSeoTab            project={selected} onSave={handleUpdateProject} showToast={showToast} />}
            {activeTab === "settings"       && !readOnly && <ProjectSettingsTab       project={selected} onSave={handleUpdateProject} onPublishToggle={() => void handlePublishToggle()} showToast={showToast} />}
          </div>
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
