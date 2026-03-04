"use client"

import { useEffect, useState } from "react"
import {
  fetchSaleActivityLogs,
  fetchValidationComments,
  insertValidationComment,
  type SaleActivityLog,
  type SaleValidationComment,
  type ValidationStatus,
} from "@/lib/sales-service"
import { UserAvatar } from "@/components/user-avatar"

export type DiscussionTab = "discussion" | "activity"

const STATUS_LABEL: Record<ValidationStatus, string> = {
  pending: "Pending",
  under_review: "Under Review",
  validated: "Validated",
  invalid_sale: "Invalid Sale",
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "â€”"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function actionLabel(type: string) {
  const map: Record<string, string> = {
    sale_created: "Sale Created",
    sale_updated: "Sale Updated",
    validation_status_changed: "Validation Status Changed",
    commission_status_changed: "Commission Status Changed",
    attachment_uploaded: "Attachment Uploaded",
    attachment_deleted: "Attachment Deleted",
    client_information_updated: "Client Information Updated",
  }
  return map[type] ?? type.replace(/_/g, " ")
}

export function ValidationDiscussion({
  saleId,
  currentUserId,
  currentRole,
  validationStatus,
  isAdmin,
  initialTab,
}: {
  saleId: string
  currentUserId: string
  currentRole: string
  validationStatus: ValidationStatus
  isAdmin: boolean
  initialTab?: DiscussionTab
}) {
  const [activeTab, setActiveTab] = useState<DiscussionTab>(initialTab ?? "discussion")
  const [comments, setComments] = useState<SaleValidationComment[]>([])
  const [logs, setLogs] = useState<SaleActivityLog[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoadingComments(true)
      const { data, error: fetchError } = await fetchValidationComments(saleId)
      if (fetchError) setError(fetchError)
      else setComments(data ?? [])
      setLoadingComments(false)
    })()
  }, [saleId])

  useEffect(() => {
    if (!isAdmin || activeTab !== "activity") return
    void (async () => {
      setLoadingLogs(true)
      const { data, error: fetchError } = await fetchSaleActivityLogs(saleId)
      if (fetchError) setError(fetchError)
      else setLogs(data ?? [])
      setLoadingLogs(false)
    })()
  }, [saleId, activeTab, isAdmin])

  useEffect(() => {
    setActiveTab(initialTab ?? "discussion")
  }, [initialTab])

  const submitComment = async () => {
    setError(null)
    setSending(true)
    const { data, error: submitError } = await insertValidationComment({
      sales_report_id: saleId,
      comment: commentText,
      commented_by: currentUserId,
      commenter_role: currentRole,
    })
    if (submitError) {
      setError(submitError)
      setSending(false)
      return
    }
    if (data) {
      setComments((prev) => [...prev, data])
      setCommentText("")
    }
    setSending(false)
  }

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-[20px] border border-white/60 shadow-sm shadow-black/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("discussion")}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
            activeTab === "discussion"
              ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white"
              : "bg-[#f3f4f6] text-[#6b7280] hover:text-[#374151]"
          }`}
        >
          Validation Discussion
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === "activity"
                ? "bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white"
                : "bg-[#f3f4f6] text-[#6b7280] hover:text-[#374151]"
            }`}
          >
            Activity History
          </button>
        )}
      </div>

      <div className="px-4 py-2.5 rounded-2xl border border-[#e5e7eb] bg-white text-xs font-semibold text-[#374151]">
        Validation Status: <span className="text-[#001f3f] uppercase">{STATUS_LABEL[validationStatus]}</span>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-xs text-rose-700">
          {error}
        </div>
      )}

      {activeTab === "discussion" && (
        <div className="space-y-4">
          {loadingComments ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="px-4 py-6 rounded-2xl border border-[#f0f2f5] text-sm text-[#6b7280] text-center">
              No discussion messages yet.
            </div>
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
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={3}
              placeholder="Write a validation comment or reply..."
              className="w-full px-4 py-3 rounded-2xl border border-[#e5e5e5] bg-white text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void submitComment()}
                disabled={sending || !commentText.trim()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md hover:translate-y-[-1px] hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "activity" && isAdmin && (
        <div className="space-y-3">
          {loadingLogs ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-2xl bg-[#f3f4f6] animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-6 rounded-2xl border border-[#f0f2f5] text-sm text-[#6b7280] text-center">
              No activity logs yet.
            </div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[#eef2f5] bg-[#fbfdff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#001f3f]">{actionLabel(entry.action_type)}</p>
                  <span className="text-[11px] text-[#9ca3af]">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-[#6b7280]">
                  {entry.profiles?.fullname ?? entry.performed_role ?? "User"}
                  {entry.performed_role ? ` Â· ${entry.performed_role}` : ""}
                </p>
                {(entry.old_value != null || entry.new_value != null) && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 break-all">
                      Old: {entry.old_value == null ? "â€”" : JSON.stringify(entry.old_value)}
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 break-all">
                      New: {entry.new_value == null ? "â€”" : JSON.stringify(entry.new_value)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
