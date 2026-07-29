"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react"
import Image from "next/image"
import Link from "next/link"
import { createPortal } from "react-dom"
import {
  Archive,
  ArrowDownWideNarrow,
  Bath,
  BedDouble,
  Building2,
  ChevronDown,
  Clapperboard,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FilterX,
  ImagePlus,
  Images,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MapPin,
  Maximize2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import MarketingActionsModal from "@/components/dashboard/listings/marketing/MarketingActionsModal"
import { TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import { getDashboardRouteByRole } from "@/lib/auth"
import { relativeTime } from "@/lib/utils"
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
import {
  coverImage,
  developerName,
  locationLabel,
  photoCount,
  priceLine,
  projectName,
  propertyTypes,
  publicPath,
  searchHaystack,
  unitFacts,
  unitTypeLabel,
} from "./listing-card-facts"

// app/layout.tsx exposes Outfit as a CSS variable; the repo's usual
// `font-['Outfit']` names a family that was never registered, so it silently
// falls back. Referencing the variable is what actually applies the face.
const DISPLAY = "font-[family-name:var(--font-outfit)]"

const GOLD = "#d6b357"
/** Primary actions reuse the shared toolbar gradient from
 *  components/common/header-toolbar (top-to-bottom #0a3d6b → #001f3f, white on
 *  top) — imported rather than restated so the two can never drift apart. */
const BRAND_GRADIENT = `${TOOLBAR_GRADIENT} text-white`
/** Toolbar icon + focus-ring colour, matching that same toolbar's deep navy. */
const ACCENT = "#001f3f"
/** The toolbar's "floating white control" surface. */
const SHELL = "bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.05)]"

/** agent_listings.status is CHECK-constrained to exactly these three — the schema
 *  has no pending / sold / leased / expired state. */
const STATUS_META: Record<AgentListingStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Published", dot: "bg-emerald-500", text: "text-emerald-700" },
  draft: { label: "Draft", dot: "bg-blue-500", text: "text-blue-700" },
  archived: { label: "Archived", dot: "bg-slate-400", text: "text-slate-600" },
}

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

/** Module-level so showToast needs no ref: a ref reachable from render (via the
 *  per-row action closures) trips react-hooks/refs, and toast ids are never read
 *  during render anyway. */
let toastSeq = 0

// ─── Hydration-safe portal (no setState inside an effect) ─────────────────────

const noopSubscribe = () => () => {}
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

function Portal({ children }: { children: React.ReactNode }) {
  if (!useHydrated()) return null
  return createPortal(children, document.body)
}

// ─── Toolbar select ───────────────────────────────────────────────────────────

/** Icon + label + chevron over a native <select>: keeps native keyboard and
 *  mobile behaviour while matching the pill look. */
function ToolbarSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className={`${SHELL} relative h-[44px]`}>
      <Icon
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: ACCENT }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none w-full h-full bg-transparent rounded-2xl pl-10 pr-8 text-[14px] font-semibold text-[#344054] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/10 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98a2b3] pointer-events-none" />
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

/** One chip in the filter row. Chips are grouped by axis (status / category /
 *  property type) and separated by a hairline, because the axes AND together —
 *  a flat undivided row would read as mutually exclusive. */
function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 px-3 rounded-full text-[12px] font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? `${BRAND_GRADIENT} shadow-sm`
          : "bg-[#f1f3f6] text-[#6b7280] hover:bg-[#e8ebef] hover:text-[#374151]"
      }`}
    >
      {children}
      {count != null && (
        // /80 rather than /60: the count sits over the gold end of the gradient,
        // where a lighter tint stops reading.
        <span className={`tabular-nums ${active ? "text-white/80" : "text-[#a8b0ba]"}`}>{count}</span>
      )}
    </button>
  )
}

function ChipDivider() {
  return <span className="w-px h-5 bg-[#e3e7ed] mx-0.5 shrink-0" aria-hidden />
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: "sale" | "rent" }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide text-white shadow-sm"
      style={{ backgroundColor: kind === "sale" ? GOLD : "#2563eb" }}
    >
      {kind === "sale" ? "FOR SALE" : "FOR RENT"}
    </span>
  )
}

function StatusBadge({ status }: { status: AgentListingStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur text-[10px] font-bold shadow-sm ${meta.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  )
}

// ─── Row menu ─────────────────────────────────────────────────────────────────

type MenuItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  destructive?: boolean
}

function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 208
      const height = items.length * 38 + 16
      const pad = 8
      const below = rect.bottom + 6 + height <= window.innerHeight - pad
      setPos({
        top: below ? rect.bottom + 6 : Math.max(pad, rect.top - height - 6),
        left: Math.min(Math.max(pad, rect.right - width), window.innerWidth - width - pad),
      })
    }
    compute()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [open, items.length])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#f4f6f9] hover:text-[#001f3f] transition-colors flex-shrink-0"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <Portal>
          <div
            ref={menuRef}
            className="fixed z-[150] w-[208px] bg-white rounded-2xl border border-[#e6eaf1] shadow-2xl py-2"
            style={{ top: pos.top, left: pos.left }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
                  item.destructive ? "text-rose-600 hover:bg-rose-50" : "text-[#374151] hover:bg-[#f8fafc]"
                }`}
              >
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  )
}

