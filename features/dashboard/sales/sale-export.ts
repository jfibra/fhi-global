// Excel + PDF export for the Sales Reports.
//
// Both formats are produced in the browser with no extra dependency:
//   Excel — CSV with a UTF-8 BOM. Excel opens it natively, Arabic and accented
//           names survive, and numbers stay numbers (no thousands separators,
//           no currency symbol inside the cell) so the boss can total a column.
//   PDF   — a branded, print-stylesheet HTML document rendered into a hidden
//           iframe and sent to print(). Every OS print dialog offers "Save as
//           PDF", and the output paginates properly with a repeating table
//           header, which a canvas screenshot of the page would not.
//
// Both take the rows the caller already fetched with the active filters, and
// both stamp the filters and totals onto the document — an exported report that
// doesn't say what it was filtered by is worse than no export.

import type { SaleRecord, SaleType } from "@/lib/sales-service"

export type ExportColumn = {
  header: string
  /** Cell value. Return a number to keep it numeric in Excel. */
  value: (s: SaleRecord) => string | number | null
  /** Right-align in the PDF and skip quoting in the CSV. */
  numeric?: boolean
}

export type ExportTotals = {
  dealCount: number
  totalValue: number
  pendingCount: number
  /** False when the numbers are the unfiltered fallback — the document must say so. */
  filtered: boolean
}

export type ExportPayload = {
  /** e.g. "Brokerage / Ready Unit Report" */
  title: string
  /** e.g. "Resale / private-owner sales — no developer." */
  subtitle?: string
  /** Human-readable "Property Type: Villa", "Period: March 2026", … */
  filterLines: string[]
  columns: ExportColumn[]
  rows: SaleRecord[]
  totals: ExportTotals | null
  /** True when the row cap was hit and the export is not the whole set. */
  truncated: boolean
  /** Who generated it, for the PDF footer. */
  generatedBy?: string | null
}

const clientName = (s: SaleRecord) => {
  const c = s.clients
  if (!c) return ""
  return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ")
}

const STATUS_WORDS = (v: string | null) =>
  (v ?? "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())

// Columns mirror the on-screen table but carry the extra detail a spreadsheet
// is actually for — client contact, both dates, remarks. Project sales key off
// developer/project/unit; brokerage and rental off property type/address.
export function exportColumnsFor(saleType: SaleType | null): ExportColumn[] {
  const lead: ExportColumn[] = [
    { header: "Reservation Date", value: (s) => s.reservation_date ?? "" },
    { header: "Agent", value: (s) => s.profiles?.fullname ?? "" },
  ]

  const middle: ExportColumn[] =
    saleType === "project"
      ? [
          { header: "Developer", value: (s) => s.developers?.name ?? "" },
          { header: "Project", value: (s) => s.projects?.name ?? "" },
          { header: "Unit Type", value: (s) => s.project_units?.unit_type ?? "" },
          { header: "Unit No.", value: (s) => s.unit_number ?? "" },
          { header: "Block", value: (s) => s.block_number ?? "" },
          { header: "Lot", value: (s) => s.lot_number ?? "" },
        ]
      : saleType === null
        ? [
            // The per-agent drill-in lists all three types at once, so it needs
            // both sets of columns plus the type itself to tell them apart.
            { header: "Sale Type", value: (s) => STATUS_WORDS(s.sale_type) },
            { header: "Developer", value: (s) => s.developers?.name ?? "" },
            { header: "Project", value: (s) => s.projects?.name ?? "" },
            { header: "Unit No.", value: (s) => s.unit_number ?? "" },
            { header: "Property Type", value: (s) => s.property_type ?? "" },
            { header: "Property Address", value: (s) => s.property_address ?? "" },
          ]
        : [
            { header: "Property Type", value: (s) => s.property_type ?? "" },
            { header: "Property Address", value: (s) => s.property_address ?? "" },
          ]

  const tail: ExportColumn[] = [
    { header: "Client", value: clientName },
    { header: "Client Email", value: (s) => s.clients?.email ?? "" },
    { header: "Client Phone", value: (s) => s.clients?.phone ?? "" },
    { header: "Contract Price (AED)", value: (s) => s.contract_price ?? 0, numeric: true },
    { header: "Commission", value: (s) => STATUS_WORDS(s.commission_status) },
    { header: "Validation", value: (s) => STATUS_WORDS(s.validation_status) },
    // Audit stamp (migration 024) — who last set the validation status, and
    // when, so the exported report answers it without the dashboard.
    { header: "Validation By", value: (s) => s.validation_changed_by_name ?? "" },
    { header: "Validation Date", value: (s) => (s.validation_changed_at ? s.validation_changed_at.slice(0, 10) : "") },
    { header: "Remarks", value: (s) => s.remarks ?? "" },
    { header: "Recorded On", value: (s) => (s.created_at ? s.created_at.slice(0, 10) : "") },
  ]

  return [...lead, ...middle, ...tail]
}

// ─── Excel (CSV) ──────────────────────────────────────────────────────────────

// A leading =, +, -, @ (or tab/CR) makes Excel treat the cell as a formula, so a
// remark like "=cmd|..." becomes a live command on open. Prefix a single quote
// to force it back to text. Standard CSV-injection defence — worth doing on a
// file a whole office will open.
const deFormula = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)

