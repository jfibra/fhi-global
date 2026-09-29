"use client"

// Agent Resource → Buyers Link (migrations 060–063). Every agent has ONE
// permanent link, created the first time they open this page, with a
// readable address from their name and two public pages: /buy-with/<name>
// for buyers and /sell-with/<name> for owners who want to sell. Each client answers a four-step brief that lands here. Laid out like
// Invite: a Buyers / Sellers toggle, the QR card on the left, the clients
// that view brought in on the right. The link comes from the idempotent
// POST /api/buyer-links; briefs are read under RLS, so an agent only ever
// sees their own.

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileSpreadsheet, FileText, House, Link2,
  Loader2, MessageCircle, RefreshCw, Search, Users,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { canUseBuyerLinks, isAdminStaffRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { titleCaseName } from "@/lib/public-profile"
import {
  BUDGET_OPTIONS, BUYER_QUESTIONS, BUYER_STEPS, GRADE_OPTIONS, LEAD_GRADES, SELLER_QUESTIONS, answerLabel, budgetLabel, buyerLinkPath,
  contactTimeLabel, formatAed, formatSqft, leadGrade, sellerAnswerLabel, sellerLinkPath, waDigits,
  type BriefKind, type BuyerLead, type BuyerLink, type Choice, type LeadGrade, type QuestionKey, type SellerQuestionKey,
} from "@/lib/buyer-links"
import { fetchAllBuyerLeads, fetchMyBuyerLeads, fetchMyBuyerLink } from "@/lib/buyer-link-service"

const PAGE_SIZE = 10
/** A brief this recent gets a "New" badge. */
const NEW_FOR_MS = 3 * 24 * 60 * 60 * 1000

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" })

type Row = { label: string; value: string }
type Section = { title: string; rows: Row[] }
/** A headline answer: `value` fits its column, `full` is the whole answer. */
type Col = { label: string; value: string; full: string; w: string }

/** A free-text answer from the brief, or "". */
const txt = (l: BuyerLead, k: string): string => {
  const v = l.profile?.[k]
  return typeof v === "string" ? v : ""
}
const rowOf = (label: string, value: string | null | undefined): Row | null => (value ? { label, value } : null)
const rows = (list: (Row | null)[]) => list.filter((r): r is Row => r !== null)
const contactRows = (l: BuyerLead) => [
  rowOf("WhatsApp", `${l.whatsapp_code} ${l.whatsapp}`),
  rowOf("Email", l.email),
  rowOf("Nationality", txt(l, "nationality")),
]

// ─── Buyers ──────────────────────────────────────────────────────────────────

/** "Downtown Dubai, JVC, Al Furjan": the picked areas plus anything typed in. */
const areasText = (l: BuyerLead) => [answerLabel("areas", l.profile?.areas), txt(l, "areas_other")].filter(Boolean).join(", ")
const buyerAnswer = (l: BuyerLead, k: QuestionKey): string => (k === "areas" ? areasText(l) : answerLabel(k, l.profile?.[k]) ?? "")

/** Column-width versions of the two longest answers; the brief shows them in full. */
const COMPACT: Record<string, string> = { asap: "ASAP", payment_plan: "Payment plan" }
const compact = (l: BuyerLead, k: "buy_timeline" | "payment") => COMPACT[txt(l, k)] || buyerAnswer(l, k)

/**
 * The buyer's brief as the agent reads it, in the client's four steps.
 * Contact fields lead the first step and the budget leads the last.
 */
function buyerSections(l: BuyerLead): Section[] {
  const before: Record<string, (Row | null)[]> = {
    details: contactRows(l),
    financials: [rowOf("Budget", budgetLabel(l.budget))],
  }
  const after: Record<string, (Row | null)[]> = { details: [rowOf("Best time", contactTimeLabel(l.contact_time))] }
  return BUYER_STEPS.map((s) => ({
    title: s.id === "details" ? "Contact" : s.title,
    rows: rows([...(before[s.id] ?? []), ...s.keys.map((k) => rowOf(BUYER_QUESTIONS[k].short, buyerAnswer(l, k))), ...(after[s.id] ?? [])]),
  }))
}

// ─── Sellers ─────────────────────────────────────────────────────────────────

const sellerAnswer = (l: BuyerLead, k: SellerQuestionKey): string => sellerAnswerLabel(k, l.profile?.[k]) ?? ""
const sellerArea = (l: BuyerLead) => [sellerAnswer(l, "area"), txt(l, "area_other")].filter(Boolean).join(", ")
const bedsShort = (v: string) => (!v ? "" : v === "studio" ? "Studio" : v === "5_plus" ? "5+ bed" : `${v} bed`)
/** "Apartment · 2 bed". */
const sellerProperty = (l: BuyerLead) => [sellerAnswer(l, "property_type"), bedsShort(txt(l, "bedrooms"))].filter(Boolean).join(" · ")
const sellerPrice = (l: BuyerLead) => formatAed(txt(l, "asking_price")) ?? (txt(l, "valuation") === "yes" ? "Wants a valuation" : "")

/** The seller's brief as the agent reads it, in the owner's four steps. */
function sellerSections(l: BuyerLead): Section[] {
  const a = (k: SellerQuestionKey) => rowOf(SELLER_QUESTIONS[k].short, sellerAnswer(l, k))
  return [
    { title: "Contact", rows: rows([...contactRows(l), a("relation"), a("residence"), rowOf("Best time", contactTimeLabel(l.contact_time))]) },
    {
      title: "The property",
      rows: rows([
        a("property_type"),
        rowOf("Area", sellerArea(l)),
        rowOf("Building", txt(l, "building")),
        a("bedrooms"),
        a("bathrooms"),
        rowOf("Size", formatSqft(txt(l, "size_sqft"))),
        a("furnishing"),
        a("features"),
      ]),
    },
    {
      title: "Status & price",
      rows: rows([
        a("completion"),
        a("paid_percent"),
        a("handover"),
        a("occupancy"),
        a("tenancy_ends"),
        rowOf("Asking price", formatAed(txt(l, "asking_price"))),
        a("valuation"),
        a("mortgage"),
        a("title_deed"),
      ]),
    },
    { title: "Plans", rows: rows([a("sell_timeline"), a("reason"), a("listed"), a("also_rent")]) },
  ]
}

// ─── The two views ───────────────────────────────────────────────────────────

type View = "buyers" | "sellers"
type Filter = { any: string; aria: string; options: Choice[]; get: (l: BuyerLead) => string | null }
type ViewConfig = {
  kind: BriefKind
  /** The public page by the link's readable address; `legacy` by its code, until the address exists. */
  path: (slug: string) => string
  legacy: (code: string) => string
  intro: string
  qrTitle: string
  qrNote: string | null
  share: (url: string) => string
  qrFile: string
  how: string[]
  list: string
  empty: { title: string; body: string }
  filters: Filter[]
  /** Buyers only: the grade from the answers, shown as a chip and a filter. */
  grade?: (l: BuyerLead) => LeadGrade
  subline: (l: BuyerLead) => string
  cols: (l: BuyerLead) => Col[]
  sections: (l: BuyerLead) => Section[]
  hello: (first: string, agentFirst: string) => string
  csvName: string
  csv: { header: string; get: (l: BuyerLead) => string }[]
  pdf: { title: string; band: string; heads: string[]; cells: (l: BuyerLead) => string[] }
  /** Free text worth searching beyond name, email, number and nationality. */
  searchText: (l: BuyerLead) => string
}

const VIEWS: Record<View, ViewConfig> = {
  buyers: {
    kind: "buyer",
    path: buyerLinkPath,
    legacy: (code) => `/b/${code}`,
    intro:
      "Your one link for every buyer. Send it or show the QR. Your client answers four quick steps about what they want, and their brief lands here.",
    qrTitle: "Scan to send your brief",
    qrNote: null,
    share: (url) =>
      `Hi! To help me find the right property for you in Dubai, please answer a few quick questions here. It takes about two minutes: ${url}`,
    qrFile: "fhi-buyers-link-qr.png",
    how: [
      "Send your link on WhatsApp, or let a client scan the QR.",
      "They answer four quick steps: details, buying profile, preferences and financials.",
      "Their brief lands in My buyers, ready for you to reply on WhatsApp.",
      "Each brief gets a grade from its answers — Priority, Qualified, Nurture or Information — so you know who to call first.",
    ],
    list: "My buyers",
    empty: { title: "No briefs yet", body: "Share your link or QR with a client. When they send their brief, they’ll appear here." },
    filters: [
      { any: "Any budget", aria: "Filter by budget", options: BUDGET_OPTIONS, get: (l) => l.budget },
      { any: "Any timeline", aria: "Filter by when they plan to buy", options: BUYER_QUESTIONS.buy_timeline.options, get: (l) => txt(l, "buy_timeline") },
      { any: "Any grade", aria: "Filter by lead grade", options: GRADE_OPTIONS, get: (l) => leadGrade(l) },
    ],
    grade: leadGrade,
    subline: (l) => [buyerAnswer(l, "buying_for"), fmtDate(l.created_at)].filter(Boolean).join(" · "),
    cols: (l) => [
      { label: "Budget", value: budgetLabel(l.budget) ?? "", full: budgetLabel(l.budget) ?? "", w: "w-[92px]" },
      { label: "Plans to buy", value: compact(l, "buy_timeline"), full: buyerAnswer(l, "buy_timeline"), w: "w-[104px]" },
      { label: "Payment", value: compact(l, "payment"), full: buyerAnswer(l, "payment"), w: "w-[96px]" },
    ],
    sections: buyerSections,
    hello: (first, agentFirst) =>
      `Hi ${first}, this is ${agentFirst} from FHI Global. Thank you for your property brief. I'm putting together options that fit.`,
    csvName: "my-buyers",
    csv: [
      { header: "Received", get: (l) => fmtDate(l.created_at) },
      { header: "Name", get: (l) => l.name },
      { header: "WhatsApp", get: (l) => `${l.whatsapp_code} ${l.whatsapp}` },
      { header: "Email", get: (l) => l.email ?? "" },
      { header: "Nationality", get: (l) => txt(l, "nationality") },
      { header: "Best time", get: (l) => contactTimeLabel(l.contact_time) ?? "" },
      { header: "Budget", get: (l) => budgetLabel(l.budget) ?? "" },
      { header: "Grade", get: (l) => LEAD_GRADES[leadGrade(l)].label },
      ...BUYER_STEPS.flatMap((s) => s.keys).map((k) => ({ header: BUYER_QUESTIONS[k].short, get: (l: BuyerLead) => buyerAnswer(l, k) })),
      { header: "Message", get: (l) => l.message ?? "" },
    ],
    pdf: {
      title: "My Buyers",
      band: "FHI Global · Buyers Link",
      heads: ["Budget", "Buying for", "Plans to buy", "Payment", "Looking for", "Areas", "Received"],
      cells: (l) => [
        budgetLabel(l.budget) ?? "",
        buyerAnswer(l, "buying_for"),
        buyerAnswer(l, "buy_timeline"),
        buyerAnswer(l, "payment"),
        [buyerAnswer(l, "property_types"), buyerAnswer(l, "bedrooms") && `${buyerAnswer(l, "bedrooms")} bed`].filter(Boolean).join(" · "),
        areasText(l),
        fmtDate(l.created_at),
      ],
    },
    searchText: (l) => txt(l, "areas_other"),
  },
  sellers: {
    kind: "seller",
    path: sellerLinkPath,
    legacy: (code) => `/s/${code}`,
    intro:
      "Your link for owners who want to sell. Send it or show the QR. They answer four quick steps about their property, and it lands here.",
    qrTitle: "Scan to sell your property",
    qrNote: "For owners who want to sell in Dubai. Their property details land in your Sellers list.",
    share: (url) =>
      `Hi! Thinking of selling your property in Dubai? Tell me about it here and I'll come back to you on price and next steps. It takes about two minutes: ${url}`,
    qrFile: "fhi-sellers-link-qr.png",
    how: [
      "Send your Sellers Link on WhatsApp, or let an owner scan the QR.",
      "They answer four quick steps: details, the property, status and price, and their plans.",
      "The property lands in My sellers, ready for you to reply on WhatsApp.",
    ],
    list: "My sellers",
    empty: { title: "No sellers yet", body: "Share your Sellers Link or QR with an owner. When they send their property details, they’ll appear here." },
    filters: [
      { any: "Any property", aria: "Filter by property type", options: SELLER_QUESTIONS.property_type.options, get: (l) => txt(l, "property_type") },
      { any: "Any timeline", aria: "Filter by when they want to sell", options: SELLER_QUESTIONS.sell_timeline.options, get: (l) => txt(l, "sell_timeline") },
    ],
    subline: (l) => [sellerAnswer(l, "sell_timeline"), fmtDate(l.created_at)].filter(Boolean).join(" · "),
    cols: (l) => {
      const price = sellerPrice(l)
      return [
        { label: "Property", value: sellerProperty(l), full: sellerProperty(l), w: "w-[116px]" },
        { label: "Area", value: sellerArea(l), full: sellerArea(l), w: "w-[112px]" },
        { label: "Asking", value: price === "Wants a valuation" ? "Valuation" : price, full: price, w: "w-[100px]" },
      ]
    },
    sections: sellerSections,
    hello: (first, agentFirst) =>
      `Hi ${first}, this is ${agentFirst} from FHI Global. Thank you for the details of your property. When is a good time to talk about selling it?`,
    csvName: "my-sellers",
    csv: [
      { header: "Received", get: (l) => fmtDate(l.created_at) },
      { header: "Name", get: (l) => l.name },
      { header: "WhatsApp", get: (l) => `${l.whatsapp_code} ${l.whatsapp}` },
      { header: "Email", get: (l) => l.email ?? "" },
      { header: "Nationality", get: (l) => txt(l, "nationality") },
      { header: "Best time", get: (l) => contactTimeLabel(l.contact_time) ?? "" },
      { header: "Owner", get: (l) => sellerAnswer(l, "relation") },
      { header: "Lives", get: (l) => sellerAnswer(l, "residence") },
      { header: "Property type", get: (l) => sellerAnswer(l, "property_type") },
      { header: "Area", get: (l) => sellerArea(l) },
      { header: "Building", get: (l) => txt(l, "building") },
      { header: "Bedrooms", get: (l) => sellerAnswer(l, "bedrooms") },
      { header: "Bathrooms", get: (l) => sellerAnswer(l, "bathrooms") },
      { header: "Size (sq ft)", get: (l) => txt(l, "size_sqft") },
      { header: "Furnishing", get: (l) => sellerAnswer(l, "furnishing") },
      { header: "Highlights", get: (l) => sellerAnswer(l, "features") },
      { header: "Status", get: (l) => sellerAnswer(l, "completion") },
      { header: "Paid so far", get: (l) => sellerAnswer(l, "paid_percent") },
      { header: "Handover", get: (l) => sellerAnswer(l, "handover") },
      { header: "Occupancy", get: (l) => sellerAnswer(l, "occupancy") },
      { header: "Tenancy ends", get: (l) => sellerAnswer(l, "tenancy_ends") },
      { header: "Asking price (AED)", get: (l) => txt(l, "asking_price") },
      { header: "Valuation", get: (l) => sellerAnswer(l, "valuation") },
      { header: "Mortgage", get: (l) => sellerAnswer(l, "mortgage") },
      { header: "Title deed", get: (l) => sellerAnswer(l, "title_deed") },
      { header: "Wants to sell", get: (l) => sellerAnswer(l, "sell_timeline") },
      { header: "Reason", get: (l) => sellerAnswer(l, "reason") },
      { header: "Listed elsewhere", get: (l) => sellerAnswer(l, "listed") },
      { header: "Would rent", get: (l) => sellerAnswer(l, "also_rent") },
      { header: "Message", get: (l) => l.message ?? "" },
    ],
    pdf: {
      title: "My Sellers",
      band: "FHI Global · Sellers Link",
      heads: ["Property", "Area", "Asking price", "Status", "Wants to sell", "Received"],
      cells: (l) => [
        [sellerProperty(l), formatSqft(txt(l, "size_sqft"))].filter(Boolean).join(" · "),
        [sellerArea(l), txt(l, "building")].filter(Boolean).join(" · "),
        sellerPrice(l),
        [sellerAnswer(l, "completion"), sellerAnswer(l, "paid_percent") && `${sellerAnswer(l, "paid_percent")} paid`].filter(Boolean).join(" · "),
        sellerAnswer(l, "sell_timeline"),
        fmtDate(l.created_at),
      ],
    },
    searchText: (l) => [txt(l, "building"), txt(l, "area_other")].join(" "),
  },
}

export default function BuyersLinkPage({ scope = "agent" }: { scope?: "agent" | "admin" }) {
  // "admin" (Communication → Buyer Leads): every agent's briefs, read-only —
  // no link or QR of their own; an Agent column, filter and totals instead.
  const admin = scope === "admin"
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(admin ? isAdminStaffRole(role) : canUseBuyerLinks(role))
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

  const [view, setView] = useState<View>("buyers")
  const [query, setQuery] = useState("")
  // One slot per filter, plus the admin's Agent filter in front (unused for agents).
  const [filters, setFilters] = useState<Record<View, string[]>>({ buyers: ["", "", "", ""], sellers: ["", "", ""] })
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed || !userId) return
    let live = true
    const load = admin
      ? fetchAllBuyerLeads().then((briefs) => ({ mine: null, briefs }))
      : Promise.all([fetchMyBuyerLink(), fetchMyBuyerLeads(userId)]).then(([mine, briefs]) => ({ mine, briefs }))
    void load.then(({ mine, briefs }) => {
      if (!live) return
      setOrigin(window.location.origin)
      setLink(mine?.link ?? null)
      setLinkError(mine?.error ?? null)
      setLeads(briefs.leads)
      setLeadsError(briefs.error)
      setLoadedAt(Date.now())
    })
    return () => {
      live = false
    }
  }, [allowed, userId, reloadKey, admin])

  const cfg = VIEWS[view]
  const all = useMemo(() => leads ?? [], [leads])
  const counts = useMemo(() => {
    const sellers = all.filter((l) => l.kind === "seller").length
    return { buyers: all.length - sellers, sellers }
  }, [all])
  const pool = useMemo(() => all.filter((l) => (l.kind ?? "buyer") === cfg.kind), [all, cfg])
  // Admin: whose link each brief came through — a filter, a column, a search field, a total.
  const ownerName = (l: BuyerLead) => l.agent?.name ?? ""
  const agentOptions = useMemo<Choice[]>(() => {
    const seen = new Map<string, string>()
    for (const l of all) if (l.agent && !seen.has(l.agent.id)) seen.set(l.agent.id, l.agent.name)
    return [...seen].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))
  }, [all])
  const activeFilters = useMemo<Filter[]>(
    () => (admin ? [{ any: "Any agent", aria: "Filter by agent", options: agentOptions, get: (l) => l.agent_id }, ...cfg.filters] : cfg.filters),
    [admin, agentOptions, cfg],
  )
  const stats = useMemo(() => {
    // Measured from when the list was loaded (state), so the memo stays pure.
    const weekAgo = loadedAt - 7 * 24 * 60 * 60 * 1000
    const grade = cfg.grade
    return [
      { label: cfg.kind === "seller" ? "Seller briefs" : "Buyer briefs", value: pool.length },
      { label: "This week", value: pool.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length },
      grade
        ? { label: "Priority", value: pool.filter((l) => grade(l) === "priority").length }
        : { label: "Want a valuation", value: pool.filter((l) => txt(l, "valuation") === "yes").length },
      { label: "Agents", value: new Set(pool.map((l) => l.agent_id)).size },
    ]
  }, [pool, cfg, loadedAt])
  const picked = filters[view]
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    return pool.filter((l) => {
      if (activeFilters.some((f, i) => picked[i] && f.get(l) !== picked[i])) return false
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        txt(l, "nationality").toLowerCase().includes(q) ||
        ownerName(l).toLowerCase().includes(q) ||
        cfg.searchText(l).toLowerCase().includes(q) ||
        (digits.length >= 3 && `${l.whatsapp_code}${l.whatsapp}`.replace(/\D/g, "").includes(digits))
      )
    })
  }, [pool, query, picked, cfg, activeFilters])

  if (!allowed) return null

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const filtering = !!(query.trim() || picked.some(Boolean))

  const agentName = titleCaseName(profile?.fullname ?? "")
  const agentFirst = agentName.split(" ")[0] || "your advisor"
  const url = link && origin ? `${origin}${link.slug ? cfg.path(link.slug) : cfg.legacy(link.code)}` : ""
  const dark = view === "sellers"

  const switchView = (v: View) => {
    setView(v)
    setQuery("")
    setPage(1)
    setOpenId(null)
    setCopied(false)
  }
  const setFilter = (i: number, value: string) => {
    setFilters((f) => ({ ...f, [view]: f[view].map((v, j) => (j === i ? value : v)) }))
    setPage(1)
  }
  const clearFilters = () => {
    setQuery("")
    setFilters((f) => ({ ...f, [view]: f[view].map(() => "") }))
    setPage(1)
  }

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
    a.download = cfg.qrFile
    a.click()
  }

  const refresh = async () => {
    if (!userId) return
    setRefreshing(true)
    const briefs = admin ? await fetchAllBuyerLeads() : await fetchMyBuyerLeads(userId)
    setLeads(briefs.leads)
    setLeadsError(briefs.error)
    setLoadedAt(Date.now())
    setRefreshing(false)
  }

  // ── Exports: the whole filtered list, not just the visible page ──

  const csvCols = admin ? [{ header: "Agent", get: ownerName }, ...cfg.csv] : cfg.csv
  const pdfHeads = admin ? ["Agent", ...cfg.pdf.heads] : cfg.pdf.heads
  const pdfCells = (l: BuyerLead) => (admin ? [ownerName(l), ...cfg.pdf.cells(l)] : cfg.pdf.cells(l))
  const pdfTitle = admin ? (view === "sellers" ? "Seller Leads" : "Buyer Leads") : cfg.pdf.title

  const exportExcel = () => {
    const table = [csvCols.map((c) => c.header), ...visible.map((l) => csvCols.map((c) => c.get(l)))]
    // BOM so Excel opens UTF-8 names (ñ, Arabic, …) correctly.
    const csv = "﻿" + table.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    a.download = `${admin ? `all-${view}` : cfg.csvName}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportPdf = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const w = window.open("", "_blank", "width=1000,height=720")
    if (!w) return
    const generated = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
    const body = visible
      .map(
        (l, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td><strong>${esc(l.name)}</strong><br><span class="sub">${esc(`${l.whatsapp_code} ${l.whatsapp}`)}${l.email ? ` · ${esc(l.email)}` : ""}</span></td>
          ${pdfCells(l).map((c) => `<td>${esc(c || "—")}</td>`).join("")}
        </tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(pdfTitle)} — ${esc(agentName)}</title>
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
  <div class="band"><p class="gold">${esc(cfg.pdf.band)}</p><h1>${esc(pdfTitle)}</h1></div>
  <div class="meta">
    <span>${admin ? "Prepared by" : "Agent"}: <strong>${esc(agentName)}</strong></span>
    <span>Generated: <strong>${esc(generated)}</strong></span>
    <span>${view === "sellers" ? "Sellers" : "Buyers"}: <strong>${visible.length}</strong></span>
  </div>
  <table>
    <thead><tr><th>#</th><th>${view === "sellers" ? "Owner" : "Client"}</th>${pdfHeads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
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
  const tab = (v: View, label: string, Icon: typeof Users, n: number) => (
    <button
      type="button"
      onClick={() => switchView(v)}
      aria-pressed={view === v}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
        view === v ? "bg-[#001f3f] text-white" : "text-[#374151] hover:bg-[#f3f4f6]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {leads && (
        <span
          className={`rounded-full px-1.5 text-[11px] ${
            view === v ? (v === "sellers" ? "bg-[#d6b357] text-[#001f3f]" : "bg-white/15") : "bg-[#f3f4f6]"
          }`}
        >
          {n}
        </span>
      )}
    </button>
  )

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
            <Link2 className="h-6 w-6 text-[#001f3f]" />
            {admin ? "Buyer Leads" : "Buyers Link"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
            {admin ? "Every agent's Buyers Link briefs in one place, read-only. Each lead stays with the agent whose link it came through." : cfg.intro}
          </p>
        </div>
        {/* Segmented toggle: which link the QR and the list are for. */}
        <div className="inline-flex shrink-0 self-start rounded-xl border border-[#e5e7eb] bg-white p-1">
          {tab("buyers", "Buyers", Users, counts.buyers)}
          {tab("sellers", "Sellers", House, counts.sellers)}
        </div>
      </div>

      <div className={admin ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]"}>
        {/* ── Left: the QR card (agents only) ── */}
        {!admin && (
          <div className="space-y-4 self-start lg:sticky lg:top-0">
            <div
              className={`flex flex-col items-center rounded-2xl border p-6 ${
                dark ? "border-[#d6b357]/50 bg-[#001f3f] text-white" : "border-[#e8eaed] bg-white"
              }`}
            >
              <div className="rounded-2xl border-4 border-[#d6b357] bg-white p-4">
                {url ? (
                  <QRCodeSVG value={url} size={190} level="M" fgColor="#001f3f" />
                ) : (
                  <div className={`h-[190px] w-[190px] rounded-xl bg-[#f3f4f6] ${linkError ? "" : "animate-pulse"}`} />
                )}
              </div>
              <p className={`mt-4 text-center font-['Outfit'] text-lg font-bold ${dark ? "text-[#d6b357]" : "text-[#001f3f]"}`}>{cfg.qrTitle}</p>
              {cfg.qrNote && <p className="mt-1.5 text-center text-[11px] leading-relaxed text-white/70">{cfg.qrNote}</p>}

              {linkError ? (
                <div className="mt-3 w-full text-center">
                  <p className={`text-xs ${dark ? "text-rose-300" : "text-rose-600"}`}>Couldn&apos;t load your link. {linkError}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className={`mt-2 text-xs font-bold underline ${dark ? "text-white" : "text-[#001f3f]"}`}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                url && (
                  <p
                    className={`mt-3 w-full select-all break-words rounded-lg px-3 py-2 text-center font-mono text-[11.5px] leading-relaxed ${
                      dark ? "bg-white/10 text-white/85" : "bg-[#f4f6f9] text-[#374151]"
                    }`}
                    title={url}
                  >
                    {/* Line breaks only after a slash, so the agent's name stays whole. */}
                    {url
                      .replace(/^https?:\/\//, "")
                      .split("/")
                      .map((part, i, all) => (
                        <Fragment key={i}>
                          {part}
                          {i < all.length - 1 && (
                            <>
                              /<wbr />
                            </>
                          )}
                        </Fragment>
                      ))}
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
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
                    dark ? "bg-[#d6b357] text-[#001f3f] hover:bg-[#c8a544]" : "bg-[#001f3f] text-white hover:bg-[#00356b]"
                  }`}
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                <a
                  href={url ? `https://wa.me/?text=${encodeURIComponent(cfg.share(url))}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!url}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25d366] px-4 py-3 text-sm font-bold transition-colors hover:bg-[#25d366]/10 ${
                    dark ? "text-[#7fe3a5]" : "text-[#128c4b]"
                  } ${url ? "" : "pointer-events-none opacity-40"}`}
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
                        ? dark
                          ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : dark
                          ? "border border-white/25 text-white hover:border-[#d6b357] hover:text-[#d6b357]"
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
                    className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                      dark
                        ? "border-white/25 text-white hover:border-[#d6b357] hover:text-[#d6b357]"
                        : "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f] hover:text-[#001f3f]"
                    } ${url ? "" : "pointer-events-none opacity-40"}`}
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
                {cfg.how.map((t, i) => (
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

        )}

        {/* ── Admin: the numbers behind this view's list ── */}
        {admin && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-[#e8eaed] bg-white px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#b8913f]">{s.label}</p>
                <p className="mt-1 font-['Outfit'] text-2xl font-bold text-[#0d1117]">{leads ? s.value : "—"}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Right: the clients this view's link brought in ── */}
        <div className="@container min-w-0 rounded-2xl border border-[#e8eaed] bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-2.5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6b7280]">
              {view === "sellers" ? <House className="h-4 w-4 text-[#d6b357]" /> : <Users className="h-4 w-4 text-[#d6b357]" />}
              {cfg.list}
              {leads ? ` (${pool.length})` : ""}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing || leads === null}
              title="Refresh"
              aria-label={`Refresh ${cfg.list.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4f6f9] px-2.5 py-1.5 text-xs font-semibold text-[#6b7280] transition-colors hover:bg-[#e8eaed] hover:text-[#001f3f] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* ── Search, filters, exports ── */}
          {leads !== null && !leadsError && pool.length > 0 && (
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
                {activeFilters.map((f, i) => (
                  <select
                    key={f.aria}
                    value={picked[i]}
                    onChange={(e) => setFilter(i, e.target.value)}
                    aria-label={f.aria}
                    className={`${selectCls} min-w-[130px] flex-1 xl:flex-none`}
                  >
                    <option value="">{f.any}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ))}
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
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : leadsError ? (
            <p className="py-4 text-sm text-[#9ca3af]">Couldn&apos;t load this list right now. Refresh to try again.</p>
          ) : pool.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfe3e8] px-5 py-10 text-center">
              <p className="font-['Outfit'] text-base font-bold text-[#0d1117]">{cfg.empty.title}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6b7280]">{cfg.empty.body}</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-4 text-sm text-[#9ca3af]">
              Nobody matches {query.trim() ? <span className="font-semibold text-[#374151]">&ldquo;{query.trim()}&rdquo;</span> : "these filters"}.
              {filtering && (
                <button type="button" onClick={clearFilters} className="ml-2 font-semibold text-[#001f3f] underline">
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
                const isNew = loadedAt - new Date(l.created_at).getTime() < NEW_FOR_MS
                const cols = admin ? [{ label: "Agent", value: ownerName(l), full: ownerName(l), w: "w-[132px]" }, ...cfg.cols(l)] : cfg.cols(l)
                const grade = cfg.grade ? LEAD_GRADES[cfg.grade(l)] : null
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
                          {grade && (
                            <span
                              title={`${grade.label}: ${grade.why}`}
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                              style={{ backgroundColor: grade.bg, color: grade.text }}
                            >
                              {grade.label}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[#6b7280]">{cfg.subline(l)}</p>
                      </button>
                      <div className="hidden shrink-0 gap-4 @3xl:flex">
                        {cols.map((c) => (
                          <div key={c.label} className={c.w}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{c.label}</p>
                            <p className="truncate text-xs font-semibold text-[#374151]" title={c.full || undefined}>{c.value || "—"}</p>
                          </div>
                        ))}
                      </div>
                      {wa && !admin && (
                        <a
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(cfg.hello(first, agentFirst))}`}
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
                          {cfg.sections(l).map((s) => (
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
