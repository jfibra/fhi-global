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
// gold category eyebrow, the title in bold, actions on the right. (There is
// no prev/next stepping between documents — the shelf is one click back and
// the PDF itself scrolls.) PDFs render
// inline with pdf.js (PdfFormViewer, pdf-form-viewer.tsx) with their form
// fields fillable, and the toolbar offers exactly three actions: Download
// with changes (a copy of the PDF with what was typed written into it),
// Download without changes (the original file) and Delete — the same choice
// Chrome's own viewer gives under its download button, without leaving the
// page or opening a tab. Every other file type (Word, Excel, PowerPoint, …)
// can't be rendered inline by any browser, so it shows a "can't preview"
// fallback with a plain Download instead.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Download,
  FilePenLine,
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
import PdfFormViewer, { type PdfFormViewerHandle } from "./pdf-form-viewer"

// Catalogue cache — stale-while-revalidate. The list is tiny (a few dozen
// rows of metadata) but it used to be fetched from scratch on every mount,
// so a refresh (or a return from another dashboard page) showed the skeleton
// grid and then every tile re-appeared. Now the last good list is kept in
// localStorage: a mount paints it immediately with no loading state, then
// refetches in the background and swaps in the fresh rows only if they
// differ. Writes (upload, delete) update the cache as well as the state, so
// the next mount is already correct. Module cache covers client-side
// navigation inside one tab; localStorage covers reloads and new tabs.
const DOCS_CACHE_KEY = "fhi-library-documents-v1"
let docsMemoryCache: DocumentRow[] | undefined

function readCachedDocs(): DocumentRow[] | undefined {
  if (docsMemoryCache !== undefined) return docsMemoryCache
  try {
    const raw = localStorage.getItem(DOCS_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    docsMemoryCache = parsed as DocumentRow[]
    return docsMemoryCache
  } catch {
    return undefined
  }
}

function writeCachedDocs(rows: DocumentRow[]) {
  docsMemoryCache = rows
  try {
    localStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(rows))
  } catch {
    // storage unavailable or full — the module cache still helps within the tab
  }
}

/** Cheap structural equality so a background refetch that returns the same
 *  rows doesn't replace the array (which would re-key nothing but still
 *  cause a render pass across every tile). */
function sameDocs(a: DocumentRow[], b: DocumentRow[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.id !== y.id ||
      x.title !== y.title ||
      x.category !== y.category ||
      x.file_url !== y.file_url ||
      x.file_name !== y.file_name ||
      x.file_size !== y.file_size
    ) {
      return false
    }
  }
  return true
}

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

/** Save bytes as a file through the browser's normal download path (a blob
 *  URL + `<a download>`) — no navigation, no new tab. */
