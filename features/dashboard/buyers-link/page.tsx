"use client"

// Agent Resource → Buyers Link (migration 060). The agent picks up to six
// projects and gets a short link to send a client; the client sees those
// projects and can leave their details, which land here. Reads run under
// RLS; writes go through /api/buyer-links.

import { useMemo, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import {
  Check, Copy, Download, ExternalLink, Link2, Loader2, MessageCircle, Pause, Play, Plus, QrCode, Search, Trash2, Users, X,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { titleCaseName } from "@/lib/public-profile"
import {
  BUYER_LINK_MAX_PROJECTS, budgetLabel, buyerLinkPath, contactTimeLabel, waDigits, type BuyerLead, type BuyerLink,
} from "@/lib/buyer-links"
import {
  createBuyerLink, deleteBuyerLink, fetchMyBuyerLinks, fetchPickableProjects, setBuyerLinkActive, type PickableProject,
} from "@/lib/buyer-link-service"

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })

const labelCls = "mb-1.5 block text-[12px] font-bold text-[#0d1117]"
const hintCls = "mt-1.5 text-[11.5px] text-[#9ca3af]"
const inputCls =
  "w-full border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-2.5 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:bg-white focus:outline-none"
const ghostBtn =
  "inline-flex items-center gap-1.5 border border-[#e8eaed] bg-white px-3 py-2 text-[13px] font-semibold text-[#374151] transition-colors hover:border-[#c9ced6] disabled:opacity-50"

