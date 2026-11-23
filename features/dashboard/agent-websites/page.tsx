"use client"

/**
 * Agent Websites (admin → Agent Resource): every agent's Website Builder site.
 * Preview it as clients see it, open the live page, take it down (soft delete:
 * off the public page, directory and sitemap — everything kept, can be
 * restored) or delete it for good (typed confirmation). Data and actions:
 * /api/admin/agent-websites (admin staff only, audit-logged).
 */

import { useEffect, useMemo, useState } from "react"
import { ArchiveRestore, Eye, EyeOff, ExternalLink, Globe, Loader2, Search, Trash2, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole, roleToLabel } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { SITE_URL } from "@/lib/seo"
import type { Testimonial, WebsiteData } from "@/app/website/_data"
import type { AdminAgentWebsite } from "@/app/api/admin/agent-websites/route"
import { LivePreview } from "@/features/dashboard/my-website/site-preview"

type Filter = "all" | "live" | "down"

const siteUrl = (slug: string) => `${SITE_URL.replace(/\/$/, "")}/website/${slug}`
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"

export default function AgentWebsitesPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))

  const [sites, setSites] = useState<AdminAgentWebsite[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewOf, setPreviewOf] = useState<AdminAgentWebsite | null>(null)
  const [deleteOf, setDeleteOf] = useState<AdminAgentWebsite | null>(null)

  useEffect(() => {
    if (!allowed) return
    let active = true
    fetch("/api/admin/agent-websites")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!active) return
        if (!r.ok) return setError(j.error ?? "Couldn't load the agent websites.")
        setSites(j.sites ?? [])
      })
      .catch(() => { if (active) setError("Couldn't load the agent websites.") })
    return () => { active = false }
  }, [allowed])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (sites ?? []).filter((s) => {
      if (filter === "live" && !s.live) return false
      if (filter === "down" && s.live) return false
      return !q || s.agent.name.toLowerCase().includes(q) || s.slug.includes(q) || s.title.toLowerCase().includes(q)
    })
  }, [sites, query, filter])

  if (!allowed) return null

  const counts = {
    all: sites?.length ?? 0,
    live: sites?.filter((s) => s.live).length ?? 0,
    down: sites?.filter((s) => !s.live).length ?? 0,
  }

  const setLive = async (site: AdminAgentWebsite, live: boolean) => {
    setBusyId(site.id)
    setError(null)
    try {
      const r = await fetch(`/api/admin/agent-websites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? "Couldn't change that website.")
      setSites((all) => (all ?? []).map((s) => (s.id === site.id ? { ...s, live } : s)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that website.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Globe className="h-6 w-6 text-[#001f3f]" /> Agent Websites
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {counts.live} live · {counts.down} taken down
          </p>
        </div>
        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agent or address"
            className="h-10 w-full rounded-xl border border-[#e5e8ec] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#001f3f]"
          />
        </label>
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Show">
        {([
          { v: "all", label: `All (${counts.all})` },
          { v: "live", label: `Live (${counts.live})` },
          { v: "down", label: `Taken down (${counts.down})` },
        ] as const).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
            className={`h-8 rounded-full border px-3 text-xs font-bold ${filter === v ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#e5e8ec] bg-white text-[#374151] hover:border-[#001f3f]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </p>
      )}

      {sites === null && !error ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl border border-[#e8eaed] bg-white" />)}</div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-[#e8eaed] bg-white p-6 text-center text-sm text-[#6b7280]">No websites match.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-[#e8eaed] bg-white p-3 shadow-sm md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#eef0f3]">
                  {s.agent.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.agent.photo} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#6b7280]">{s.agent.name.charAt(0)}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-bold text-[#0d1117]">{s.agent.name}</span>
                    {s.agent.role && <span className="text-xs text-[#6b7280]">{roleToLabel(s.agent.role)}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                      {s.live ? "Live" : "Taken down"}
                    </span>
                    {s.live && !s.complete && (
                      <span className="rounded-full bg-[#f4f5f7] px-2 py-0.5 text-[11px] font-semibold text-[#6b7280]" title="Name, bio or portrait still missing — not offered to search engines yet">
                        Not in search yet
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-[#001f3f]">{siteUrl(s.slug).replace(/^https?:\/\//, "")}</p>
                  <p className="text-xs text-[#9ca3af]">Updated {shortDate(s.updatedAt)} · created {shortDate(s.createdAt)}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button type="button" onClick={() => setPreviewOf(s)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e8ec] px-3 text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]">
                  <Eye className="h-4 w-4" /> Preview
                </button>
                {s.live && (
                  <a href={`/website/${s.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e8ec] px-3 text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]">
                    <ExternalLink className="h-4 w-4" /> Open
                  </a>
                )}
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void setLive(s, !s.live)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e8ec] px-3 text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-50"
                >
                  {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : s.live ? <EyeOff className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                  {s.live ? "Take down" : "Restore"}
                </button>
                <button type="button" onClick={() => setDeleteOf(s)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 hover:border-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewOf && <PreviewModal site={previewOf} onClose={() => setPreviewOf(null)} />}
      {deleteOf && (
        <DeleteModal
          site={deleteOf}
          onClose={() => setDeleteOf(null)}
          onDeleted={(id) => {
            setSites((all) => (all ?? []).filter((s) => s.id !== id))
            setDeleteOf(null)
          }}
        />
      )}
    </div>
  )
}

/** The site as clients see it (or would, when taken down) — the same template the live page uses. */
function PreviewModal({ site, onClose }: { site: AdminAgentWebsite; onClose: () => void }) {
  const [state, setState] = useState<{ data: WebsiteData; reviews: Testimonial[] } | "error" | null>(null)
  useEffect(() => {
    let active = true
    fetch(`/api/admin/agent-websites/${site.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (active) setState({ data: j.data, reviews: j.reviews ?? [] }) })
      .catch(() => { if (active) setState("error") })
    return () => { active = false }
  }, [site.id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-[#f4f5f7] px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-1 text-xs text-[#6b7280]">
            {siteUrl(site.slug).replace(/^https?:\/\//, "")}
            {!site.live && <span className="ml-2 font-bold text-amber-700">· taken down — only admins see this</span>}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-[#6b7280] hover:bg-white hover:text-[#0d1117]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {state === "error" ? (
            <p className="p-6 text-sm text-red-700">Couldn&apos;t load this website.</p>
          ) : state ? (
            <LivePreview data={state.data} reviews={state.reviews} target={null} qrValue={siteUrl(site.slug)} />
          ) : (
            <div className="h-full animate-pulse bg-[#eef0f3]" />
          )}
        </div>
      </div>
    </div>
  )
}

/** Permanent delete — the admin types the site's address to confirm. */
function DeleteModal({ site, onClose, onDeleted }: { site: AdminAgentWebsite; onClose: () => void; onDeleted: (id: string) => void }) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = typed.trim() === site.slug
  const remove = async () => {
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/admin/agent-websites/${site.id}?confirm=${encodeURIComponent(site.slug)}`, { method: "DELETE" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? "Couldn't delete that website.")
      onDeleted(site.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that website.")
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Delete {site.agent.name}&apos;s website for good?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
            Everything on it — hero, about, featured projects, areas and gallery — is removed and can&apos;t be brought back.
            {site.live ? " To only hide it, use Take down instead." : ""} The agent can build a new one later.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-[#374151]">
            Type <span className="font-mono text-[#0d1117]">{site.slug}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="h-10 w-full rounded-xl border border-[#e5e8ec] px-3 font-mono text-sm outline-none focus:border-red-500"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl border border-[#e5e8ec] px-4 text-sm font-semibold text-[#374151] hover:border-[#001f3f] disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={() => void remove()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete for good
          </button>
        </div>
      </div>
    </div>
  )
}