function saveBlob(bytes: Uint8Array, fileName: string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Deferred: revoking synchronously can abort the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function DocumentsClient() {
  // `null` = nothing to show yet, derives the loading state. The initialiser
  // seeds it from the cache so a mount with a cached list never shows the
  // skeleton at all; the effect below then revalidates in the background.
  // Never set from inside the effect itself (only its async callback, after
  // the await, sets it), so there is nothing for the set-state-in-effect
  // check to flag. `load()` is reused directly (a plain event-handler call,
  // not an effect) to refresh the list after an upload.
  const [result, setResult] = useState<{ data: DocumentRow[]; error: string | null } | null>(() => {
    const cached = readCachedDocs()
    return cached ? { data: cached, error: null } : null
  })
  const loading = result === null
  const docs = useMemo(() => result?.data ?? [], [result])
  const error = result?.error ?? null

  const [tab, setTab] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  /** Applies a fetch result: a success refreshes the cache and only replaces
   *  the rows if they actually changed; a failure keeps whatever is already
   *  on screen (cached rows beat an empty error state) but surfaces the
   *  message. */
  const applyResult = useCallback((res: { data: DocumentRow[]; error: string | null }) => {
    if (res.error) {
      setResult((prev) => ({ data: prev?.data ?? [], error: res.error }))
      return
    }
    writeCachedDocs(res.data)
    setResult((prev) => (prev && !prev.error && sameDocs(prev.data, res.data) ? prev : { data: res.data, error: null }))
  }, [])

  const load = async () => {
    applyResult(await listDocuments())
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await listDocuments()
      if (!cancelled) applyResult(res)
    })()
    return () => {
      cancelled = true
    }
  }, [applyResult])

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
      setResult((prev) => {
        if (!prev) return prev
        const data = prev.data.filter((d) => d.id !== doc.id)
        writeCachedDocs(data)
        return { ...prev, data }
      })
      if (openId === doc.id) setOpenId(null)
    }
    setDeletingId(null)
  }

  if (open) {
    return (
      <DocumentPage
        doc={open}
        onBack={() => setOpenId(null)}
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
        <div className="grid grid-cols-4 gap-4">
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
        <div className="grid grid-cols-4 gap-4">
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
                  <span className="block truncate text-xs font-semibold text-white">{doc.title}</span>
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
 * A full page, not an overlay — replaces the shelf entirely while a document
 * is open (same convention as the Ebooks reader: back arrow, a gold category
 * eyebrow, the title in bold, actions on the right).
 */
function DocumentPage({
  doc,
  onBack,
  onDelete,
  deleting,
}: {
  doc: DocumentRow
  onBack: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const previewable = isPdf(doc.file_name)
  const viewerRef = useRef<PdfFormViewerHandle>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const onViewerStatus = useCallback((status: "loading" | "ready" | "error") => setViewerReady(status === "ready"), [])

  // "With your changes": pdf.js writes what was typed into the fields into a
  // new copy of the PDF, saved straight to the user's downloads. If the viewer
  // isn't up (still loading, or it failed) there is nothing to merge, so it
  // falls through to the original file rather than doing nothing.
  const downloadWithChanges = async () => {
    if (saving) return
    setSaving(true)
    try {
      const bytes = await viewerRef.current?.saveWithChanges()
      if (bytes) {
        saveBlob(bytes, doc.file_name, "application/pdf")
        return
      }
      window.location.assign(proxyUrl(doc.file_url, true))
    } catch {
      window.location.assign(proxyUrl(doc.file_url, true))
    } finally {
      setSaving(false)
    }
  }

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
        <div className="flex shrink-0 items-center gap-2">
          {previewable && (
            <button
              type="button"
              onClick={() => void downloadWithChanges()}
              disabled={!viewerReady || saving}
              title={viewerReady ? "Save a copy with everything you typed into the fields" : "Available once the preview has loaded"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002b57] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePenLine className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Download with changes</span>
              <span className="sm:hidden">With changes</span>
            </button>
          )}
          <a
            href={proxyUrl(doc.file_url, true)}
            download={doc.file_name}
            className={
              previewable
                ? "inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                : "inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002b57]"
            }
          >
            <Download className="h-3.5 w-3.5" />
            {previewable ? (
              <>
                <span className="hidden sm:inline">Download without changes</span>
                <span className="sm:hidden">Original</span>
              </>
            ) : (
              "Download"
            )}
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
          the PDF's actual page (rendered by pdf.js) is still white. */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-transparent">
        {previewable ? (
          // Keyed by id so stepping to the next document tears the whole
          // viewer (and its typed-in values) down rather than reusing it.
          <PdfFormViewer key={doc.id} ref={viewerRef} src={proxyUrl(doc.file_url, false)} title={doc.title} onStatusChange={onViewerStatus} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
              <FileTile fileName={doc.file_name} />
            </div>
            <p className="max-w-sm text-sm text-[#6b7280]">
              {extensionOf(doc.file_name).toUpperCase()} files can&rsquo;t be previewed in the browser — use Download above
              instead.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
