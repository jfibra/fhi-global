"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  AlertCircle, Building2, ClipboardList, Loader2, Search, Star,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import {
  fetchMyAgentListings, setAgentListingFeatured, type AgentListing,
} from "@/lib/agent-listings-service"
import { fetchProjects, type Project } from "@/lib/project-service"
import {
  FEATURED_PROJECTS_MAX, readFeaturedProjects, type FeaturedItem,
} from "@/lib/public-profile"
import { DISPLAY } from "@/features/dashboard/listings/listing-ui"

/**
 * Featured — the ONE place a listing or a project gets pinned to this profile.
 *
 * Listings write `agent_listings.is_featured` (a listing has exactly one owner,
 * so that column is already per-profile). Projects write an ordered id list into
 * `profiles.metadata.featured_projects` rather than `projects.is_featured`,
 * because that column is a single site-wide flag an admin sets — writing to it
 * from here would change what every visitor sees, not just this profile.
 *
 * Both save on the click rather than on the page's Save Changes button: a pin is
 * one discrete act, and batching it would make "did that take?" ambiguous.
 */

const FEATURED_LISTINGS_MAX = 6
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""

function StarButton({
  on,
  busy,
  disabled,
  onClick,
  label,
}: {
  on: boolean
  busy?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        on
          ? "text-[#8a6a10] bg-[#d6b357]/20 hover:bg-[#d6b357]/30"
          : "text-[#9ca3af] hover:text-[#8a6a10] hover:bg-[#d6b357]/15"
      }`}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Star className={`w-4 h-4 ${on ? "fill-current" : ""}`} />
      )}
    </button>
  )
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-[#eef1f5]">
      {src ? (
        <Image src={src} alt={alt} fill sizes="44px" className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#b8bfc9]">
          <Building2 className="w-4 h-4" />
        </div>
      )}
    </div>
  )
}

function Count({ n, max }: { n: number; max: number }) {
  return (
    <span
      className={`shrink-0 text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 tabular-nums ${
        n >= max ? "text-[#8a6a10] bg-[#d6b357]/20" : "text-[#6b7280] bg-[#f0f2f5]"
      }`}
    >
      {n} of {max}
    </span>
  )
}

export function FeaturedPanel({
  onSelectionChange,
}: {
  /** Lets the maker's live preview mirror the pins without refetching them. */
  onSelectionChange?: (sel: { listings: FeaturedItem[]; projects: FeaturedItem[] }) => void
}) {
  const { user, profile } = useAuth()
  const userId = user?.id ?? ""

  const [listings, setListings] = useState<AgentListing[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [picked, setPicked] = useState<number[]>(() => readFeaturedProjects(profile?.metadata))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  // Every setState happens after the await, which keeps this off the
  // cascading-render path the repo's lint rule guards against.
  useEffect(() => {
    if (!userId) return
    let alive = true
    void (async () => {
      const [mine, pubProjects] = await Promise.all([
        fetchMyAgentListings(userId),
        fetchProjects({ isPublished: true, perPage: 100 }),
      ])
      if (!alive) return
      setError(mine.error ?? pubProjects.error ?? null)
      setListings((mine.data ?? []).filter((r) => !r.deleted_at))
      setProjects(pubProjects.data ?? [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [userId])

  const featuredListingCount = listings.filter((r) => r.is_featured).length

  /** Pinned first, so what is featured is always at the top of the list. */
  const orderedListings = useMemo(
    () =>
      [...listings].sort((a, b) => {
        if (Boolean(a.is_featured) !== Boolean(b.is_featured)) return a.is_featured ? -1 : 1
        return a.title.localeCompare(b.title)
      }),
    [listings],
  )

  const orderedProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? projects.filter((p) => `${p.name} ${p.city ?? ""}`.toLowerCase().includes(q))
      : projects
    return [...matches].sort((a, b) => {
      const ap = picked.includes(a.id)
      const bp = picked.includes(b.id)
      if (ap !== bp) return ap ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [projects, picked, query])

  const toggleListing = async (row: AgentListing) => {
    const next = !row.is_featured
    if (next && featuredListingCount >= FEATURED_LISTINGS_MAX) return
    setBusy(row.id)
    setListings((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_featured: next } : r)))
    const { error: err } = await setAgentListingFeatured(row.id, userId, next)
    setBusy(null)
    if (err) {
      // Put it back: the write is the source of truth, not the click.
      setListings((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_featured: !next } : r)))
      setError(err)
    }
  }

  const toggleProject = async (project: Project) => {
    const on = picked.includes(project.id)
    if (!on && picked.length >= FEATURED_PROJECTS_MAX) return
    const before = picked
    const next = on ? picked.filter((id) => id !== project.id) : [...picked, project.id]
    setBusy(`p${project.id}`)
    setPicked(next)
    try {
      const res = await fetch(`${API_BASE}/api/me/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured_projects: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      setError(null)
    } catch (err) {
      setPicked(before)
      setError(err instanceof Error ? err.message : "Could not save that pick.")
    } finally {
      setBusy(null)
    }
  }

  // Mirrored to the preview in the same shape the public page receives, so what
  // you see in the phone frame is what a visitor gets.
  const selection: { listings: FeaturedItem[]; projects: FeaturedItem[] } = useMemo(() => {
    const money = (n: number | string | null | undefined, currency: string | null) => {
      const v = typeof n === "string" ? Number(n) : n
      if (v == null || !Number.isFinite(v)) return "Price on request"
      return `${(currency || "AED").toUpperCase()} ${new Intl.NumberFormat("en-US").format(v)}`
    }
    const pinnedListings: FeaturedItem[] = listings
      .filter((r) => r.is_featured && r.status === "published")
      .map((r) => ({
        kind: "listing" as const,
        href: `/listings/${r.slug || r.id}`,
        title: r.title,
        subtitle: [r.unit_type, `For ${r.listing_kind}`].filter(Boolean).join(" · "),
        price: money(r.price ?? r.projects?.launch_price_from ?? null, r.currency ?? r.projects?.currency ?? null),
        image:
          [...(r.agent_listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
          r.projects?.main_image ??
          null,
      }))
    const byId = new Map(projects.map((p) => [p.id, p]))
    const pinnedProjects: FeaturedItem[] = picked.flatMap((id) => {
      const p = byId.get(id)
      if (!p) return []
      return [{
        kind: "project" as const,
        href: p.developers?.slug ? `/${p.developers.slug}/${p.slug}` : `/projects/${p.slug}`,
        title: p.name,
        subtitle: p.city ?? "",
        price: money(p.launch_price_from, p.currency),
        image: p.main_image,
      }]
    })
    return { listings: pinnedListings, projects: pinnedProjects }
  }, [listings, projects, picked])

  useEffect(() => {
    onSelectionChange?.(selection)
  }, [selection, onSelectionChange])

  const rowCls = "flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors"

  return (
    <div className="bg-white rounded-2xl border border-[#e4e7ec] shadow-[0_2px_16px_-4px_rgba(0,31,63,0.08)] p-6 space-y-5">
      {/* Section header */}
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] flex items-center justify-center">
          <Star className="w-4 h-4 text-[#d6b357]" />
        </span>
        <div>
          <h2 className={`${DISPLAY} text-base font-bold text-[#0d1117]`}>Featured</h2>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            Pin your best listings and projects to this profile. This is the only place they&apos;re
            chosen, and each star saves on the spot.
          </p>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-rose-600" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-[#001f3f] animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Listings ────────────────────────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#374151]">
                <ClipboardList className="w-3.5 h-3.5 text-[#6b7280]" /> My listings
              </h3>
              <Count n={featuredListingCount} max={FEATURED_LISTINGS_MAX} />
            </div>

            {orderedListings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-6 text-center text-xs text-[#6b7280]">
                You don&apos;t have any listings yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {orderedListings.map((row) => {
                  const on = Boolean(row.is_featured)
                  const atCap = !on && featuredListingCount >= FEATURED_LISTINGS_MAX
                  return (
                    <div
                      key={row.id}
                      className={`${rowCls} ${on ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#eef0f2] bg-[#fcfcfd]"}`}
                    >
                      <Thumb src={row.agent_listing_images?.[0]?.url ?? null} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{row.title}</p>
                        <p className="text-[11px] text-[#6b7280] capitalize">
                          For {row.listing_kind} &middot; {row.status}
                        </p>
                      </div>
                      <StarButton
                        on={on}
                        busy={busy === row.id}
                        disabled={atCap}
                        onClick={() => void toggleListing(row)}
                        label={
                          atCap
                            ? `You can feature ${FEATURED_LISTINGS_MAX} listings at a time`
                            : on
                              ? "Remove from featured"
                              : "Feature on my profile"
                        }
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Projects ────────────────────────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#374151]">
                <Building2 className="w-3.5 h-3.5 text-[#6b7280]" /> Projects
              </h3>
              <Count n={picked.length} max={FEATURED_PROJECTS_MAX} />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects by name or city"
                aria-label="Search projects"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"
              />
            </div>

            {orderedProjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-6 text-center text-xs text-[#6b7280]">
                {query.trim() ? "No project matches that search." : "No published projects yet."}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {orderedProjects.map((p) => {
                  const on = picked.includes(p.id)
                  const atCap = !on && picked.length >= FEATURED_PROJECTS_MAX
                  return (
                    <div
                      key={p.id}
                      className={`${rowCls} ${on ? "border-[#d6b357] bg-[#fffdf3]" : "border-[#eef0f2] bg-[#fcfcfd]"}`}
                    >
                      <Thumb src={p.main_image} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{p.name}</p>
                        <p className="text-[11px] text-[#6b7280] truncate">
                          {p.developers?.name ?? "—"}
                          {p.city ? ` · ${p.city}` : ""}
                        </p>
                      </div>
                      <StarButton
                        on={on}
                        busy={busy === `p${p.id}`}
                        disabled={atCap}
                        onClick={() => void toggleProject(p)}
                        label={
                          atCap
                            ? `You can feature ${FEATURED_PROJECTS_MAX} projects at a time`
                            : on
                              ? "Remove from featured"
                              : "Feature on my profile"
                        }
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
