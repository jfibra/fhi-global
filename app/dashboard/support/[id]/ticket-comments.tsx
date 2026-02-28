"use client"

import { useEffect, useState } from "react"
import { UserAvatar } from "@/components/user-avatar"
import {
  fetchSupportTicketComments,
  insertSupportTicketComment,
  type SupportTicketComment,
} from "@/lib/support-service"

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TicketComments({
  ticketId,
  currentUserId,
  currentRole,
  onToast,
}: {
  ticketId: string
  currentUserId: string
  currentRole: string
  onToast: (type: "success" | "error", text: string) => void
}) {
  const [comments, setComments] = useState<SupportTicketComment[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [comment, setComment] = useState("")

  const loadComments = async () => {
    setLoading(true)
    try {
      const { data, error } = await fetchSupportTicketComments(ticketId)
      if (error) {
        onToast("error", error)
        return
      }
      setComments(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadComments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const submitComment = async () => {
    setSending(true)
    try {
      const { data, error } = await insertSupportTicketComment({
        ticket_id: ticketId,
        comment,
        commented_by: currentUserId,
        commenter_role: currentRole,
        currentRole,
      })
      if (error || !data) {
        onToast("error", error ?? "Failed to add comment")
        return
      }
      setComments((prev) => [...prev, data])
      setComment("")
      onToast("success", "Comment added")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-5 space-y-4">
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />)}</div>
      ) : comments.length === 0 ? (
        <div className="px-4 py-6 rounded-2xl border border-[#f0f2f5] text-sm text-[#6b7280] text-center">No discussion yet.</div>
      ) : (
        <div className="space-y-3">
          {comments.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#eef2f5] bg-[#fbfdff] p-4">
              <div className="flex items-start gap-3">
                <UserAvatar
                  name={item.profiles?.fullname ?? item.commenter_role ?? "User"}
                  imageUrl={item.profiles?.profile_url}
                  size={34}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#001f3f]">
                      {item.profiles?.fullname ?? item.commenter_role ?? "User"}
                      <span className="ml-2 text-[#9ca3af] uppercase">{item.commenter_role ?? ""}</span>
                    </p>
                    <span className="text-[11px] text-[#9ca3af]">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#374151] whitespace-pre-wrap">{item.comment}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="Write a comment..."
          className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 resize-none"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void submitComment()}
            disabled={sending || !comment.trim()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  )
}
