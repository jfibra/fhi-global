"use client"

// Poster Maker — admin-staff studio reached from the Agent Resource bento.
// Listings mode: pick any published listing and open the existing Flyer /
// Announcement Poster modals (they self-fetch marketing data by listing id).
// Projects mode: pick any published project and open the existing per-project
// Poster Studio (ProjectPosterTab) in a full-screen shell.

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  FileImage, ImagePlus, LayoutTemplate, Loader2, Megaphone, Search, X,
} from "lucide-react"
import FlyerModal from "@/components/dashboard/listings/marketing/FlyerModal"
import AnnouncementModal from "@/components/dashboard/listings/marketing/AnnouncementModal"
import { ProjectPosterTab } from "@/features/dashboard/projects/project-poster-tab"
import { fetchProject, fetchProjects, type Project } from "@/lib/project-service"

/** Portals here only mount after user interaction (modal open, toast), so the
 *  document is always available and no hydration pass ever renders them. */
function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body)
}

/** Full-screen modal shell — same chrome as the projects browser's studios. */
function StudioModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <Portal>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6">
        <div className="absolute inset-0 bg-[#001428]/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <div className="relative bg-[#f9fafb] rounded-3xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-[#f0f0f0] flex-shrink-0">
            <p className="text-sm font-semibold text-[#6b7280] truncate">{title}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f3f4f6] text-[#6b7280] hover:text-[#001f3f] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </Portal>
  )
}

const inputWrapCls =
  "mb-4 flex items-center gap-2 bg-[#f3f4f6] rounded-xl px-3.5 py-2.5 border border-transparent focus-within:border-[#001f3f]/25 transition-all max-w-md"

// ─── Listings mode ──────────────────────────────────────────────────────────────

type PublishedListingDto = {
  id: string
  title: string
  listingKind: "sale" | "rent"
  price: number | null
  currency: string
  projectName: string | null
  agentName: string | null
  images: { id: string; url: string; sort_order: number }[]
}