// ─── Listing card ─────────────────────────────────────────────────────────────

type CardActions = {
  reelHref: string
  onFlyer: () => void
  onPoster: () => void
  menu: MenuItem[]
}

/** A dash, not a zero — beds/baths/size come from the developer's project unit
 *  line, so a standalone listing genuinely has none on file. */
function Fact({
  icon: Icon,
  value,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number | null
  suffix: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#6b7280]">
      <Icon className="w-3 h-3 text-[#b6bcc6]" />
      {value == null ? (
        <span className="text-[#c4c9d0]">—</span>
      ) : (
        <span className="font-semibold text-[#374151] tabular-nums">
          {value.toLocaleString()}
          {suffix && <span className="font-normal text-[#6b7280]"> {suffix}</span>}
        </span>
      )}
    </span>
  )
}

function ListingCard({ row, actions }: { row: AgentListing; actions: CardActions }) {
  const cover = coverImage(row)
  const loc = locationLabel(row)
  const price = priceLine(row)
  const facts = unitFacts(row)
  const photos = photoCount(row)
  const dev = developerName(row)
  const proj = projectName(row)
  const unitLabel = unitTypeLabel(row)

  return (
    <article className="flex flex-col rounded-2xl bg-white border border-[#e6eaf1] shadow-sm hover:shadow-lg transition-shadow duration-300">
      {/* Cover */}
      <div className="relative h-32 rounded-t-2xl overflow-hidden bg-[#eef1f5]">
        {cover ? (
          // next/image resizes on the fly — the S3 originals are 300–470KB each
          // and this box is ~250x128, so serving them raw was the page's biggest
          // cost by far. `sizes` must track the grid below or Next over-fetches.
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 20vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 text-[#b8bfc9]">
            <ImagePlus className="w-6 h-6" />
            <span className="text-[11px] font-semibold">No photo yet</span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5">
          <KindBadge kind={row.listing_kind} />
        </span>
        <span className="absolute top-2.5 right-2.5">
          <StatusBadge status={row.status} />
        </span>
        {photos > 1 && (
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px] font-bold tabular-nums">
            <Images className="w-3 h-3" /> {photos}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <h3 className={`${DISPLAY} text-[14px] font-bold text-[#0d1117] leading-snug line-clamp-1`}>
          {row.title}
        </h3>

        <p className="flex items-center gap-1.5 text-[11px] text-[#6b7280] min-w-0">
          <MapPin className="w-3 h-3 text-[#b6bcc6] flex-shrink-0" />
          <span className="truncate">
            {loc ?? (dev || proj ? [dev, proj].filter(Boolean).join(" · ") : "No location on file")}
          </span>
        </p>

        <p
          className={`${DISPLAY} text-[15px] font-bold leading-tight ${
            price.known ? "text-[#0d1117]" : "text-[#9ca3af]"
          }`}
        >
          {price.text}
          {price.fromProject && (
            <span className="ml-1 text-[9px] font-semibold text-[#9ca3af] align-middle">from project</span>
          )}
        </p>

        <div className="flex items-center gap-2.5 flex-wrap text-[11px] pt-0.5">
          <Fact icon={BedDouble} value={facts.beds} suffix={facts.beds === 1 ? "bed" : "beds"} />
          <Fact icon={Bath} value={facts.baths} suffix={facts.baths === 1 ? "bath" : "baths"} />
          <Fact icon={Maximize2} value={facts.size?.value ?? null} suffix={facts.size?.unit ?? "sqm"} />
        </div>

        <p className="text-[10px] text-[#b0b7c1] mt-auto pt-0.5 truncate">
          {unitLabel ? `${unitLabel} · ` : ""}
          Edited {relativeTime(row.updated_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-[#f1f3f6]">
        <Link
          href={actions.reelHref}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#7c3aed] hover:bg-[#7c3aed]/10 transition-colors whitespace-nowrap"
        >
          <Clapperboard className="w-3 h-3" /> Reel
        </Link>
        <button
          type="button"
          onClick={actions.onFlyer}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#001f3f] hover:bg-[#001f3f]/[0.07] transition-colors whitespace-nowrap"
        >
          <FileImage className="w-3 h-3" /> Flyer
        </button>
        <button
          type="button"
          onClick={actions.onPoster}
          className="flex-[2] inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold text-[#0e7490] hover:bg-[#0891b2]/10 transition-colors whitespace-nowrap"
        >
          <Megaphone className="w-3 h-3" /> Just Listed/Sold
        </button>
        <RowMenu items={actions.menu} label={`More actions for ${row.title}`} />
      </div>
    </article>
  )
}

// ─── Listing row (list view) ──────────────────────────────────────────────────

function ListingRow({ row, actions }: { row: AgentListing; actions: CardActions }) {
  const cover = coverImage(row)
  const loc = locationLabel(row)
  const price = priceLine(row)
  const facts = unitFacts(row)

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f8fafc] transition-colors">
      <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-[#eef1f5] flex-shrink-0">
        {cover ? (
          <Image src={cover} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[#c4c9d0]">
            <ImagePlus className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[13px] font-bold text-[#0d1117] truncate">{row.title}</h3>
          <KindBadge kind={row.listing_kind} />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#6b7280] mt-0.5 min-w-0">
          <MapPin className="w-3 h-3 text-[#b6bcc6] flex-shrink-0" />
          <span className="truncate">{loc ?? "No location on file"}</span>
        </p>
      </div>

      <div className="hidden md:flex items-center gap-2.5 text-[11px] flex-shrink-0">
        <Fact icon={BedDouble} value={facts.beds} suffix="" />
        <Fact icon={Bath} value={facts.baths} suffix="" />
        <Fact icon={Maximize2} value={facts.size?.value ?? null} suffix={facts.size?.unit ?? "sqm"} />
      </div>

      <p
        className={`hidden sm:block text-[13px] font-bold tabular-nums w-36 text-right flex-shrink-0 ${
          price.known ? "text-[#0d1117]" : "text-[#9ca3af]"
        }`}
      >
        {price.text}
      </p>

      <div className="flex-shrink-0">
        <StatusBadge status={row.status} />
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Link
          href={actions.reelHref}
          title="Create a reel"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7c3aed] hover:bg-[#7c3aed]/10"
        >
          <Clapperboard className="w-3.5 h-3.5" />
        </Link>
        <button
          type="button"
          onClick={actions.onFlyer}
          title="Create a flyer"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#001f3f] hover:bg-[#001f3f]/[0.07]"
        >
          <FileImage className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={actions.onPoster}
          title="Just Listed/Sold"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#0e7490] hover:bg-[#0891b2]/10"
        >
          <Megaphone className="w-3.5 h-3.5" />
        </button>
        <RowMenu items={actions.menu} label={`More actions for ${row.title}`} />
      </div>
    </div>
  )
}

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

  const actionsFor = (row: AgentListing): CardActions => {
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

    return {
      reelHref: `${base}/reels-maker?listing=${row.id}`,
      onFlyer: () => setMarketing({ row, view: "flyer" }),
      onPoster: () => setMarketing({ row, view: "announce" }),
      menu,
    }
  }

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
      <div className="space-y-3 -m-6 p-6 bg-white min-h-[calc(100%+3rem)]">
        {/* Toolbar — search · sort · developer · clear/refresh · New Listing, one line */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className={`${SHELL} relative flex-1 min-w-[220px] h-[44px]`}>
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: ACCENT }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, location or project…"
              aria-label="Search listings"
              className="w-full h-full bg-transparent rounded-2xl pl-10 pr-9 text-[14px] text-[#344054] placeholder:text-[#98a2b3] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[#98a2b3] hover:text-[#344054] hover:bg-[#f2f5fa]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

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

            {/* Clear filters · refresh */}
            <div className={`${SHELL} h-[44px] flex items-center px-1 gap-0.5`}>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!filtersActive}
                aria-label="Clear all filters"
                title={filtersActive ? "Clear all filters" : "No filters applied"}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors enabled:hover:bg-[#f2f5fa] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <FilterX className="w-4 h-4" style={{ color: ACCENT }} />
              </button>
              <span className="w-px h-6 bg-[#e2e8f0]" aria-hidden />
              <button
                type="button"
                onClick={() => void refresh()}
                aria-label="Refresh listings"
                title="Refresh"
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[#f2f5fa]"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                  style={{ color: ACCENT }}
                />
              </button>
            </div>

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

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f1f3f6]">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Card view"
              className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all ${
                view === "grid" ? "bg-white text-[#001f3f] shadow-sm" : "text-[#9ca3af] hover:text-[#374151]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
              className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all ${
                view === "list" ? "bg-white text-[#001f3f] shadow-sm" : "text-[#9ca3af] hover:text-[#374151]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {visible.map((row) => (
              <ListingCard key={row.id} row={row} actions={actionsFor(row)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[#e6eaf1] bg-white shadow-sm overflow-hidden divide-y divide-[#f1f3f6]">
            {visible.map((row) => (
              <ListingRow key={row.id} row={row} actions={actionsFor(row)} />
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
