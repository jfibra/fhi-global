"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Mail, Phone, Building2, Clock, Send, Trash2, Archive,
  ArchiveRestore, MailOpen, Loader2, RotateCcw, CheckCircle2, AlertTriangle,
} from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { formatDateTime, relativeTime } from "@/lib/utils"
import {
  type ContactSubmission,
  type ContactReply,
  fetchContactSubmission,
  sendContactReply,
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
  const [replySubjectEdit, setReplySubjectEdit] = useState<string | null>(null)
  const [replies, setReplies] = useState<ContactReply[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const { data, replies: thread, error: err } = await fetchContactSubmission(id)
      if (cancelled) return
      setSubmission(data)
      setReplies(thread)
      setError(err)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id])

  const refresh = async () => {
    const { data, replies: thread } = await fetchContactSubmission(id)
    if (data) setSubmission(data)
    setReplies(thread)
  }

  const sendReply = async () => {
    if (!submission || sending) return
    const subject = (replySubjectEdit ?? `Re: ${submission.subject?.trim() || "Your inquiry"}`).trim()
    const message = replyBody.trim()
    if (!subject || !message) { setNotice("Write a subject and a message first."); return }
    setSending(true)
    const { error: err } = await sendContactReply(id, { subject, message })
    setSending(false)
    if (err) { setNotice(err); void refresh(); return }
    setReplyBody("")
    setReplySubjectEdit(null)
    setNotice(`Reply sent to ${submission.email}.`)
    void refresh()
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
  const replySubject = replySubjectEdit ?? `Re: ${s.subject?.trim() || "Your inquiry"}`

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

      {/* The thread so far — every reply sent from the inbox, newest last. */}
      {replies.length > 0 && (
        <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Replies sent ({replies.length})</p>
          <div className="space-y-3">
            {replies.map((r) => (
              <div key={r.id} className={`rounded-2xl border px-4 py-3 ${r.status === "failed" ? "border-rose-200 bg-rose-50" : "border-[#eef0f2] bg-[#fafbfc]"}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6b7280]">
                  {r.status === "failed" ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span className="font-semibold text-[#374151]">{r.sent_by_name ?? "FHI Global"}</span>
                  <span>{formatDateTime(r.created_at)}</span>
                  {r.status === "failed" && <span className="text-rose-700">not delivered{r.error ? ` — ${r.error}` : ""}</span>}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-[#111827]">{r.subject}</p>
                <p className="mt-1 text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{r.body_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply — sent from the house mailbox, signed with the admin's name. */}
      {!isDeleted && (
        <div className="bg-white rounded-[24px] border border-[#eef0f2] shadow-sm p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">Reply</p>
          <p className="text-xs text-[#9ca3af] mb-4">
            Sending as <span className="font-semibold text-[#374151]">{SUPPORT_EMAIL}</span> to {s.email}, signed with your name.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="contact-reply-subject" className="text-xs font-semibold text-[#6b7280] mb-1.5 block">Subject</label>
              <input
                id="contact-reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubjectEdit(e.target.value)}
                disabled={sending}
                maxLength={200}
                className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#111827] focus:border-[#001f3f] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="contact-reply-body" className="text-xs font-semibold text-[#6b7280] mb-1.5 block">Message</label>
              <textarea
                id="contact-reply-body"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                disabled={sending}
                rows={6}
                maxLength={10000}
                placeholder="Write your reply…"
                className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#111827] resize-y focus:border-[#001f3f] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[#9ca3af]">The client replies to {SUPPORT_EMAIL}; it lands in Leads → Inbox.</span>
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={sending || !replyBody.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#00152b] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
