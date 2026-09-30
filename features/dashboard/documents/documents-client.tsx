"use client"

// Documents shelf — cover-style tile grid + category pills, same look as the
// Ebooks shelf, but for admin-uploaded document templates (DLD contract
// forms, agency agreements, company templates) rather than a fixed set of
// training PDFs. Unlike Materials/Ebooks (a developer drops a file into a
// repo folder and redeploys), uploading here is a real in-app flow: files go
// to S3 (app/api/upload/document) and the catalog row to Postgres
// (lib/document-service.ts), admin-staff only both ways.
//
// A PDF's tile shows its actual page 1, rendered client-side by
// PdfThumbnail (pdf-thumbnail.tsx) — there's no authored cover art the way
// Ebooks has. A non-PDF file (Word, Excel, PowerPoint, …) falls back to
// FileTile's generic file-type icon, same as before.
//
// Clicking a tile opens a full page (DocumentPage below), replacing the
// shelf entirely — same convention as the Ebooks reader: a back arrow, a
// gold category eyebrow, the title in bold, actions on the right. ←/→ step
// through whichever documents the current category tab shows. PDFs render
// inline with Chrome's own toolbar hidden (PDF Open Parameters — just the
// page, nothing else); every other file type (Word, Excel, PowerPoint, …)
// shows a "can't preview" fallback with Download and New tab, since no
// browser can render those inline no matter how they're embedded.

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react"
import { formatBytes } from "@/lib/materials-shared"
import { createDocument, deleteDocument, listDocuments, type DocumentRow } from "@/lib/document-service"
import PdfThumbnail from "./pdf-thumbnail"

const ALL = "All"
const UNCATEGORIZED = "Uncategorized"

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}
function isPdf(fileName: string): boolean {
  return extensionOf(fileName) === "pdf"
}
function categoryOf(doc: DocumentRow): string {
  return doc.category?.trim() || UNCATEGORIZED
}

/** Same-origin passthrough (see app/api/document-proxy) — required for both
 *  the in-page preview and a real (not ignored) browser download. */
function proxyUrl(fileUrl: string, download: boolean): string {
  const qs = new URLSearchParams({ url: fileUrl })
  if (download) qs.set("download", "1")
  return `/api/document-proxy?${qs.toString()}`
}

