"use client"

// Website Builder — every section of the /website/sample template is editable
// through the form on the left while the right side shows the real template
// (the same section components) live-updating at a scaled 1440px virtual
// viewport. The form shows ONE section at a time (chip navigation at the top),
// Featured Projects/Listings are picked from real published data, and the
// agent's contact fields seed from their profile. The draft autosaves to
// localStorage; DB persistence comes later.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import {
  ArrowDown, ArrowUp, Check, ExternalLink, ImagePlus, Loader2, Palette, Plus, RotateCcw, Save, Search, Trash2,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { compressImageForUpload } from "@/lib/upload/compress-image"
import { normalizeSocialUrl, readSocialLinks } from "@/lib/public-profile"
import {
  BAND_STAT_ICON_FALLBACK, DEFAULT_THEME, GALLERY_CATEGORIES, HERO_STAT_ICON_FALLBACK, SAMPLE_DATA, STAT_ICONS, TEST_AREAS, TEST_GALLERY_AWARDS, TEST_GALLERY_CERTIFICATES, TEST_GALLERY_EVENTS, TEST_REVIEWS, themeVars,
  type GalleryCategory, type Project, type Property, type StatIconKey, type WebsiteData,
} from "@/app/website/_data"
import { SiteHeader } from "@/app/website/_components/header"
import { SiteFooter } from "@/app/website/_components/footer"
import { HeroSection } from "@/app/website/_components/sections/hero"
import { AboutSection } from "@/app/website/_components/sections/about"
import { FeaturedSection } from "@/app/website/_components/sections/featured"
import { StatsBandSection } from "@/app/website/_components/sections/stats"
import { ServiceAreasSection } from "@/app/website/_components/sections/service-areas"
import { GallerySection } from "@/app/website/_components/sections/gallery"
import { TestimonialsSection } from "@/app/website/_components/sections/what-my-clients-say"

const DRAFT_KEY = "fhi:website-builder:draft:v1"
const VIRTUAL_WIDTH = 1440
const MAX_FEATURED = 8

// ─── Draft persistence + profile seeding ─────────────────────────────────────

function loadDraft(): WebsiteData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WebsiteData
    // Newly added fields fall back to the sample so old drafts never render holes.
    return {
      ...structuredClone(SAMPLE_DATA),
      ...parsed,
      agent: { ...SAMPLE_DATA.agent, ...parsed.agent },
      hero: { ...structuredClone(SAMPLE_DATA.hero), ...parsed.hero },
      about: { ...structuredClone(SAMPLE_DATA.about), ...parsed.about },
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
  d.agent = { ...d.agent, title: "", brn: "", orn: "", brokerage: "" }
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

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">{label}</span>
        {action}
      </span>
      {children}
    </label>
  )
}

/** Labeled swatch that opens the native color picker. */
function ColorButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-[#e2e6ea] bg-white px-1.5 py-0.5"
      title="Pick a text color"
    >
      <Palette className="h-3 w-3 text-[#6b7280]" />
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">Color</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Text color"
        className="h-4 w-6 cursor-pointer appearance-none border border-[#e2e6ea] bg-white p-0"
      />
    </span>
  )
}

const INPUT_CLS =
  "w-full border border-[#e2e6ea] bg-white px-3 py-2 text-[13px] text-[#0d1117] outline-none transition-colors focus:border-[#001f3f]"

function TInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />
}

function TArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLS} resize-y`} />
}

/** Image field: thumbnail + URL input + S3 upload button. */
function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const { file: toUpload } = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append("file", toUpload)
      const res = await fetch("/api/upload/website-builder", { method: "POST", body: fd })
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error || "Upload failed")
      onChange(json.url)
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
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL"
          className={INPUT_CLS}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-[#e2e6ea] bg-white px-3 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
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
function IconPicker({ value, onChange }: { value: StatIconKey; onChange: (k: StatIconKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(STAT_ICONS) as StatIconKey[]).map((k) => {
        const Icon = STAT_ICONS[k]
        const selected = value === k
        return (
          <button
            key={k}
            type="button"
            title={k}
            aria-label={k}
            onClick={() => onChange(k)}
            className={`flex h-8 w-8 items-center justify-center border transition-colors ${
              selected
                ? "border-[#001f3f] bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white"
                : "border-[#e2e6ea] bg-white text-[#5b6472] hover:border-[#9aa0aa]"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

// ─── Featured picker (projects + listings share the shape) ───────────────────

type PickerItem = { sourceId: string; image: string; title: string; sub: string }

function FeaturedPicker({
  items,
  loading,
  loadError,
  selectedIds,
  onToggle,
  emptyText,
}: {
  items: PickerItem[]
  loading: boolean
  loadError: string | null
  selectedIds: Set<string>
  onToggle: (id: string) => void
  emptyText: string
}) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const filtered = needle ? items.filter((i) => `${i.title} ${i.sub}`.toLowerCase().includes(needle)) : items

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa0aa]" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className={`${INPUT_CLS} pl-8`}
        />
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto border border-[#e8eaed] bg-[#fafbfc] p-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-[#9aa0aa]" />
          </div>
        ) : loadError ? (
          <p className="px-2 py-4 text-center text-[12px] font-semibold text-red-600">{loadError}</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-[#9aa0aa]">{emptyText}</p>
        ) : (
          filtered.map((item) => {
            const selected = selectedIds.has(item.sourceId)
            return (
              <button
                key={item.sourceId}
                type="button"
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
          })
        )}
      </div>
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
  target,
  onSectionInView,
}: {
  data: WebsiteData
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
          <SiteHeader sticky={false} />
          <HeroSection data={data} />
          <AboutSection data={data} />
          <FeaturedSection data={data} />
          <StatsBandSection data={data} />
          <ServiceAreasSection data={data} />
          <GallerySection data={data} />
          <TestimonialsSection />
          <SiteFooter data={data} />
        </div>
      </div>
    </div>
  )
}

// ─── Section navigation ───────────────────────────────────────────────────────

const FORM_SECTIONS = [
  { id: "palette", label: "Palette" },
  { id: "agent", label: "Agent" },
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "listings", label: "Listings" },
  { id: "stats", label: "Stats" },
  { id: "areas", label: "Service Areas" },
  { id: "gallery", label: "Gallery" },
  { id: "reviews", label: "Reviews" },
  { id: "link", label: "Link Preview" },
] as const

type FormSectionId = (typeof FORM_SECTIONS)[number]["id"]

