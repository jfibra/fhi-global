"use client"

// Agent Resource → Buyers Link (migrations 060–061). Every agent has ONE
// permanent link (/b/<code>), created the first time they open this page. A
// client who opens it answers a four-step brief that lands here. Laid out like
// Invite: the QR card on the left, the clients it brought in on the right.
// The link comes from the idempotent POST /api/buyer-links; briefs are read
// under RLS, so an agent only ever sees their own.

import { useEffect, useMemo, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileSpreadsheet, FileText, Link2,
  Loader2, MessageCircle, RefreshCw, Search, Users,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { canUseBuyerLinks } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { titleCaseName } from "@/lib/public-profile"
import {
  BUDGET_OPTIONS, BUYER_QUESTIONS, BUYER_STEPS, answerLabel, budgetLabel, buyerLinkPath, contactTimeLabel, waDigits,
  type BuyerLead, type BuyerLink, type QuestionKey,
} from "@/lib/buyer-links"
import { fetchMyBuyerLeads, fetchMyBuyerLink } from "@/lib/buyer-link-service"

const PAGE_SIZE = 10
/** A brief this recent gets a "New" badge. */
const NEW_FOR_MS = 3 * 24 * 60 * 60 * 1000

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })

type Row = { label: string; value: string }

/** "Downtown Dubai, JVC, Al Furjan": the picked areas plus anything typed in. */
const areasText = (l: BuyerLead) => [answerLabel("areas", l.profile?.areas), l.profile?.areas_other].filter(Boolean).join(", ")

const answer = (l: BuyerLead, k: QuestionKey): string => (k === "areas" ? areasText(l) : answerLabel(k, l.profile?.[k]) ?? "")

/**
 * The brief as the agent reads it, in the client's four steps. Contact
 * fields lead the first step and the budget leads the last; blanks drop out.
 */
function briefSections(l: BuyerLead): { title: string; rows: Row[] }[] {
  const row = (label: string, value: string | null | undefined): Row | null => (value ? { label, value } : null)
  const before: Record<string, (Row | null)[]> = {
    details: [row("WhatsApp", `${l.whatsapp_code} ${l.whatsapp}`), row("Email", l.email), row("Nationality", l.profile?.nationality)],
    financials: [row("Budget", budgetLabel(l.budget))],
  }
  const after: Record<string, (Row | null)[]> = {
    details: [row("Best time", contactTimeLabel(l.contact_time))],
  }
  return BUYER_STEPS.map((s) => ({
    title: s.id === "details" ? "Contact" : s.title,
    rows: [...(before[s.id] ?? []), ...s.keys.map((k) => row(BUYER_QUESTIONS[k].short, answer(l, k))), ...(after[s.id] ?? [])].filter(
      (r): r is Row => r !== null,
    ),
  }))
}

/** Every column of the Excel export, in the order the client answered. */
const CSV_COLUMNS: { header: string; get: (l: BuyerLead) => string }[] = [
  { header: "Received", get: (l) => fmtDate(l.created_at) },
  { header: "Name", get: (l) => l.name },
  { header: "WhatsApp", get: (l) => `${l.whatsapp_code} ${l.whatsapp}` },
  { header: "Email", get: (l) => l.email ?? "" },
  { header: "Nationality", get: (l) => l.profile?.nationality ?? "" },
  { header: "Best time", get: (l) => contactTimeLabel(l.contact_time) ?? "" },
  { header: "Budget", get: (l) => budgetLabel(l.budget) ?? "" },
  ...BUYER_STEPS.flatMap((s) => s.keys).map((k) => ({ header: BUYER_QUESTIONS[k].short, get: (l: BuyerLead) => answer(l, k) })),
  { header: "Message", get: (l) => l.message ?? "" },
]

const TIMELINE_OPTIONS = BUYER_QUESTIONS.buy_timeline.options

/** Column-width versions of the two longest answers; the brief shows them in full. */
const COMPACT: Record<string, string> = { asap: "ASAP", payment_plan: "Payment plan" }
const compact = (l: BuyerLead, k: "buy_timeline" | "payment") => {
  const v = l.profile?.[k]
  return (typeof v === "string" && COMPACT[v]) || answer(l, k)
}

