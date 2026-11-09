"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  X, Loader2, RefreshCw, AlertTriangle, CircleCheck, Info, UserRound, Venus, Mars, IdCard, Phone, CalendarDays,
  Building2, Layers, Printer, Link2,
} from "lucide-react"
import type { Broker, BrokerLookupResponse } from "@/lib/brokers"

export type BrokerFetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string; notFound?: boolean }
  | { kind: "ok"; broker: Broker; source: BrokerLookupResponse["source"] }

const DAY_MS = 24 * 60 * 60 * 1000

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  // "Oct 5, 2026"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Licence status from the end date — expired, ending within 30 days, or active. */
export function licenceStatus(end: string | null): { label: string; cls: string } {
  if (!end) return { label: "No end date", cls: "bg-[#f3f4f6] text-[#374151]" }
  const left = new Date(`${end}T23:59:59`).getTime() - Date.now()
  if (left < 0) return { label: "Licence expired", cls: "bg-[#fee2e2] text-[#991b1b]" }
  if (left < 30 * DAY_MS) return { label: `Expires in ${Math.ceil(left / DAY_MS)} days`, cls: "bg-[#fef3c7] text-[#92400e]" }
  return { label: "Licence active", cls: "bg-[#dcfce7] text-[#166534]" }
}

/**
 * GET /api/brokers/<brn>. `refresh` re-pulls from DLD; `cachedOnly` reads the
 * saved `brokers` row and never calls DLD (answers "error" with notSaved).
 */
export async function fetchBroker(brn: string, refresh: boolean, cachedOnly = false): Promise<BrokerFetchState> {
  try {
    const qs = refresh ? "?refresh=1" : cachedOnly ? "?cached=1" : ""
    const res = await fetch(`/api/brokers/${encodeURIComponent(brn)}${qs}`)
    const json = (await res.json().catch(() => ({}))) as Partial<BrokerLookupResponse> & { error?: string }
    if (res.status === 404) return { kind: "error", message: json.error || "Not found.", notFound: true }
    if (!res.ok || !json.broker) return { kind: "error", message: json.error || "Could not load the broker details." }
    return { kind: "ok", broker: json.broker, source: json.source ?? "dld" }
  } catch {
    return { kind: "error", message: "Could not reach the server. Please try again." }
  }
}

/**
 * The RERA broker behind a BRN, from the Dubai Land Department register via
 * GET /api/brokers/<brn> (saved in the `brokers` table). Mounted only while
 * open, so each open starts fresh.
 */