export default function BuyersLinkPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(canUseBuyerLinks(role))
  const [links, setLinks] = useState<BuyerLink[] | null>(null)
  const [leads, setLeads] = useState<BuyerLead[]>([])
  const [projects, setProjects] = useState<PickableProject[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [qr, setQr] = useState<{ title: string; url: string; code: string; data: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null)

  const userId = user?.id ?? null
  useEffect(() => {
    if (!allowed || !userId) return
    let live = true
    void Promise.all([fetchMyBuyerLinks(userId), fetchPickableProjects()]).then(([mine, pickable]) => {
      if (!live) return
      setOrigin(window.location.origin)
      if (mine.error) setLoadError(mine.error)
      setLinks(mine.links)
      setLeads(mine.leads)
      setProjects(pickable)
    })
    return () => {
      live = false
    }
  }, [allowed, userId])

  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  const linkById = useMemo(() => new Map((links ?? []).map((l) => [l.id, l])), [links])
  const leadCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of leads) counts.set(l.link_id, (counts.get(l.link_id) ?? 0) + 1)
    return counts
  }, [leads])

  if (!allowed) return null

  const agentFirst = titleCaseName(profile?.fullname ?? "").split(" ")[0] || "your advisor"
  const urlFor = (l: BuyerLink) => `${origin}${buyerLinkPath(l.code)}`

  const copy = async (l: BuyerLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(l))
      setCopied(l.id)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(null), 2000)
    } catch {
      setActionError({ id: l.id, message: "Could not copy — select the link and copy it by hand." })
    }
  }

  const showQr = async (l: BuyerLink) => {
    const url = urlFor(l)
    try {
      // Navy-on-white so a printed QR still scans cleanly.
      const data = await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#001f3f", light: "#ffffff" } })
      setQr({ title: l.title, url, code: l.code, data })
    } catch {
      setActionError({ id: l.id, message: "Could not make the QR code." })
    }
  }

  const toggle = async (l: BuyerLink) => {
    setToggling(l.id)
    setActionError(null)
    const { link, error } = await setBuyerLinkActive(l.id, !l.is_active)
    setToggling(null)
    if (!link) {
      setActionError({ id: l.id, message: error ?? "Could not update the link." })
      return
    }
    setLinks((prev) => prev?.map((x) => (x.id === link.id ? link : x)) ?? prev)
  }

  const remove = async (l: BuyerLink) => {
    const n = leadCount.get(l.id) ?? 0
    const clients = n === 0 ? "" : ` Its ${n} ${n === 1 ? "client" : "clients"} will be deleted too.`
    if (!window.confirm(`Delete "${l.title}"?${clients} The link stops working and this can't be undone.`)) return
    setToggling(l.id)
    setActionError(null)
    const { error } = await deleteBuyerLink(l.id)
    setToggling(null)
    if (error) {
      setActionError({ id: l.id, message: error })
      return
    }
    setLinks((prev) => prev?.filter((x) => x.id !== l.id) ?? prev)
    setLeads((prev) => prev.filter((x) => x.link_id !== l.id))
  }

  return (
    <div className="w-full max-w-5xl space-y-8">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <Link2 className="w-6 h-6 text-[#001f3f]" />
          Buyers Link
        </h1>
        <p className="text-sm text-[#6b7280] mt-1 max-w-3xl">
          Pick projects for your clients and send them one link. They see the photos, prices and payment
          plans, and can send you their details — which arrive right here.
        </p>
      </div>

      {loadError && (
        <p className="bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#b91c1c]">Could not load your links: {loadError}</p>
      )}

      <CreateLinkForm
        projects={projects}
        onCreated={(link) => {
          setLinks((prev) => [link, ...(prev ?? [])])
          setJustCreated(link.id)
        }}
      />

      {/* ── Your links ── */}
      <section>
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-4">
          {links && links.length > 0 ? `Your links (${links.length})` : "Your links"}
        </h2>
        {links === null && !loadError && (
          <div className="flex items-center justify-center py-12 bg-white border border-[#e8eaed]">
            <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
          </div>
        )}
        {links !== null && links.length === 0 && (
          <p className="bg-white border border-dashed border-[#dfe3e8] px-5 py-8 text-center text-sm text-[#6b7280]">
            No links yet — create your first one above.
          </p>
        )}
        <div className="space-y-3">
          {(links ?? []).map((l) => {
            const url = urlFor(l)
            const n = leadCount.get(l.id) ?? 0
            return (
              <article
                key={l.id}
                className={`bg-white border p-5 ${justCreated === l.id ? "border-[#d6b357] ring-2 ring-[#d6b357]/25" : "border-[#e8eaed]"}`}
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-[#0d1117]">{l.title}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold ${l.is_active ? "bg-[#e8f6ee] text-[#15803d]" : "bg-[#f3f4f6] text-[#6b7280]"}`}>
                    {l.is_active ? "Active" : "Paused"}
                  </span>
                  {justCreated === l.id && <span className="text-[11px] font-bold text-[#8a6d2a]">New — send it to your client</span>}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#374151]">
                    <Users className="w-3.5 h-3.5" /> {n} {n === 1 ? "client" : "clients"}
                  </span>
                </header>
                <p className="mt-1.5 text-[13px] text-[#6b7280]">
                  {l.project_ids.map((id) => projectName.get(id) ?? "Unlisted project").join(" · ")}
                  <span className="text-[#b7bcc4]"> · created {fmtDate(l.created_at)}</span>
                </p>
                <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Link for ${l.title}`}
                    className="min-w-0 flex-1 border border-[#e5e7eb] bg-[#fafbfc] px-3 py-2 text-sm text-[#0d1117]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copy(l)} className="inline-flex items-center gap-1.5 bg-[#d6b357] px-3.5 py-2 text-[13px] font-bold text-[#1a1408] hover:brightness-95">
                      {copied === l.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied === l.id ? "Copied!" : "Copy"}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`${l.title}\n${url}`)}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                      <MessageCircle className="w-4 h-4 text-[#25d366]" /> WhatsApp
                    </a>
                    <button type="button" onClick={() => void showQr(l)} className={ghostBtn}>
                      <QrCode className="w-4 h-4" /> QR
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                      <ExternalLink className="w-4 h-4" /> Open
                    </a>
                    <button type="button" onClick={() => void toggle(l)} disabled={toggling === l.id} className={ghostBtn}>
                      {toggling === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {l.is_active ? "Pause" : "Activate"}
                    </button>
                    <button type="button" onClick={() => void remove(l)} disabled={toggling === l.id} className={`${ghostBtn} hover:border-[#fecaca] hover:text-[#b91c1c]`}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
                {actionError?.id === l.id && <p className="mt-2 text-xs text-[#b91c1c]">{actionError.message}</p>}
              </article>
            )
          })}
        </div>
      </section>

      {/* ── Clients who sent their details ── */}
      <section>
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] mb-4">
          {leads.length > 0 ? `Clients (${leads.length})` : "Clients"}
        </h2>
        {links !== null && leads.length === 0 && (
          <p className="bg-white border border-dashed border-[#dfe3e8] px-5 py-8 text-center text-sm text-[#6b7280]">
            When a client sends their details from one of your links, they appear here.
          </p>
        )}
        <div className="space-y-3">
          {leads.map((lead) => {
            const link = linkById.get(lead.link_id)
            const names = lead.project_ids.map((id) => projectName.get(id)).filter((n): n is string => !!n)
            const wa = waDigits(lead.whatsapp_code, lead.whatsapp)
            const first = lead.name.trim().split(/\s+/)[0]
            const hello = `Hi ${first}, this is ${agentFirst} from FHI Global${names.length ? ` about ${names.join(", ")}` : ""}.`
            const budget = budgetLabel(lead.budget)
            const time = contactTimeLabel(lead.contact_time)
            return (
              <article key={lead.id} className="bg-white border border-[#e8eaed] p-5">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-[#0d1117]">{lead.name}</span>
                  {link && <span className="text-xs text-[#6b7280]">via {link.title}</span>}
                  <time className="ml-auto text-xs text-[#9ca3af]">{fmtDate(lead.created_at)}</time>
                </header>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#374151]">
                  <span>WhatsApp: <span className="font-semibold">{lead.whatsapp_code} {lead.whatsapp}</span></span>
                  {lead.email && <a href={`mailto:${lead.email}`} className="text-[#001f3f] underline">{lead.email}</a>}
                  {budget && <span>Budget: <span className="font-semibold">{budget}</span></span>}
                  {time && <span>Best time: <span className="font-semibold">{time}</span></span>}
                </div>
                {names.length > 0 && <p className="mt-1.5 text-[13px] text-[#6b7280]">Interested in: {names.join(", ")}</p>}
                {lead.message && (
                  <p className="mt-3 whitespace-pre-line border-l-2 border-[#d6b357] pl-3 text-sm text-[#374151]">{lead.message}</p>
                )}
                {wa && (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(hello)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 bg-[#25d366] px-4 py-2 text-sm font-bold text-white hover:bg-[#1fb857]"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp {first}
                  </a>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setQr(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`QR code for ${qr.title}`}
        >
          <div className="w-full max-w-sm bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[#0d1117]">{qr.title}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.data} alt={`QR code for ${qr.title}`} className="mx-auto mt-4 h-60 w-60" />
            <p className="mt-2 break-all text-xs text-[#6b7280]">{qr.url}</p>
            <div className="mt-4 flex justify-center gap-2">
              <a href={qr.data} download={`buyers-link-${qr.code}.png`} className="inline-flex items-center gap-1.5 bg-[#d6b357] px-4 py-2 text-sm font-bold text-[#1a1408] hover:brightness-95">
                <Download className="w-4 h-4" /> Download
              </a>
              <button type="button" onClick={() => setQr(null)} className={ghostBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateLinkForm({ projects, onCreated }: { projects: PickableProject[]; onCreated: (link: BuyerLink) => void }) {
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [picked, setPicked] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return projects
      .filter((p) => !picked.includes(p.id) && (p.name.toLowerCase().includes(q) || (p.developer ?? "").toLowerCase().includes(q)))
      .slice(0, 8)
  }, [projects, picked, query])
  const full = picked.length >= BUYER_LINK_MAX_PROJECTS

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { link, error: err } = await createBuyerLink({ title, note, projectIds: picked })
    setBusy(false)
    if (!link) {
      setError(err ?? "Could not create the link.")
      return
    }
    setTitle("")
    setNote("")
    setPicked([])
    setQuery("")
    onCreated(link)
  }

  return (
    <form onSubmit={submit} className="bg-white border border-[#e8eaed]">
      <div className="border-b border-[#f0f2f5] px-5 py-4">
        <h2 className="font-['Outfit'] text-base font-bold text-[#0d1117] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#b8913f]" /> Create a Buyers Link
        </h2>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label htmlFor="bl-title" className={labelCls}>Title *</label>
            <input
              id="bl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. 2-bedroom options in JVC"
              className={inputCls}
            />
            <p className={hintCls}>Your client sees this as the page heading and in the WhatsApp preview.</p>
          </div>
          <div>
            <label htmlFor="bl-note" className={labelCls}>Note to your client <span className="font-normal text-[#9ca3af]">(optional)</span></label>
            <textarea
              id="bl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Here are the projects we talked about — tell me which ones you like."
              className={`${inputCls} resize-y`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="bl-search" className={labelCls}>
            Projects * <span className="font-normal text-[#9ca3af]">({picked.length}/{BUYER_LINK_MAX_PROJECTS})</span>
          </label>
          {picked.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {picked.map((id) => {
                const p = byId.get(id)
                return (
                  <li key={id} className="flex items-center justify-between gap-2 border border-[#e8eaed] bg-[#fafbfc] px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-[#0d1117]">{p?.name ?? `Project ${id}`}</span>
                      {p?.developer && <span className="text-[#9ca3af]"> · {p.developer}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicked((cur) => cur.filter((x) => x !== id))}
                      aria-label={`Remove ${p?.name ?? "project"}`}
                      className="shrink-0 text-[#9ca3af] hover:text-[#b91c1c]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {full ? (
            <p className={hintCls}>That&rsquo;s the maximum of {BUYER_LINK_MAX_PROJECTS} projects for one link.</p>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                id="bl-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={projects.length ? "Search a project or developer" : "Loading projects…"}
                autoComplete="off"
                className={`${inputCls} pl-9`}
              />
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto border border-[#e8eaed] bg-white shadow-lg">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked((cur) => [...cur, p.id])
                          setQuery("")
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f6f8]"
                      >
                        <span className="font-semibold text-[#0d1117]">{p.name}</span>
                        {p.developer && <span className="text-[#9ca3af]"> · {p.developer}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && results.length === 0 && projects.length > 0 && (
                <p className={hintCls}>No published project matches &ldquo;{query.trim()}&rdquo;.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <button
          type="submit"
          disabled={busy || !title.trim() || picked.length === 0}
          className="inline-flex items-center gap-2 bg-[#001f3f] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Create link
        </button>
        {error && <span className="text-sm text-[#b91c1c]">{error}</span>}
      </div>
    </form>
  )
}
