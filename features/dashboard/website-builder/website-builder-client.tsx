"use client"

// Website Builder — every section of the /website/sample template is editable
// through the form on the left while the right side shows the real template
// (the same section components) live-updating at a scaled 1440px virtual
// viewport. The form shows ONE section at a time (chip navigation at the top),
// Featured Projects/Listings are picked from real published data, and the
// agent's contact fields seed from their profile. The draft autosaves to
// localStorage; DB persistence comes later.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Film, GripVertical, ImagePlus, Loader2, LocateFixed, Plus, RotateCcw, Save, Search, Trash2, Upload, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { createClient } from "@/lib/supabase/client"
import { getDashboardRouteByRole } from "@/lib/auth"
import { STORY_BY_AGENT } from "@/lib/films"
import { capitalizeWords, decodeHeadline, encodeHeadline, tokenizeHeadline } from "@/lib/headline-highlight"
import { loadAgentWebsiteReviews, orderWebsiteReviews } from "@/lib/website-reviews"
import { compressImageForUpload } from "@/lib/upload/compress-image"
import { normalizeSocialUrl, readSocialLinks } from "@/lib/public-profile"
import {
  DEFAULT_THEME, GALLERY_CATEGORIES, HERO_STAT_ICON_FALLBACK, SAMPLE_DATA, STAT_ICONS, themeVars,
  type GalleryCategory, type Project, type StatIconKey, type Testimonial, type WebsiteData,
} from "@/app/website/_data"
import { SiteHeader } from "@/app/website/_components/header"
import { SiteFooter } from "@/app/website/_components/footer"
import { HeroSection } from "@/app/website/_components/sections/hero"
import { AboutSection } from "@/app/website/_components/sections/about"
import { FeaturedSection } from "@/app/website/_components/sections/featured"
import { BLANK_ABOUT, BLANK_AGENT, BLANK_HERO, agentSiteMissing, sanitizeAgentCredentials } from "@/lib/agent-site"
import { ServiceAreasSection } from "@/app/website/_components/sections/service-areas"
import { GallerySection } from "@/app/website/_components/sections/gallery"
import { TestimonialsSection } from "@/app/website/_components/sections/what-my-clients-say"

// Drafts are PER ACCOUNT: the key carries the user id, so two agents sharing
// a browser (or one person switching accounts) never see — or save over each
// other with — the other's unsaved edits. v1 was a single fixed key, which did
// exactly that; it is removed on first load.
const LEGACY_DRAFT_KEY = "fhi:website-builder:draft:v1"
const draftKey = (userId: string) => `fhi:website-builder:draft:v2:${userId}`
/** Set once a browser's draft has dropped the service areas cleared on 2026-11-09. */
const AREAS_RESET_KEY = (userId: string) => `fhi:website-builder:areas-reset-2026-11-09:${userId}`
const VIRTUAL_WIDTH = 1440
const MAX_FEATURED = 12

// ─── Draft persistence + profile seeding ─────────────────────────────────────

function loadDraft(key: string): WebsiteData | null {
  try {
    localStorage.removeItem(LEGACY_DRAFT_KEY)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WebsiteData
    // Newly added fields fall back to the sample so old drafts never render holes.
    return {
      ...structuredClone(SAMPLE_DATA),
      ...parsed,
      // Over a BLANK agent, never the sample: an old draft that lacks a key must not
      // inherit the sample's phone/e-mail or its "BRN: 123456 / ORN: 98765".
      agent: sanitizeAgentCredentials({ ...BLANK_AGENT, ...parsed.agent }),
      // Hero and about over BLANK too: an old draft missing a key must never regain the sample's bio, portrait or headline.
      hero: { ...structuredClone(BLANK_HERO), ...parsed.hero },
      about: { ...structuredClone(BLANK_ABOUT), ...parsed.about },
      cta: { ...SAMPLE_DATA.cta, ...parsed.cta },
      gallery: { ...structuredClone(SAMPLE_DATA.gallery), ...parsed.gallery },
    }
  } catch {
    return null
  }
}

type ProfileSeed = {
  name: string
  phone: string
  whatsapp: string
  email: string
  facebook: string
  instagram: string
  linkedin: string
  youtube: string
}

/** Sample data with the agent's own contact details + socials dropped in. */
function seededSample(seed: ProfileSeed): WebsiteData {
  const d = structuredClone(SAMPLE_DATA)
  if (seed.name) d.agent.name = seed.name
  if (seed.phone) d.agent.phone = seed.phone
  if (seed.whatsapp) d.agent.whatsapp = seed.whatsapp
  if (seed.email) d.agent.email = seed.email
  d.about.socials = {
    facebook: seed.facebook,
    instagram: seed.instagram,
    linkedin: seed.linkedin,
    youtube: seed.youtube,
  }
  return d
}

/** A blank site for first-time builders: no placeholder content anywhere, so
 *  nothing fake needs clearing — only the profile-seeded contacts, socials
 *  survive. (The sample content stays viewable at /website/sample.) */
function emptySite(seed: ProfileSeed): WebsiteData {
  const d = seededSample(seed)
  // Blank, then only what the profile supplies: the sample's phone, e-mail and
  // "Business Bay" office must not survive when the profile lacks them — they
  // were saved onto live sites that way.
  d.agent = { ...BLANK_AGENT, name: seed.name, phone: seed.phone, whatsapp: seed.whatsapp, email: seed.email }
  d.hero = { headline: "", headlineAccent: "", description: "", image: "", overlay: 0, stats: [] }
  d.about = { ...d.about, heading: "", bio: "", portrait: "", views: "", listings: "", rating: "" }
  d.projects = []
  d.properties = []
  d.bandStats = []
  d.areas = []
  d.gallery = { "Event Photos": [], Certificates: [], "Awards & Recognition": [] }
  d.testimonials = []
  d.cta = { heading: "", sub: "" }
  return d
}

/** Profile values fill in any EMPTY social field of an existing draft — a
 *  draft saved before seeding existed shouldn't pin the socials to "". */
function seedEmptySocials(d: WebsiteData, seed: ProfileSeed): WebsiteData {
  const s = d.about.socials
  if (!s.facebook && seed.facebook) s.facebook = seed.facebook
  if (!s.instagram && seed.instagram) s.instagram = seed.instagram
  if (!s.linkedin && seed.linkedin) s.linkedin = seed.linkedin
  if (!s.youtube && seed.youtube) s.youtube = seed.youtube
  return d
}

// Mounted flag without a set-state-in-effect: server snapshot is false, the
// client snapshot is true, so the editor body only renders after hydration
// (the draft comes from localStorage, which the server can't see).
const subscribeNoop = () => () => {}
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false)
}

// ─── Small form primitives ────────────────────────────────────────────────────

function Field({
  label, action, hint, help, helpAlign = "left", invalid = false, children,
}: {
  label: React.ReactNode
  action?: React.ReactNode
  hint?: string
  /** Explanation shown in a "?" tooltip after the label (instead of text under the field). */
  help?: string
  helpAlign?: "left" | "right"
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
          {label}
          {help && <HelpTip text={help} align={helpAlign} />}
        </span>
        {action}
      </span>
      {children}
      {hint && <span className={`mt-1 block text-[11px] leading-snug ${invalid ? "text-[#b42318]" : "text-[#9ca3af]"}`}>{hint}</span>}
    </label>
  )
}

/** One review in the builder's Reviews tab: a show/hide tick, the quote and who wrote it, plus `children` (order controls). */
function ReviewRowCard({
  review, shown, onToggle, children,
}: { review: Testimonial; shown: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 border p-3 ${shown ? "border-[#e2e6ea] bg-white" : "border-dashed border-[#e2e6ea] bg-[#fafbfc] opacity-75"}`}>
      <input
        type="checkbox"
        checked={shown}
        onChange={onToggle}
        aria-label={shown ? `Hide ${review.name}'s review` : `Show ${review.name}'s review`}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#001f3f]"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-[12.5px] leading-relaxed text-[#374151]">&ldquo;{review.quote}&rdquo;</p>
        <p className="mt-1.5 text-[11.5px] font-bold text-[#0d1117]">
          {review.name} <span className="font-medium text-[#9aa0aa]">— {review.where}</span>
        </p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </div>
  )
}

/** A "?" in a circle; hovering (or focusing) it shows `text` in a dark tooltip. */
function HelpTip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  return (
    <span
      tabIndex={0}
      aria-label={text}
      // Inside a <label>: a click here mustn't move focus to the field.
      onClick={(e) => e.preventDefault()}
      className="group relative inline-flex cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#001f3f]/30"
    >
      <CircleHelp className="h-3.5 w-3.5 text-[#9aa0aa] transition-colors group-hover:text-[#001f3f]" aria-hidden />
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-2 w-60 rounded-md bg-[#0d1117] px-3 py-2 text-[11.5px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
          align === "right" ? "right-0" : "-left-2"
        }`}
      >
        {text}
      </span>
    </span>
  )
}

const INPUT_CLS =
  "w-full border border-[#e2e6ea] bg-white px-3 py-2 text-[13px] text-[#0d1117] outline-none transition-colors focus:border-[#001f3f]"

function TInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />
}