const csvCell = (v: string | number | null, numeric?: boolean) => {
  if (v === null || v === undefined) return ""
  if (numeric && typeof v === "number") return String(v)
  const s = deFormula(String(v))
  return `"${s.replace(/"/g, '""')}"`
}

export function buildCsv(p: ExportPayload): string {
  const lines: string[] = []

  lines.push(csvCell(p.title))
  if (p.subtitle) lines.push(csvCell(p.subtitle))
  lines.push(csvCell(`Generated ${new Date().toLocaleString()}`))
  for (const f of p.filterLines) lines.push(csvCell(f))

  if (p.totals) {
    lines.push("")
    lines.push([csvCell("Sales"), csvCell(p.totals.dealCount, true)].join(","))
    lines.push([csvCell("Total Contract Value (AED)"), csvCell(p.totals.totalValue, true)].join(","))
    lines.push([csvCell("Pending Validation"), csvCell(p.totals.pendingCount, true)].join(","))
    if (!p.totals.filtered) lines.push(csvCell("NOTE: totals above cover all records, not the filtered set."))
  }
  if (p.truncated) {
    lines.push(csvCell(`NOTE: this export was capped at ${p.rows.length} rows — narrow the filters for the complete set.`))
  }

  lines.push("")
  lines.push(p.columns.map((c) => csvCell(c.header)).join(","))
  for (const row of p.rows) {
    lines.push(p.columns.map((c) => csvCell(c.value(row), c.numeric)).join(","))
  }

  // CRLF is what Excel expects; the BOM makes it read the file as UTF-8 so
  // Arabic and accented names don't arrive as mojibake.
  return "﻿" + lines.join("\r\n")
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ─── PDF (print) ──────────────────────────────────────────────────────────────

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string))

