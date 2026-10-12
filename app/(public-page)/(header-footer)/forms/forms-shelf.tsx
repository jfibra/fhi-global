"use client"

// The public Forms shelf — the dashboard's Documents shelf (features/dashboard/
// documents/documents-client.tsx) dressed for the public site: the editorial
// masthead the other pages open with, category pills, 2:3 paper tiles whose
// cover is page 1 rendered by pdf.js, and one Download per form. No hover
// effects and nothing opens from the tile — there is no viewer and no fill-in
// here; visitors save a copy.

import { useMemo, useState } from "react"
import { Download, FileSpreadsheet, FileText, FileType2 } from "lucide-react"
import PdfThumbnail from "@/features/dashboard/documents/pdf-thumbnail"
import { formatBytes } from "@/lib/materials-shared"
import { formFileHref, type PublicForm } from "@/lib/forms-shared"

const ALL = "All"
const UNCATEGORIZED = "Other"

const extensionOf = (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? ""
const isPdf = (fileName: string) => extensionOf(fileName) === "pdf"
const categoryOf = (doc: PublicForm) => doc.category?.trim() || UNCATEGORIZED
const kindOf = (doc: PublicForm) => (isPdf(doc.file_name) ? "PDF" : (extensionOf(doc.file_name) || "file").toUpperCase())

export function FormsShelf({ docs }: { docs: PublicForm[] }) {
  const [tab, setTab] = useState<string>(ALL)

  const categories = useMemo(() => {
    const named = [...new Set(docs.map(categoryOf))].sort((a, b) => a.localeCompare(b))
    named.sort((a, b) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : 0))
    return [ALL, ...named]
  }, [docs])

  const shown = tab === ALL ? docs : docs.filter((d) => categoryOf(d) === tab)

  return (
    <>
      {/* ── Masthead — the site's light editorial header ── */}
      <section className="relative overflow-hidden border-b border-[#e8eaed] bg-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          aria-hidden="true"
          style={{ backgroundImage: "linear-gradient(#001f3f 1px, transparent 1px), linear-gradient(90deg, #001f3f 1px, transparent 1px)", backgroundSize: "56px 56px" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.25em] text-[#b8913f]">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            FHI Global · Forms
          </p>
          <h1 className="mt-4 max-w-3xl font-['Outfit'] text-[36px] font-bold leading-[1.05] tracking-tight text-[#001f3f] sm:text-[46px] lg:text-[54px]">
            Forms, agreements <span className="text-[#b8913f]">and templates.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#4b5563] sm:text-[17px]">
            The Dubai Land Department contract forms, agency agreements and company templates our team works with — download, print and fill in.
          </p>
          {docs.length > 0 && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#e8eaed] bg-[#fafafa] px-4 py-2 text-[13px] font-semibold text-[#001f3f]">
              <Download className="h-4 w-4 text-[#b8913f]" />
              {docs.length} {docs.length === 1 ? "form" : "forms"} · free to download
            </p>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#d6b357]" aria-hidden="true" />
      </section>

      {/* ── Shelf ── */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categories">
            {categories.map((c) => {
              const active = c === tab
              const count = c === ALL ? docs.length : docs.filter((d) => categoryOf(d) === c).length
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(c)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    active
                      ? "border-[#001f3f] bg-[#001f3f] text-white shadow-[0_6px_16px_-8px_rgba(0,31,63,0.6)]"
                      : "border-[#e8eaed] bg-white text-[#4b5563]"
                  }`}
                >
                  {c}
                  <span className={`text-[11px] font-bold ${active ? "text-[#d6b357]" : "text-[#9ca3af]"}`}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#dfe4ea] bg-white px-6 py-20 text-center">
            <FileText className="h-8 w-8 text-[#c3c9d1]" />
            <p className="font-['Outfit'] text-lg font-bold text-[#0d1117]">{docs.length === 0 ? "No forms yet" : "Nothing in this category yet"}</p>
            <p className="max-w-md text-sm text-[#6b7280]">Forms appear here as soon as the team publishes them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:gap-8">
            {shown.map((doc) => (
              <article key={doc.id} className="flex h-full flex-col">
                {/* Paper tile: page 1 as the cover, category chip, hover reveal with the full title and file facts. */}
                <div className="relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-[#e8eaed] bg-[#eef1f5] shadow-[0_2px_10px_-4px_rgba(0,31,63,0.18)]">
                  {isPdf(doc.file_name) ? (
                    <PdfThumbnail src={formFileHref(doc.id)} alt={doc.title} fallback={<FileTile fileName={doc.file_name} />} />
                  ) : (
                    <FileTile fileName={doc.file_name} />
                  )}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/10 to-transparent" aria-hidden="true" />
                  {tab === ALL && doc.category?.trim() && (
                    <span className="absolute left-3 top-3 rounded-full bg-[#001f3f]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0d89b] backdrop-blur-sm">
                      {doc.category.trim()}
                    </span>
                  )}
                </div>

                <div className="mt-3 min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-['Outfit'] text-[14px] font-bold leading-snug text-[#0d1117] sm:text-[15px]">{doc.title}</h2>
                  <p className="mt-1 text-[12px] text-[#6b7280]">
                    {kindOf(doc)}{doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
                  </p>
                </div>

                <a
                  href={formFileHref(doc.id, true)}
                  download={doc.file_name}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#001f3f] px-4 py-2.5 text-[13px] font-bold text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

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