/** A phone number the builder shows but doesn't edit: its country code box, then the number. */
function ReadOnlyPhone({ code, number }: { code: string; number: string }) {
  return (
    <div className="flex" aria-readonly="true">
      <div className="flex min-h-[36px] shrink-0 items-center border border-r-0 border-[#e2e6ea] bg-[#f9fafb] px-2.5 text-[13px] text-[#4b5563]">
        {code || "+—"}
      </div>
      <div className="flex min-h-[36px] min-w-0 flex-1 cursor-not-allowed items-center truncate border border-[#e2e6ea] bg-[#f9fafb] px-3 text-[13px] text-[#4b5563]">
        {number || <span className="text-[#9ca3af]">—</span>}
      </div>
    </div>
  )
}

/** A value the builder shows but doesn't edit (it comes from elsewhere). */
function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="w-full min-h-[36px] cursor-not-allowed border border-[#e2e6ea] bg-[#f9fafb] px-3 py-2 text-[13px] text-[#4b5563]" aria-readonly="true">
      {value || <span className="text-[#9ca3af]">—</span>}
    </div>
  )
}

function TArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLS} resize-y`} />
}

/** Compress one picked image and upload it for the Website Builder; returns its URL. */
async function uploadBuilderImage(file: File): Promise<string> {
  const { file: toUpload } = await compressImageForUpload(file)
  const fd = new FormData()
  fd.append("file", toUpload)
  const res = await fetch("/api/upload/website-builder", { method: "POST", body: fd })
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !json.url) throw new Error(json.error || "Upload failed")
  return json.url
}

/** Image field: thumbnail + URL input + S3 upload button. `middle` replaces the URL input (e.g. Service Areas puts the area name there). */
function ImageInput({ value, onChange, middle }: { value: string; onChange: (v: string) => void; middle?: React.ReactNode }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      onChange(await uploadBuilderImage(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden border border-[#e2e6ea] bg-[#f4f6f9]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4 text-[#9aa0aa]" />
          )}
        </span>
        {middle ?? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Image URL"
            className={INPUT_CLS}
          />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          // Navy, square corners, white upload arrow + bold label (the builder's primary-button look).
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-4 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={2.25} />}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  )
}

/** Up/down arrows for reordering a list item (the saved rank is the array
 *  position). Each arrow disables at its end of the list. */
function MoveButtons({ index, count, onMove }: { index: number; count: number; onMove: (dir: -1 | 1) => void }) {
  const btn = "flex h-6 w-6 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-[#eef0f3] hover:text-[#0d1117] disabled:pointer-events-none disabled:opacity-30"
  return (
    <>
      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className={btn}>
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className={btn}>
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </>
  )
}

/** Numbered card wrapper for one item of a list, with move + remove buttons. */
function ItemCard({
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className=" border border-[#e8eaed] bg-[#fafbfc] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#9aa0aa]">#{index + 1}</span>
        <div className="flex items-center gap-0.5">
          <MoveButtons index={index} count={count} onMove={onMove} />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

/** Swap arr[i] with its neighbor in place — the update() clone makes it safe. */
function swap<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

/** Flat grid of the STAT_ICONS registry — the selected key is navy. */
/** The area name's size on its tile: shorter names larger, longer ones smaller (two lines max). */
function areaNameSize(name: string): number {
  const n = name.trim().length
  if (n <= 10) return 13
  if (n <= 16) return 12
  if (n <= 22) return 11
  if (n <= 30) return 10
  return 9
}

/**
 * A Service Areas tile's name: a dark band two lines tall in the middle of the photo, the text
 * centred across AND down it. A textarea can't centre its text vertically, so it is one line tall
 * and grows to fit (up to two lines) inside the band, which centres it. Enter adds no line break.
 */
function AreaNameBox({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fontSize = areaNameSize(value)
  // Fit the textarea to its text after every change (and when the size steps).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value, fontSize])
  return (
    <div
      className="absolute left-1.5 right-1.5 top-1/2 flex -translate-y-1/2 items-center border border-white/30 bg-black/45 px-1 focus-within:border-white"
      style={{ height: Math.round(fontSize * 1.25 * 2 + 10) }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder="Area name"
        aria-label={label}
        style={{ fontSize }}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
        // Title case as typed: each word starts with a capital ("dubai marina" → "Dubai Marina"; "JVC" stays).
        onChange={(e) => onChange(capitalizeWords(e.target.value.replace(/\s*\n\s*/g, " ")))}
        className="block max-h-full w-full resize-none overflow-hidden bg-transparent p-0 text-center font-bold leading-tight text-white outline-none placeholder:text-white/60"
      />
    </div>
  )
}

/** One button showing the chosen icon; clicking it drops down every icon to pick from. */
function IconPicker({ value, onChange }: { value: StatIconKey; onChange: (k: StatIconKey) => void }) {
  const [open, setOpen] = useState(false)
  const Current = STAT_ICONS[value]
  return (
    <div
      className="relative shrink-0"
      // Closes when focus leaves the button and its list.
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false) }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Icon: ${value}`}
        title={value}
        className="flex h-full min-h-[36px] items-center gap-1 border border-[#e2e6ea] bg-white px-2 text-[#001f3f] transition-colors hover:border-[#9aa0aa]"
      >
        <Current className="h-4 w-4" />
        <ChevronDown className={`h-3 w-3 text-[#9aa0aa] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-30 mt-1 grid w-[232px] grid-cols-6 gap-1 border border-[#e2e6ea] bg-white p-1.5 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]">
          {(Object.keys(STAT_ICONS) as StatIconKey[]).map((k) => {
            const Icon = STAT_ICONS[k]
            const selected = value === k
            return (
              <button
                key={k}
                type="button"
                role="option"
                aria-selected={selected}
                title={k}
                aria-label={k}
                onClick={() => { onChange(k); setOpen(false) }}
                className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                  selected
                    ? "border-[#001f3f] bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white"
                    : "border-transparent text-[#5b6472] hover:border-[#9aa0aa]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Featured picker (projects + listings share the shape) ───────────────────

type PickerItem = { sourceId: string; image: string; title: string; sub: string }

/** "Show all projects" lists this many per page. */
const PICKER_PAGE_SIZE = 20

function FeaturedPicker({
  items,
  loading,
  loadError,
  selectedIds,
  onToggle,
  emptyText,
  noun = "projects",
  trailing,
}: {
  items: PickerItem[]
  loading: boolean
  loadError: string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  emptyText: string
  /** What the list holds, for the search wording ("projects", "areas"). */
  noun?: string
  /** A control on the search row, right after the box (Service Areas: "Add area"). */
  trailing?: React.ReactNode
}) {
  const [q, setQ] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [page, setPage] = useState(0)
  const needle = q.trim().toLowerCase()
  const filtered = needle ? items.filter((i) => `${i.title} ${i.sub}`.toLowerCase().includes(needle)) : []
  // "Show all": the whole list, PICKER_PAGE_SIZE at a time; hidden by default and while searching.
  const pages = Math.max(1, Math.ceil(items.length / PICKER_PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const pageItems = items.slice(current * PICKER_PAGE_SIZE, (current + 1) * PICKER_PAGE_SIZE)

  const row = (item: PickerItem, inDropdown = false) => {
    const selected = selectedIds.has(item.sourceId)
    return (
      <button
        key={item.sourceId}
        type="button"
        // In the dropdown: pick on mousedown so the input keeps focus and the list stays open.
        onMouseDown={inDropdown ? (e) => e.preventDefault() : undefined}
        onClick={() => onToggle(item.sourceId)}
        className={`flex w-full items-center gap-2.5 border p-2 text-left transition-colors ${
          selected ? "border-[#001f3f] bg-[#eef3f9]" : "border-transparent bg-white hover:border-[#d8dde3]"
        }`}
      >
        <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden bg-[#eceff3]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5 text-[#9aa0aa]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-[#0d1117]">{item.title}</span>
          <span className="block truncate text-[11px] text-[#9aa0aa]">{item.sub}</span>
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
            selected ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#c8ccd2] text-transparent"
          }`}
        >
          <Check className="h-3 w-3" />
        </span>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center border border-[#e8eaed] bg-[#fafbfc] py-6">
        <Loader2 className="h-4 w-4 animate-spin text-[#9aa0aa]" />
      </div>
    )
  }
  if (loadError) {
    return <p className="border border-[#e8eaed] bg-[#fafbfc] px-2 py-4 text-center text-[12px] font-semibold text-red-600">{loadError}</p>
  }
  if (items.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="border border-[#e8eaed] bg-[#fafbfc] px-2 py-4 text-center text-[12px] text-[#9aa0aa]">{emptyText}</p>
        {trailing}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Search: results drop down under the box; nothing else is listed while searching. */}
      <div className="flex items-stretch gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa0aa]" />
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setSearchOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setSearchOpen(false) } }}
          placeholder={`Search ${noun}…`}
          className={`${INPUT_CLS} pl-8 ${q ? "pr-8" : "pr-32"}`}
        />
        {/* Right side of the box: "Show all" when empty, a clear ✕ while searching. */}
        {!q && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#f4f6f9] px-2 py-1 text-[11px] font-bold text-[#001f3f] transition-colors hover:bg-[#e8ecf1]"
          >
            {showAll ? "Hide all" : `Show all (${items.length})`}
          </button>
        )}
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-[#9aa0aa] hover:text-[#0d1117]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {needle && searchOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 space-y-1.5 overflow-y-auto border border-[#e2e6ea] bg-white p-1.5 shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] text-[#9aa0aa]">Nothing matches “{q.trim()}”.</p>
            ) : (
              filtered.map((item) => row(item, true))
            )}
          </div>
        )}
      </div>
      {trailing && <div className="flex shrink-0 whitespace-nowrap">{trailing}</div>}
      </div>

      {!needle && (
        <>
          {showAll && (
            <div className="border border-[#e8eaed] bg-[#fafbfc] p-1.5">
              <div className="space-y-1.5">{pageItems.map((item) => row(item))}</div>
              {pages > 1 && (
                <div className="mt-2 flex items-center justify-between px-1 pb-0.5">
                  <button
                    type="button"
                    onClick={() => setPage(current - 1)}
                    disabled={current === 0}
                    className="border border-[#e2e6ea] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-[11.5px] text-[#6b7280]">
                    {current * PICKER_PAGE_SIZE + 1}–{Math.min(items.length, (current + 1) * PICKER_PAGE_SIZE)} of {items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pages - 1}
                    className="border border-[#e2e6ea] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Live preview ─────────────────────────────────────────────────────────────

/** A scroll request: the template anchor id plus a counter so re-clicking the
 *  same section still scrolls. */
export type PreviewTarget = { id: string; n: number }

/** Template anchors in page order — used by the scroll spy. */
const SPY_ANCHORS = ["home", "about", "projects", "properties", "stats", "areas", "gallery", "reviews", "contact"] as const

function LivePreview({
  data,
  reviews,
  target,
  onSectionInView,
}: {
  data: WebsiteData
  /** The agent's approved client reviews — none hides the section, as on the live site. */
  reviews: Testimonial[]
  target: PreviewTarget | null
  /** Fires with the anchor id of the section currently at the top of the preview. */
  onSectionInView?: (anchor: string) => void
}) {
  const [outerEl, setOuterEl] = useState<HTMLDivElement | null>(null)
  const [innerEl, setInnerEl] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)
  const [innerH, setInnerH] = useState(5000)

  // Scroll the preview to the section that's being edited. Rect math is in
  // post-transform (scaled) coordinates, so no manual scale factor needed.
  useEffect(() => {
    if (!target || !outerEl || !innerEl) return
    const el = innerEl.querySelector(`#${target.id}`)
    if (!el) return
    const top = el.getBoundingClientRect().top - outerEl.getBoundingClientRect().top + outerEl.scrollTop
    outerEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    // outerEl/innerEl are stable refs; only a new click should re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  useEffect(() => {
    if (!outerEl) return
    const ro = new ResizeObserver(() => {
      if (outerEl.clientWidth > 0) setScale(outerEl.clientWidth / VIRTUAL_WIDTH)
    })
    ro.observe(outerEl)
    return () => ro.disconnect()
  }, [outerEl])

  useEffect(() => {
    if (!innerEl) return
    const ro = new ResizeObserver(() => {
      if (innerEl.offsetHeight > 0) setInnerH(innerEl.offsetHeight)
    })
    ro.observe(innerEl)
    return () => ro.disconnect()
  }, [innerEl])

  // Scroll spy — report which section is at the top of the preview so the
  // form can follow along. Rect math is post-transform, so scale-safe.
  useEffect(() => {
    if (!outerEl || !innerEl || !onSectionInView) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const outerTop = outerEl.getBoundingClientRect().top
        let current: string = SPY_ANCHORS[0]
        for (const id of SPY_ANCHORS) {
          const el = innerEl.querySelector(`#${id}`)
          if (el && el.getBoundingClientRect().top - outerTop <= 140) current = id
        }
        onSectionInView(current)
      })
    }
    outerEl.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      outerEl.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [outerEl, innerEl, onSectionInView])

  return (
    <div ref={setOuterEl} className="h-full overflow-y-auto overflow-x-hidden bg-[#dfe4ea]">
      <div style={{ height: innerH * scale }} className="relative">
        <div ref={setInnerEl} style={{ width: VIRTUAL_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left", ...themeVars(data.theme) }}>
          <SiteHeader sticky={false} data={data} showReviews={reviews.length > 0} />
          <HeroSection data={data} />
          <AboutSection data={data} />
          {/* Listings and the stats band are off for now — projects only (as on the live site). */}
          <FeaturedSection data={{ ...data, properties: [] }} />
          <ServiceAreasSection data={data} />
          <GallerySection data={data} />
          <TestimonialsSection testimonials={reviews} />
          <SiteFooter data={data} />
        </div>
      </div>
    </div>
  )
}

// ─── Section navigation ───────────────────────────────────────────────────────

// Hero first — the tab the builder opens on (boss, 2026-11-09).
// Listings and the stats band are off for now (boss, 2026-11-09): projects only,
// and stats only in the hero. Saved listings / band stats stay in the database.
const FORM_SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "gallery", label: "Gallery" },
  { id: "palette", label: "Palette" },
  { id: "areas", label: "Areas" },
  { id: "reviews", label: "Reviews" },
  { id: "agent", label: "Info" },
] as const

type FormSectionId = (typeof FORM_SECTIONS)[number]["id"]

/** Which template anchor each form section corresponds to in the preview. */
const SECTION_ANCHORS: Record<FormSectionId, string> = {
  palette: "home",
  agent: "home",
  hero: "home",
  about: "about",
  projects: "projects",
  areas: "areas",
  gallery: "gallery",
  reviews: "reviews",
}

/** Curated palette suggestions — accent (gold family) + primary (dark family).
 *  The first is the default design; picking it clears the stored theme. */
const PALETTE_PRESETS: { name: string; gold: string; brand: string; isDefault?: boolean }[] = [
  { name: "Classic Gold", gold: DEFAULT_THEME.gold, brand: DEFAULT_THEME.brand, isDefault: true },
  { name: "Royal Emerald", gold: "#3fae8a", brand: "#0b3d2e" },
  { name: "Burgundy Luxe", gold: "#d9a441", brand: "#3d0c11" },
  { name: "Ocean Sapphire", gold: "#6fb7e9", brand: "#0a2540" },
  { name: "Copper Slate", gold: "#c47f4a", brand: "#232b36" },
  { name: "Onyx Silver", gold: "#b9c2cf", brand: "#101418" },
  { name: "Violet Night", gold: "#b79bd6", brand: "#241a3d" },
  { name: "Desert Rose", gold: "#d98c8c", brand: "#402a32" },
  { name: "Champagne Noir", gold: "#e2c992", brand: "#171512" },
  { name: "Forest Brass", gold: "#c9b458", brand: "#1e2d24" },
  { name: "Crimson Steel", gold: "#e07a5f", brand: "#1d2430" },
  { name: "Teal Sand", gold: "#e0c9a6", brand: "#0f3a3f" },
  { name: "Midnight Mint", gold: "#8fd6bd", brand: "#101f33" },
  { name: "Espresso Cream", gold: "#d6b98c", brand: "#2b1d16" },
  { name: "Arctic Ice", gold: "#a8d3e6", brand: "#12232e" },
  { name: "Imperial Purple", gold: "#d4af37", brand: "#301934" },
  { name: "Graphite Lime", gold: "#b6c649", brand: "#1c1f1a" },
  { name: "Terracotta Dusk", gold: "#cc7a52", brand: "#33272b" },
  { name: "Deep Sea Coral", gold: "#f0937b", brand: "#082a3a" },
  { name: "Platinum Navy", gold: "#cfd8e3", brand: "#001a33" },
]

// ─── Editor ───────────────────────────────────────────────────────────────────

export function WebsiteBuilderClient() {
  const mounted = useMounted()
  const { user, profile, role } = useAuth()

  // Contact fields + socials seed from the logged-in profile (still fully
  // editable). Socials come from the digital-business-card links
  // (metadata.socials), falling back to the profile tab's facebook/linkedin
  // fields; bare handles are normalized to full https URLs.
  const meta = (profile?.metadata ?? {}) as Record<string, unknown>
  const socials = readSocialLinks(profile?.metadata ?? null)
  const socialUrl = (platform: "facebook" | "instagram" | "linkedin" | "tiktok", fallback?: unknown) => {
    const raw = socials[platform] ?? (typeof fallback === "string" ? fallback : "")
    return raw ? normalizeSocialUrl(platform, raw) ?? "" : ""
  }
  const seed: ProfileSeed = {
    name: profile?.fullname ?? "",
    phone: typeof meta.phone_number === "string" ? meta.phone_number : "",
    whatsapp: typeof meta.whatsapp_number === "string" ? meta.whatsapp_number : "",
    email: user?.email ?? "",
    facebook: socialUrl("facebook", meta.facebook),
    instagram: socialUrl("instagram"),
    linkedin: socialUrl("linkedin", meta.linkedin),
    // No YouTube field exists on the profile yet — stays manual.
    youtube: "",
  }

  // The editor's content. Starts empty; the load effect below fills it from
  // THIS account's local draft (unsaved edits win) or, failing that, the saved
  // site in the DB — both need the user id, which is not known at first render.
  const [data, setData] = useState<WebsiteData>(() => emptySite(seed))
  // Autosave must not run until that load has happened, or the empty initial
  // state would overwrite the very draft we are about to read.
  const [draftReady, setDraftReady] = useState(false)
  // Country codes shown before the read-only Phone / WhatsApp (from profile settings).
  const [contactCodes, setContactCodes] = useState({ phone: "", whatsapp: "" })
  const userId = user?.id ?? null
  // The agent's own film from fhiglobal.ae/agents ("My story"), if FHI made one.
  const myStory = userId ? STORY_BY_AGENT[userId] ?? null : null
  // The preview plays what the site will: a blank Featured video link falls back to My story.
  const previewData = myStory && !(data.hero.video ?? "").trim() ? { ...data, hero: { ...data.hero, video: myStory.hd } } : data

  // Hero title: the words and which are highlighted (old sites' separate accent included).
  const titleWords = decodeHeadline(data.hero.headline, data.hero.headlineAccent)
  const setTitleText = (text: string) => {
    const tokens = tokenizeHeadline(text)
    // A word keeps its highlight while it stays the same word in the same place.
    const kept = new Set([...titleWords.highlighted].filter((i) => tokens[i] === titleWords.tokens[i]))
    update((d) => { d.hero.headline = encodeHeadline(tokens, kept); d.hero.headlineAccent = "" })
  }
  const toggleTitleWord = (i: number) => {
    const next = new Set(titleWords.highlighted)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    update((d) => { d.hero.headline = encodeHeadline(titleWords.tokens, next); d.hero.headlineAccent = "" })
  }
  // This account's approved client reviews (lib/website-reviews.ts), shown
  // exactly as the live site shows them; RLS limits the read to own rows.
  const [reviews, setReviews] = useState<Testimonial[]>([])
  useEffect(() => {
    if (!userId) return
    let live = true
    void loadAgentWebsiteReviews(createClient(), userId).then((r) => { if (live) setReviews(r) })
    return () => { live = false }
  }, [userId])

  // Reviews: which approved ones the site shows, in order (data.reviewIds; null = all, newest first).
  const shownReviews = orderWebsiteReviews(reviews, data.reviewIds)
  const hiddenReviews = reviews.filter((r) => !shownReviews.includes(r))
  const shownIds = () => shownReviews.map((r) => r.id).filter((id): id is string => Boolean(id))
  const toggleReview = (id: string | undefined) => {
    if (!id) return
    const ids = shownIds()
    update((d) => { d.reviewIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  }
  const moveReview = (i: number, dir: -1 | 1) => {
    const ids = shownIds()
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    update((d) => { d.reviewIds = ids })
  }
  const [activeSection, setActiveSection] = useState<FormSectionId>("hero")
  const [activeGalleryCat, setActiveGalleryCat] = useState<GalleryCategory>("Event Photos")
  // Selected projects: the row being dragged and the row it's over (drag to reorder).
  const [dragProject, setDragProject] = useState<number | null>(null)
  const [dropProject, setDropProject] = useState<number | null>(null)
  // Gallery: the picture being dragged / dragged over, and the multi-picture upload.
  const [dragGallery, setDragGallery] = useState<number | null>(null)
  const [dropGallery, setDropGallery] = useState<number | null>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  // Service Areas: drag to reorder, and "Add area" = upload photos.
  const [dragArea, setDragArea] = useState<number | null>(null)
  const [dropArea, setDropArea] = useState<number | null>(null)
  const areaFileRef = useRef<HTMLInputElement>(null)
  const [areaUploading, setAreaUploading] = useState(false)
  const [areaError, setAreaError] = useState<string | null>(null)
  const [addingArea, setAddingArea] = useState(false)
  const [newAreaName, setNewAreaName] = useState("")
  const [galleryUploading, setGalleryUploading] = useState(0)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  // While a tab click smooth-scrolls the preview, the scroll spy would fire on
  // every intermediate section — suppress it until the animation settles.
  const spySuppressed = useRef(false)

  // The form's scroll box: a new tab starts at its top (Prev / Next sit at the bottom).
  const formScrollRef = useRef<HTMLDivElement>(null)
  // Which section the live preview shows (kept by handleSectionInView below).
  const [previewAnchor, setPreviewAnchor] = useState<string | null>("home")
  // Changing tab only changes the form; the preview stays where it is (boss, 2026-11-09).
  const openSection = (id: FormSectionId) => {
    setActiveSection(id)
    formScrollRef.current?.scrollTo({ top: 0 })
  }
  /** The button next to Discard changes: scroll the preview to the section being edited. */
  const showInPreview = (id: FormSectionId) => {
    spySuppressed.current = true
    setPreviewAnchor(SECTION_ANCHORS[id])
    setPreviewTarget((t) => ({ id: SECTION_ANCHORS[id], n: (t?.n ?? 0) + 1 }))
  }

  useEffect(() => {
    if (!previewTarget) return
    const t = setTimeout(() => {
      spySuppressed.current = false
    }, 1200)
    return () => clearTimeout(t)
  }, [previewTarget])

  // Scroll spy: scrolling the preview follows along in the form. The agent tab
  // shares the hero anchor, so don't fight the user while they're on it.
  // Scrolling the preview never switches the form, and switching tabs never moves the preview: the
  // button next to Discard changes brings the preview to the section being edited. This remembers which
  // section the preview shows (previewAnchor, above), so that button greys out when it's already there.
  const handleSectionInView = useCallback((anchor: string) => {
    if (spySuppressed.current) return
    setPreviewAnchor(anchor)
  }, [])

  // Published-site state (migration 035): the slug is minted on first save.
  const [siteSlug, setSiteSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Whether the SAVED site is offered to search engines (the server's verdict on the last
  // load/save); null until known. The line in the footer compares it with the live draft.
  const [savedComplete, setSavedComplete] = useState<boolean | null>(null)

  useEffect(() => {
    if (!mounted || !userId) return
    let alive = true
    // This account's unsaved draft on this browser beats the DB copy (it is
    // newer by definition — it only exists between an edit and a Save).
    const draft = loadDraft(draftKey(userId))
    // RERA BRN / ORN / brokerage: always the profile's (read-only here), applied
    // over the saved site or the local draft alike.
    let credentials: Pick<WebsiteData["agent"], "brn" | "orn" | "brokerage"> | null = null
    let savedAreas: WebsiteData["areas"] | null = null
    let contact: { phone: string; whatsapp: string; phoneCode: string; whatsappCode: string; email: string } | null = null
    fetch("/api/website-builder/site")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive || !ok) return
        const site = j as {
          exists?: boolean
          slug?: string
          data?: WebsiteData
          complete?: boolean
          credentials?: Pick<WebsiteData["agent"], "brn" | "orn" | "brokerage">
        }
        credentials = site.credentials ?? null
        contact = (j as { contact?: typeof contact }).contact ?? null
        savedAreas = site.data?.areas ?? []
        if (!site.exists || !site.slug || !site.data) return
        setSiteSlug(site.slug)
        setSavedComplete(site.complete === true)
        if (!draft) setData(site.data)
      })
      .catch(() => {
        // No saved site / table not migrated yet — the editor stays local-only.
      })
      .finally(() => {
        if (!alive) return
        // Applied here (async), not synchronously in the effect body, so the
        // draft shows whether or not the DB read succeeded.
        if (draft) {
          // Service areas were cleared on 2026-11-09: a draft from before then still holds the
          // old ones (and saving it would put them back). Once per browser, its areas give way
          // to the saved site's — or to none when the read failed.
          let areasReset = true
          try { areasReset = localStorage.getItem(AREAS_RESET_KEY(userId)) === "1" } catch { /* storage blocked */ }
          const next = seedEmptySocials(draft, seed)
          if (!areasReset) {
            next.areas = savedAreas ?? []
            try { localStorage.setItem(AREAS_RESET_KEY(userId), "1") } catch { /* storage blocked */ }
          }
          setData(next)
        } else {
          // No draft to fix: mark it done, so a draft made from here on keeps its areas.
          try { localStorage.setItem(AREAS_RESET_KEY(userId), "1") } catch { /* storage blocked */ }
        }
        const c = credentials
        if (c) setData((d) => ({ ...d, agent: { ...d.agent, ...c } }))
        // Phone + WhatsApp from profile settings, over the saved site or the draft alike.
        const k = contact
        if (k) {
          setData((d) => ({ ...d, agent: { ...d.agent, phone: k.phone, whatsapp: k.whatsapp, email: k.email } }))
          setContactCodes({ phone: k.phoneCode, whatsapp: k.whatsappCode })
        }
        // No Featured video link yet → fill in the agent's My story film (the site's default anyway).
        const story = STORY_BY_AGENT[userId]
        if (story) setData((d) => ((d.hero.video ?? "").trim() ? d : { ...d, hero: { ...d.hero, video: story.hd } }))
        setDraftReady(true)
      })
    return () => {
      alive = false
    }
    // `seed` is derived from the profile each render; the draft is seeded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, userId])

  // What the draft still lacks before search engines are offered the site — live, as the agent types.
  const listingMissing = agentSiteMissing({ name: data.agent.name, bio: data.about.bio, portrait: data.about.portrait })

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch("/api/website-builder/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json().catch(() => ({}))) as { slug?: string; error?: string; complete?: boolean }
      if (!res.ok || !json.slug) throw new Error(json.error || "Failed to save")
      setSiteSlug(json.slug)
      setSavedComplete(json.complete === true)
      // Saved = the DB is now the truth; drop the draft so a stale copy can't
      // shadow the live site on the next visit. Autosave re-creates it on the
      // next edit.
      if (userId) localStorage.removeItem(draftKey(userId))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // Picker data — real published projects (listings are off for now).
  const [projectOptions, setProjectOptions] = useState<Project[] | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  // Shared service-area catalog — typing an existing name reuses its row/photo.
  const [areaOptions, setAreaOptions] = useState<{ name: string; photo: string }[]>([])

  useEffect(() => {
    if (!mounted) return
    let alive = true
    fetch("/api/website-builder/projects")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return
        if (!ok) throw new Error((j as { error?: string }).error || "Failed to load projects")
        setProjectOptions(((j as { projects?: Project[] }).projects ?? []))
      })
      .catch((e) => {
        if (alive) setProjectsError(e instanceof Error ? e.message : "Failed to load projects")
      })
    fetch("/api/website-builder/areas")
      .then((r) => (r.ok ? r.json() : { areas: [] }))
      .then((j) => {
        if (alive) setAreaOptions(((j as { areas?: { name: string; photo: string }[] }).areas ?? []))
      })
      .catch(() => {
        // Catalog unavailable — the field still works as free text.
      })
    return () => {
      alive = false
    }
  }, [mounted])

  // Debounced localStorage autosave, per account. Skips the initial load
  // (draftReady) and the first data value it produced — only real edits
  // after that create a draft, so merely opening the builder never leaves a
  // draft that would later shadow the saved site.
  const loadedData = useRef<WebsiteData | null>(null)
  useEffect(() => {
    if (!mounted || !draftReady || !userId) return
    if (loadedData.current === null) {
      loadedData.current = data
      return
    }
    if (loadedData.current === data) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(userId), JSON.stringify(data))
      } catch {
        // storage full/blocked — the draft just won't persist
      }
    }, 400)
    return () => clearTimeout(id)
  }, [data, mounted, draftReady, userId])

  /** Clone-and-mutate updater: keeps every field handler a one-liner. */
  const update = (fn: (d: WebsiteData) => void) =>
    setData((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })

  /** Discard unsaved edits: reload the SAVED site from the DB. Only when
   *  nothing has ever been saved does it fall back to the seeded sample. */
  const [resetting, setResetting] = useState(false)
  const reset = async () => {
    if (!window.confirm("Discard your unsaved changes and go back to your saved site?")) return
    setResetting(true)
    try {
      if (userId) localStorage.removeItem(draftKey(userId))
      const res = await fetch("/api/website-builder/site")
      const json = (await res.json().catch(() => ({}))) as { exists?: boolean; slug?: string; data?: WebsiteData; complete?: boolean }
      if (res.ok && json.exists && json.data) {
        setData(json.data)
        if (json.slug) setSiteSlug(json.slug)
        setSavedComplete(json.complete === true)
      } else {
        setData(emptySite(seed))
      }
    } catch {
      setData(emptySite(seed))
    } finally {
      setResetting(false)
    }
  }


  const selectedProjectIds = new Set(data.projects.map((p) => p.sourceId).filter(Boolean) as string[])

  // Service Areas from the catalog: picked by name (the catalog's spelling), case-insensitively.
  const selectedAreaNames = new Set(
    areaOptions.filter((o) => data.areas.some((a) => a.label.trim().toLowerCase() === o.name.toLowerCase())).map((o) => o.name),
  )
  const toggleArea = (name: string) => {
    const option = areaOptions.find((o) => o.name === name)
    update((d) => {
      const at = d.areas.findIndex((a) => a.label.trim().toLowerCase() === name.toLowerCase())
      if (at >= 0) d.areas.splice(at, 1)
      else if (option) {
        // Fill an empty row first (a fresh "Add area"), otherwise add one.
        const blank = d.areas.findIndex((a) => !a.label.trim() && !a.image.trim())
        if (blank >= 0) d.areas[blank] = { label: option.name, image: option.photo }
        else d.areas.push({ label: option.name, image: option.photo })
      }
    })
  }

  /** Upload several pictures into one gallery category, adding each to the grid as it finishes. */
  const uploadGallery = async (cat: GalleryCategory, files: File[]) => {
    setGalleryError(null)
    setGalleryUploading(files.length)
    let failed = 0
    for (const file of files) {
      try {
        const url = await uploadBuilderImage(file)
        // Drop the empty rows older drafts may hold, then add the new picture.
        update((d) => { d.gallery[cat] = [...d.gallery[cat].filter((x) => x.trim()), url] })
      } catch {
        failed++
      }
      setGalleryUploading((n) => n - 1)
    }
    if (failed) setGalleryError(`${failed} picture${failed === 1 ? "" : "s"} couldn't be uploaded — try again.`)
  }

  /** Add area: the typed name + its uploaded photo become one new area (filling an empty row first). */
  const addAreaWithPhoto = async (name: string, file: File) => {
    const label = capitalizeWords(name.trim())
    if (!label) return
    setAreaError(null)
    setAreaUploading(true)
    try {
      const url = await uploadBuilderImage(file)
      update((d) => {
        const blank = d.areas.findIndex((x) => !x.label.trim() && !x.image.trim())
        if (blank >= 0) d.areas[blank] = { label, image: url }
        else d.areas.push({ label, image: url })
      })
      setNewAreaName("")
      setAddingArea(false)
    } catch (e) {
      setAreaError(e instanceof Error ? e.message : "The photo couldn't be uploaded — try again.")
    } finally {
      setAreaUploading(false)
    }
  }

  const toggleProject = (id: string) => {
    const option = projectOptions?.find((o) => o.sourceId === id)
    update((d) => {
      const at = d.projects.findIndex((p) => p.sourceId === id)
      if (at >= 0) d.projects.splice(at, 1)
      else if (option && d.projects.length < MAX_FEATURED) d.projects.push(structuredClone(option))
    })
  }

  if (!mounted) {
    return (
      <div data-wb-full-bleed className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#9aa0aa]" />
      </div>
    )
  }

  return (
    <div data-wb-full-bleed className="flex h-full min-h-0">
      {/* ── Form ── */}
      <div className="flex w-[400px] shrink-0 flex-col border-r border-[#e8eaed] bg-white xl:w-[440px]">
        {/* Section navigation — one section's fields at a time: text tabs, the active one blue and
            underlined; the row scrolls sideways when the tabs don't fit. */}
        <div className="shrink-0 overflow-x-auto border-b border-[#dfe3e8] bg-[#eceef3] [scrollbar-width:none]">
          <div className="flex min-w-max px-2">
            {FORM_SECTIONS.map((s) => {
              const active = activeSection === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSection(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={`relative whitespace-nowrap px-2 pb-3 pt-3.5 font-['Outfit'] text-[14px] font-semibold transition-colors ${
                    active ? "text-[#2f5fe0]" : "text-[#6b7280] hover:text-[#374151]"
                  }`}
                >
                  {s.label}
                  {active && <span className="absolute inset-x-0.5 bottom-0 h-[3px] rounded-t-sm bg-[#2f5fe0]" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrolls up and down only — never sideways (the tab bar above is the one row that does). */}
        <div ref={formScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-5">
          {activeSection === "palette" && (
            <>
              {/* Hero text colours first — one line (moved here from the Hero tab). */}
              <div>
                <span className="mb-1 flex items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
                  Hero text
                  <HelpTip text="Colours of the hero's title, the words you highlight in it, and the description under it." />
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "headlineColor", label: "Title color", fallback: "#0d1b2e" },
                      { key: "headlineAccentColor", label: "Highlighted words", fallback: data.theme?.gold ?? DEFAULT_THEME.gold },
                      { key: "descriptionColor", label: "Description color", fallback: "#3d4451" },
                    ] as const
                  ).map(({ key, label, fallback }) => (
                    <label key={key} className="flex cursor-pointer flex-col gap-1.5 border border-[#e8eaed] bg-[#fafbfc] p-2">
                      <span className="truncate text-[12px] font-bold text-[#0d1117]">{label}</span>
                      <input
                        type="color"
                        value={data.hero[key] ?? fallback}
                        onChange={(e) => update((d) => { d.hero[key] = e.target.value })}
                        aria-label={label}
                        className="h-8 w-full cursor-pointer appearance-none border border-[#e2e6ea] bg-white p-0.5"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <Field
                label="Title dark overlay background"
                help="Darkens the background behind the title so it stays readable on bright photos. 0% = no overlay."
                action={<span className="text-[10px] font-bold text-[#6b7280]">{data.hero.overlay ?? 0}%</span>}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={data.hero.overlay ?? 0}
                  onChange={(e) => update((d) => { d.hero.overlay = Number(e.target.value) })}
                  className="w-full cursor-pointer accent-[#001f3f]"
                  aria-label="Title dark overlay background strength"
                />
              </Field>

              {/* Brand colours — your own (custom), on one line, right above the suggestions. */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
                    Brand colors <span className="font-normal text-[#6b7280]">(custom, or choose below)</span>
                    <HelpTip text="Primary: navbar, primary buttons, stat bands and dark sections. Accent: icons, dividers, eyebrows and the Get in Touch / Book a Consultation buttons." />
                  </span>
                  {/* Back to the default palette (Classic Gold). */}
                  <button
                    type="button"
                    onClick={() => update((d) => { delete d.theme })}
                    disabled={!data.theme}
                    className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#2f5fe0] hover:underline disabled:cursor-default disabled:text-[#9aa0aa] disabled:no-underline"
                  >
                    Reset colors
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "brand", label: "Primary color" },
                      { key: "gold", label: "Accent color" },
                    ] as const
                  ).map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer flex-col gap-1.5 border border-[#e8eaed] bg-[#fafbfc] p-2">
                      <span className="truncate text-[12px] font-bold text-[#0d1117]">{label}</span>
                      <input
                        type="color"
                        value={data.theme?.[key] ?? DEFAULT_THEME[key]}
                        onChange={(e) => update((d) => { d.theme = { ...(d.theme ?? {}), [key]: e.target.value } })}
                        aria-label={label}
                        className="h-8 w-full cursor-pointer appearance-none border border-[#e2e6ea] bg-white p-0.5"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Suggested palettes */}
              <Field label="Suggestions">
                <div className="grid grid-cols-2 gap-2">
                  {PALETTE_PRESETS.map((p) => {
                    const activeGold = data.theme?.gold ?? DEFAULT_THEME.gold
                    const activeBrand = data.theme?.brand ?? DEFAULT_THEME.brand
                    const selected = activeGold.toLowerCase() === p.gold.toLowerCase() && activeBrand.toLowerCase() === p.brand.toLowerCase()
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => update((d) => {
                          if (p.isDefault) delete d.theme
                          else d.theme = { gold: p.gold, brand: p.brand }
                        })}
                        className={`flex items-center gap-2.5 border p-2 text-left transition-colors ${
                          selected ? "border-[#001f3f] bg-[#eef3f9]" : "border-[#e8eaed] bg-white hover:border-[#9aa0aa]"
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 overflow-hidden border border-black/10">
                          <span className="h-full w-1/2" style={{ backgroundColor: p.brand }} />
                          <span className="h-full w-1/2" style={{ backgroundColor: p.gold }} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-bold text-[#0d1117]">{p.name}</span>
                          {p.isDefault && <span className="block text-[10px] text-[#9aa0aa]">Default</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Field>

            </>
          )}

          {activeSection === "agent" && (
            <>
              {/* RERA credentials: read-only, from profile settings (the BRN is checked with the Dubai Land
                  Department there; ORN + brokerage are that BRN's DLD record). The server applies the same. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="RERA BRN"><ReadOnlyValue value={data.agent.brn} /></Field>
                <Field label="RERA ORN"><ReadOnlyValue value={data.agent.orn} /></Field>
              </div>
              <Field label="Brokerage"><ReadOnlyValue value={data.agent.brokerage} /></Field>
              <div className="grid grid-cols-2 gap-3">
                {/* Phone + WhatsApp: read-only, synced from profile settings (country code + number). */}
                <Field label="Phone"><ReadOnlyPhone code={contactCodes.phone} number={data.agent.phone} /></Field>
                <Field label="WhatsApp"><ReadOnlyPhone code={contactCodes.whatsapp} number={data.agent.whatsapp} /></Field>
              </div>
              <Field label="Email"><ReadOnlyValue value={data.agent.email} /></Field>
              {/* One note for every field on this tab: all synced from profile settings. */}
              <p className="text-[11.5px] leading-snug text-[#6b7280]">
                Synced from your{" "}
                <a href={`${getDashboardRouteByRole(role)}/profile`} className="font-bold text-[#001f3f] underline">
                  profile settings
                </a>{" "}
                — change them there.
              </p>
            </>
          )}

          {activeSection === "hero" && (
            <>
              <Field label="Banner photo"><ImageInput value={data.hero.image} onChange={(v) => update((d) => { d.hero.image = v })} /></Field>
              <Field
                label="Photo zoom"
                help="100% = no zoom. Zooming magnifies around the position you set."
                action={<span className="text-[10px] font-bold text-[#6b7280]">{(data.hero.zoom ?? 100).toFixed(1)}%</span>}
              >
                <input
                  type="range"
                  min={100}
                  max={300}
                  step={0.1}
                  value={data.hero.zoom ?? 100}
                  onChange={(e) => update((d) => { d.hero.zoom = Number(e.target.value) })}
                  className="w-full cursor-pointer accent-[#001f3f]"
                  aria-label="Banner photo zoom"
                />
              </Field>
              {/* Position X and Y on one line. */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Position X"
                    help="Which part of an oversized photo shows in the banner, left to right: 0% = left edge, 100% = right edge."
                    action={<span className="text-[10px] font-bold text-[#6b7280]">{(data.hero.posX ?? 50).toFixed(1)}%</span>}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={data.hero.posX ?? 50}
                      onChange={(e) => update((d) => { d.hero.posX = Number(e.target.value) })}
                      className="w-full cursor-pointer accent-[#001f3f]"
                      aria-label="Banner photo horizontal position"
                    />
                  </Field>
                  <Field
                    label="Position Y"
                    help="Which part of an oversized photo shows in the banner, top to bottom: 0% = top edge, 100% = bottom edge."
                    helpAlign="right"
                    action={<span className="text-[10px] font-bold text-[#6b7280]">{(data.hero.posY ?? 50).toFixed(1)}%</span>}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.1}
                      value={data.hero.posY ?? 50}
                      onChange={(e) => update((d) => { d.hero.posY = Number(e.target.value) })}
                      className="w-full cursor-pointer accent-[#001f3f]"
                      aria-label="Banner photo vertical position"
                    />
                  </Field>
                </div>
              </div>
              {/* The whole title in one box; click its words below to highlight them
                  (stored as **markers** in hero.headline — lib/headline-highlight.ts). */}
              <Field
                label={<>Title <span className="font-normal text-[#6b7280]">(line breaks kept)</span></>}
              >
                <TArea rows={2} placeholder="Looking for homes?" value={titleWords.tokens.join("")} onChange={setTitleText} />
              </Field>
              {titleWords.tokens.some((t) => t.trim()) && (
                <div>
                  <span className="mb-1 flex items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
                    Click words to highlight
                    <HelpTip text="Highlighted words show in the highlight color on your site (set it in Palette)." />
                  </span>
                  <div className="flex flex-wrap gap-1.5 border border-[#e2e6ea] bg-[#f9fafb] p-2">
                    {titleWords.tokens.map((tok, i) => {
                      const accentColor = data.hero.headlineAccentColor || data.theme?.gold || DEFAULT_THEME.gold
                      if (!tok.trim()) return null
                      const on = titleWords.highlighted.has(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleTitleWord(i)}
                          // Not highlighted: black text on white, no border, a soft shadow (the title colour may be white
                          // for a dark photo — unreadable here). Highlighted: the highlight colour, bordered.
                          className={`border px-2 py-1 text-[13px] font-bold transition-colors ${
                            on ? "bg-white shadow-sm" : "border-transparent bg-white text-[#0d1117] shadow-[0_1px_3px_rgba(15,23,42,0.12)] hover:shadow-[0_2px_6px_rgba(15,23,42,0.16)]"
                          }`}
                          style={on ? { color: accentColor, borderColor: accentColor } : undefined}
                        >
                          {tok.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <Field label="Description">
                <TArea value={data.hero.description} onChange={(v) => update((d) => { d.hero.description = v })} />
              </Field>
              <Field
                label="Featured video link"
                help={myStory
                  ? "Shows a “Featured Video” button in the hero that opens the video in a pop-up. Left blank, your My Story film is used. Facebook, Instagram and TikTok videos must be public."
                  : "Shows a “Featured Video” button in the hero that opens the video in a pop-up. Facebook, Instagram and TikTok videos must be public. Leave blank to hide the button."}
                action={
                  <button
                    type="button"
                    onClick={() => { if (myStory) update((d) => { d.hero.video = myStory.hd }) }}
                    // No film yet → shown but disabled, so agents know the option exists.
                    disabled={!myStory || data.hero.video === myStory.hd || !(data.hero.video ?? "").trim()}
                    title={myStory
                      ? `Use “${myStory.title}” (${myStory.duration}) — the film on fhiglobal.ae/agents`
                      : "You don't have a My Story film on fhiglobal.ae/agents yet"}
                    className="inline-flex shrink-0 items-center gap-1 border border-[#e2e6ea] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#001f3f] transition-colors hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:text-[#9aa0aa] disabled:hover:bg-white"
                  >
                    <Film className="h-3 w-3" />
                    {myStory && (data.hero.video === myStory.hd || !(data.hero.video ?? "").trim())
                      ? "Your story is used by default"
                      : "Use my story"}
                  </button>
                }
              >
                <TInput
                  value={data.hero.video ?? ""}
                  placeholder={myStory ? "Blank = your My Story film" : "YouTube / Vimeo / Facebook / Instagram / TikTok / direct video URL"}
                  onChange={(v) => update((d) => { d.hero.video = v })}
                />
              </Field>
              {/* A plain heading, not <Field> (a <label>): a click inside must not press Add stat. */}
              <div>
                <span className="mb-1 block text-[13.5px] font-bold text-[#0d1117]">Hero stats</span>
                <div className="space-y-2.5">
                  {/* Add stat first, full width, label centred. */}
                  <button
                    type="button"
                    onClick={() => update((d) => { d.hero.stats.push({ value: "", label: "" }) })}
                    className="flex w-full items-center justify-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add stat
                  </button>
                  {data.hero.stats.map((s, i) => (
                    <ItemCard
                      key={i}
                      index={i}
                      count={data.hero.stats.length}
                      onMove={(dir) => update((d) => swap(d.hero.stats, i, dir))}
                      onRemove={() => update((d) => { d.hero.stats.splice(i, 1) })}
                    >
                      {/* Icon (a dropdown) first, then value and label, on one line. */}
                      <div className="flex items-stretch gap-2">
                        <IconPicker
                          value={s.icon ?? HERO_STAT_ICON_FALLBACK[i % HERO_STAT_ICON_FALLBACK.length]}
                          onChange={(k) => update((d) => { d.hero.stats[i].icon = k })}
                        />
                        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                          <TInput value={s.value} placeholder="Value" onChange={(v) => update((d) => { d.hero.stats[i].value = v })} />
                          <TInput value={s.label} placeholder="Label" onChange={(v) => update((d) => { d.hero.stats[i].label = v })} />
                        </div>
                      </div>
                    </ItemCard>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSection === "about" && (
            <>
              <Field label="About Me Portrait photo"><ImageInput value={data.about.portrait} onChange={(v) => update((d) => { d.about.portrait = v })} /></Field>
              <Field label="Full name"><TInput value={data.agent.name} onChange={(v) => update((d) => { d.agent.name = v })} /></Field>
              <Field label="Professional Title"><TInput value={data.agent.title} onChange={(v) => update((d) => { d.agent.title = v })} /></Field>
              <Field label={<>About Me Heading <span className="font-normal text-[#6b7280]">(line breaks kept)</span></>}><TArea rows={2} value={data.about.heading} onChange={(v) => update((d) => { d.about.heading = v })} /></Field>
              <Field label="Bio"><TArea rows={7} value={data.about.bio} onChange={(v) => update((d) => { d.about.bio = v })} /></Field>
              <Field label="Facebook URL"><TInput value={data.about.socials.facebook} onChange={(v) => update((d) => { d.about.socials.facebook = v })} /></Field>
              <Field label="Instagram URL"><TInput value={data.about.socials.instagram} onChange={(v) => update((d) => { d.about.socials.instagram = v })} /></Field>
              <Field label="LinkedIn URL"><TInput value={data.about.socials.linkedin} onChange={(v) => update((d) => { d.about.socials.linkedin = v })} /></Field>
              <Field label="YouTube URL"><TInput value={data.about.socials.youtube} onChange={(v) => update((d) => { d.about.socials.youtube = v })} /></Field>
            </>
          )}

          {activeSection === "projects" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Pick up to {MAX_FEATURED} published projects — the card fills in from the real project.
                <span className="ml-1 font-bold text-[#0d1117]">{data.projects.length}/{MAX_FEATURED} selected</span>
              </p>
              <FeaturedPicker
                items={(projectOptions ?? []).map((p) => ({
                  sourceId: p.sourceId!,
                  image: p.image,
                  title: p.title,
                  sub: [p.developerName, p.location].filter(Boolean).join(" · "),
                }))}
                loading={projectOptions === null && !projectsError}
                loadError={projectsError}
                selectedIds={selectedProjectIds}
                onToggle={toggleProject}
                emptyText="No published projects found."
              />
              {data.projects.length > 0 && (
                // A plain heading, not <Field> (a <label>): a click on a row must not press its first button.
                <div>
                  <span className="mb-1 flex items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
                    Selected <span className="font-normal text-[#6b7280]">(shown in this order)</span>
                    <HelpTip text="Drag a project by its handle (or use the arrows) to change the order it shows on your site." />
                  </span>
                  <div className="space-y-1.5">
                    {data.projects.map((p, i) => (
                      <div
                        key={`${p.sourceId ?? p.title}-${i}`}
                        draggable
                        onDragStart={(e) => {
                          setDragProject(i)
                          e.dataTransfer.effectAllowed = "move"
                          e.dataTransfer.setData("text/plain", String(i))
                        }}
                        onDragOver={(e) => {
                          if (dragProject === null) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = "move"
                          if (dropProject !== i) setDropProject(i)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragProject !== null && dragProject !== i) {
                            const from = dragProject
                            update((d) => { const [moved] = d.projects.splice(from, 1); d.projects.splice(i, 0, moved) })
                          }
                          setDragProject(null)
                          setDropProject(null)
                        }}
                        onDragEnd={() => { setDragProject(null); setDropProject(null) }}
                        className={`flex cursor-grab items-center gap-2 border px-2.5 py-1.5 transition-colors active:cursor-grabbing ${
                          dragProject === i
                            ? "border-dashed border-[#9aa0aa] bg-white opacity-50"
                            : dropProject === i && dragProject !== null
                              ? "border-[#001f3f] bg-[#eef3f9]"
                              : "border-[#e8eaed] bg-[#fafbfc]"
                        }`}
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#9aa0aa]" aria-hidden />
                        <span className="text-[11px] font-bold text-[#9aa0aa]">#{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#0d1117]">{p.title || "Untitled"}</span>
                        <MoveButtons index={i} count={data.projects.length} onMove={(dir) => update((d) => swap(d.projects, i, dir))} />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => update((d) => { d.projects.splice(i, 1) })}
                          className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}


          {activeSection === "areas" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Areas are shared across all agent sites: picking or typing an existing name reuses it (and its photo); a new name is added to the catalog when you save.
              </p>
              {/* Pick from the shared catalog — the same search + Show all as Projects. */}
              <FeaturedPicker
                noun="areas"
                items={areaOptions.map((o) => ({ sourceId: o.name, image: o.photo, title: o.name, sub: "" }))}
                loading={false}
                loadError={null}
                selectedIds={selectedAreaNames}
                onToggle={toggleArea}
                emptyText="No areas in the catalog yet — add your own."
              />
              {/* Add area: full width; opens the name + photo step below. */}
              <button
                type="button"
                onClick={() => { setAddingArea((v) => !v); setAreaError(null) }}
                aria-expanded={addingArea}
                className="flex w-full items-center justify-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Add area
              </button>
              {/* New area: the name first, then its photo — the upload adds it to the grid. */}
              {addingArea && (
                <div className="space-y-2 border border-[#e2e6ea] bg-[#fafbfc] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-bold text-[#0d1117]">New area</span>
                    {/* Cancel: closes the step and forgets the typed name. */}
                    <button
                      type="button"
                      onClick={() => { setAddingArea(false); setNewAreaName(""); setAreaError(null) }}
                      disabled={areaUploading}
                      aria-label="Cancel new area"
                      title="Cancel"
                      className="flex h-7 w-7 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-stretch gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newAreaName}
                      placeholder="Area name, e.g. Dubai Marina"
                      aria-label="New area name"
                      onChange={(e) => setNewAreaName(capitalizeWords(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newAreaName.trim()) { e.preventDefault(); areaFileRef.current?.click() }
                        if (e.key === "Escape") setAddingArea(false)
                      }}
                      className={`${INPUT_CLS} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => areaFileRef.current?.click()}
                      disabled={!newAreaName.trim() || areaUploading}
                      title={newAreaName.trim() ? "Upload this area's photo" : "Type the area name first"}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {areaUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {areaUploading ? "Uploading…" : "Upload photo"}
                    </button>
                  </div>
                  <input
                    ref={areaFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (file) void addAreaWithPhoto(newAreaName, file)
                    }}
                  />
                  {areaError && <p className="text-[11px] font-semibold text-red-600">{areaError}</p>}
                </div>
              )}
              {/* The areas, 3 per row like the gallery: the photo with its name typed in the centre.
                  Drag to reorder; on hover (always on touch screens) delete and ‹ ›. */}
              {data.areas.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {data.areas.map((a, i) => (
                    <div
                      key={`${i}-${a.image}`}
                      draggable
                      onDragStart={(e) => {
                        // Typing in the name box must not start a drag.
                        if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); return }
                        setDragArea(i)
                        e.dataTransfer.effectAllowed = "move"
                        e.dataTransfer.setData("text/plain", String(i))
                      }}
                      onDragOver={(e) => {
                        if (dragArea === null) return
                        e.preventDefault()
                        if (dropArea !== i) setDropArea(i)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragArea !== null && dragArea !== i) {
                          const from = dragArea
                          update((d) => { const [moved] = d.areas.splice(from, 1); d.areas.splice(i, 0, moved) })
                        }
                        setDragArea(null)
                        setDropArea(null)
                      }}
                      onDragEnd={() => { setDragArea(null); setDropArea(null) }}
                      className={`group relative aspect-square cursor-grab overflow-hidden border bg-[#1f2937] active:cursor-grabbing ${
                        dragArea === i
                          ? "border-dashed border-[#9aa0aa] opacity-50"
                          : dropArea === i && dragArea !== null
                            ? "border-2 border-[#001f3f]"
                            : "border-[#e2e6ea]"
                      }`}
                    >
                      {a.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image} alt="" draggable={false} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ImagePlus className="h-5 w-5 text-white/40" />
                        </span>
                      )}
                      <span className="pointer-events-none absolute inset-0 bg-black/25" aria-hidden />
                      <span className="absolute left-1 top-1 min-w-[24px] bg-black/60 px-1.5 py-0.5 text-center text-[13px] font-bold leading-5 text-white">{i + 1}</span>
                      {/* Area name, in the centre — up to two lines, centred both ways (AreaNameBox). */}
                      <AreaNameBox
                        value={a.label}
                        label={`Area ${i + 1} name`}
                        onChange={(v) => {
                          const match = areaOptions.find((o) => o.name.toLowerCase() === v.trim().toLowerCase())
                          update((d) => {
                            d.areas[i].label = v
                            // Typing an existing area's name adopts its shared photo when this one has none.
                            if (match?.photo && !d.areas[i].image) d.areas[i].image = match.photo
                          })
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Remove area"
                        onClick={() => update((d) => { d.areas.splice(i, 1) })}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#b42318] opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move earlier"
                        disabled={i === 0}
                        onClick={() => update((d) => swap(d.areas, i, -1))}
                        className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#0d1117] opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 group-hover:disabled:opacity-30 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move later"
                        disabled={i === data.areas.length - 1}
                        onClick={() => update((d) => swap(d.areas, i, 1))}
                        className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#0d1117] opacity-0 transition-opacity hover:bg-white group-hover:opacity-100 group-hover:disabled:opacity-30 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:disabled:opacity-30"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeSection === "gallery" && (
            <>
              {/* Category navbar — the three share the row; only the active category's images below */}
              <div className="flex gap-1.5">
                {GALLERY_CATEGORIES.map((cat) => {
                  const active = activeGalleryCat === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveGalleryCat(cat)}
                      className={`min-w-0 flex-auto whitespace-nowrap px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                        active
                          ? "bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white"
                          : "border border-[#e2e6ea] text-[#5b6472] hover:border-[#9aa0aa]"
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
              {/* Upload, for the category picked above — full width, right under the navbar. Picks
                  several pictures at once; each is compressed and uploaded, then added to the grid. */}
              <button
                type="button"
                onClick={() => galleryFileRef.current?.click()}
                disabled={galleryUploading > 0}
                className="flex w-full items-center justify-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {galleryUploading > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {galleryUploading > 0
                  ? `Uploading ${galleryUploading} picture${galleryUploading === 1 ? "" : "s"}…`
                  : activeGalleryCat === "Event Photos"
                    ? "Upload event photos"
                    : activeGalleryCat === "Certificates"
                      ? "Upload certificates"
                      : "Upload awards or recognition photos"}
              </button>
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  if (files.length) void uploadGallery(activeGalleryCat, files)
                }}
              />
              {galleryError && <p className="text-[11px] font-semibold text-red-600">{galleryError}</p>}
              <div className="space-y-2.5">
                {/* The pictures, 3 per row — drag to reorder, or use the arrows. */}
                {data.gallery[activeGalleryCat].some((src) => src.trim()) && (
                  <div className="grid grid-cols-3 gap-2">
                    {data.gallery[activeGalleryCat].map((src, i) =>
                      !src.trim() ? null : (
                        <div
                          key={`${activeGalleryCat}-${i}-${src}`}
                          draggable
                          onDragStart={(e) => {
                            setDragGallery(i)
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", String(i))
                          }}
                          onDragOver={(e) => {
                            if (dragGallery === null) return
                            e.preventDefault()
                            if (dropGallery !== i) setDropGallery(i)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragGallery !== null && dragGallery !== i) {
                              const from = dragGallery
                              update((d) => {
                                const list = d.gallery[activeGalleryCat]
                                const [moved] = list.splice(from, 1)
                                list.splice(i, 0, moved)
                              })
                            }
                            setDragGallery(null)
                            setDropGallery(null)
                          }}
                          onDragEnd={() => { setDragGallery(null); setDropGallery(null) }}
                          className={`group relative aspect-square cursor-grab overflow-hidden border bg-[#eceff3] active:cursor-grabbing ${
                            dragGallery === i
                              ? "border-dashed border-[#9aa0aa] opacity-50"
                              : dropGallery === i && dragGallery !== null
                                ? "border-2 border-[#001f3f]"
                                : "border-[#e2e6ea]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
                          {/* Order number top left; on hover (always on touch screens): delete top right, move ‹ › at the bottom left and right. */}
                          <span className="absolute left-1 top-1 min-w-[24px] bg-black/60 px-1.5 py-0.5 text-center text-[13px] font-bold leading-5 text-white">{i + 1}</span>
                          <button
                            type="button"
                            aria-label="Remove picture"
                            onClick={() => update((d) => { d.gallery[activeGalleryCat].splice(i, 1) })}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#b42318] hover:bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move earlier"
                            disabled={i === 0}
                            onClick={() => update((d) => swap(d.gallery[activeGalleryCat], i, -1))}
                            className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#0d1117] hover:bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 group-hover:disabled:opacity-30 [@media(hover:none)]:disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move later"
                            disabled={i === data.gallery[activeGalleryCat].length - 1}
                            onClick={() => update((d) => swap(d.gallery[activeGalleryCat], i, 1))}
                            className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center bg-white/90 text-[#0d1117] hover:bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 group-hover:disabled:opacity-30 [@media(hover:none)]:disabled:opacity-30"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === "reviews" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Your reviews come from clients who fill in your{" "}
                <a href={`${getDashboardRouteByRole(role)}/feedback`} className="font-bold text-[#001f3f] underline">Customer Feedback</a>{" "}
                link. Once an admin approves a review it shows here and on your website — first name and
                last initial only. Until then the Reviews section and its menu link stay hidden.
              </p>
              {reviews.length === 0 ? (
                <p className="border border-dashed border-[#e2e6ea] bg-[#fafbfc] p-3 text-[12px] text-[#6b7280]">No approved reviews yet.</p>
              ) : (
                <>
                  {/* Shown on the site, in this order — tick to show / hide, arrows to reorder.
                      Saved as data.reviewIds (migration 087); never picked = all, newest first. */}
                  {/* Plain headings, not <Field> (a <label>): a click on a review's text must not tick the first checkbox. */}
                  <div>
                    <span className="mb-1 flex items-center gap-1.5 text-[13.5px] font-bold text-[#0d1117]">
                      Shown on your site
                      <HelpTip text="Untick a review to hide it; use the arrows to change the order. Reviews approved later start hidden — tick them to show." />
                    </span>
                    {shownReviews.length === 0 ? (
                      <p className="border border-dashed border-[#e2e6ea] bg-[#fafbfc] p-3 text-[12px] text-[#6b7280]">
                        None shown — the Reviews section and its menu link are hidden.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {shownReviews.map((t, i) => (
                          <ReviewRowCard key={t.id ?? i} review={t} shown onToggle={() => toggleReview(t.id)}>
                            <span className="text-[11px] font-bold text-[#9aa0aa]">#{i + 1}</span>
                            <MoveButtons index={i} count={shownReviews.length} onMove={(dir) => moveReview(i, dir)} />
                          </ReviewRowCard>
                        ))}
                      </div>
                    )}
                  </div>
                  {hiddenReviews.length > 0 && (
                    <div>
                      <span className="mb-1 block text-[13.5px] font-bold text-[#0d1117]">Hidden</span>
                      <div className="space-y-2">
                        {hiddenReviews.map((t, i) => (
                          <ReviewRowCard key={t.id ?? i} review={t} shown={false} onToggle={() => toggleReview(t.id)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        {/* Actions — at the end of the form (not pinned). Every tab but the last steps Prev / Next;
            the last (Info) holds Save. Clear (drop unsaved edits) is on every tab. */}
        {(() => {
          const at = FORM_SECTIONS.findIndex((x) => x.id === activeSection)
          const prev = at > 0 ? FORM_SECTIONS[at - 1] : null
          const next = at < FORM_SECTIONS.length - 1 ? FORM_SECTIONS[at + 1] : null
          // One row: Previous (its tab name cut with "…" when tight) · Clear, which stretches to fill the
          // space between · Next / Save at their own width.
          const stepBtn = "inline-flex h-8 min-w-0 shrink items-center gap-1.5 border border-[#e2e6ea] px-3 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9]"
          // Show the section being edited in the preview — the preview no longer follows the tabs by itself.
          const inView = previewAnchor === SECTION_ANCHORS[activeSection]
          const followBtn = (
            <button
              type="button"
              onClick={() => showInPreview(activeSection)}
              disabled={inView}
              title={inView ? "The preview is showing this section" : "Show this section in the preview"}
              aria-label="Show this section in the preview"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#e2e6ea] text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          )
          // Discard changes (drop unsaved edits, back to the saved site) is on every tab.
          const clearBtn = (
            <button
              type="button"
              onClick={() => void reset()}
              disabled={resetting}
              title="Throw away the edits you haven't saved and go back to your saved site"
              className="inline-flex h-8 min-w-[76px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-[#e2e6ea] px-2.5 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:opacity-60"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Discard changes
            </button>
          )
          if (next) {
            return (
              <div className="mt-2 flex items-center gap-2 border-t border-[#eef0f3] pt-4">
                {prev && (
                  <button type="button" onClick={() => openSection(prev.id)} className={stepBtn}>
                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Previous</span>
                  </button>
                )}
                {clearBtn}
                {followBtn}
                  <button
                    type="button"
                    onClick={() => openSection(next.id)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
              </div>
            )
          }
          return (
        <div className="mt-2 border-t border-[#eef0f3] pt-4">
          <div className="flex items-center gap-2">
            {prev && (
              <button type="button" onClick={() => openSection(prev.id)} className={stepBtn}>
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Previous</span>
              </button>
            )}
              {clearBtn}
              {followBtn}
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {siteSlug ? "Save" : "Save & Publish"}
              </button>
          </div>
          {saveError && <p className="mt-2 text-[11px] font-semibold text-red-600">{saveError}</p>}
          {/* Search listing: a site is offered to Google only when it is really the agent's (lib/agent-site.ts) */}
          <p className={`mt-2 text-[11px] leading-relaxed ${listingMissing.length === 0 && savedComplete ? "text-emerald-700" : "text-[#8a6d1d]"}`}>
            <span className="font-semibold">Listed for Google:</span>{" "}
            {listingMissing.length > 0
              ? `not yet — still needed: ${listingMissing.join(" · ")}.`
              : savedComplete
                ? "yes — your site is in our sitemap and open to search engines."
                : "ready — Save to list your site."}
          </p>
        </div>
          )
        })()}
        </div>

      </div>

      {/* ── Live preview ── */}
      <div className="min-w-0 flex-1">
        <LivePreview data={previewData} reviews={orderWebsiteReviews(reviews, data.reviewIds)} target={previewTarget} onSectionInView={handleSectionInView} />
      </div>
    </div>
  )
}
