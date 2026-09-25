"use client"

// Customer Feedback — the admin review queue. Every advisor's client reviews
// (migration 039), newest first. Approving one puts it in the "What My
// Clients Say" section of that advisor's website — the "did well" answer,
// first name + last initial and the star rating (lib/website-reviews.ts);
// hiding takes it off again. New and hidden reviews never appear publicly.
// Reads run on the browser client (RLS: admin staff read every row); the
// status change goes through PATCH /api/admin/feedback/[id].

import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, EyeOff, Loader2, MessageSquareQuote, Star } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { titleCaseName } from "@/lib/public-profile"
import { feedbackToTestimonial } from "@/lib/website-reviews"
import {
  RECOMMEND_LABELS,
  fetchAllFeedback,
  fetchPublishedSites,
  setFeedbackStatus,
  type AdminFeedback,
  type FeedbackStatus,
} from "@/lib/feedback-service"

// Legacy sale/purchase rows were converted to "buy" by migration 040.
const TYPE_LABELS: Record<string, string> = { buy: "Buy", resell: "Resell", rent: "Rent", sale: "Buy", purchase: "Buy" }

const STATUS_META: Record<FeedbackStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-[#fff7e6] text-[#8a6d2a]" },
  approved: { label: "On website", className: "bg-[#e8f6ee] text-[#15803d]" },
  hidden: { label: "Hidden", className: "bg-[#f3f4f6] text-[#6b7280]" },
}

type Tab = FeedbackStatus | "all"
const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "approved", label: "Approved" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
]

const advisorName = (r: AdminFeedback) => titleCaseName(r.agent_name ?? "") || "Advisor"

