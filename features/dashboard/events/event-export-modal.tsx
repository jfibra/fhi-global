"use client"

/**
 * Attendee export — one dialog for both the printable check-in sheet (PDF via
 * the browser's print dialog) and the spreadsheet (CSV). The admin picks the
 * format and which columns to include, and sees a live preview of the first
 * rows before downloading.
 *
 * "Signature" is a blank ruled cell for the venue check-in desk. When it is
 * included it is always the last column, whatever else is chosen — the
 * column list below is in output order and Signature is defined last.
 */

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, X } from "lucide-react"
import { formatAnswer, type AnswerValue, type RegistrationField } from "@/lib/events/fields"

export type ExportRegistration = {
  fullName: string
  email: string
  whatsapp: string | null
  invitedBy: string | null
  answers: Record<string, AnswerValue>
  createdAt: string
}

type Format = "pdf" | "csv"

type Column = {
  id: string
  label: string
  /** Cell text for one row; the sheet and the spreadsheet want different date stamps. */
  cell: (r: ExportRegistration, index: number, format: Format) => string
  /** Included until the admin changes the selection. */
  defaultOn: Record<Format, boolean>
  /** Print-sheet cell class (width / colour hints). */
  cls?: string
}

const PREVIEW_PAGE = 10
/** Beyond this many columns a portrait A4 check-in sheet gets cramped. */
const LANDSCAPE_FROM = 8

/** Day + time only for the sheet (keeps room for the signature line); full stamp for the spreadsheet. */
function registeredStamp(iso: string, format: Format): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  if (format === "csv") return d.toLocaleString("en-AE", { timeZone: "Asia/Dubai" })
  return (
    d.toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "Asia/Dubai" }) +
    " · " +
    d.toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" })
  )
}

