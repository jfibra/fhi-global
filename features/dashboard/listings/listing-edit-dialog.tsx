"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Check, Pencil, Tag, Building2, Info } from "lucide-react"
import {
  type AdminListingRow,
  type AdminListingUpdateInput,
  type AdminListingKind,
  type AdminListingStatus,
  updateAdminListing,
} from "@/lib/admin-listings-service"

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

const KINDS: { value: AdminListingKind; label: string }[] = [
  { value: "sale", label: "For Sale" },
  { value: "rent", label: "For Rent" },
]
const STATUSES: { value: AdminListingStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

interface Props {
  listing: AdminListingRow | null
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function ListingEditDialog({ listing, onClose, onSaved, onError }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<AdminListingKind>("sale")
  const [status, setStatus] = useState<AdminListingStatus>("draft")
  const [unitType, setUnitType] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("AED")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectLinked = listing?.project_id != null

  useEffect(() => {
    if (!listing) return
    setError(null)
    setTitle(listing.title ?? "")
    setDescription(listing.description ?? "")
    setKind(listing.listing_kind)
    setStatus(listing.status)
    setUnitType(listing.unit_type ?? "")
    setPrice(listing.price != null ? String(listing.price) : "")
    setCurrency(listing.currency ?? "AED")
  }, [listing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!listing) return null

  const inp =
    "w-full px-4 py-3 rounded-2xl border bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 text-sm border-[#e5e5e5]"

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    setBusy(true)
    setError(null)
    const input: AdminListingUpdateInput = {
      title: title.trim(),
      description: description.trim(),
      listing_kind: kind,
      status,
      unit_type: unitType.trim() || null,
      price: projectLinked ? null : price.trim() === "" ? null : Number(price),
      currency: currency.trim() || "AED",
    }
    const { error: err } = await updateAdminListing(listing.id, input)
    setBusy(false)
    if (err) {
      setError(err)
      onError(err)
      return
    }
    onSaved("Listing updated.")
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

        <div className="relative w-full sm:max-w-[640px] max-h-[95dvh] flex flex-col bg-white rounded-t-[28px] sm:rounded-[28px] border border-white/60 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#f0f0f0] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#d6b357] flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-['Outfit'] text-lg font-bold text-[#0d1117] truncate">Edit Listing</h3>
                <p className="text-xs text-[#6b7280] truncate">
                  {listing.agent?.fullname ? `by ${listing.agent.fullname}` : "Agent listing"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e5] text-[#6b7280] hover:text-[#0d1117] hover:border-[#0d1117] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Title *</label>
              <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Listing title" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Type</label>
                <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as AdminListingKind)}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Status</label>
                <select className={inp} value={status} onChange={(e) => setStatus(e.target.value as AdminListingStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Unit Type</label>
              <input className={inp} value={unitType} onChange={(e) => setUnitType(e.target.value)} placeholder="e.g. 2 BR Apartment" />
            </div>

            {/* Price — standalone listings only */}
            {projectLinked ? (
              <div className="flex items-start gap-2.5 rounded-2xl border border-[#eef0f2] bg-[#f9fafb] px-4 py-3">
                <Building2 className="w-4 h-4 text-[#9ca3af] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[#6b7280]">
                  This listing is linked to the project
                  <span className="font-semibold text-[#374151]"> {listing.projects?.name ?? "—"}</span>
                  {listing.projects?.developers?.name ? ` (${listing.projects.developers.name})` : ""} — price &amp; currency
                  come from the developer project and can&apos;t be edited here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Price</label>
                  <input
                    className={inp}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 1500000"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Currency</label>
                  <input className={inp} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#374151] ml-1 mb-2 block">Description</label>
              <textarea
                className={`${inp} resize-none`}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Listing description…"
              />
            </div>

            <div className="flex items-start gap-2.5 text-xs text-[#9ca3af]">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>Photos and the linked developer/project are managed by the agent and aren&apos;t editable from here.</p>
            </div>

            {error && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#f0f0f0] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy}
              className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md disabled:opacity-60 disabled:translate-y-0 flex items-center gap-2"
            >
              {busy ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Check className="w-4 h-4" /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
