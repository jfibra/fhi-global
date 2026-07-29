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
import {
  Archive,
  ArrowDownWideNarrow,
  Building2,
  Clapperboard,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  Images,
  Link2,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import MarketingActionsModal from "@/components/dashboard/listings/marketing/MarketingActionsModal"
import { getDashboardRouteByRole } from "@/lib/auth"
import {
  type AgentListing,
  type AgentListingFormInput,
  type AgentListingStatus,
  type ProjectPickerOption,
  UNASSIGNED_DEVELOPER_KEY,
  fetchMyAgentListings,
  fetchPublishedProjectsForListingForm,
  createAgentListing,
  updateAgentListing,
  replaceAgentListingImages,
  setAgentListingStatus,
  softDeleteAgentListing,
} from "@/lib/agent-listings-service"
import { developerName, propertyTypes, publicPath, searchHaystack } from "./listing-card-facts"
import {
  type MenuItem,
  BRAND_GRADIENT,
  Chip,
  ChipDivider,
  DISPLAY,
  LISTING_GRID,
  ListingCard,
  ListingRow,
  RowMenu,
  ToolbarActions,
  ToolbarSearch,
  ToolbarSelect,
  ViewToggle,
  WHITE_PAGE,
} from "./listing-ui"

// app/layout.tsx exposes Outfit as a CSS variable; the repo's usual
// `font-['Outfit']` names a family that was never registered, so it silently
// falls back. Referencing the variable is what actually applies the face.
const emptyForm: AgentListingFormInput = {
  title: "",
  description: "",
  listing_kind: "sale",
  project_id: null,
  status: "published",
  unit_type: null,
}

type StatusFilter = "all" | AgentListingStatus
type KindFilter = "all" | "sale" | "rent"
type SortKey = "updated_desc" | "created_desc" | "price_desc" | "price_asc" | "title_asc"

const SORT_LABELS: Record<SortKey, string> = {
  updated_desc: "Recently edited",
  created_desc: "Newest first",
  price_desc: "Price: high to low",
  price_asc: "Price: low to high",
  title_asc: "Title A–Z",
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

let toastSeq = 0

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AgentListingsClient({
  userId,
  currentRole,
}: {
  userId: string
  /** Passed by variants.tsx; the page shows the listings, not the owner's name. */
  userName?: string
  currentRole: string
}) {
  const base = getDashboardRouteByRole(currentRole)

  const [rows, setRows] = useState<AgentListing[]>([])
  const [projects, setProjects] = useState<ProjectPickerOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsFetched, setProjectsFetched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Browse controls
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  /** "Categories" in the toolbar — sale vs rent. */
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  /** "Types" in the toolbar — the project's property_types (Apartment, Villa, …). */
  const [propertyType, setPropertyType] = useState("all")
  const [developerFilter, setDeveloperFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc")
  const [view, setView] = useState<"grid" | "list">("grid")

  // Create / edit
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AgentListing | null>(null)
  const [form, setForm] = useState<AgentListingFormInput>(emptyForm)
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string>("")
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [aiHint, setAiHint] = useState("")
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiDescError, setAiDescError] = useState<string | null>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)

  // Project gallery, keyed by id so switching projects can't flash the old one
  const [projectData, setProjectData] = useState<{
    projectId: number
    urls: string[]
    extras: ProjectPickerExtras | null
  } | null>(null)
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null)

  const [marketing, setMarketing] = useState<{ row: AgentListing; view: "menu" | "flyer" | "announce" } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((variant: Toast["variant"], message: string) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, variant, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const applyListings = useCallback(
    (res: Awaited<ReturnType<typeof fetchMyAgentListings>>) => {
      if (res.error) showToast("error", res.error)
      else setRows(res.data ?? [])
    },
    [showToast],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchMyAgentListings(userId)
      if (cancelled) return
      applyListings(res)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, applyListings])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    applyListings(await fetchMyAgentListings(userId))
    setRefreshing(false)
  }, [userId, applyListings])

  /**
   * The project picker pulls EVERY published project (~240 rows with developer
   * names) and is only ever read inside the create/edit dialog, so it loads the
   * first time that dialog opens rather than on every visit to the page.
   */
  const ensureProjects = useCallback(async () => {
    if (projectsFetched || projectsLoading) return
    setProjectsLoading(true)
    const res = await fetchPublishedProjectsForListingForm()
    if (!res.error && res.data) setProjects(res.data)
    setProjectsFetched(true)
    setProjectsLoading(false)
  }, [projectsFetched, projectsLoading])

  /** Counts behind the filter chips. Only buckets the schema actually supports. */
  const stats = useMemo(() => {
    const count = (fn: (r: AgentListing) => boolean) => rows.filter(fn).length
    return {
      total: rows.length,
      published: count((r) => r.status === "published"),
      draft: count((r) => r.status === "draft"),
      archived: count((r) => r.status === "archived"),
      sale: count((r) => r.listing_kind === "sale"),
      rent: count((r) => r.listing_kind === "rent"),
    }
  }, [rows])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false
      if (kindFilter !== "all" && row.listing_kind !== kindFilter) return false
      if (propertyType !== "all" && !propertyTypes(row).includes(propertyType)) return false
      if (developerFilter !== "all" && (developerName(row) ?? "Standalone") !== developerFilter) return false
      if (!needle) return true
      return searchHaystack(row).includes(needle)
    })

    const priceOf = (r: AgentListing) => {
      const own = r.price == null ? null : Number(r.price)
      if (own != null && Number.isFinite(own)) return own
      const raw = r.projects?.launch_price_from
      const n = raw == null ? null : Number(raw)
      return n != null && Number.isFinite(n) ? n : null
    }

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "created_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "title_asc":
          return a.title.localeCompare(b.title)
        case "price_desc":
        case "price_asc": {
          // Unpriced listings sort last whichever direction is picked.
          const av = priceOf(a)
          const bv = priceOf(b)
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          return sortKey === "price_desc" ? bv - av : av - bv
        }
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })
  }, [rows, search, statusFilter, kindFilter, propertyType, developerFilter, sortKey])

  /** Only offer property types that exist in this agent's own listings, with the
   *  count of listings behind each. */
  const propertyTypeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const t of propertyTypes(row)) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const developerOptionsForFilter = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) set.add(developerName(row) ?? "Standalone")
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtersActive =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    propertyType !== "all" ||
    developerFilter !== "all"

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setKindFilter("all")
    setPropertyType("all")
    setDeveloperFilter("all")
  }

  // ── Form plumbing ───────────────────────────────────────────────────────────

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

  const formProjectId = form.project_id
  const projectGalleryUrls = projectData?.projectId === formProjectId ? projectData.urls : []
  const projectPickerExtras = projectData?.projectId === formProjectId ? projectData.extras : null
  const projectGalleryLoading = formProjectId != null && loadingProjectId === formProjectId

  useEffect(() => {
    if (!modalOpen || formProjectId == null) return
    let cancelled = false
    void (async () => {
      setLoadingProjectId(formProjectId)
      try {
        const res = await fetch(`/api/agent-listings/project-gallery?projectId=${formProjectId}`)
        const data = (await res.json()) as ProjectGalleryApi
        if (cancelled) return
        setProjectData({
          projectId: formProjectId,
          urls: res.ok && data.urls ? data.urls : [],
          extras: res.ok ? extrasFromProjectGalleryPayload(data) : null,
        })
      } catch {
        if (!cancelled) setProjectData({ projectId: formProjectId, urls: [], extras: null })
      } finally {
        if (!cancelled) setLoadingProjectId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen, formProjectId])

  const openCreate = () => {
    void ensureProjects()
    setEditing(null)
    setForm(emptyForm)
    setSelectedDeveloperId("")
    setAiHint("")
    setAiDescError(null)
    setGalleryUrls([])
    setModalOpen(true)
  }

  const openEdit = (row: AgentListing) => {
    void ensureProjects()
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
    const did = row.projects?.developer_id
    setSelectedDeveloperId(
      row.project_id != null
        ? did != null && String(did).trim() !== ""
          ? String(did)
          : UNASSIGNED_DEVELOPER_KEY
        : "",
    )
    setGalleryUrls((row.agent_listing_images ?? []).map((i) => i.url))
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
        if (data.url) setGalleryUrls((prev) => [...prev, data.url as string])
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
        if (res.ok) extras = extrasFromProjectGalleryPayload((await res.json()) as ProjectGalleryApi)
      } catch {
        /* keep extras null */
      }
    }
    const projectLabel =
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
      if (from != null && to != null && to !== from) return `Developer launch pricing: ${cur} ${fmt(from)} – ${fmt(to)}`
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
          projectName: projectLabel,
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
        showToast(
          imgErr ? "error" : "success",
          imgErr ? `Saved listing but images failed: ${imgErr}` : "Listing updated",
        )
        await refresh()
      } else {
        const { data, error } = await createAgentListing(userId, form)
        if (error) {
          showToast("error", error)
          return
        }
        if (data) {
          const { error: imgErr } = await replaceAgentListingImages(data.id, userId, galleryUrls)
          showToast(
            imgErr ? "error" : "success",
            imgErr ? `Listing created but images failed: ${imgErr}` : "Listing created",
          )
          await refresh()
        }
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Row actions ─────────────────────────────────────────────────────────────

  const changeStatus = async (row: AgentListing, status: AgentListingStatus) => {
    const { error } = await setAgentListingStatus(row.id, userId, status)
    if (error) {
      showToast("error", error)
      return
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status, updated_at: new Date().toISOString() } : r)),
    )
    showToast(
      "success",
      status === "published" ? "Listing published" : status === "draft" ? "Moved to draft" : "Listing archived",
    )
  }

  const deleteListing = async (row: AgentListing) => {
    if (!confirm(`Delete "${row.title}"? It comes off the public site. An admin can restore it.`)) return
    const { error } = await softDeleteAgentListing(row.id, userId)
    if (error) {
      showToast("error", error)
      return
    }
    showToast("success", "Listing deleted")
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  const copyLink = async (row: AgentListing) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath(row)}`)
      showToast("success", "Public link copied")
    } catch {
      showToast("error", "Copy failed — your browser blocked clipboard access")
    }
  }

  const menuFor = (row: AgentListing): MenuItem[] => {
    const menu: MenuItem[] = [{ label: "Edit listing", icon: Pencil, onSelect: () => openEdit(row) }]
    if (row.status === "published") {
      menu.push({
        label: "Open public page",
        icon: ExternalLink,
        onSelect: () => window.open(publicPath(row), "_blank", "noopener,noreferrer"),
      })
      menu.push({ label: "Move to draft", icon: EyeOff, onSelect: () => void changeStatus(row, "draft") })
    } else {
      menu.push({ label: "Publish", icon: Eye, onSelect: () => void changeStatus(row, "published") })
    }
    menu.push({ label: "Copy public link", icon: Link2, onSelect: () => void copyLink(row) })
    menu.push({ label: "Marketing tools", icon: Sparkles, onSelect: () => setMarketing({ row, view: "menu" }) })
    if (row.status !== "archived") {
      menu.push({ label: "Archive", icon: Archive, onSelect: () => void changeStatus(row, "archived") })
    }
    menu.push({ label: "Delete", icon: Trash2, onSelect: () => void deleteListing(row), destructive: true })
    return menu
  }

  /** The marketing trio — this page's own actions. The admin view can't offer
   *  them: share-card writes are scoped to the owning agent. */
  const cardFooter = (row: AgentListing) => (
    <>
      <Link
        href={`${base}/reels-maker?listing=${row.id}`}
        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#7c3aed] hover:bg-[#7c3aed]/10 transition-colors whitespace-nowrap"
      >
        <Clapperboard className="w-3 h-3" /> Reel
      </Link>
      <button
        type="button"
        onClick={() => setMarketing({ row, view: "flyer" })}
        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#001f3f] hover:bg-[#001f3f]/[0.07] transition-colors whitespace-nowrap"
      >
        <FileImage className="w-3 h-3" /> Flyer
      </button>
      <button
        type="button"
        onClick={() => setMarketing({ row, view: "announce" })}
        className="flex-[2] inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#0e7490] hover:bg-[#0891b2]/10 transition-colors whitespace-nowrap"
      >
        <Megaphone className="w-3 h-3" /> Just Listed/Sold
      </button>
      <RowMenu items={menuFor(row)} label={`More actions for ${row.title}`} />
    </>
  )

  const rowFooter = (row: AgentListing) => (
    <>
      <Link
        href={`${base}/reels-maker?listing=${row.id}`}
        title="Create a reel"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7c3aed] hover:bg-[#7c3aed]/10"
      >
        <Clapperboard className="w-3.5 h-3.5" />
      </Link>
      <button
        type="button"
        onClick={() => setMarketing({ row, view: "flyer" })}
        title="Create a flyer"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#001f3f] hover:bg-[#001f3f]/[0.07]"
      >
        <FileImage className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setMarketing({ row, view: "announce" })}
        title="Just Listed/Sold"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#0e7490] hover:bg-[#0891b2]/10"
      >
        <Megaphone className="w-3.5 h-3.5" />
      </button>
      <RowMenu items={menuFor(row)} label={`More actions for ${row.title}`} />
    </>
  )

  const statusPills: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "published", label: "Published", count: stats.published },
    { value: "draft", label: "Draft", count: stats.draft },
    { value: "archived", label: "Archived", count: stats.archived },
  ]

  return (
    <>
      {/* The dashboard shell paints #f4f6f9 and pads its <main> by 6 (24px); the
          negative margin + matching padding lets this page carry a white surface
          edge to edge instead.
          Two details this depends on, both easy to break:
           • NO `w-full` — that resolves to 100% of main's *content* box, which
             after -mx-6 lands 24px short of the right edge and leaks grey.
             width:auto on a block fills the containing block minus margins,
             which is content + 48px = main's full width.
           • min-height must be 100% + 3rem for the same reason vertically, so a
             short list still paints white all the way down. */}
      <div className={`space-y-3 ${WHITE_PAGE}`}>
        {/* Toolbar — search · sort · developer · clear/refresh · New Listing, one line */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Search title, location or project…"
          />

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <ToolbarSelect
              icon={ArrowDownWideNarrow}
              label="Sort by"
              value={sortKey}
              onChange={(v) => setSortKey(v as SortKey)}
              options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                value: k,
                label: SORT_LABELS[k],
              }))}
            />

            <ToolbarSelect
              icon={Building2}
              label="Developer"
              value={developerFilter}
              onChange={setDeveloperFilter}
              options={[
                { value: "all", label: "All developers" },
                ...developerOptionsForFilter.map((d) => ({ value: d, label: d })),
              ]}
            />

            <ToolbarActions
              onClear={clearFilters}
              clearDisabled={!filtersActive}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
            />

            <button
              type="button"
              onClick={openCreate}
              className={`${BRAND_GRADIENT} h-[44px] px-4 rounded-2xl inline-flex items-center justify-center gap-1.5 text-[14px] font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap grow sm:grow-0`}
            >
              <Plus className="w-4 h-4" />
              New Listing
            </button>
          </div>
        </div>

        {/* Filter chips — status | category | property type. Each group is
            single-select; clicking an active chip clears that group. */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusPills.map((p) => (
              <Chip
                key={p.value}
                active={statusFilter === p.value}
                count={p.count}
                onClick={() => setStatusFilter(p.value)}
              >
                {p.label}
              </Chip>
            ))}

            <ChipDivider />

            <Chip
              active={kindFilter === "sale"}
              count={stats.sale}
              onClick={() => setKindFilter((k) => (k === "sale" ? "all" : "sale"))}
            >
              For sale
            </Chip>
            <Chip
              active={kindFilter === "rent"}
              count={stats.rent}
              onClick={() => setKindFilter((k) => (k === "rent" ? "all" : "rent"))}
            >
              For rent
            </Chip>

            {propertyTypeOptions.length > 0 && <ChipDivider />}
            {propertyTypeOptions.map((t) => (
              <Chip
                key={t.name}
                active={propertyType === t.name}
                count={t.count}
                onClick={() => setPropertyType((p) => (p === t.name ? "all" : t.name))}
              >
                {t.name}
              </Chip>
            ))}
          </div>

          <ViewToggle view={view} onChange={setView} />
        </div>

        {/* Results */}
        {loading ? (
          <div className={LISTING_GRID}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[268px] rounded-2xl bg-white border border-[#e6eaf1] animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm p-10 text-center">
            <span className="w-14 h-14 rounded-2xl bg-[#001f3f]/5 text-[#001f3f] flex items-center justify-center mx-auto mb-4">
              <Images className="w-6 h-6" />
            </span>
            <h3 className={`${DISPLAY} text-lg font-bold text-[#0d1117]`}>No listings yet</h3>
            <p className="text-sm text-[#6b7280] mt-1.5 max-w-md mx-auto">
              Create a listing and link it to a developer project — its location, pricing and unit details
              come across automatically.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className={`${BRAND_GRADIENT} inline-flex items-center gap-2 mt-5 h-11 px-5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all`}
            >
              <Plus className="w-4 h-4" /> New Listing
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm p-10 text-center">
            <span className="w-14 h-14 rounded-2xl bg-[#f4f6f9] text-[#9ca3af] flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6" />
            </span>
            <h3 className={`${DISPLAY} text-lg font-bold text-[#0d1117]`}>Nothing matches</h3>
            <p className="text-sm text-[#6b7280] mt-1.5">
              Adjust the filters, or clear them to see all {rows.length}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setStatusFilter("all")
                setKindFilter("all")
              }}
              className="mt-5 h-11 px-5 rounded-xl border border-[#e5e7eb] text-sm font-bold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
            >
              Clear filters
            </button>
          </div>
        ) : view === "grid" ? (
          <div className={LISTING_GRID}>
            {visible.map((row) => (
              <ListingCard key={row.id} row={row} footer={cardFooter(row)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm overflow-hidden divide-y divide-[#f1f3f6]">
            {visible.map((row) => (
              <ListingRow key={row.id} row={row} footer={rowFooter(row)} />
            ))}
          </div>
        )}

        {visible.length > 0 && (
          <p className="text-[11px] text-[#9ca3af] text-center tabular-nums">
            Showing {visible.length} of {rows.length} listing{rows.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Create / edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl border border-[#e8eaed] shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 scrollbar-none">
            <h2 className={`${DISPLAY} text-lg font-bold text-[#001f3f] mb-4`}>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {/* Status had no control before, so Draft and Archived were
                    unreachable from this form and their tiles could only read 0. */}
                <div>
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">Visibility</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AgentListingStatus }))}
                    className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="published">Published — live on the site</option>
                    <option value="draft">Draft — only you can see it</option>
                    <option value="archived">Archived — off the site</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">Developer</label>
                <select
                  value={selectedDeveloperId}
                  onChange={(e) => {
                    setSelectedDeveloperId(e.target.value)
                    setForm((f) => ({ ...f, project_id: null, unit_type: null }))
                  }}
                  className="w-full border border-[#e5e5e5] rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">
                    {projectsLoading ? "Loading developers…" : "— No developer project —"}
                  </option>
                  {developerOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Location, launch price, project photos and the beds/baths/size on the card all follow the
                  project you select.
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
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#9ca3af] border border-[#e5e5e5] rounded-xl px-3 py-2 bg-[#fafafa]">
                    {projectGalleryLoading
                      ? "Loading the developer's unit lines…"
                      : "This project has no unit lines yet in the developer portal."}
                  </p>
                )}
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Picking the matching unit is what fills in beds, baths and size on the card.
                </p>
              </div>

              {form.project_id != null && (
                <div className="rounded-xl border border-[#e8eaed] bg-[#fafafa] p-3">
                  <p className="text-xs font-semibold text-[#374151] mb-1">Developer project photos</p>
                  <p className="text-[10px] text-[#9ca3af] mb-2 leading-relaxed">
                    Read-only preview from the developer&apos;s project record. Files you upload on this form
                    go in <span className="font-semibold text-[#6b7280]">Your unit / room photos</span> below.
                  </p>
                  {projectGalleryLoading ? (
                    <p className="text-xs text-[#9ca3af] flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading gallery…
                    </p>
                  ) : projectGalleryUrls.length === 0 ? (
                    <p className="text-xs text-[#9ca3af]">
                      No images are stored on this project yet. Your own photos below still show on the public
                      listing.
                    </p>
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
                  Saved on this listing only. The first one becomes the card cover.
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
                  <p className="text-xs text-rose-600 mb-1.5" role="alert">{aiDescError}</p>
                )}
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

      {marketing && (
        <MarketingActionsModal
          listingId={marketing.row.id}
          listingSlug={marketing.row.slug ?? null}
          listingTitle={marketing.row.title}
          listingStatus={marketing.row.status}
          listingKind={marketing.row.listing_kind}
          agentId={userId}
          initialOgOptions={marketing.row.og_card_options ?? null}
          initialView={marketing.view}
          onOgSaved={(opts) => {
            setRows((rs) => rs.map((r) => (r.id === marketing.row.id ? { ...r, og_card_options: opts } : r)))
            setMarketing((m) => (m ? { ...m, row: { ...m.row, og_card_options: opts } } : m))
            showToast("success", "Share card saved")
          }}
          onClose={() => setMarketing(null)}
          onEdit={() => {
            const r = marketing.row
            setMarketing(null)
            openEdit(r)
          }}
          onDelete={() => {
            const r = marketing.row
            setMarketing(null)
            void deleteListing(r)
          }}
        />
      )}

      <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm border ${
              t.variant === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}