export function DocumentsClient() {
  // `null` = not fetched yet, derives the loading state — never set from
  // inside the effect below (only its async callback, after the await, sets
  // it), so there is nothing for the set-state-in-effect check to flag.
  // `load()` is reused directly (a plain event-handler call, not an effect)
  // to refresh the list after an upload or a delete.
  const [result, setResult] = useState<{ data: DocumentRow[]; error: string | null } | null>(null)
  const loading = result === null
  const docs = useMemo(() => result?.data ?? [], [result])
  const error = result?.error ?? null

  const [tab, setTab] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const load = async () => {
    const res = await listDocuments()
    setResult(res)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await listDocuments()
      if (!cancelled) setResult(res)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Upload form
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [uploadCategory, setUploadCategory] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const named = [...new Set(docs.map(categoryOf))].sort((a, b) => a.localeCompare(b))
    // Uncategorized reads like a real bucket, not a category — sort it last, same as Materials' General.
    named.sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : 0))
    return [ALL, ...named]
  }, [docs])
  const existingCategories = useMemo(
    () => [...new Set(docs.map((d) => d.category?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [docs],
  )
  const shown = tab === ALL ? docs : docs.filter((d) => categoryOf(d) === tab)
  const open = docs.find((d) => d.id === openId) ?? null

  const onPickFile = (f: File | null) => {
    setFile(f)
    setUploadError(null)
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""))
  }

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload/document", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed.")

      const created = await createDocument({
        title: title.trim(),
        category: uploadCategory.trim() || null,
        file_url: json.url,
        file_name: json.file_name,
        file_size: json.file_size,
        mime_type: json.mime_type,
      })
      if (created.error) throw new Error(created.error)

      setFile(null)
      setTitle("")
      setUploadCategory("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      setShowUpload(false)
      await load()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const onDelete = async (doc: DocumentRow) => {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return
    setDeletingId(doc.id)
    const res = await deleteDocument(doc.id)
    if (res.error) {
      window.alert(res.error)
    } else {
      setResult((prev) => (prev ? { ...prev, data: prev.data.filter((d) => d.id !== doc.id) } : prev))
      if (openId === doc.id) setOpenId(null)
    }
    setDeletingId(null)
  }

  // Prev/Next step through the currently shown (category-filtered) list, so
  // the arrows move through the same set of tiles the grid had on screen —
  // not the full unfiltered catalogue.
  const openIndex = open ? shown.findIndex((d) => d.id === open.id) : -1
  const goTo = (i: number) => {
    if (shown.length === 0) return
    setOpenId(shown[(i + shown.length) % shown.length].id)
  }

  if (open) {
    return (
      <DocumentPage
        doc={open}
        onBack={() => setOpenId(null)}
        onPrev={shown.length > 1 ? () => goTo(openIndex - 1) : undefined}
        onNext={shown.length > 1 ? () => goTo(openIndex + 1) : undefined}
        position={shown.length > 1 ? { index: openIndex, total: shown.length } : undefined}
        onDelete={() => onDelete(open)}
        deleting={deletingId === open.id}
      />
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#001f3f] shadow-lg">
          <FileText className="h-6 w-6 text-[#d6b357]" />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Documents</h1>
          <p className="text-sm text-[#6b7280]">DLD contract forms, agency agreements and company templates.</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {docs.length > 0 && (
            <span className="rounded-full bg-[#f3f4f6] px-3 py-1.5 text-xs font-bold text-[#6b7280]">
              {docs.length} {docs.length === 1 ? "document" : "documents"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            aria-pressed={showUpload}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              showUpload ? "bg-[#eef1f5] text-[#001f3f]" : "bg-[#001f3f] text-white hover:bg-[#002b57]"
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {showUpload && (
        <form onSubmit={onUpload} className="rounded-lg border border-[#e5e5e5] bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#0d1117]">File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[#374151] file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-[#eef1f5] file:px-4 file:text-sm file:font-semibold file:text-[#001f3f] hover:file:bg-[#e5e9ee]"
              />
              <p className="mt-1.5 text-xs text-[#9ca3af]">PDF, Word, Excel, PowerPoint, TXT or CSV — up to 25 MB.</p>
            </div>
            <div>
              <label htmlFor="doc-title" className="mb-1.5 block text-sm font-medium text-[#0d1117]">
                Title <span className="text-rose-600">*</span>
              </label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. DLD Form F — Sale Agreement"
                className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
              />
            </div>
            <div>
              <label htmlFor="doc-category" className="mb-1.5 block text-sm font-medium text-[#0d1117]">
                Category
              </label>
              <input
                id="doc-category"
                type="text"
                list="doc-categories"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                placeholder="e.g. DLD Forms"
                className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3.5 text-sm text-[#0f2940] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
              />
              <datalist id="doc-categories">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#f0f2f5] pt-4">
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#001f3f] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2e57] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Upload document
            </button>
            {file && (
              <span className="text-xs text-[#6b7280]">
                {file.name} · {formatBytes(file.size)}
              </span>
            )}
            {uploadError && <span className="text-xs text-rose-600">{uploadError}</span>}
          </div>
        </form>
      )}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {/* Category tabs — driven by the catalogue, so a new category appears
          the moment a document uses it. */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === tab
            const count = c === ALL ? docs.length : docs.filter((d) => categoryOf(d) === c).length
            return (
              <button
                key={c}
                type="button"
                onClick={() => setTab(c)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[#001f3f] text-white" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e8eaee]"
                }`}
              >
                {c}
                <span className={`text-[11px] font-bold ${active ? "text-[#d6b357]" : "text-[#9ca3af]"}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-[#eef1f5]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#9ca3af]">
            {docs.length === 0 ? "No documents yet — click Upload above to add the first one." : "Nothing in this category yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((doc) => (
            <article key={doc.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpenId(doc.id)}
                aria-label={`Open ${doc.title}`}
                className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-black/[0.08] bg-[#eef1f5] shadow-sm transition-shadow hover:shadow-[0_12px_28px_-12px_rgba(0,31,63,0.5)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20"
              >
                {isPdf(doc.file_name) ? (
                  <PdfThumbnail
                    src={proxyUrl(doc.file_url, false)}
                    alt={doc.title}
                    fallback={<FileTile fileName={doc.file_name} />}
                  />
                ) : (
                  <FileTile fileName={doc.file_name} />
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#001f3f]/85 px-2.5 py-2 transition-opacity duration-200 group-hover:opacity-0">
                  <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">{doc.title}</span>
                </span>
                {/* Hover: the full (untruncated) title, centered over a full-card
                    dark overlay — replaces the bottom bar rather than sitting on
                    top of it, so nothing is cut off no matter how long the title is. */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#001f3f]/0 p-4 text-center opacity-0 transition-all duration-200 group-hover:bg-[#001f3f]/90 group-hover:opacity-100">
                  <span className="text-xs font-semibold leading-snug text-white">{doc.title}</span>
                </span>
              </button>

              <a
                href={proxyUrl(doc.file_url, true)}
                download={doc.file_name}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-rose-700"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Cover-style tile for a document — no real thumbnail (an arbitrary uploaded
 * PDF/Word/Excel file has none to generate cheaply), so a large, color-coded
 * file-type icon stands in for the ebook cover art.
 */
function FileTile({ fileName }: { fileName: string }) {
  const ext = extensionOf(fileName)
  const spreadsheet = ["xls", "xlsx", "csv"].includes(ext)
  const slideshow = ["ppt", "pptx"].includes(ext)
  const Icon = spreadsheet ? FileSpreadsheet : slideshow ? FileType2 : FileText
  const color = spreadsheet ? "#0f7a4f" : slideshow ? "#b3541e" : "#b3261e"
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#f3f5f8] p-3">
      <Icon className="h-10 w-10" style={{ color }} strokeWidth={1.5} />
      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6b7280] shadow-sm">
        {ext || "file"}
      </span>
    </span>
  )
}

/**
 * Full-screen lightbox, portalled to <body> so it sits above the dashboard
 * shell's fixed sidebar/topbar regardless of where in the tree it's mounted —
 * same reason FilipinoHomes' MediaLightbox does the same. Backdrop click and
 * Escape both close it; ←/→ step to onPrev/onNext when given.
 */
/**
 * A full page, not an overlay — replaces the shelf entirely while a document
 * is open (same convention as the Ebooks reader: back arrow, a gold category
 * eyebrow, the title in bold, actions on the right). ←/→ still step through
 * whichever documents the current category tab shows.
 */
function DocumentPage({
  doc,
  onBack,
  onPrev,
  onNext,
  position,
  onDelete,
  deleting,
}: {
  doc: DocumentRow
  onBack: () => void
  onPrev?: () => void
  onNext?: () => void
  position?: { index: number; total: number }
  onDelete: () => void
  deleting: boolean
}) {
  const previewable = isPdf(doc.file_name)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault()
        onPrev()
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onPrev, onNext])

  return (
    // Fills the shell's <main> (which already supplies p-6) and adds none of
    // its own, so the document gets the full width — same convention as the
    // Ebooks reader.
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[460px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Documents"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#d6b357]">{categoryOf(doc)}</p>
          <h1 className="truncate font-['Outfit'] text-base font-bold leading-tight text-[#0d1117]" title={doc.title}>
            {doc.title}
          </h1>
        </div>
        {position && (
          <span className="hidden shrink-0 text-xs font-semibold text-[#9ca3af] sm:inline">
            {position.index + 1} / {position.total}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous document"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next document"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 py-2 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New tab</span>
          </a>
          <a
            href={proxyUrl(doc.file_url, true)}
            download={doc.file_name}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002b57]"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${doc.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#9ca3af] transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Transparent, not white — the dashboard shell's own background is a
          light gray-blue (#f4f6f9), and a plain white box here still showed
          up as a visibly different rectangle against it: the "container"
          edge. Letting the shell's own background show through removes it;
          the PDF's actual page (rendered by the iframe) is still white. */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-transparent">
        {previewable ? (
          <>
            {/* Sits behind the iframe — only shows if the viewer fails to paint. */}
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-[#6b7280]">
                Preparing the preview…{" "}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#001f3f] underline">
                  open it in a new tab
                </a>{" "}
                if nothing appears.
              </p>
            </div>
            <iframe
              // Direct to the S3 URL — S3 is already an allowed frame-src
              // host, so no proxy is needed here. The proxy is only used
              // for Download above, where a cross-origin `download`
              // attribute would otherwise be silently ignored.
              //
              // PDF Open Parameters (Chrome/PDFium honours these, same as
              // FilipinoHomes' own MediaLightbox): toolbar=0 hides Chrome's
              // own toolbar, navpanes=0 hides its left thumbnails/outline
              // panel, scrollbar=0 hides the scrollbar chrome — what's left
              // is just the rendered page. view=FitH fits it to the width.
              src={`${doc.file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={doc.title}
              className="absolute inset-0 h-full w-full border-0"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
              <FileTile fileName={doc.file_name} />
            </div>
            <p className="max-w-sm text-sm text-[#6b7280]">
              {extensionOf(doc.file_name).toUpperCase()} files can&rsquo;t be previewed in the browser — use Download or New
              tab above instead.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
