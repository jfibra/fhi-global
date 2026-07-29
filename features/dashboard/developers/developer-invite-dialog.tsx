"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import {
  X, QrCode, Check, Copy, Download, MessageCircle, ChevronDown, ChevronRight, Search,
  Loader2, Trash2, Ban, Link2, Plus, Building2, ArrowLeft, Users, Mail, UserRound,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DeveloperLogo } from "@/components/developers/developer-logo"
import type { Developer } from "@/lib/developer-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

type PickerDeveloper = { id: string; name: string; logo_url: string | null }

type InviteListItem = {
  id: string
  url: string
  developer: { name: string; logo_url: string | null } | null
  label: string | null
  autoActivate: boolean
  expiresAt: string | null
  maxUses: number | null
  useCount: number
  isActive: boolean
  status: "active" | "expired" | "used_up" | "revoked" | "invalid"
  createdAt: string
}

type Recruit = {
  id: string
  name: string
  email: string | null
  role: string | null
  status: string | null
  isDeleted: boolean
  developerId: string | null
  developerName: string | null
  joinedAt: string | null
}

const EXPIRY_OPTIONS = [
  { label: "24 hours", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Never", days: 0 },
]

const inp =
  "w-full px-4 py-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:bg-white focus:ring-4 focus:ring-[#001f3f]/6 transition-all"

function FieldLabel({ text }: { text: string }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-1.5 block">{text}</label>
}

function Toggle({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-3 text-left">
      <span>
        <span className="text-sm font-semibold text-[#111827] block">{label}</span>
        <span className="text-xs text-[#9ca3af]">{hint}</span>
      </span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${on ? "bg-[#001f3f]" : "bg-[#d1d5db]"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  )
}

function DevSelect({
  developers,
  value,
  onChange,
  disabled,
}: {
  developers: PickerDeveloper[]
  value: PickerDeveloper | null
  onChange: (d: PickerDeveloper | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const filtered = q ? developers.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())) : developers
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-[#f9fafb] text-left disabled:opacity-60 ${open ? "border-[#001f3f] bg-white" : "border-[#e5e7eb]"}`}
      >
        {value ? (
          <>
            <DeveloperLogo url={value.logo_url} name={value.name} size={28} />
            <span className="flex-1 text-sm font-medium text-[#111827] truncate">{value.name}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-[#9ca3af]">Any developer (generic link)</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && (
        <>
          <button type="button" className="fixed inset-0 z-[60]" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute z-[70] mt-1.5 w-full bg-white rounded-2xl border border-[#e8eaed] shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[#f0f2f5]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#e5e7eb] text-sm focus:outline-none focus:border-[#001f3f]" />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              <button type="button" onClick={() => { onChange(null); setOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] text-left">
                <span className="w-7 h-7 rounded-xl bg-[#f0f2f5] flex items-center justify-center"><Building2 className="w-4 h-4 text-[#9ca3af]" /></span>
                <span className="flex-1 text-sm text-[#374151]">Any developer (generic)</span>
                {!value && <Check className="w-4 h-4 text-[#001f3f]" />}
              </button>
              {filtered.map((d) => (
                <button key={d.id} type="button" onClick={() => { onChange(d); setOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] text-left">
                  <DeveloperLogo url={d.logo_url} name={d.name} size={28} />
                  <span className="flex-1 text-sm font-medium text-[#111827] truncate">{d.name}</span>
                  {value?.id === d.id && <Check className="w-4 h-4 text-[#001f3f]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** QR + share actions for one invite URL. Reused by the "just created" panel
 *  and the "View details" panel so both offer the same copy/QR/WhatsApp tools. */
function QrShare({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const canvasWrap = useRef<HTMLDivElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const download = () => {
    const canvas = canvasWrap.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "developer-invite-qr.png"
    a.click()
  }

  const waText = encodeURIComponent(`Join FHI Global as a developer member — create your account here: ${url}`)

  return (
    <div className="w-full flex flex-col items-center">
      <div className="rounded-2xl border-4 border-[#d6b357] p-4 bg-white shadow-[0_10px_34px_-14px_rgba(0,31,63,0.3)]">
        <QRCodeSVG value={url} size={200} level="M" fgColor="#001f3f" />
      </div>
      <div ref={canvasWrap} className="hidden" aria-hidden>
        <QRCodeCanvas value={url} size={1024} level="M" fgColor="#001f3f" marginSize={4} />
      </div>
      <div className="mt-3 w-full flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-[#f9fafb] px-3 py-2">
        <Link2 className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
        <span className="text-[11px] text-[#6b7280] break-all leading-snug">{url}</span>
      </div>
      <div className="mt-4 w-full space-y-2">
        <button type="button" onClick={download} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00356b]">
          <Download className="w-4 h-4" /> Download QR
        </button>
        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#25d366] text-[#128c4b] text-sm font-bold hover:bg-[#25d366]/10">
          <MessageCircle className="w-4 h-4" /> Share on WhatsApp
        </a>
        <button type="button" onClick={() => void copy()} className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${copied ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]"}`}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#111827] text-right min-w-0 truncate">{value}</span>
    </div>
  )
}

export function DeveloperInviteDialog({
  open,
  presetDeveloper,
  onClose,
  onError,
}: {
  open: boolean
  presetDeveloper: Developer | null
  onClose: () => void
  onError: (msg: string) => void
}) {
  const [tab, setTab] = useState<"create" | "manage">("create")
  const [developers, setDevelopers] = useState<PickerDeveloper[]>([])

  // create form
  const [selDev, setSelDev] = useState<PickerDeveloper | null>(null)
  const [label, setLabel] = useState("")
  const [autoActivate, setAutoActivate] = useState(true)
  const [expiryDays, setExpiryDays] = useState(7)
  const [maxUses, setMaxUses] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  // manage list
  const [invites, setInvites] = useState<InviteListItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [detailInvite, setDetailInvite] = useState<InviteListItem | null>(null)

  // registrations for the open detail link
  const [recruits, setRecruits] = useState<Recruit[]>([])
  const [recruitsCreatedBy, setRecruitsCreatedBy] = useState<{ name: string } | null>(null)
  const [recruitsLoading, setRecruitsLoading] = useState(false)

  // in-app confirmation for revoke / delete
  const [confirmState, setConfirmState] = useState<{ type: "revoke" | "delete"; invite: InviteListItem } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const loadDevelopers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("developers")
      .select("id, name, logo_url")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
    setDevelopers((data as PickerDeveloper[] | null) ?? [])
  }, [])

  const loadInvites = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch("/api/admin/developer-invites")
      const json = (await res.json()) as { invites?: InviteListItem[] }
      const list = res.ok ? json.invites ?? [] : []
      setInvites(list)
      return list
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadDevelopers()
    // Reset per-open.
    setTab("create")
    setCreatedUrl(null)
    setDetailInvite(null)
    setLabel("")
    setAutoActivate(true)
    setExpiryDays(7)
    setMaxUses("")
    setSelDev(presetDeveloper ? { id: presetDeveloper.id, name: presetDeveloper.name, logo_url: presetDeveloper.logo_url } : null)
  }, [open, presetDeveloper, loadDevelopers])

  useEffect(() => {
    if (open && tab === "manage") void loadInvites()
  }, [open, tab, loadInvites])

  // Load who redeemed the link whenever a detail panel opens.
  useEffect(() => {
    if (!detailInvite) {
      setRecruits([])
      setRecruitsCreatedBy(null)
      return
    }
    let cancelled = false
    setRecruitsLoading(true)
    const inviteId = detailInvite.id
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/developer-invites/${inviteId}/recruits`)
        const json = (await res.json()) as { recruits?: Recruit[]; createdBy?: { name: string } | null }
        if (!cancelled && res.ok) {
          setRecruits(json.recruits ?? [])
          setRecruitsCreatedBy(json.createdBy ?? null)
        }
      } finally {
        if (!cancelled) setRecruitsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailInvite])

  if (!open) return null

  const create = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/admin/developer-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerId: selDev?.id ?? null,
          label: label.trim() || null,
          autoActivate,
          expiresInDays: expiryDays > 0 ? expiryDays : undefined,
          maxUses: maxUses.trim() ? Number(maxUses) : undefined,
        }),
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        onError(json.error ?? "Could not create the invite link.")
        return
      }
      setCreatedUrl(json.url)
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/developer-invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    const list = await loadInvites()
    // Keep the open detail panel in sync with the refreshed status.
    setDetailInvite((cur) => (cur ? list.find((x) => x.id === cur.id) ?? null : null))
  }

  const remove = async (id: string) => {
    await fetch(`/api/admin/developer-invites/${id}`, { method: "DELETE" })
    setDetailInvite(null)
    void loadInvites()
  }

  // Revoke (close registration) and Delete both run through the in-app confirm.
  const runConfirm = async () => {
    if (!confirmState) return
    setConfirmBusy(true)
    try {
      if (confirmState.type === "revoke") await revoke(confirmState.invite.id, confirmState.invite.isActive)
      else await remove(confirmState.invite.id)
    } finally {
      setConfirmBusy(false)
      setConfirmState(null)
    }
  }

  const statusChip: Record<InviteListItem["status"], string> = {
    active: "bg-emerald-50 text-emerald-700",
    expired: "bg-amber-50 text-amber-700",
    used_up: "bg-slate-100 text-slate-600",
    revoked: "bg-rose-50 text-rose-600",
    invalid: "bg-rose-50 text-rose-600",
  }

  // The detail view lays out QR + details + registrations side-by-side, so the
  // modal widens for it; create/list stay at a comfortable reading width.
  const wide = tab === "manage" && !!detailInvite

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className={`relative w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"} max-h-[92vh] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden transition-[max-width] duration-300 ease-out`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f5]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#001f3f] flex items-center justify-center">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">Developer Invite</h2>
                <p className="text-xs text-[#9ca3af]">Generate a self-registration link</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#9ca3af] hover:bg-[#f4f6f9]"><X className="w-5 h-5" /></button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 mx-6 mt-4 p-1 rounded-xl bg-[#eef1f5]">
            {(["create", "manage"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTab(t); setDetailInvite(null) }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280]"}`}>
                {t === "create" ? "Create link" : "Manage links"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === "create" ? (
              createdUrl ? (
                /* Share panel */
                <div className="flex flex-col items-center">
                  <p className="mb-3 text-sm font-semibold text-[#001f3f]">Invite link ready</p>
                  <QrShare url={createdUrl} />
                  <button type="button" onClick={() => setCreatedUrl(null)} className="w-full mt-2 py-2.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f]">
                    Create another
                  </button>
                </div>
              ) : (
                /* Create form */
                <div className="space-y-4">
                  <div>
                    <FieldLabel text="Developer" />
                    <DevSelect developers={developers} value={selDev} onChange={setSelDev} disabled={!!presetDeveloper} />
                    <p className="text-[11px] text-[#9ca3af] mt-1.5 ml-1">
                      {presetDeveloper ? "Pre-bound to this developer." : "Leave as “Any developer” to let the registrant choose."}
                    </p>
                  </div>
                  <div>
                    <FieldLabel text="Label (optional)" />
                    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Q3 sales team" className={inp} />
                  </div>
                  <div className="rounded-xl border border-[#e8eaed] px-4 py-3">
                    <Toggle on={autoActivate} onToggle={() => setAutoActivate((v) => !v)} label="Activate immediately" hint={autoActivate ? "New members can sign in right away." : "New members wait for admin approval."} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel text="Expires" />
                      <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} className={inp}>
                        {EXPIRY_OPTIONS.map((o) => <option key={o.label} value={o.days}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel text="Max uses" />
                      <input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Unlimited" className={inp} inputMode="numeric" />
                    </div>
                  </div>
                  <button type="button" onClick={() => void create()} disabled={creating}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#001f3f] hover:bg-[#002b57] text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-60 transition-all">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {creating ? "Generating…" : "Generate invite link"}
                  </button>
                </div>
              )
            ) : detailInvite ? (
              /* Details view for one link */
              <div>
                <button type="button" onClick={() => setDetailInvite(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] mb-4">
                  <ArrowLeft className="w-4 h-4" /> All links
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
                  {/* Left: identity + QR + share */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {detailInvite.developer ? (
                        <DeveloperLogo url={detailInvite.developer.logo_url} name={detailInvite.developer.name} size={40} />
                      ) : (
                        <span className="w-10 h-10 rounded-xl bg-[#f0f2f5] flex items-center justify-center shrink-0"><Link2 className="w-5 h-5 text-[#9ca3af]" /></span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#111827] truncate">{detailInvite.developer?.name ?? "Generic link"}</p>
                        {detailInvite.label && <p className="text-xs text-[#9ca3af] truncate">{detailInvite.label}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusChip[detailInvite.status]}`}>{detailInvite.status.replace("_", " ")}</span>
                    </div>
                    <QrShare url={detailInvite.url} />
                  </div>

                  {/* Right: details + registrations */}
                  <div className="space-y-5 min-w-0">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-2">Link details</h4>
                      <dl className="rounded-2xl border border-[#e8eaed] divide-y divide-[#f0f2f5]">
                        <DetailRow label="Scope" value={detailInvite.developer ? "Bound developer" : "Any developer (generic)"} />
                        <DetailRow label="Uses" value={`${detailInvite.useCount}${detailInvite.maxUses ? ` / ${detailInvite.maxUses}` : " (unlimited)"}`} />
                        <DetailRow label="Activation" value={detailInvite.autoActivate ? "Immediate" : "Needs approval"} />
                        <DetailRow label="Expires" value={detailInvite.expiresAt ? new Date(detailInvite.expiresAt).toLocaleString() : "Never"} />
                        <DetailRow label="Created" value={new Date(detailInvite.createdAt).toLocaleString()} />
                        <DetailRow label="Created by" value={recruitsCreatedBy?.name ?? (recruitsLoading ? "…" : "—")} />
                      </dl>
                    </div>

                    {/* Who registered through this link */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Users className="w-4 h-4 text-[#001f3f]" />
                        <h4 className="text-sm font-bold text-[#0d1117]">Registrations</h4>
                        <span className="text-xs text-[#9ca3af]">({recruits.length})</span>
                      </div>
                      {recruitsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-[#9ca3af]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                      ) : recruits.length === 0 ? (
                        <p className="text-sm text-[#9ca3af] py-3 px-3 rounded-xl bg-[#f9fafb] border border-[#f0f2f5]">No one has registered through this link yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
                          {recruits.map((r) => (
                            <div key={r.id} className="rounded-xl border border-[#e8eaed] p-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-full bg-[#001f3f]/8 flex items-center justify-center shrink-0">
                                  <UserRound className="w-4 h-4 text-[#001f3f]" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-[#111827] truncate">
                                    {r.name}
                                    {r.isDeleted && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500">deleted</span>}
                                  </p>
                                  <p className="text-[11px] text-[#9ca3af] flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" />{r.email ?? "—"}</p>
                                </div>
                                {r.status && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${r.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{r.status}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-2 pl-[42px] text-[11px] text-[#6b7280]">
                                <Building2 className="w-3 h-3 shrink-0 text-[#9ca3af]" />
                                <span className="truncate">{r.developerName ?? "—"}</span>
                                {r.joinedAt && <span className="ml-auto shrink-0 text-[#9ca3af]">{new Date(r.joinedAt).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#f0f2f5]">
                  <button
                    type="button"
                    onClick={() => {
                      // Reactivating is harmless (reopens the link) → no confirm.
                      // Revoking closes registration → confirm first.
                      if (detailInvite.isActive) setConfirmState({ type: "revoke", invite: detailInvite })
                      else void revoke(detailInvite.id, detailInvite.isActive)
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-amber-600 hover:border-amber-300"
                  >
                    <Ban className="w-4 h-4" /> {detailInvite.isActive ? "Revoke" : "Reactivate"}
                  </button>
                  <button type="button" onClick={() => setConfirmState({ type: "delete", invite: detailInvite })} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-rose-500 hover:border-rose-300">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ) : (
              /* Manage tab — list */
              <div className="space-y-2.5">
                {loadingList ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#9ca3af]"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : invites.length === 0 ? (
                  <p className="text-center text-sm text-[#9ca3af] py-10">No invite links yet.</p>
                ) : (
                  invites.map((iv) => (
                    <button key={iv.id} type="button" onClick={() => setDetailInvite(iv)}
                      className="w-full rounded-2xl border border-[#e8eaed] p-3.5 flex items-center gap-3 text-left hover:border-[#001f3f]/40 hover:bg-[#f9fafb] transition-colors">
                      {iv.developer ? (
                        <DeveloperLogo url={iv.developer.logo_url} name={iv.developer.name} size={32} />
                      ) : (
                        <span className="w-8 h-8 rounded-xl bg-[#f0f2f5] flex items-center justify-center shrink-0"><Link2 className="w-4 h-4 text-[#9ca3af]" /></span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">
                          {iv.developer?.name ?? "Generic link"}{iv.label ? ` · ${iv.label}` : ""}
                        </p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {iv.useCount}{iv.maxUses ? `/${iv.maxUses}` : ""} used · {iv.autoActivate ? "auto-active" : "needs approval"}
                          {iv.expiresAt ? ` · expires ${new Date(iv.expiresAt).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusChip[iv.status]}`}>{iv.status.replace("_", " ")}</span>
                      <ChevronRight className="w-4 h-4 text-[#c0c5cc] shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Confirm overlay for Revoke / Delete */}
          {confirmState && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-5">
              <button
                type="button"
                aria-label="Cancel"
                className="absolute inset-0 bg-[#0d1117]/45 backdrop-blur-[2px]"
                onClick={() => { if (!confirmBusy) setConfirmState(null) }}
              />
              <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${confirmState.type === "delete" ? "bg-rose-50" : "bg-amber-50"}`}>
                  {confirmState.type === "delete" ? <Trash2 className="w-7 h-7 text-rose-500" /> : <Ban className="w-7 h-7 text-amber-500" />}
                </div>
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117]">
                  {confirmState.type === "delete" ? "Delete this invite link?" : "Close registration?"}
                </h3>
                <p className="text-sm text-[#6b7280] mt-1.5 mb-5 leading-relaxed">
                  {confirmState.type === "delete"
                    ? "It will stop working immediately and be removed from your list. This can’t be undone."
                    : "People will no longer be able to register through this link. You can reactivate it anytime — it won’t be deleted."}
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={confirmBusy}
                    onClick={() => setConfirmState(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:bg-[#f5f5f5] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={confirmBusy}
                    onClick={() => void runConfirm()}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 ${confirmState.type === "delete" ? "bg-rose-500 hover:bg-rose-600" : "bg-amber-500 hover:bg-amber-600"}`}
                  >
                    {confirmBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmState.type === "delete" ? <Trash2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    {confirmState.type === "delete" ? "Delete" : "Revoke link"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
