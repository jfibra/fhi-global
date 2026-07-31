"use client"

// Ebooks shelf — cover grid with category tabs, and the in-dashboard reader.
//
// The reader embeds the PDF straight from its host in an <iframe>, handing it
// to the browser's built-in viewer. That is the fastest path (the file streams
// from their CDN, and `Accept-Ranges: bytes` lets the browser pull pages on
// demand instead of the whole file) and it ships no PDF library of our own —
// zoom, search, page jump and print all come from the native viewer.

import { useMemo, useState } from "react"
import Image from "next/image"
import { ArrowLeft, BookOpen, Download, ExternalLink, Library } from "lucide-react"
import { ebookCategories, ebookCoverUrl, ebookFileName, type Ebook } from "@/lib/ebooks"

const ALL = "All"

export function EbooksClient({ books }: { books: Ebook[] }) {
  const [tab, setTab] = useState<string>(ALL)
  const [openId, setOpenId] = useState<string | null>(null)

  const categories = useMemo(() => [ALL, ...ebookCategories(books)], [books])
  const shown = tab === ALL ? books : books.filter((b) => b.category === tab)
  const open = books.find((b) => b.id === openId) ?? null

  if (open) return <Reader book={open} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#001f3f] shadow-lg">
          <Library className="h-6 w-6 text-[#d6b357]" />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Ebooks</h1>
          <p className="text-sm text-[#6b7280]">Training material you can read here or download for offline.</p>
        </div>
        {books.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-[#f3f4f6] px-3 py-1.5 text-xs font-bold text-[#6b7280]">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        )}
      </div>

      {/* Category tabs — driven by the catalogue, so a new category appears
          here the moment a book uses it. */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === tab
            const count = c === ALL ? books.length : books.filter((b) => b.category === c).length
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

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#9ca3af]">No books in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((book) => (
            <article key={book.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpenId(book.id)}
                aria-label={`Read ${book.title}`}
                className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-black/[0.08] bg-[#eef1f5] shadow-sm transition-shadow hover:shadow-[0_12px_28px_-12px_rgba(0,31,63,0.5)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20"
              >
                <Cover book={book} />

                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#001f3f]/0 opacity-0 transition-all duration-200 group-hover:bg-[#001f3f]/40 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#d6b357] px-3 py-2 text-xs font-bold text-[#001f3f]">
                    <BookOpen className="h-3.5 w-3.5" /> Read
                  </span>
                </span>
              </button>

              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-[#0d1117]" title={book.title}>
                {book.title}
              </p>
              <a
                href={book.url}
                download={ebookFileName(book)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#6b7280] transition-colors hover:text-[#001f3f]"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Cover art, falling back to a generated one if the image 404s.
 *
 * `contain` rather than `cover`: book jackets come in different proportions,
 * and cropping one to the tile slices the title off the edges.
 */
function Cover({ book }: { book: Ebook }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <GeneratedCover title={book.title} />
  return (
    <Image
      src={ebookCoverUrl(book)}
      alt={book.title}
      fill
      sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
      quality={75}
      onError={() => setFailed(true)}
      className="object-contain"
    />
  )
}

/** Stand-in shown when a book has no reachable cover image. */
function GeneratedCover({ title }: { title: string }) {
  return (
    <span className="absolute inset-0 flex flex-col justify-between bg-[#001f3f] p-3 text-left">
      <span className="h-1 w-8 rounded-full bg-[#d6b357]" />
      <span className="font-['Outfit'] text-sm font-bold leading-tight text-white line-clamp-5">{title}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#d6b357]">FHI Global</span>
    </span>
  )
}

function Reader({ book, onBack }: { book: Ebook; onBack: () => void }) {
  return (
    // Fills the shell's <main> (which already supplies p-6) and adds none of
    // its own, so the PDF gets the full width. The column is pinned to the
    // viewport height and the viewer takes whatever the header row leaves.
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[460px] flex-col gap-3">
      {/* Back, title and actions share one row — a second row would cost the
          viewer another 40px of height. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Ebooks"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-white text-[#6b7280] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#d6b357]">{book.category}</p>
          <h1 className="truncate font-['Outfit'] text-base font-bold leading-tight text-[#0d1117]" title={book.title}>
            {book.title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={book.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 py-2 text-xs font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            New tab
          </a>
          <a
            href={book.url}
            download={ebookFileName(book)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#001f3f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002b57]"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </div>

      {/* The fallback sits behind the iframe, so it only shows if the viewer
          fails to paint (host blocks framing, or no PDF viewer available). */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-black/[0.08] bg-[#525659]">
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-white/70">
            Preparing the reader…{" "}
            <a href={book.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#d6b357] underline">
              open it in a new tab
            </a>{" "}
            if nothing appears.
          </p>
        </div>
        <iframe
          // #view=FitH opens fitted to the page width rather than zoomed in.
          src={`${book.url}#view=FitH`}
          title={book.title}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  )
}