const money = (n: number) =>
  new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export function buildPrintableHtml(p: ExportPayload): string {
  const head = p.columns
    .map((c) => `<th class="${c.numeric ? "num" : ""}">${esc(c.header)}</th>`)
    .join("")

  const body = p.rows
    .map((row) => {
      const tds = p.columns
        .map((c) => {
          const raw = c.value(row)
          const text = c.numeric && typeof raw === "number" ? money(raw) : String(raw ?? "")
          return `<td class="${c.numeric ? "num" : ""}">${esc(text)}</td>`
        })
        .join("")
      return `<tr>${tds}</tr>`
    })
    .join("")

  const totals = p.totals
    ? `<div class="totals">
         <div class="t"><span>Sales</span><strong>${p.totals.dealCount}</strong></div>
         <div class="t"><span>Total Contract Value</span><strong>AED ${money(p.totals.totalValue)}</strong></div>
         <div class="t"><span>Pending Validation</span><strong>${p.totals.pendingCount}</strong></div>
       </div>
       ${p.totals.filtered ? "" : `<p class="warn">Totals cover all records — filtered totals were unavailable.</p>`}`
    : ""

  const filters = p.filterLines.length
    ? `<ul class="filters">${p.filterLines.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`
    : `<p class="filters-none">No filters applied — all records.</p>`

  // Solid navy / gold only; the house style has no decorative gradients, and
  // most printers would render one as muddy banding anyway.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(p.title)}</title>
<style>
  @page { size: A4 landscape; margin: 11mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color:#0d1117; font-size:9.5pt; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  header { background:#001f3f; color:#fff; padding:14px 16px; border-radius:8px; }
  header h1 { margin:0; font-size:15pt; letter-spacing:-0.01em; }
  header p  { margin:3px 0 0; font-size:9pt; color:#c9d3e0; }
  .rule { height:3px; background:#d6b357; border-radius:2px; margin:0 0 12px; }
  .meta { display:flex; flex-wrap:wrap; gap:6px 26px; margin:10px 0 12px; font-size:8.5pt; color:#4b5563; }
  .filters { margin:0; padding:0; list-style:none; display:flex; flex-wrap:wrap; gap:5px; }
  .filters li { border:1px solid #d9dee5; border-radius:999px; padding:2px 9px; font-size:8pt; color:#374151; }
  .filters-none { margin:0; font-size:8.5pt; color:#6b7280; font-style:italic; }
  .totals { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0; }
  .totals .t { flex:1 1 170px; border:1px solid #e3e7ec; border-left:3px solid #001f3f;
               border-radius:6px; padding:8px 11px; }
  .totals span  { display:block; font-size:7.5pt; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; }
  .totals strong{ display:block; font-size:12pt; margin-top:2px; }
  .warn { margin:0 0 10px; font-size:8pt; color:#9a3412; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }          /* repeat the header on every page */
  tr { page-break-inside:avoid; }
  th { background:#001f3f; color:#fff; text-align:left; font-size:8pt; font-weight:700;
       text-transform:uppercase; letter-spacing:.04em; padding:6px 7px; }
  td { padding:5px 7px; border-bottom:1px solid #edf0f3; vertical-align:top; word-break:break-word; }
  tbody tr:nth-child(even) td { background:#f7f8fa; }
  .num { text-align:right; white-space:nowrap; }
  tfoot td { border-top:2px solid #001f3f; font-weight:700; padding-top:7px; }
  footer { margin-top:12px; font-size:7.5pt; color:#9ca3af; }
  .empty { padding:22px; text-align:center; color:#6b7280; font-style:italic; }
</style></head>
<body>
  <header>
    <h1>${esc(p.title)}</h1>
    ${p.subtitle ? `<p>${esc(p.subtitle)}</p>` : ""}
  </header>
  <div class="meta">
    <span>Generated ${esc(new Date().toLocaleString())}</span>
    ${p.generatedBy ? `<span>By ${esc(p.generatedBy)}</span>` : ""}
    <span>${p.rows.length} row${p.rows.length === 1 ? "" : "s"}${p.truncated ? " (capped)" : ""}</span>
  </div>
  ${filters}
  ${totals}
  ${p.truncated ? `<p class="warn">Capped at ${p.rows.length} rows — narrow the filters for the complete set.</p>` : ""}
  <div class="rule"></div>
  ${p.rows.length === 0
    ? `<p class="empty">No sales match these filters.</p>`
    : `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`}
  <footer>FHI Global — internal sales report. Figures are as recorded at the time of export.</footer>
</body></html>`
}

// Renders into a hidden same-origin iframe rather than window.open(), which
// popup blockers routinely eat. The iframe is torn down on afterprint, with a
// timeout fallback for browsers that don't fire it — removing it while the
// dialog is still open would cancel the print job.
export function printHtml(html: string) {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.setAttribute("tabindex", "-1")
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;"
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = win?.document
  if (!win || !doc) { iframe.remove(); return }

  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    iframe.remove()
  }

  doc.open()
  doc.write(html)
  doc.close()

  const run = () => {
    win.addEventListener("afterprint", () => setTimeout(cleanup, 300))
    setTimeout(cleanup, 60_000) // fallback: never leak the node
    win.focus()
    win.print()
  }

  if (doc.readyState === "complete") setTimeout(run, 60)
  else iframe.addEventListener("load", () => setTimeout(run, 60), { once: true })
}

/** `Brokerage-Report_2026-08-01.csv` — safe on every filesystem. */
export function exportFilename(title: string, ext: "csv"): string {
  const slug = title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60)
  const stamp = new Date().toISOString().slice(0, 10)
  return `${slug || "Sales-Report"}_${stamp}.${ext}`
}