/** Which template anchor each form section corresponds to in the preview. */
const SECTION_ANCHORS: Record<FormSectionId, string> = {
  palette: "home",
  agent: "home",
  hero: "home",
  about: "about",
  projects: "projects",
  listings: "properties",
  stats: "stats",
  areas: "areas",
  gallery: "gallery",
  reviews: "reviews",
  link: "contact",
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

/** Scroll-spy inverse: which form section a preview anchor selects ("home"
 *  picks Hero — Agent shares the hero and stays reachable by tab). */
const ANCHOR_TO_SECTION: Record<string, FormSectionId> = {
  home: "hero",
  about: "about",
  projects: "projects",
  properties: "listings",
  stats: "stats",
  areas: "areas",
  gallery: "gallery",
  reviews: "reviews",
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function WebsiteBuilderClient() {
  const mounted = useMounted()
  const { user, profile } = useAuth()

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

  // Whether a local draft existed at mount — when it didn't, the saved site
  // from the DB (if any) becomes the initial state instead.
  const [hadDraft] = useState(() => typeof window !== "undefined" && !!localStorage.getItem(DRAFT_KEY))
  const [data, setData] = useState<WebsiteData>(() => {
    if (typeof window === "undefined") return SAMPLE_DATA
    const draft = loadDraft()
    return draft ? seedEmptySocials(draft, seed) : emptySite(seed)
  })
  const [activeSection, setActiveSection] = useState<FormSectionId>("agent")
  const [activeGalleryCat, setActiveGalleryCat] = useState<GalleryCategory>("Event Photos")
  // Cache-buster for the link-share (OG) preview image.
  const [ogBust, setOgBust] = useState(0)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  // While a tab click smooth-scrolls the preview, the scroll spy would fire on
  // every intermediate section — suppress it until the animation settles.
  const spySuppressed = useRef(false)

  const openSection = (id: FormSectionId) => {
    setActiveSection(id)
    spySuppressed.current = true
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
  const handleSectionInView = useCallback((anchor: string) => {
    if (spySuppressed.current) return
    const formId = ANCHOR_TO_SECTION[anchor]
    if (!formId) return
    setActiveSection((prev) => {
      if (prev === formId) return prev
      // Palette + Agent share the hero anchor — don't kick the user off them.
      if (formId === "hero" && (prev === "agent" || prev === "palette")) return prev
      return formId
    })
  }, [])

  // Published-site state (migration 035): the slug is minted on first save.
  const [siteSlug, setSiteSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!mounted) return
    let alive = true
    fetch("/api/website-builder/site")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive || !ok) return
        const site = j as { exists?: boolean; slug?: string; data?: WebsiteData }
        if (!site.exists || !site.slug || !site.data) return
        setSiteSlug(site.slug)
        // A local draft is newer than the DB copy on this browser — keep it.
        if (!hadDraft) setData(site.data)
      })
      .catch(() => {
        // No saved site / table not migrated yet — the editor stays local-only.
      })
    return () => {
      alive = false
    }
  }, [mounted, hadDraft])

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch("/api/website-builder/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json().catch(() => ({}))) as { slug?: string; error?: string }
      if (!res.ok || !json.slug) throw new Error(json.error || "Failed to save")
      setSiteSlug(json.slug)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // Picker data — real published projects + the agent's own published listings.
  const [projectOptions, setProjectOptions] = useState<Project[] | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [listingOptions, setListingOptions] = useState<Property[] | null>(null)
  const [listingsError, setListingsError] = useState<string | null>(null)
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
    fetch("/api/website-builder/listings")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return
        if (!ok) throw new Error((j as { error?: string }).error || "Failed to load listings")
        setListingOptions(((j as { listings?: Property[] }).listings ?? []))
      })
      .catch((e) => {
        if (alive) setListingsError(e instanceof Error ? e.message : "Failed to load listings")
      })
    return () => {
      alive = false
    }
  }, [mounted])

  // Debounced localStorage autosave.
  useEffect(() => {
    if (!mounted) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
      } catch {
        // storage full/blocked — the draft just won't persist
      }
    }, 400)
    return () => clearTimeout(id)
  }, [data, mounted])

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
    if (!window.confirm("Discard unsaved edits and reload your saved site?")) return
    setResetting(true)
    try {
      localStorage.removeItem(DRAFT_KEY)
      const res = await fetch("/api/website-builder/site")
      const json = (await res.json().catch(() => ({}))) as { exists?: boolean; slug?: string; data?: WebsiteData }
      if (res.ok && json.exists && json.data) {
        setData(json.data)
        if (json.slug) setSiteSlug(json.slug)
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
  const selectedListingIds = new Set(data.properties.map((p) => p.sourceId).filter(Boolean) as string[])

  const toggleProject = (id: string) => {
    const option = projectOptions?.find((o) => o.sourceId === id)
    update((d) => {
      const at = d.projects.findIndex((p) => p.sourceId === id)
      if (at >= 0) d.projects.splice(at, 1)
      else if (option && d.projects.length < MAX_FEATURED) d.projects.push(structuredClone(option))
    })
  }

  const toggleListing = (id: string) => {
    const option = listingOptions?.find((o) => o.sourceId === id)
    update((d) => {
      const at = d.properties.findIndex((p) => p.sourceId === id)
      if (at >= 0) d.properties.splice(at, 1)
      else if (option && d.properties.length < MAX_FEATURED) d.properties.push(structuredClone(option))
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
        {/* Section navigation — one section's fields at a time */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#eef0f3] px-5 py-3">
          {FORM_SECTIONS.map((s) => {
            const active = activeSection === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openSection(s.id)}
                className={` px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                  active
                    ? "bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] text-white"
                    : "border border-[#e2e6ea] text-[#5b6472] hover:border-[#9aa0aa]"
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {activeSection === "palette" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Your site&apos;s two brand colors. Everything derives from them — the navbar, buttons,
                stat bands, glass cards, icons, dividers and gradients all update together.
              </p>

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

              {(
                [
                  { key: "gold", label: "Accent (gold)", hint: "Icons, dividers, eyebrows, Get in Touch / Book a Consultation" },
                  { key: "brand", label: "Primary (navy)", hint: "Navbar, primary buttons, stat bands, dark sections" },
                ] as const
              ).map(({ key, label, hint }) => (
                <div key={key} className="border border-[#e8eaed] bg-[#fafbfc] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12.5px] font-bold text-[#0d1117]">{label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#9aa0aa]">{hint}</p>
                    </div>
                    <input
                      type="color"
                      value={data.theme?.[key] ?? DEFAULT_THEME[key]}
                      onChange={(e) => update((d) => { d.theme = { ...(d.theme ?? {}), [key]: e.target.value } })}
                      aria-label={label}
                      className="h-10 w-14 shrink-0 cursor-pointer appearance-none border border-[#e2e6ea] bg-white p-1"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update((d) => { delete d.theme })}
                className="inline-flex items-center gap-1.5 border border-[#e2e6ea] bg-white px-3 py-2 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default palette
              </button>
            </>
          )}

          {activeSection === "agent" && (
            <>
              <Field label="Full name"><TInput value={data.agent.name} onChange={(v) => update((d) => { d.agent.name = v })} /></Field>
              <Field label="Professional Title"><TInput value={data.agent.title} onChange={(v) => update((d) => { d.agent.title = v })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="RERA BRN"><TInput value={data.agent.brn} onChange={(v) => update((d) => { d.agent.brn = v })} /></Field>
                <Field label="RERA ORN"><TInput value={data.agent.orn} onChange={(v) => update((d) => { d.agent.orn = v })} /></Field>
              </div>
              <Field label="Brokerage"><TInput value={data.agent.brokerage} onChange={(v) => update((d) => { d.agent.brokerage = v })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><TInput value={data.agent.phone} onChange={(v) => update((d) => { d.agent.phone = v })} /></Field>
                <Field label="WhatsApp"><TInput value={data.agent.whatsapp} onChange={(v) => update((d) => { d.agent.whatsapp = v })} /></Field>
              </div>
              <Field label="Email"><TInput value={data.agent.email} onChange={(v) => update((d) => { d.agent.email = v })} /></Field>
              <Field label="Office address"><TInput value={data.agent.office} onChange={(v) => update((d) => { d.agent.office = v })} /></Field>
            </>
          )}

          {activeSection === "hero" && (
            <>
              <Field
                label="Headline (line breaks kept)"
                action={<ColorButton value={data.hero.headlineColor ?? "#0d1b2e"} onChange={(v) => update((d) => { d.hero.headlineColor = v })} />}
              >
                <TArea rows={2} value={data.hero.headline} onChange={(v) => update((d) => { d.hero.headline = v })} />
              </Field>
              <Field
                label="Headline accent"
                action={<ColorButton value={data.hero.headlineAccentColor ?? "#c9a24b"} onChange={(v) => update((d) => { d.hero.headlineAccentColor = v })} />}
              >
                <TInput value={data.hero.headlineAccent} onChange={(v) => update((d) => { d.hero.headlineAccent = v })} />
              </Field>
              <Field
                label="Description"
                action={<ColorButton value={data.hero.descriptionColor ?? "#3d4451"} onChange={(v) => update((d) => { d.hero.descriptionColor = v })} />}
              >
                <TArea value={data.hero.description} onChange={(v) => update((d) => { d.hero.description = v })} />
              </Field>
              <Field label="Banner photo"><ImageInput value={data.hero.image} onChange={(v) => update((d) => { d.hero.image = v })} /></Field>
              <Field
                label="Left dark overlay"
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
                  aria-label="Left dark overlay strength"
                />
                <p className="mt-1 text-[11px] text-[#9aa0aa]">
                  Darkens the left side behind the headline so it stays readable on bright photos. 0% = no overlay.
                </p>
              </Field>
              <Field
                label="Photo position — horizontal"
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
                label="Photo position — vertical"
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
                <p className="mt-1 text-[11px] text-[#9aa0aa]">
                  Picks which part of an oversized photo shows in the banner crop: 0% = left/top edge, 100% = right/bottom edge.
                </p>
              </Field>
              <Field
                label="Photo zoom"
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
                <p className="mt-1 text-[11px] text-[#9aa0aa]">
                  100% = no zoom. Zooming magnifies around the position you set above.
                </p>
              </Field>
              <Field label="Hero stats">
                <div className="space-y-2.5">
                  {data.hero.stats.map((s, i) => (
                    <ItemCard
                      key={i}
                      index={i}
                      count={data.hero.stats.length}
                      onMove={(dir) => update((d) => swap(d.hero.stats, i, dir))}
                      onRemove={() => update((d) => { d.hero.stats.splice(i, 1) })}
                    >
                      <div className="grid grid-cols-2 gap-2.5">
                        <TInput value={s.value} placeholder="Value" onChange={(v) => update((d) => { d.hero.stats[i].value = v })} />
                        <TInput value={s.label} placeholder="Label" onChange={(v) => update((d) => { d.hero.stats[i].label = v })} />
                      </div>
                      <IconPicker
                        value={s.icon ?? HERO_STAT_ICON_FALLBACK[i % HERO_STAT_ICON_FALLBACK.length]}
                        onChange={(k) => update((d) => { d.hero.stats[i].icon = k })}
                      />
                    </ItemCard>
                  ))}
                  <AddButton label="Add stat" onClick={() => update((d) => { d.hero.stats.push({ value: "", label: "" }) })} />
                </div>
              </Field>
            </>
          )}

          {activeSection === "about" && (
            <>
              <Field label="Heading (line breaks kept)"><TArea rows={2} value={data.about.heading} onChange={(v) => update((d) => { d.about.heading = v })} /></Field>
              <Field label="Bio"><TArea rows={7} value={data.about.bio} onChange={(v) => update((d) => { d.about.bio = v })} /></Field>
              <Field label="Portrait photo"><ImageInput value={data.about.portrait} onChange={(v) => update((d) => { d.about.portrait = v })} /></Field>
              <p className="text-[11px] leading-relaxed text-[#9aa0aa]">
                Views, Listings and Rating aren&apos;t editable — they show &ldquo;-&rdquo; for now and will be automated from real data.
              </p>
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
                <Field label="Selected (shown in this order)">
                  <div className="space-y-1.5">
                    {data.projects.map((p, i) => (
                      <div key={`${p.sourceId ?? p.title}-${i}`} className="flex items-center gap-2 border border-[#e8eaed] bg-[#fafbfc] px-2.5 py-1.5">
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
                </Field>
              )}
            </>
          )}

          {activeSection === "listings" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Pick up to {MAX_FEATURED} of your published listings — the card fills in from the real listing.
                <span className="ml-1 font-bold text-[#0d1117]">{data.properties.length}/{MAX_FEATURED} selected</span>
              </p>
              <FeaturedPicker
                items={(listingOptions ?? []).map((p) => ({
                  sourceId: p.sourceId!,
                  image: p.image,
                  title: p.title,
                  sub: [p.badge, p.location, p.price].filter(Boolean).join(" · "),
                }))}
                loading={listingOptions === null && !listingsError}
                loadError={listingsError}
                selectedIds={selectedListingIds}
                onToggle={toggleListing}
                emptyText="No published listings found — publish a listing first."
              />
              {data.properties.length > 0 && (
                <Field label="Selected (shown in this order)">
                  <div className="space-y-1.5">
                    {data.properties.map((p, i) => (
                      <div key={`${p.sourceId ?? p.title}-${i}`} className="flex items-center gap-2 border border-[#e8eaed] bg-[#fafbfc] px-2.5 py-1.5">
                        <span className="text-[11px] font-bold text-[#9aa0aa]">#{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#0d1117]">{p.title || "Untitled"}</span>
                        <MoveButtons index={i} count={data.properties.length} onMove={(dir) => update((d) => swap(d.properties, i, dir))} />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => update((d) => { d.properties.splice(i, 1) })}
                          className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </>
          )}

          {activeSection === "stats" && (
            <>
              {data.bandStats.map((s, i) => (
                <ItemCard
                  key={i}
                  index={i}
                  count={data.bandStats.length}
                  onMove={(dir) => update((d) => swap(d.bandStats, i, dir))}
                  onRemove={() => update((d) => { d.bandStats.splice(i, 1) })}
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    <TInput value={s.value} placeholder="Value" onChange={(v) => update((d) => { d.bandStats[i].value = v })} />
                    <TInput value={s.label} placeholder="Label" onChange={(v) => update((d) => { d.bandStats[i].label = v })} />
                  </div>
                  <IconPicker
                    value={s.icon ?? BAND_STAT_ICON_FALLBACK[i % BAND_STAT_ICON_FALLBACK.length]}
                    onChange={(k) => update((d) => { d.bandStats[i].icon = k })}
                  />
                </ItemCard>
              ))}
              <AddButton label="Add stat" onClick={() => update((d) => { d.bandStats.push({ value: "", label: "" }) })} />
            </>
          )}

          {activeSection === "areas" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Until you add your own, the site shows Sample 1–6 as placeholders — they disappear as soon as you add an area. Areas are shared across all agent sites: typing an existing name reuses it (and its photo); a new name is added to the catalog when you save.
              </p>
              <datalist id="wb-area-catalog">
                {areaOptions.map((a) => (
                  <option key={a.name} value={a.name} />
                ))}
              </datalist>
              {data.areas.map((a, i) => (
                <ItemCard
                  key={i}
                  index={i}
                  count={data.areas.length}
                  onMove={(dir) => update((d) => swap(d.areas, i, dir))}
                  onRemove={() => update((d) => { d.areas.splice(i, 1) })}
                >
                  <input
                    type="text"
                    value={a.label}
                    placeholder="Area name"
                    list="wb-area-catalog"
                    onChange={(e) => {
                      const v = e.target.value
                      const match = areaOptions.find((o) => o.name.toLowerCase() === v.trim().toLowerCase())
                      update((d) => {
                        d.areas[i].label = v
                        // Choosing an existing area adopts its shared photo.
                        if (match?.photo) d.areas[i].image = match.photo
                      })
                    }}
                    className={INPUT_CLS}
                  />
                  <ImageInput value={a.image} onChange={(v) => update((d) => { d.areas[i].image = v })} />
                </ItemCard>
              ))}
              <AddButton label="Add area" onClick={() => update((d) => { d.areas.push({ image: "", label: "" }) })} />
              {data.areas.every((a) => a.label.trim() === "" && a.image.trim() === "") && (
                <div className="space-y-2.5">
                  {TEST_AREAS.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 border border-[#e2e6ea] bg-[#fafbfc] p-2.5 opacity-70">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.image} alt="" className="h-10 w-14 shrink-0 object-cover" />
                      <span className="text-[12.5px] font-bold text-[#0d1117]">{a.label}</span>
                      <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wide text-[#9aa0aa]">Sample</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeSection === "gallery" && (
            <>
              {/* Category navbar — only the active category's images below */}
              <div className="flex flex-wrap gap-1.5">
                {GALLERY_CATEGORIES.map((cat) => {
                  const active = activeGalleryCat === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveGalleryCat(cat)}
                      className={` px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
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
              <div className="space-y-2.5">
                {data.gallery[activeGalleryCat].map((src, i) => (
                  <div key={`${activeGalleryCat}-${i}`} className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <ImageInput value={src} onChange={(v) => update((d) => { d.gallery[activeGalleryCat][i] = v })} />
                    </div>
                    <div className="mt-2 flex shrink-0 items-center gap-0.5">
                      <MoveButtons
                        index={i}
                        count={data.gallery[activeGalleryCat].length}
                        onMove={(dir) => update((d) => swap(d.gallery[activeGalleryCat], i, dir))}
                      />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => update((d) => { d.gallery[activeGalleryCat].splice(i, 1) })}
                        className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <AddButton label="Add image" onClick={() => update((d) => { d.gallery[activeGalleryCat].push("") })} />
                {GALLERY_CATEGORIES.every((c) => data.gallery[c].every((src) => src.trim() === "")) && (
                    <div className="space-y-2.5">
                      {(activeGalleryCat === "Event Photos"
                        ? TEST_GALLERY_EVENTS
                        : activeGalleryCat === "Certificates"
                          ? TEST_GALLERY_CERTIFICATES
                          : TEST_GALLERY_AWARDS
                      ).map((src, i) => (
                        <div key={i} className="flex items-center gap-3 border border-[#e2e6ea] bg-[#fafbfc] p-2.5 opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-10 w-14 shrink-0 object-cover" />
                          <span className="truncate text-[11.5px] text-[#5b6472]">{src}</span>
                          <span className="ml-auto shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-[#9aa0aa]">Sample</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </>
          )}

          {activeSection === "reviews" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                Reviews are fixed test samples for now and are displayed on every site — real client reviews will be automated later. They can&apos;t be edited.
              </p>
              <div className="space-y-2.5">
                {TEST_REVIEWS.map((t, i) => (
                  <div key={i} className="border border-[#e2e6ea] bg-[#fafbfc] p-3">
                    <p className="text-[12.5px] leading-relaxed text-[#374151]">&ldquo;{t.quote}&rdquo;</p>
                    <p className="mt-1.5 text-[11.5px] font-bold text-[#0d1117]">{t.name} <span className="font-medium text-[#9aa0aa]">— {t.where}</span></p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === "link" && (
            <>
              <p className="text-[12px] leading-relaxed text-[#6b7280]">
                This is the thumbnail shown when your website link is shared (WhatsApp, Facebook,
                iMessage…) — your hero exactly as the page renders it, plus your contact &amp; RERA
                card at the lower right. It regenerates from your <span className="font-bold">saved</span> site,
                so hit Save first, then Refresh.
              </p>
              <div className="border border-[#e8eaed] bg-[#fafbfc] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={ogBust}
                  src={`${siteSlug ? `/website/${siteSlug}` : "/website/sample"}/opengraph-image?r=${ogBust}`}
                  alt="Link share preview"
                  className="w-full border border-[#e2e6ea]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-[11px] text-[#9aa0aa]">
                    {siteSlug ? `fhiglobal.ae/website/${siteSlug}` : "Sample preview — save to generate yours"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOgBust((n) => n + 1)}
                    className="inline-flex shrink-0 items-center gap-1.5 border border-[#e2e6ea] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9]"
                  >
                    <RotateCcw className="h-3 w-3" /> Refresh
                  </button>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-[#9aa0aa]">
                Note: messaging apps cache thumbnails — after changing your hero, use e.g. Facebook&apos;s
                Sharing Debugger to force platforms to re-scrape an already-shared link.
              </p>
            </>
          )}
        </div>

        {/* Footer — title, publish state and the View/Reset/Save actions */}
        <div className="shrink-0 border-t border-[#eef0f3] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={siteSlug ? `/website/${siteSlug}` : "/website/sample"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 border border-[#e2e6ea] px-2.5 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {siteSlug ? "View Site" : "Sample"}
              </a>
              <button
                type="button"
                onClick={() => void reset()}
                disabled={resetting}
                title="Discard unsaved edits and reload your saved site"
                className="inline-flex h-8 items-center gap-1.5 border border-[#e2e6ea] px-2.5 text-[12px] font-semibold text-[#0d1117] transition-colors hover:bg-[#f4f6f9] disabled:opacity-60"
              >
                {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reset
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex h-8 items-center gap-1.5 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {siteSlug ? "Save" : "Save & Publish"}
              </button>
            </div>
          </div>
          {saveError && <p className="mt-2 text-[11px] font-semibold text-red-600">{saveError}</p>}
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className="min-w-0 flex-1">
        <LivePreview data={data} target={previewTarget} onSectionInView={handleSectionInView} />
      </div>
    </div>
  )
}