function ListingPosterStudio() {
  const [listings, setListings] = useState<PublishedListingDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState<{ listing: PublishedListingDto; tool: "flyer" | "announce" } | null>(null)

  useEffect(() => {
    let alive = true
    void fetch("/api/reels-maker/listings", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { listings?: PublishedListingDto[] }) : { listings: [] }))
      .catch(() => ({ listings: [] as PublishedListingDto[] }))
      .then((json) => {
        if (!alive) return
        setListings(json.listings ?? [])
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const q = search.trim().toLowerCase()
  const visible = !q
    ? listings
    : listings.filter((l) =>
        [l.title, l.agentName ?? "", l.projectName ?? ""].some((s) => s.toLowerCase().includes(q)),
      )

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
      <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5">
        Pick a listing, then choose Flyer or Just Listed/Sold
      </p>
      {loading ? (
        <p className="text-sm text-[#9ca3af] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading listings…
        </p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-[#9ca3af]">No published listings available yet.</p>
      ) : (
        <>
          <div className={inputWrapCls}>
            <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by property, agent, or project…"
              className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none min-w-0"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-[#9ca3af] hover:text-[#374151] text-xs">✕</button>
            )}
          </div>
          {visible.length === 0 && <p className="text-sm text-[#9ca3af]">No listings match your search.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {visible.map((l) => {
              const cover = l.images[0]?.url ?? null
              return (
                <div key={l.id} className="rounded-xl border-2 border-[#e5e5e5] overflow-hidden">
                  <div className="relative h-24 bg-[#eef1f5]">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={l.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                        <ImagePlus className="w-5 h-5" />
                      </div>
                    )}
                    <span
                      className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white ${
                        l.listingKind === "rent" ? "bg-[#2f6fe4]" : "bg-[#d6b357]"
                      }`}
                    >
                      {l.listingKind === "rent" ? "RENT" : "SALE"}
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-[#111827] truncate">{l.title}</p>
                    {l.agentName && (
                      <p className="text-[10px] font-semibold text-[#001f3f] truncate">{l.agentName}</p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActive({ listing: l, tool: "flyer" })}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#001f3f] px-2 py-1.5 text-[10px] font-bold text-white hover:bg-[#00284f] transition-colors"
                      >
                        <FileImage className="w-3 h-3" /> Flyer
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive({ listing: l, tool: "announce" })}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#001f3f]/25 px-2 py-1.5 text-[10px] font-bold text-[#001f3f] hover:bg-[#f3f6fa] transition-colors"
                      >
                        <Megaphone className="w-3 h-3" /> Just Listed/Sold
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {active?.tool === "flyer" && (
        <FlyerModal
          listingId={active.listing.id}
          listingTitle={active.listing.title}
          onClose={() => setActive(null)}
        />
      )}
      {active?.tool === "announce" && (
        <AnnouncementModal
          listingId={active.listing.id}
          listingTitle={active.listing.title}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}

// ─── Projects mode ──────────────────────────────────────────────────────────────

function ProjectPosterStudio() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [studioProject, setStudioProject] = useState<Project | null>(null)
  const [toast, setToast] = useState<{ variant: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    let alive = true
    void fetchProjects({ isPublished: true, isActive: true, perPage: 100 }).then(({ data }) => {
      if (!alive) return
      setProjects(data)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const openStudio = async (id: number) => {
    setOpeningId(id)
    const { data } = await fetchProject(id)
    setOpeningId(null)
    if (data) setStudioProject(data)
    else setToast({ variant: "error", message: "Could not load that project." })
  }

  const q = search.trim().toLowerCase()
  const visible = !q
    ? projects
    : projects.filter((p) =>
        [p.name, p.city ?? "", (p as { developers?: { name?: string | null } | null }).developers?.name ?? ""].some(
          (s) => (s ?? "").toLowerCase().includes(q),
        ),
      )

  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] p-5">
      <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5">
        Pick a project to open its Poster Studio
      </p>
      {loading ? (
        <p className="text-sm text-[#9ca3af] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
        </p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-[#9ca3af]">No published projects available yet.</p>
      ) : (
        <>
          <div className={inputWrapCls}>
            <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project, developer, or city…"
              className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9ca3af] outline-none min-w-0"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-[#9ca3af] hover:text-[#374151] text-xs">✕</button>
            )}
          </div>
          {visible.length === 0 && <p className="text-sm text-[#9ca3af]">No projects match your search.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {visible.map((p) => {
              const developer = (p as { developers?: { name?: string | null } | null }).developers
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void openStudio(p.id)}
                  disabled={openingId !== null}
                  className="text-left rounded-xl border-2 border-[#e5e5e5] overflow-hidden transition-all hover:border-[#9ca3af] disabled:opacity-60"
                >
                  <div className="relative h-24 bg-[#eef1f5]">
                    {p.main_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.main_image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                        <ImagePlus className="w-5 h-5" />
                      </div>
                    )}
                    {openingId === p.id && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#001f3f]" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-[#111827] truncate">{p.name}</p>
                    <p className="text-[10px] font-semibold text-[#001f3f] truncate">{developer?.name ?? ""}</p>
                    <p className="text-[10px] text-[#6b7280] truncate">{p.city ?? ""}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {studioProject && (
        <StudioModal title={`Poster Studio — ${studioProject.name}`} onClose={() => setStudioProject(null)}>
          <ProjectPosterTab
            project={studioProject}
            showToast={(variant, message) => setToast({ variant, message })}
          />
        </StudioModal>
      )}

      {toast && (
        <Portal>
          <div
            className={`fixed bottom-6 right-6 z-[200] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.variant === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        </Portal>
      )}
    </div>
  )
}

// ─── Entry ──────────────────────────────────────────────────────────────────────

export function PosterMakerClient({ source }: { source: "listings" | "projects" }) {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-[#001f3f]" />
          {source === "projects" ? "Project Posters" : "Listing Posters"}
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          {source === "projects"
            ? "Open any published project's Poster Studio — three designs, three formats, exported as print-ready PNG."
            : "Create flyers and Just Listed / Sold announcement posters from any published listing."}
        </p>
      </div>
      {source === "projects" ? <ProjectPosterStudio /> : <ListingPosterStudio />}
    </div>
  )
}
