"use client"

// Shared presentation for the two listing pages:
//   • listings-client.tsx      — one agent's own listings (browser client + RLS)
//   • all-listings-client.tsx  — every agent's, admin (service-role API)
//
// Both render identical cards, rows, chips, badges and toolbar controls. They
// differ only in where the rows come from and which actions each row offers, so
// the action strip is a slot. Keeping the presentation here is what stops the
// two pages drifting apart.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import Image from "next/image"
import { createPortal } from "react-dom"
import {
  Bath,
  BedDouble,
  ChevronDown,
  FilterX,
  ImagePlus,
  Images,
  LayoutGrid,
  List,
  MapPin,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react"
import { TOOLBAR_GRADIENT } from "@/components/common/header-toolbar"
import { relativeTime } from "@/lib/utils"
import {
  type ListingFacts,
  coverImage,
  developerName,
  locationLabel,
  photoCount,
  priceLine,
  projectName,
  unitFacts,
  unitTypeLabel,
} from "./listing-card-facts"

export type ListingStatus = "draft" | "published" | "archived"

// ─── Tokens ───────────────────────────────────────────────────────────────────

// app/layout.tsx exposes Outfit as a CSS variable; the repo's usual
// `font-['Outfit']` names a family that was never registered, so it silently
// falls back. Referencing the variable is what actually applies the face.
export const DISPLAY = "font-[family-name:var(--font-outfit)]"

export const GOLD = "#d6b357"
/** Primary actions reuse the shared toolbar gradient from
 *  components/common/header-toolbar (top-to-bottom #0a3d6b → #001f3f) —
 *  imported rather than restated so the two can never drift apart. */
export const BRAND_GRADIENT = `${TOOLBAR_GRADIENT} text-white`
/** Toolbar icon + focus-ring colour, matching that same toolbar's deep navy. */
export const ACCENT = "#001f3f"
/** The toolbar's "floating white control" surface. */
export const SHELL =
  "bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.05)]"

/** The dashboard shell paints #f4f6f9 and pads its <main> by 6 (24px); this
 *  cancels that so a page can carry a white surface edge to edge.
 *  No `w-full` — that resolves to 100% of main's content box, which after -mx-6
 *  lands 24px short on the right and leaks grey; width:auto fills the containing
 *  block minus its margins. min-height needs the same +3rem vertically. */
export const WHITE_PAGE = "-m-6 p-6 bg-white min-h-[calc(100%+3rem)]"

/** Four cards across from xl, five at 2xl. Shared so COVER_SIZES stays truthful
 *  on both pages. */
export const LISTING_GRID =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"

/** Must track LISTING_GRID or next/image over-fetches. */
const COVER_SIZES =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 20vw"

/** agent_listings.status is CHECK-constrained to exactly these three — the schema
 *  has no pending / sold / leased / expired state. */
export const STATUS_META: Record<ListingStatus, { label: string; dot: string; text: string }> = {
  published: { label: "Published", dot: "bg-emerald-500", text: "text-emerald-700" },
  draft: { label: "Draft", dot: "bg-blue-500", text: "text-blue-700" },
  archived: { label: "Archived", dot: "bg-slate-400", text: "text-slate-600" },
}

// ─── Hydration-safe portal (no setState inside an effect) ─────────────────────

const noopSubscribe = () => () => {}
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function Portal({ children }: { children: ReactNode }) {
  if (!useHydrated()) return null
  return createPortal(children, document.body)
}

// ─── Toolbar select ───────────────────────────────────────────────────────────

/** Icon + label + chevron over a native <select>: keeps native keyboard and
 *  mobile behaviour while matching the pill look. */
export function ToolbarSelect({
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

// ─── Search field ─────────────────────────────────────────────────────────────

export function ToolbarSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className={`${SHELL} relative flex-1 min-w-[220px] h-[44px]`}>
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: ACCENT }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-full bg-transparent rounded-2xl pl-10 pr-9 text-[14px] text-[#344054] placeholder:text-[#98a2b3] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[#98a2b3] hover:text-[#344054] hover:bg-[#f2f5fa]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/** Clear-filters + refresh, paired in one shell like the toolbar's icon group. */
export function ToolbarActions({
  onClear,
  clearDisabled,
  onRefresh,
  refreshing,
}: {
  onClear: () => void
  clearDisabled: boolean
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <div className={`${SHELL} h-[44px] flex items-center px-1 gap-0.5`}>
      <button
        type="button"
        onClick={onClear}
        disabled={clearDisabled}
        aria-label="Clear all filters"
        title={clearDisabled ? "No filters applied" : "Clear all filters"}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors enabled:hover:bg-[#f2f5fa] disabled:opacity-35 disabled:cursor-not-allowed"
      >
        <FilterX className="w-4 h-4" style={{ color: ACCENT }} />
      </button>
      <span className="w-px h-6 bg-[#e2e8f0]" aria-hidden />
      <button
        type="button"
        onClick={onRefresh}
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
  )
}

/** Grid / list switch. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list"
  onChange: (view: "grid" | "list") => void
}) {
  const cls = (active: boolean) =>
    `w-8 h-7 rounded-lg flex items-center justify-center transition-all ${
      active ? "bg-white text-[#001f3f] shadow-sm" : "text-[#9ca3af] hover:text-[#374151]"
    }`
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f1f3f6]">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={view === "grid"}
        aria-label="Card view"
        className={cls(view === "grid")}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        aria-label="List view"
        className={cls(view === "list")}
      >
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

/** One chip in the filter row. Chips are grouped by axis (status / kind /
 *  property type) and separated by a hairline, because the axes AND together —
 *  a flat undivided row would read as mutually exclusive. */
export function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: ReactNode
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

export function ChipDivider() {
  return <span className="w-px h-5 bg-[#e3e7ed] mx-0.5 shrink-0" aria-hidden />
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export function KindBadge({ kind }: { kind: "sale" | "rent" }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide text-white shadow-sm"
      style={{ backgroundColor: kind === "sale" ? GOLD : "#2563eb" }}
    >
      {kind === "sale" ? "FOR SALE" : "FOR RENT"}
    </span>
  )
}

/** `deleted` wins over the status column: a soft-deleted listing is off the site
 *  whatever its status still says. */
export function StatusBadge({ status, deleted }: { status: ListingStatus; deleted?: boolean }) {
  const meta = deleted
    ? { label: "Deleted", dot: "bg-rose-500", text: "text-rose-600" }
    : STATUS_META[status]
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

export type MenuItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  destructive?: boolean
}

/** Portal-positioned row menu — flips above the trigger near the viewport edge. */
/**
 * Shown on the cover whenever a listing is featured — the at-a-glance answer to
 * "is this one featured?", without opening anything.
 */
export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#d6b357] text-[#3b2c05] text-[10px] font-bold shadow-sm">
      <Star className="w-3 h-3 fill-current" /> Featured
    </span>
  )
}

export function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
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

// ─── Card & row ───────────────────────────────────────────────────────────────

/** A dash, not a zero — beds/baths/size come from the developer's project unit
 *  line, so a standalone listing genuinely has none on file. */
export function Fact({
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

type ListingViewProps = {
  row: ListingFacts
  /** Soft-deleted (admin view only) — dims it and flips the status badge. */
  deleted?: boolean
  /** An extra line under the location, e.g. the owning agent on the admin page. */
  meta?: ReactNode
  /** The action strip. Each page supplies what it can actually offer. */
  footer: ReactNode
}

export function ListingCard({ row, deleted, meta, footer }: ListingViewProps) {
  const cover = coverImage(row)
  const loc = locationLabel(row)
  const price = priceLine(row)
  const facts = unitFacts(row)
  const photos = photoCount(row)
  const dev = developerName(row)
  const proj = projectName(row)
  const unitLabel = unitTypeLabel(row)

  return (
    <article
      className={`flex flex-col rounded-2xl bg-white border border-[#e6eaf1] shadow-sm hover:shadow-lg transition-shadow duration-300 ${
        deleted ? "opacity-60" : ""
      }`}
    >
      {/* Cover */}
      <div className="relative h-32 rounded-t-2xl overflow-hidden bg-[#eef1f5]">
        {cover ? (
          // next/image resizes on the fly — the S3 originals are 300–470KB each
          // and this box is ~250x128, so serving them raw was the biggest cost.
          <Image src={cover} alt="" fill sizes={COVER_SIZES} className="object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 text-[#b8bfc9]">
            <ImagePlus className="w-6 h-6" />
            <span className="text-[11px] font-semibold">No photo yet</span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          <KindBadge kind={row.listing_kind} />
          {row.is_featured && <FeaturedBadge />}
        </span>
        <span className="absolute top-2.5 right-2.5">
          <StatusBadge status={row.status} deleted={deleted} />
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

        {meta}

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
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-[#f1f3f6]">{footer}</div>
    </article>
  )
}

export function ListingRow({ row, deleted, meta, footer }: ListingViewProps) {
  const cover = coverImage(row)
  const loc = locationLabel(row)
  const price = priceLine(row)
  const facts = unitFacts(row)

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[#f8fafc] transition-colors ${
        deleted ? "opacity-60" : ""
      }`}
    >
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
          {row.is_featured && <FeaturedBadge />}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#6b7280] mt-0.5 min-w-0">
          <MapPin className="w-3 h-3 text-[#b6bcc6] flex-shrink-0" />
          <span className="truncate">{loc ?? "No location on file"}</span>
        </p>
        {meta}
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
        <StatusBadge status={row.status} deleted={deleted} />
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">{footer}</div>
    </div>
  )
}
