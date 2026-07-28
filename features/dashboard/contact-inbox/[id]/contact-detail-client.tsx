"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Mail, Phone, Building2, Clock, Send, Trash2, Archive,
  ArchiveRestore, MailOpen, Loader2, Paperclip, Wrench, RotateCcw,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDateTime, relativeTime } from "@/lib/utils"
import {
  type ContactSubmission,
  fetchContactSubmission,
  setContactStatus,
  setContactDeleted,
} from "@/lib/contact-inbox-service"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

const SUPPORT_EMAIL = "info@fhiglobal.ae"

export function ContactDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const base = getDashboardRouteByRole(useAuth().role)
  const [submission, setSubmission] = useState<ContactSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, error: err } = await fetchContactSubmission(id)
      if (cancelled) return
      setSubmission(data)
      setError(err)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id])

  const refresh = async () => {
    const { data } = await fetchContactSubmission(id)
    if (data) setSubmission(data)
  }

  const markUnread = async () => {
    setBusy(true)
    const { error: err } = await setContactStatus(id, "new")
    setBusy(false)
    if (err) { setNotice(err); return }
    setNotice("Marked as unread.")
    void refresh()
  }

  const toggleArchive = async () => {
    if (!submission) return
    const next = submission.status === "archived" ? "read" : "archived"
    setBusy(true)
    const { error: err } = await setContactStatus(id, next)
    setBusy(false)
    if (err) { setNotice(err); return }
    setNotice(next === "archived" ? "Archived." : "Moved back to inbox.")
    void refresh()
  }

  const handleDelete = async () => {
    if (!submission) return
    const isDeleted = Boolean(submission.deleted_at)
    setBusy(true)
    const { error: err } = await setContactDeleted(id, !isDeleted)
    setBusy(false)
    if (err) { setNotice(err); return }
    if (isDeleted) { setNotice("Restored."); void refresh() }
    else router.push(`${base}/contact-inbox`)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#9ca3af] py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading inquiry…
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <p className="text-base font-semibold text-[#374151]">{error ?? "Inquiry not found."}</p>
        <Link href={`${base}/contact-inbox`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#001f3f] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Contact Inbox
        </Link>
      </div>
    )
  }

  const s = submission
  const isDeleted = Boolean(s.deleted_at)
  const replySubject = `Re: ${s.subject?.trim() || "Your inquiry"}`

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {!isDeleted && (
            <>
              <button type="button" onClick={() => void markUnread()} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-50 transition-all">
                <MailOpen className="w-3.5 h-3.5" /> Mark unread
              </button>
              <button type="button" onClick={() => void toggleArchive()} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#e5e5e5] text-xs font-semibold text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f] disabled:opacity-50 transition-all">
                {s.status === "archived" ? <><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive</> : <><Archive className="w-3.5 h-3.5" /> Archive</>}
              </button>
            </>
          )}
          <button type="button" onClick={() => void handleDelete()} disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-semibold disabled:opacity-50 transition-all ${
              isDeleted ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : "border-rose-200 text-rose-500 hover:bg-rose-50"
            }`}>
            {isDeleted ? <><RotateCcw className="w-3.5 h-3.5" /> Restore</> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#e8eaed] bg-[#f9fafb] px-4 py-2.5 text-sm text-[#374151]">{notice}</div>
      )}

      {/* Sender card */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <div className="flex items-start gap-4">
          <UserAvatar name={s.name} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Outfit'] text-xl font-bold text-[#0d1117]">{s.name}</h1>
              {isDeleted && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600">Deleted</span>}
              {!isDeleted && s.status === "new" && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">New</span>}
              {!isDeleted && s.status === "archived" && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">Archived</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[#6b7280]">
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 text-[#001f3f] hover:underline">
                <Mail className="w-3.5 h-3.5" /> {s.email}
              </a>
              {s.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {s.phone}</span>}
              {s.company && <span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {s.company}</span>}
              <span className="inline-flex items-center gap-1.5" title={formatDateTime(s.created_at)}>
                <Clock className="w-3.5 h-3.5" /> {formatDateTime(s.created_at)} ({relativeTime(s.created_at)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Original message */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Original Message</p>
        {s.subject && <p className="text-sm text-[#374151] mb-3"><span className="font-semibold">Subject:</span> {s.subject}</p>}
        <p className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap">{s.message}</p>
      </div>

      {/* Reply — present but disabled (under maintenance) */}
      <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Reply</p>
        <p className="text-xs text-[#9ca3af] mb-4">
          Sending as <span className="font-semibold text-[#374151]">{SUPPORT_EMAIL}</span> to {s.email}.
        </p>

        {/* Maintenance banner */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <Wrench className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">This reply feature is under maintenance and is temporarily unavailable.</p>
        </div>

        <div className="space-y-3 opacity-70 pointer-events-none select-none" aria-disabled="true">
          <div>
            <label className="text-xs font-semibold text-[#6b7280] mb-1.5 block">Subject</label>
            <input
              value={replySubject}
              readOnly
              disabled
              className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-[#f9fafb] text-sm text-[#374151]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#6b7280] mb-1.5 block">Message</label>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              disabled
              rows={5}
              placeholder="Write your reply…"
              className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-[#f9fafb] text-sm text-[#374151] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#9ca3af]">
            <Paperclip className="w-3.5 h-3.5" /> Attach images
          </span>
          <button
            type="button"
            disabled
            title="This reply feature is under maintenance"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#e5e7eb] text-[#9ca3af] text-sm font-semibold cursor-not-allowed"
          >
            <Send className="w-4 h-4" /> Send reply
          </button>
        </div>
      </div>
    </div>
  )
}