export default function BuyersLinkPage() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(canUseBuyerLinks(role))
  const userId = user?.id ?? null

  const [origin, setOrigin] = useState("")
  const [link, setLink] = useState<BuyerLink | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [leads, setLeads] = useState<BuyerLead[] | null>(null)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const downloadRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState("")
  const [budget, setBudget] = useState("")
  const [timeline, setTimeline] = useState("")
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed || !userId) return
    let live = true
    void Promise.all([fetchMyBuyerLink(), fetchMyBuyerLeads(userId)]).then(([mine, briefs]) => {
      if (!live) return
      setOrigin(window.location.origin)
      setLink(mine.link)
      setLinkError(mine.error)
      setLeads(briefs.leads)
      setLeadsError(briefs.error)
      setLoadedAt(Date.now())
    })
    return () => {
      live = false
    }
  }, [allowed, userId, reloadKey])

  const all = useMemo(() => leads ?? [], [leads])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    return all.filter((l) => {
      if (budget && l.budget !== budget) return false
      if (timeline && l.profile?.buy_timeline !== timeline) return false
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.profile?.nationality ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && `${l.whatsapp_code}${l.whatsapp}`.replace(/\D/g, "").includes(digits))
      )
    })
  }, [all, query, budget, timeline])

  if (!allowed) return null

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const filtering = !!(query.trim() || budget || timeline)

  const agentName = titleCaseName(profile?.fullname ?? "")
  const agentFirst = agentName.split(" ")[0] || "your advisor"
  const url = link && origin ? `${origin}${buyerLinkPath(link.code)}` : ""
  const shareText = encodeURIComponent(
    `Hi! To help me find the right property for you in Dubai, please answer a few quick questions here. It takes about two minutes: ${url}`,
  )

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable: the link is on screen to copy by hand */
    }
  }

  const downloadQr = () => {
    const canvas = downloadRef.current?.querySelector("canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "fhi-buyers-link-qr.png"
    a.click()
  }

  const refresh = async () => {
    if (!userId) return
    setRefreshing(true)
    const briefs = await fetchMyBuyerLeads(userId)
    setLeads(briefs.leads)
    setLeadsError(briefs.error)
    setLoadedAt(Date.now())
    setRefreshing(false)
  }

  // ── Exports: the whole filtered list, not just the visible page ──

  const exportExcel = () => {
    const rows = [CSV_COLUMNS.map((c) => c.header), ...visible.map((l) => CSV_COLUMNS.map((c) => c.get(l)))]
    // BOM so Excel opens UTF-8 names (ñ, Arabic, …) correctly.
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    a.download = `my-buyers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportPdf = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=1000,height=720")
    if (!w) return
    const generated = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
    const cell = (v: string) => esc(v || "—")
    const body = visible
      .map(
        (l, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td><strong>${esc(l.name)}</strong><br><span class="sub">${esc(`${l.whatsapp_code} ${l.whatsapp}`)}${l.email ? ` · ${esc(l.email)}` : ""}</span></td>
          <td>${cell(budgetLabel(l.budget) ?? "")}</td>
          <td>${cell(answer(l, "buying_for"))}</td>
          <td>${cell(answer(l, "buy_timeline"))}</td>
          <td>${cell(answer(l, "payment"))}</td>
          <td>${cell([answer(l, "property_types"), answer(l, "bedrooms") && `${answer(l, "bedrooms")} bed`].filter(Boolean).join(" · "))}</td>
          <td>${cell(areasText(l))}</td>
          <td>${esc(fmtDate(l.created_at))}</td>
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>My Buyers — ${esc(agentName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #ffffff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; gap: 24px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
  th { background: #001f3f; color: #ffffff; text-align: left; padding: 9px 10px; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 9px 10px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbfc; }
  .n { color: #9ca3af; width: 30px; }
  .sub { color: #6b7280; font-size: 11px; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { size: landscape; margin: 12mm; }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Buyers Link</p><h1>My Buyers</h1></div>
  <div class="meta">
    <span>Agent: <strong>${esc(agentName)}</strong></span>
    <span>Generated: <strong>${esc(generated)}</strong></span>
    <span>Buyers: <strong>${visible.length}</strong></span>
  </div>
  <table>
    <thead><tr><th>#</th><th>Client</th><th>Budget</th><th>Buying for</th><th>Plans to buy</th><th>Payment</th><th>Looking for</th><th>Areas</th><th>Received</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">Generated from the FHI Global dashboard · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    // Give the new window a beat to render before the print dialog opens.
    setTimeout(() => w.print(), 350)
  }

  const selectCls =
    "rounded-xl border border-[#e5e5e5] bg-white px-3 py-2.5 text-xs font-semibold text-[#374151] focus:border-[#001f3f] focus:outline-none"

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <Link2 className="h-6 w-6 text-[#001f3f]" />
          Buyers Link
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
          Your one link for every buyer. Send it or show the QR. Your client answers four quick steps about what they want, and
          their brief lands here.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Left: the QR card ── */}
        <div className="space-y-4 self-start lg:sticky lg:top-0">
          <div className="flex flex-col items-center rounded-2xl border border-[#e8eaed] bg-white p-6">
            <div className="rounded-2xl border-4 border-[#d6b357] bg-white p-4">
              {url ? (
                <QRCodeSVG value={url} size={190} level="M" fgColor="#001f3f" />
              ) : (
                <div className={`h-[190px] w-[190px] rounded-xl bg-[#f3f4f6] ${linkError ? "" : "animate-pulse"}`} />
              )}
            </div>
            <p className="mt-4 text-center font-['Outfit'] text-lg font-bold text-[#001f3f]">Scan to send your brief</p>

            {linkError ? (
              <div className="mt-3 w-full text-center">
                <p className="text-xs text-rose-600">Couldn&apos;t load your link. {linkError}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-2 text-xs font-bold text-[#001f3f] underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              url && (
                <p className="mt-2 w-full select-all truncate rounded-lg bg-[#f4f6f9] px-3 py-2 text-center font-mono text-[11.5px] text-[#374151]" title={url}>
                  {url.replace(/^https?:\/\//, "")}
                </p>
              )
            )}
            {link && !link.is_active && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-[11.5px] font-semibold text-amber-800">
                This link is switched off, so clients can&apos;t send a brief. Ask an admin to turn it back on.
              </p>
            )}

            {/* Hidden high-resolution canvas used for the PNG download. */}
            <div ref={downloadRef} className="hidden" aria-hidden>
              {url && <QRCodeCanvas value={url} size={1024} level="M" fgColor="#001f3f" marginSize={4} />}
            </div>

            <div className="mt-5 w-full space-y-2">
              <button
                type="button"
                onClick={downloadQr}
                disabled={!url}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#00356b] disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Download QR
              </button>
              <a
                href={url ? `https://wa.me/?text=${shareText}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!url}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25d366] px-4 py-3 text-sm font-bold text-[#128c4b] transition-colors hover:bg-[#25d366]/10 ${url ? "" : "pointer-events-none opacity-40"}`}
              >
                <MessageCircle className="h-4 w-4" />
                Share on WhatsApp
              </a>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  disabled={!url}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                    copied
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a
                  href={url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!url}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#e5e5e5] px-3 py-3 text-sm font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f] ${url ? "" : "pointer-events-none opacity-40"}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </a>
              </div>
            </div>
          </div>

          {/* ── How it works ── */}
          <div className="rounded-2xl border border-[#e8eaed] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">How it works</p>
            <ol className="mt-3 space-y-3">
              {[
                "Send your link on WhatsApp, or let a client scan the QR.",
                "They answer four quick steps: details, buying profile, preferences and financials.",
                "Their brief lands in My buyers, ready for you to reply on WhatsApp.",
              ].map((t, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-snug text-[#374151]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#001f3f] text-[11px] font-bold text-[#d6b357]">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ── Right: My buyers ── */}
        <div className="@container min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-2.5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
              <Users className="h-4 w-4 text-[#d6b357]" />
              My buyers{leads ? ` (${all.length})` : ""}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || leads === null}
              title="Refresh buyers"
              aria-label="Refresh buyers"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f6f9] px-2.5 py-1.5 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* ── Search, filters, exports ── */}
          {leads !== null && !leadsError && all.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search by name, email, number or nationality…"
                  className="w-full rounded-xl border border-[#e5e5e5] py-2.5 pl-10 pr-4 text-sm text-[#111827] transition-colors placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={budget}
                  onChange={(e) => {
                    setBudget(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by budget"
                  className={selectCls}
                >
                  <option value="">Any budget</option>
                  {BUDGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={timeline}
                  onChange={(e) => {
                    setTimeline(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by when they plan to buy"
                  className={selectCls}
                >
                  <option value="">Any timeline</option>
                  {TIMELINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={visible.length === 0}
                  title="Download as Excel (CSV)"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-40"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={visible.length === 0}
                  title="Download report as PDF"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#001f3f]/15 bg-[#001f3f]/5 px-3.5 py-2.5 text-xs font-bold text-[#001f3f] transition-colors hover:bg-[#001f3f]/10 disabled:opacity-40"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>
          )}

          {leads === null ? (
            <p className="flex items-center gap-2 py-4 text-sm text-[#9ca3af]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your buyers…
            </p>
          ) : leadsError ? (
            <p className="py-4 text-sm text-[#9ca3af]">Couldn&apos;t load your buyers right now. Refresh to try again.</p>
          ) : all.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfe3e8] px-5 py-10 text-center">
              <p className="font-['Outfit'] text-base font-bold text-[#0d1117]">No briefs yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6b7280]">
                Share your link or QR with a client. When they send their brief, they&apos;ll appear here.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-4 text-sm text-[#9ca3af]">
              No buyers match {query.trim() ? <span className="font-semibold text-[#374151]">&ldquo;{query.trim()}&rdquo;</span> : "these filters"}.
              {filtering && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setBudget("")
                    setTimeline("")
                    setPage(1)
                  }}
                  className="ml-2 font-semibold text-[#001f3f] underline"
                >
                  Clear
                </button>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-[#f0f2f5]">
              {pageItems.map((l) => {
                const open = openId === l.id
                const first = l.name.trim().split(/\s+/)[0]
                const wa = waDigits(l.whatsapp_code, l.whatsapp)
                const hello = `Hi ${first}, this is ${agentFirst} from FHI Global. Thank you for your property brief. I'm putting together options that fit.`
                const isNew = loadedAt - new Date(l.created_at).getTime() < NEW_FOR_MS
                const cols: (Row & { full: string; w: string })[] = [
                  { label: "Budget", value: budgetLabel(l.budget) ?? "", full: budgetLabel(l.budget) ?? "", w: "w-[92px]" },
                  { label: "Plans to buy", value: compact(l, "buy_timeline"), full: answer(l, "buy_timeline"), w: "w-[104px]" },
                  { label: "Payment", value: compact(l, "payment"), full: answer(l, "payment"), w: "w-[96px]" },
                ]
                return (
                  <li key={l.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#001f3f] to-[#003366] text-sm font-bold text-white">
                        {first.charAt(0).toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : l.id)}
                        aria-expanded={open}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                          <span className="truncate">{l.name}</span>
                          {isNew && (
                            <span className="shrink-0 rounded-full bg-[#d6b357]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a6d2b]">
                              New
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[#6b7280]">
                          {[answer(l, "buying_for"), fmtDate(l.created_at)].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                      <div className="hidden shrink-0 gap-4 @3xl:flex">
                        {cols.map((c) => (
                          <div key={c.label} className={c.w}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{c.label}</p>
                            <p className="truncate text-xs font-semibold text-[#374151]" title={c.full || undefined}>{c.value || "—"}</p>
                          </div>
                        ))}
                      </div>
                      {wa && (
                        <a
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(hello)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`WhatsApp ${first}`}
                          aria-label={`WhatsApp ${first}`}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#25d366] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#1fb857]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="hidden @md:inline">WhatsApp</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : l.id)}
                        aria-expanded={open}
                        aria-label={open ? `Hide ${first}'s brief` : `Show ${first}'s brief`}
                        className="shrink-0 rounded-lg p-1.5 text-[#9ca3af] transition-colors hover:bg-[#f4f6f9] hover:text-[#001f3f]"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {/* The three headline answers as chips, when the card is too narrow for columns. */}
                    <div className="ml-12 mt-2 flex flex-wrap gap-1.5 @3xl:hidden">
                      {cols
                        .filter((c) => c.full)
                        .map((c) => (
                          <span key={c.label} className="rounded-full bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-semibold text-[#374151]">
                            {c.full}
                          </span>
                        ))}
                    </div>

                    {open && (
                      <div className="mt-3 rounded-xl border border-[#eef0f3] bg-[#fafbfc] p-4 @md:ml-12">
                        <div className="grid gap-x-8 gap-y-5 @xl:grid-cols-2">
                          {briefSections(l).map((s) => (
                            <section key={s.title}>
                              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">{s.title}</p>
                              {s.rows.length ? (
                                <dl className="mt-2 space-y-1.5">
                                  {s.rows.map((r) => (
                                    <div key={r.label} className="grid grid-cols-[88px_1fr] gap-2 text-[13px] @md:grid-cols-[104px_1fr]">
                                      <dt className="text-[#6b7280]">{r.label}</dt>
                                      <dd className={`min-w-0 font-semibold text-[#111827] ${r.label === "Email" ? "break-all" : "break-words"}`}>
                                        {r.label === "Email" ? (
                                          <a href={`mailto:${r.value}`} className="text-[#001f3f] underline">{r.value}</a>
                                        ) : (
                                          r.value
                                        )}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="mt-2 text-[13px] text-[#9ca3af]">Skipped</p>
                              )}
                            </section>
                          ))}
                        </div>
                        {l.message && (
                          <div className="mt-5 border-l-2 border-[#d6b357] pl-3">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">Their note</p>
                            <p className="mt-1 whitespace-pre-line text-[13px] text-[#374151]">{l.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {/* ── Pagination ── */}
          {leads !== null && !leadsError && totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f2f5] pt-4">
              <p className="whitespace-nowrap text-xs text-[#9ca3af]">
                Showing{" "}
                <span className="font-bold text-[#374151]">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visible.length)}
                </span>{" "}
                of <span className="font-bold text-[#374151]">{visible.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="whitespace-nowrap px-1 text-xs font-bold text-[#001f3f]">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5e5] px-3 py-1.5 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