function buildColumns(fields: RegistrationField[]): Column[] {
  return [
    { id: "index", label: "#", cell: (_r, i) => String(i + 1), defaultOn: { pdf: true, csv: false }, cls: "n" },
    { id: "name", label: "Name", cell: (r) => r.fullName, defaultOn: { pdf: true, csv: true }, cls: "name" },
    { id: "email", label: "Email", cell: (r) => r.email, defaultOn: { pdf: true, csv: true } },
    { id: "whatsapp", label: "WhatsApp", cell: (r) => r.whatsapp ?? "", defaultOn: { pdf: true, csv: true } },
    { id: "invited_by", label: "Invited by", cell: (r) => r.invitedBy ?? "", defaultOn: { pdf: true, csv: true } },
    ...fields.map<Column>((f) => ({
      id: `field:${f.key}`,
      label: f.label,
      cell: (r) => formatAnswer(r.answers?.[f.key]),
      defaultOn: { pdf: true, csv: true },
    })),
    { id: "registered", label: "Registered", cell: (r, _i, fmt) => registeredStamp(r.createdAt, fmt), defaultOn: { pdf: true, csv: true }, cls: "reg" },
    // Always last: a blank line to sign on at the door.
    { id: "signature", label: "Signature", cell: () => "", defaultOn: { pdf: true, csv: false }, cls: "sig" },
  ]
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function EventExportModal({
  event,
  registrations,
  fields,
  filterLabel,
  onClose,
}: {
  event: { title: string; slug: string | null; venue: string | null; eventDateText: string }
  /** Already filtered by the attendee-list search, so the export matches what is on screen. */
  registrations: ExportRegistration[]
  fields: RegistrationField[]
  /** The active search text, echoed onto the sheet so a partial list is labelled as such. */
  filterLabel?: string
  onClose: () => void
}) {
  const columns = useMemo(() => buildColumns(fields), [fields])
  const [format, setFormat] = useState<Format>("pdf")
  const [page, setPage] = useState(1)
  // One selection per format, so switching PDF ↔ CSV never discards choices.
  const [selected, setSelected] = useState<Record<Format, Set<string>>>(() => ({
    pdf: new Set(columns.filter((c) => c.defaultOn.pdf).map((c) => c.id)),
    csv: new Set(columns.filter((c) => c.defaultOn.csv).map((c) => c.id)),
  }))

  const active = selected[format]
  const chosen = columns.filter((c) => active.has(c.id))

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s[format])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...s, [format]: next }
    })
  const setAll = (on: boolean) =>
    setSelected((s) => ({ ...s, [format]: new Set(on ? columns.map((c) => c.id) : []) }))
  const reset = () =>
    setSelected((s) => ({ ...s, [format]: new Set(columns.filter((c) => c.defaultOn[format]).map((c) => c.id)) }))

  const downloadCsv = () => {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = chosen.map((c) => c.label)
    const rows = registrations.map((r, i) => chosen.map((c) => c.cell(r, i, "csv")))
    // BOM so Excel reads Arabic and accented names correctly.
    const csv = "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${(event.slug ?? "event").slice(0, 60)}-attendees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Branded print view — the browser's print dialog offers "Save as PDF" and
  // direct printing for the check-in desk.
  const printPdf = () => {
    const w = window.open("", "_blank", "width=900,height=700")
    if (!w) return
    const generated = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" })
    const head = chosen.map((c) => `<th>${esc(c.label)}</th>`).join("")
    const body = registrations
      .map(
        (r, i) =>
          `<tr>${chosen
            .map((c) => {
              if (c.id === "signature") return `<td class="sig"><span class="line"></span></td>`
              const text = esc(c.cell(r, i, "pdf") || "—")
              return `<td${c.cls ? ` class="${c.cls}"` : ""}>${c.id === "name" ? `<strong>${text}</strong>` : text}</td>`
            })
            .join("")}</tr>`,
      )
      .join("")
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendees — ${esc(event.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 32px; }
  .band { background: #001f3f; border-bottom: 4px solid #d6b357; border-radius: 12px 12px 0 0; padding: 22px 28px; }
  .band h1 { color: #ffffff; font-size: 22px; }
  .band .gold { color: #d6b357; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .meta { display: flex; flex-wrap: wrap; gap: 20px; padding: 14px 28px; background: #f6f8fb; border: 1px solid #e8eaed; border-top: 0; font-size: 12px; color: #4b5563; }
  .meta strong { color: #001f3f; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12.5px; }
  th { background: #001f3f; color: #ffffff; text-align: left; padding: 9px 12px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 9px 12px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbfc; }
  .n { color: #9ca3af; width: 34px; }
  .reg { white-space: nowrap; color: #4b5563; }
  .sig { width: 150px; }
  .sig .line { display: block; height: 22px; border-bottom: 1.5px solid #9aa3ae; }
  .foot { margin-top: 22px; text-align: center; font-size: 11px; color: #9ca3af; }
  .foot b { color: #b8913f; }
  @page { margin: 14mm; ${chosen.length >= LANDSCAPE_FROM ? "size: landscape;" : ""} }
</style></head><body>
  <div class="band"><p class="gold">FHI Global · Event Attendees</p><h1>${esc(event.title)}</h1></div>
  <div class="meta">
    <span>Event date: <strong>${esc(event.eventDateText)}</strong></span>
    ${event.venue ? `<span>Venue: <strong>${esc(event.venue)}</strong></span>` : ""}
    <span>Total registered: <strong>${registrations.length}</strong></span>
    <span>Generated: <strong>${esc(generated)}</strong></span>
    ${filterLabel ? `<span>Filter: <strong>“${esc(filterLabel)}”</strong></span>` : ""}
  </div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="foot">Generated from the FHI Global dashboard · <b>fhiglobal.ae</b></p>
</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  const download = () => {
    if (chosen.length === 0) return
    if (format === "csv") downloadCsv()
    else printPdf()
  }

  // Paged preview of the whole list, so the admin can check every row before
  // exporting rather than trusting the first few.
  const totalPages = Math.max(1, Math.ceil(registrations.length / PREVIEW_PAGE))
  const safePage = Math.min(page, totalPages)
  const previewStart = (safePage - 1) * PREVIEW_PAGE
  const preview = registrations.slice(previewStart, previewStart + PREVIEW_PAGE)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative bg-white border border-[#e8eaed] shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="Export attendees">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h3 className="font-['Outfit'] font-bold text-[#001f3f]">Export attendees</h3>
            <p className="text-xs text-[#6b7280] mt-0.5 truncate">
              {event.title} · {registrations.length} {registrations.length === 1 ? "person" : "people"}
              {filterLabel ? ` · filtered by “${filterLabel}”` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-2 text-[#6b7280] hover:bg-[#f5f5f5]" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          {/* ── Left: format + columns ── */}
          <div className="space-y-5">
            <div>
              <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280] mb-1.5">Format</p>
              <div className="grid grid-cols-2 border border-[#e5e5e5]">
                {(
                  [
                    ["pdf", "PDF", FileText, "Printable check-in sheet"],
                    ["csv", "CSV", FileSpreadsheet, "Spreadsheet for Excel / Sheets"],
                  ] as const
                ).map(([key, label, Icon, hint]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormat(key)}
                    title={hint}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-bold transition-colors ${
                      format === key ? "bg-[#001f3f] text-white" : "bg-white text-[#374151] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#9ca3af] mt-1.5">
                {format === "pdf"
                  ? "Opens the print dialog — choose “Save as PDF” or print for the door."
                  : "Downloads a .csv that opens in Excel or Google Sheets."}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">Columns</p>
                <div className="flex gap-2 text-[11px] font-semibold">
                  <button type="button" onClick={() => setAll(true)} className="text-[#001f3f] hover:underline">All</button>
                  <button type="button" onClick={() => setAll(false)} className="text-[#001f3f] hover:underline">None</button>
                  <button type="button" onClick={reset} className="text-[#6b7280] hover:underline">Reset</button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {columns.map((c) => {
                  const on = active.has(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2.5 px-3 py-2 border text-sm cursor-pointer select-none transition-colors ${
                        on ? "border-[#001f3f]/40 bg-[#001f3f]/5 text-[#001f3f] font-semibold" : "border-[#e5e5e5] text-[#6b7280] hover:bg-[#fafafa]"
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="h-3.5 w-3.5" />
                      <span className="truncate">{c.label}</span>
                      {c.id === "signature" && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">blank · last</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Right: live preview ── */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <p className="block text-xs font-bold uppercase tracking-wide text-[#6b7280]">
                Preview
                {registrations.length > PREVIEW_PAGE && (
                  <span className="normal-case tracking-normal font-semibold text-[#9ca3af]">
                    {" "}· {previewStart + 1}–{Math.min(previewStart + PREVIEW_PAGE, registrations.length)} of {registrations.length}
                  </span>
                )}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 text-xs font-semibold text-[#374151]">
                  <button type="button" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={safePage === 1}
                    className="p-1.5 border border-[#e5e5e5] hover:border-[#001f3f] disabled:opacity-30" aria-label="Previous page">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 tabular-nums">{safePage} / {totalPages}</span>
                  <button type="button" onClick={() => setPage((n) => Math.min(totalPages, n + 1))} disabled={safePage === totalPages}
                    className="p-1.5 border border-[#e5e5e5] hover:border-[#001f3f] disabled:opacity-30" aria-label="Next page">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {chosen.length === 0 ? (
              <p className="text-[12px] text-[#9ca3af] border border-dashed border-[#e5e5e5] px-4 py-10 text-center">
                Pick at least one column.
              </p>
            ) : (
              <div className="border border-[#e8eaed] overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#001f3f] text-white text-left text-[10.5px] font-bold uppercase tracking-wide">
                      {chosen.map((c) => (
                        <th key={c.id} className="px-3 py-2 whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, offset) => {
                      const i = previewStart + offset
                      return (
                      <tr key={`${r.email}-${i}`} className="border-b border-[#f0f0f0] even:bg-[#fafbfc]">
                        {chosen.map((c) => (
                          <td key={c.id} className={`px-3 py-2 align-top ${c.id === "index" ? "text-[#9ca3af]" : "text-[#374151]"} ${c.id === "name" ? "font-semibold text-[#111827]" : ""} ${c.id === "registered" ? "whitespace-nowrap" : ""}`}>
                            {c.id === "signature" ? (
                              <span className="block w-[110px] h-[18px] border-b border-[#9aa3ae]" aria-label="Blank signature line" />
                            ) : (
                              c.cell(r, i, format) || "—"
                            )}
                          </td>
                        ))}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {format === "pdf" && chosen.length >= LANDSCAPE_FROM && (
              <p className="text-[11px] text-[#9ca3af] mt-1.5">
                {chosen.length} columns — the sheet will print in landscape.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-[#f0f0f0]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-[#e5e5e5] text-sm font-semibold text-[#374151]">
            Cancel
          </button>
          <button
            type="button"
            onClick={download}
            disabled={chosen.length === 0 || registrations.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00305f] transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {format === "pdf" ? "Print / save PDF" : "Download CSV"}
          </button>
        </div>
      </div>
    </div>
  )
}