export default function FeedbackReviewPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const [rows, setRows] = useState<AdminFeedback[] | null>(null)
  const [sites, setSites] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("new")
  const [advisor, setAdvisor] = useState("all")
  // `${id}:${status}` while that change is saving.
  const [busy, setBusy] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    if (!allowed) return
    let live = true
    void fetchAllFeedback().then(async ({ data, error: err }) => {
      if (!live) return
      if (err) {
        setError(err)
        return
      }
      setRows(data)
      const map = await fetchPublishedSites([...new Set(data.map((r) => r.agent_id))])
      if (live) setSites(map)
    })
    return () => {
      live = false
    }
  }, [allowed])

  const advisors = useMemo(() => {
    const names = new Map<string, string>()
    for (const r of rows ?? []) if (!names.has(r.agent_id)) names.set(r.agent_id, advisorName(r))
    return [...names].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const forAdvisor = useMemo(
    () => (rows ?? []).filter((r) => advisor === "all" || r.agent_id === advisor),
    [rows, advisor],
  )
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { new: 0, approved: 0, hidden: 0, all: forAdvisor.length }
    for (const r of forAdvisor) c[r.status] += 1
    return c
  }, [forAdvisor])
  const shown = tab === "all" ? forAdvisor : forAdvisor.filter((r) => r.status === tab)

  const change = async (r: AdminFeedback, status: FeedbackStatus) => {
    setBusy(`${r.id}:${status}`)
    setRowError(null)
    const { error: err } = await setFeedbackStatus(r.id, status)
    setBusy(null)
    if (err) {
      setRowError({ id: r.id, message: err })
      return
    }
    setRows((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? prev)
  }

  if (!allowed) return null

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <Star className="w-6 h-6 text-[#d6b357]" />
          Customer Feedback
        </h1>
        <p className="text-sm text-[#6b7280] mt-1 max-w-3xl">
          Client reviews of every advisor. Approve a review to show it in the &ldquo;What My Clients
          Say&rdquo; section of that advisor&rsquo;s website, with the client&rsquo;s first name and last
          initial only. New and hidden reviews never appear publicly.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Review status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-sm font-semibold border transition-colors ${
                tab === t.id
                  ? "bg-[#001f3f] border-[#001f3f] text-white"
                  : "bg-white border-[#e8eaed] text-[#374151] hover:border-[#c9ced6]"
              }`}
            >
              {t.label} <span className={tab === t.id ? "text-[#d6b357]" : "text-[#9ca3af]"}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <select
          value={advisor}
          onChange={(e) => setAdvisor(e.target.value)}
          aria-label="Filter by advisor"
          className="bg-white border border-[#e8eaed] px-3 py-2 text-sm text-[#0d1117] focus:outline-none focus:border-[#d6b357]"
        >
          <option value="all">All advisors</option>
          {advisors.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-sm text-[#b91c1c]">Could not load reviews: {error}</p>
      )}

      {rows === null && !error && (
        <div className="flex items-center justify-center py-16 bg-white border border-[#e8eaed]">
          <Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" />
        </div>
      )}

      {rows !== null && shown.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#e8eaed] text-center px-6">
          <MessageSquareQuote className="w-9 h-9 text-[#cdd2d9] mb-3" />
          <p className="font-semibold text-sm text-[#0d1117]">
            {tab === "new" ? "No new reviews to check" : "No reviews here"}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {shown.map((r) => {
          const preview = feedbackToTestimonial(r)
          const site = sites[r.agent_id]
          return (
            <article key={r.id} className="bg-white border border-[#e8eaed] p-5">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-sm font-bold text-[#0d1117]">{advisorName(r)}</span>
                <span className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[r.status].className}`}>
                  {STATUS_META[r.status].label}
                </span>
                {site && (
                  <a
                    href={`/website/${site}#reviews`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#001f3f] hover:text-[#b8913f] transition-colors"
                  >
                    Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <time className="ml-auto text-xs text-[#9ca3af]">
                  {new Date(r.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })}
                </time>
              </header>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex gap-0.5" aria-label={`${r.overall_rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i <= r.overall_rating ? "fill-[#d6b357] text-[#d6b357]" : "text-[#dfe3e8]"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-[#0d1117]">{r.client_name}</span>
                {r.transaction_type && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#f3f4f6] text-[#374151]">
                    {TYPE_LABELS[r.transaction_type] ?? r.transaction_type}
                  </span>
                )}
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#eef4ff] text-[#1d4ed8]">
                  {RECOMMEND_LABELS[r.recommend]}
                </span>
                {r.property_ref && <span className="text-xs text-[#6b7280]">Ref: {r.property_ref}</span>}
              </div>

              {(r.did_well || r.to_improve || r.other_comments) && (
                <div className="mt-3 pt-3 border-t border-[#f0f2f5] space-y-2.5">
                  {r.did_well && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Did well: </span>
                      {r.did_well}
                    </p>
                  )}
                  {r.to_improve && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Could improve: </span>
                      {r.to_improve}
                    </p>
                  )}
                  {r.other_comments && (
                    <p className="text-sm text-[#374151] leading-relaxed">
                      <span className="font-semibold text-[#0d1117]">Comments: </span>
                      {r.other_comments}
                    </p>
                  )}
                </div>
              )}

              {/* Exactly what the website card would show. */}
              <div className="mt-4 bg-[#faf7ee] border border-[#efe4c4] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a6d2a]">On the website</p>
                {preview ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-[#374151]">
                    &ldquo;{preview.quote}&rdquo; <span className="font-semibold text-[#0d1117]">— {preview.name}</span>, {preview.where}
                  </p>
                ) : (
                  <p className="mt-1 text-[13px] text-[#6b7280]">Nothing to show — the client left no &ldquo;did well&rdquo; answer.</p>
                )}
                <p className="mt-1 text-[11px] text-[#9a8a5c]">&ldquo;Could improve&rdquo; and comments stay private.</p>
              </div>

              <footer className="mt-4 flex flex-wrap items-center gap-2">
                {r.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => void change(r, "approved")}
                    disabled={!preview || busy !== null}
                    title={preview ? undefined : "This review has nothing to show on the website"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d6b357] text-[#1a1408] text-sm font-bold hover:brightness-95 disabled:opacity-50 transition-all"
                  >
                    {busy === `${r.id}:approved` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve for website
                  </button>
                )}
                {r.status !== "hidden" && (
                  <button
                    type="button"
                    onClick={() => void change(r, "hidden")}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#e8eaed] bg-white text-sm font-semibold text-[#374151] hover:border-[#c9ced6] disabled:opacity-50 transition-colors"
                  >
                    {busy === `${r.id}:hidden` ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                    {r.status === "approved" ? "Remove from website" : "Hide"}
                  </button>
                )}
                {rowError?.id === r.id && <span className="text-xs text-[#b91c1c]">{rowError.message}</span>}
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
