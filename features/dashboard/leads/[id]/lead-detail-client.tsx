"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Mail, Phone, Clock, Building2, Trash2, RotateCcw, Loader2,
  MessageCircle, PhoneCall, CheckCircle2, Undo2, Globe, MonitorSmartphone,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDateTime, relativeTime } from "@/lib/utils"
import {
  type Inquiry,
  type InquiryStatus,
  fetchInquiry,
  setInquiryStatus,
  setInquiryDeleted,
  LOOKING_FOR_LABELS,
  CATEGORY_LABELS,
} from "@/lib/inquiries-service"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

function StatusPill({ lead }: { lead: Inquiry }) {
  if (lead.deleted_at) {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600">Archived</span>
  }
  if (lead.status === "new") {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#d6b357]/15 text-[#8a6d1f]">New</span>
  }
  if (lead.status === "contacted") {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700">Contacted</span>
  }
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">Closed</span>
}

export function LeadDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const base = getDashboardRouteByRole(useAuth().role)
  const [lead, setLead] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // `loading` starts true, so no synchronous setState is needed in the effect
  // body (react-hooks/set-state-in-effect) — everything runs after the await.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await fetchInquiry(id)
      if (cancelled) return
      setLead(data)
      setError(err)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id])

  const refresh = async () => {
    const { data } = await fetchInquiry(id)
    if (data) setLead(data)
  }

  const changeStatus = async (status: InquiryStatus, message: string) => {
    setBusy(true)
    const { error: err } = await setInquiryStatus(id, status)
    setBusy(false)
    if (err) { setNotice(err); return }
    setNotice(message)
    void refresh()
  }

  const handleArchive = async () => {
    if (!lead) return
    const isDeleted = Boolean(lead.deleted_at)
    setBusy(true)
    const { error: err } = await setInquiryDeleted(id, !isDeleted)
    setBusy(false)
    if (err) { setNotice(err); return }
    if (isDeleted) { setNotice("Restored."); void refresh() }
    else router.push(`${base}/leads`)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#9ca3af] py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading lead…
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <p className="text-base font-semibold text-[#374151]">{error ?? "Lead not found."}</p>
        <Link href={`${base}/leads`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#001f3f] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Leads Inquiries
        </Link>
      </div>
    )
  }

  const l = lead
  const isDeleted = Boolean(l.deleted_at)
  const fullPhone = `${l.phone_country_code} ${l.phone}`
  const waNumber = `${l.phone_country_code}${l.phone}`.replace(/[^0-9]/g, "")

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={`${base}/leads`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#001f3f] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Leads Inquiries
        </Link>
        <div className="flex items-center gap-2">
          {!isDeleted && l.status !== "contacted" && (
            <button type="button" onClick={() => void changeStatus("contacted", "Marked as contacted.")} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-sky-200 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 transition-all">
              <PhoneCall className="w-3.5 h-3.5" /> Mark contacted
            </button>
          )}
          {!isDeleted && l.status !== "closed" && (
            <button type="button" onClick={() => void changeStatus("closed", "Marked as closed.")} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-emerald-200 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-all">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark closed
            </button>
          )}
          {!isDeleted && l.status !== "new" && (
            <button type="button" onClick={() => void changeStatus("new", "Reopened as new.")} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-50 transition-all">
              <Undo2 className="w-3.5 h-3.5" /> Reopen
            </button>
          )}
          <button type="button" onClick={() => void handleArchive()} disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold disabled:opacity-50 transition-all ${
              isDeleted ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : "border-rose-200 text-rose-500 hover:bg-rose-50"
            }`}>
            {isDeleted ? <><RotateCcw className="w-3.5 h-3.5" /> Restore</> : <><Trash2 className="w-3.5 h-3.5" /> Archive</>}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#e8eaed] bg-[#f9fafb] px-4 py-2.5 text-sm text-[#374151]">{notice}</div>
      )}

      {/* Lead card */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <div className="flex items-start gap-4">
          <UserAvatar name={l.name} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">{l.name}</h1>
              <StatusPill lead={l} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[#6b7280]">
              <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 text-[#001f3f] hover:underline">
                <Mail className="w-3.5 h-3.5" /> {l.email}
              </a>
              <a href={`tel:${l.phone_country_code}${l.phone.replace(/[^0-9]/g, "")}`} className="inline-flex items-center gap-1.5 text-[#001f3f] hover:underline">
                <Phone className="w-3.5 h-3.5" /> {fullPhone}
              </a>
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#001f3f] hover:underline">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
              <span className="inline-flex items-center gap-1.5" title={formatDateTime(l.created_at)}>
                <Clock className="w-3.5 h-3.5" /> {formatDateTime(l.created_at)} ({relativeTime(l.created_at)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interest */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-4">Inquiry Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">Who they are</p>
            <p className="font-semibold text-[#111827]">{LOOKING_FOR_LABELS[l.looking_for] ?? l.looking_for}</p>
          </div>
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">Property category</p>
            <p className="font-semibold text-[#111827]">{CATEGORY_LABELS[l.property_category] ?? l.property_category}</p>
          </div>
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">Project</p>
            <p className="font-semibold text-[#111827] inline-flex items-center gap-1.5">
              {l.project_name ? <><Building2 className="w-3.5 h-3.5 text-[#9ca3af]" /> {l.project_name}</> : "—"}
            </p>
            {l.developer_name && <p className="text-xs text-[#6b7280] mt-0.5">{l.developer_name}</p>}
          </div>
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">First contacted</p>
            <p className="font-semibold text-[#111827]">
              {l.contacted_at ? `${formatDateTime(l.contacted_at)} (${relativeTime(l.contacted_at)})` : "Not yet contacted"}
            </p>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-4">Submission Meta</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">Source</p>
            <p className="font-semibold text-[#111827]">{l.source === "project_page" ? "Project page — Inquire Now" : l.source}</p>
          </div>
          <div>
            <p className="text-xs text-[#9ca3af] mb-0.5">IP address</p>
            <p className="font-semibold text-[#111827] inline-flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#9ca3af]" /> {l.ip_address ?? "—"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-[#9ca3af] mb-0.5">Device</p>
            <p className="text-[#374151] inline-flex items-start gap-1.5 break-all">
              <MonitorSmartphone className="w-3.5 h-3.5 text-[#9ca3af] mt-0.5 flex-shrink-0" /> {l.user_agent ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