export function BrokerDetailsModal({
  brn,
  initial,
  onClose,
}: {
  brn: string
  /** A result the page already has (the BRN field's search) — shown as-is, no second lookup. */
  initial?: Extract<BrokerFetchState, { kind: "ok" }>
  onClose: () => void
}) {
  const [state, setState] = useState<BrokerFetchState>(initial ?? { kind: "loading" })
  const [hasInitial] = useState(Boolean(initial))

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  // Only look the BRN up when the page didn't hand over a result.
  useEffect(() => {
    if (hasInitial) return
    let cancelled = false
    void fetchBroker(brn, false).then((next) => { if (!cancelled) setState(next) })
    return () => { cancelled = true }
  }, [brn, hasInitial])

  const reload = () => {
    setState({ kind: "loading" })
    void fetchBroker(brn, true).then(setState)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broker-details-title"
        className="relative w-full max-w-[1180px] my-8 overflow-hidden rounded-2xl bg-white shadow-[0_30px_90px_-20px_rgba(0,10,30,0.6)]"
      >
        {/* Header: DLD logo | title | licence status | close */}
        <div className="flex items-center gap-4 border-b border-[#eef0f3] px-6 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/dubai-land-department.svg" alt="Dubai Land Department" className="hidden h-11 w-auto shrink-0 sm:block" />
          <span className="hidden h-10 w-px shrink-0 bg-[#e5e7eb] sm:block" aria-hidden />
          <h3 id="broker-details-title" className="min-w-0 flex-1 font-['Outfit'] text-base font-bold text-[#0d1117] sm:text-lg">
            RERA broker register · Dubai Land Department
          </h3>
          {state.kind === "ok" && <StatusPill end={state.broker.license_end_date} />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f6f9] text-[#374151] transition-colors hover:bg-[#e8eaed]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[#f6f8fb]">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#001f3f]" />
              <p className="text-sm font-semibold text-[#374151]">Looking up the broker register…</p>
              <p className="max-w-[340px] text-xs text-[#6b7280]">
                The first lookup of a BRN asks the Dubai Land Department directly and can take up to 30 seconds. After that it opens instantly.
              </p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <AlertTriangle className="h-7 w-7 text-[#b45309]" />
              <p className="max-w-[380px] text-sm text-[#374151]">{state.message}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[#001f3f] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          )}

          {state.kind === "ok" && <BrokerBody broker={state.broker} source={state.source} onRefresh={reload} />}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ end }: { end: string | null }) {
  const status = licenceStatus(end)
  const Icon = status.label === "Licence active" ? CircleCheck : AlertTriangle
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold sm:text-sm ${status.cls}`}>
      <Icon className="h-4 w-4" aria-hidden /> {status.label}
    </span>
  )
}

/**
 * English gender for display only — the saved row is left as DLD sent it.
 * DLD's register puts Arabic in GENDER_EN for female brokers ("أنثى"), so an
 * Arabic value is read as Male/Female from the word (either field).
 */
function genderEnglish(en: string | null, ar: string | null): string | null {
  const v = (en ?? "").trim()
  if (v && !/[؀-ۿ]/.test(v)) return v.charAt(0).toUpperCase() + v.slice(1)
  const word = (/[؀-ۿ]/.test(v) ? v : (ar ?? "")).trim()
  if (/^أنث[ىي]$/.test(word)) return "Female"
  if (word === "ذكر") return "Male"
  return v || null
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v))

type IconType = typeof UserRound

const LABEL = "shrink-0 whitespace-nowrap text-[13px] text-[#4b5563] sm:text-sm"
// One line always: a value too long for its cell is cut with "…" and shows in full on hover.
const VALUE = "min-w-0 flex-1 truncate whitespace-nowrap text-sm font-bold text-[#0d1117] sm:text-[15px]"
const AR_LABEL = "shrink-0 whitespace-nowrap text-[13px] text-[#4b5563] sm:text-sm"

function IconTile({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f4f8] text-[#334155]" aria-hidden>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  )
}

/** A section: navy band (icon + English title, Arabic title right) over a white card of rows. */
function Section({ icon: Icon, en, ar, children }: { icon: IconType; en: string; ar: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 rounded-t-xl bg-gradient-to-r from-[#0a2342] to-[#16365c] px-6 py-3.5 text-white">
        <span className="flex items-center gap-3 text-sm font-bold uppercase tracking-wider">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /> {en}
        </span>
        <span dir="rtl" lang="ar" className="text-[15px] font-bold">{ar}</span>
      </div>
      <div className="rounded-b-xl border border-t-0 border-[#e8ebf0] bg-white px-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:px-6">
        {children}
      </div>
    </section>
  )
}

const ROW = "border-b border-[#eef0f3] last:border-b-0"

/** One fact in both languages: icon + English label + value | Arabic value + label. */
function BilingualRow({ icon, en, ar, valueEn, valueAr }: { icon: IconType; en: string; ar: string; valueEn: string; valueAr: string }) {
  return (
    <div className={`grid grid-cols-1 gap-y-2 py-3 md:grid-cols-2 ${ROW}`}>
      <div className="flex items-center gap-3 md:border-r md:border-[#eef0f3] md:pr-6">
        <IconTile icon={icon} />
        <span className={`${LABEL} w-[118px]`}>{en}:</span>
        <span className={VALUE} title={valueEn}>{valueEn}</span>
      </div>
      <div dir="rtl" lang="ar" className="flex items-center gap-3 md:pl-6">
        <span className={`${AR_LABEL} w-[118px]`}>{ar}:</span>
        <span className={VALUE} title={valueAr}>{valueAr}</span>
      </div>
    </div>
  )
}

/** One fact with a single value: icon + English label + value + Arabic label. */
function Cell({ icon, en, ar, value }: { icon: IconType; en: string; ar: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconTile icon={icon} />
      <span className={`${LABEL} w-[118px]`}>{en}:</span>
      <span className={VALUE} title={value}>{value}</span>
      <span dir="rtl" lang="ar" className={AR_LABEL}>{ar}:</span>
    </div>
  )
}

/** Two single-value facts side by side (stacked on small screens). */
function PairRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className={`grid grid-cols-1 gap-y-3 py-3 md:grid-cols-2 ${ROW}`}>
      <div className="md:border-r md:border-[#eef0f3] md:pr-6">{left}</div>
      <div className="md:pl-6">{right}</div>
    </div>
  )
}

function BrokerBody({ broker, source, onRefresh }: { broker: Broker; source: BrokerLookupResponse["source"]; onRefresh: () => void }) {
  const fetched = new Date(broker.fetched_at)
  const genderAr = typeof broker.data?.GENDER_AR === "string" ? broker.data.GENDER_AR : null
  const genderEn = genderEnglish(broker.gender_en, genderAr)

  return (
    <>
      <div className="max-h-[68vh] space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        <Section icon={UserRound} en="Broker Details" ar="بيانات الوسيط">
          <BilingualRow icon={UserRound} en="Agent Name" ar="اسم الوسيط" valueEn={dash(broker.broker_en)} valueAr={dash(broker.broker_ar)} />
          <BilingualRow icon={genderEn === "Male" ? Mars : Venus} en="Gender" ar="الجنس" valueEn={dash(genderEn)} valueAr={dash(genderAr)} />
          <PairRow
            left={<Cell icon={IdCard} en="BRN" ar="رقم تسجيل الوسيط" value={dash(broker.broker_number)} />}
            right={<Cell icon={Phone} en="Phone" ar="رقم الهاتف" value={dash(broker.phone)} />}
          />
          <PairRow
            left={<Cell icon={CalendarDays} en="Licence Start" ar="تاريخ بدء الترخيص" value={broker.license_start_date ? formatDate(broker.license_start_date) : "—"} />}
            right={<Cell icon={CalendarDays} en="Licence End" ar="تاريخ انتهاء الترخيص" value={broker.license_end_date ? formatDate(broker.license_end_date) : "—"} />}
          />
        </Section>

        <Section icon={Building2} en="Brokerage Details" ar="بيانات مكتب الوساطة">
          <BilingualRow icon={Building2} en="Office Name" ar="اسم المؤسسة" valueEn={dash(broker.real_estate_en)} valueAr={dash(broker.real_estate_ar)} />
          <PairRow
            left={<Cell icon={Layers} en="ORN" ar="رقم التسجيل" value={dash(broker.real_estate_number)} />}
            right={<Cell icon={Printer} en="Fax" ar="رقم الفاكس" value={dash(broker.fax)} />}
          />
          <div className={`py-3 ${ROW}`}>
            <Cell icon={Link2} en="Website" ar="الموقع الإلكتروني" value={dash(broker.webpage)} />
          </div>
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f3] bg-white px-6 py-4">
        <span className="flex items-center gap-2 text-sm text-[#6b7280]">
          <Info className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          {source === "stale" ? "Dubai Land Department didn't answer — showing the copy saved " : "Updated "}
          {Number.isNaN(fetched.getTime()) ? "" : fetched.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
        >
          <RefreshCw className="h-4 w-4" /> Refresh from DLD
        </button>
      </div>
    </>
  )
}
