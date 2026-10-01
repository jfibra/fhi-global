"use client"

// A PDF document's cover tile: page 1, rasterised client-side with pdf.js —
// same rendering call BookView (features/dashboard/ebooks) uses, just a
// single page at a small size rather than a whole flip-book. There is no
// stored/generated thumbnail anywhere (unlike Ebooks, whose covers are
// authored .png files sitting next to each PDF on its host), so this is
// generated in the browser instead.
//
// Rendering is deferred until the tile actually scrolls into view
// (IntersectionObserver) — a shelf can hold a couple dozen documents, and
// nobody should pay for rendering ones they never scroll to. Once rendered,
// the result is cached by URL in two layers: a module Map (so switching
// category tabs, which unmounts and remounts tiles, doesn't re-render the
// same page twice within a tab) and localStorage (so a reload, or a new
// tab, paints every thumbnail instantly instead of fetching each PDF and
// running pdf.js again). Rendering a page is the expensive part of this
// shelf — worth more than the catalogue query to keep across refreshes.

import { useEffect, useRef, useState } from "react"

/** Canvas width in px — the tile displays well under this, so it stays crisp on a 2x screen without over-rendering. */
const RENDER_WIDTH = 400

/** Module-scoped, not component state — survives a tile unmounting (e.g. a category tab switch) for the lifetime of the tab. */
const cache = new Map<string, string>()

// Persistent layer. One localStorage entry holding { [src]: dataUrl } in
// insertion order, capped so it can't creep past the ~5 MB origin quota
// (a 400px JPEG at q=0.82 is roughly 30–60 KB, so 60 entries ≈ 2–3 MB).
// Evicts oldest-first when over the cap, and starts over if a write still
// fails (quota taken by something else) — it's only a cache.
const STORAGE_KEY = "fhi-library-doc-thumbs-v1"
const MAX_ENTRIES = 60
let persisted: Record<string, string> | undefined

function readPersisted(): Record<string, string> {
  if (persisted) return persisted
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    persisted = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
  } catch {
    persisted = {}
  }
  return persisted
}

function getCached(src: string): string | null {
  const mem = cache.get(src)
  if (mem) return mem
  const hit = readPersisted()[src]
  if (typeof hit === "string" && hit.startsWith("data:image/")) {
    cache.set(src, hit)
    return hit
  }
  return null
}

function setCached(src: string, dataUrl: string) {
  cache.set(src, dataUrl)
  const store = readPersisted()
  // Re-insert at the end so the most recently rendered is evicted last.
  delete store[src]
  store[src] = dataUrl
  const keys = Object.keys(store)
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) delete store[keys[i]!]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    try {
      persisted = { [src]: dataUrl }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      // storage unavailable (private mode) or still full — the module cache still helps
    }
  }
}

type Props = {
  /** Same-origin, inline (not `download=1`) proxy URL — pdf.js fetches this itself, so it must not force Content-Disposition: attachment. */
  src: string
  alt: string
  /** Shown until the thumbnail has rendered, and permanently if rendering fails (e.g. a corrupt or password-protected file). */
  fallback: React.ReactNode
}

export default function PdfThumbnail({ src, alt, fallback }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => getCached(src))
  const [failed, setFailed] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dataUrl || failed) return
    const el = hostRef.current
    if (!el) return
    let cancelled = false

    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        // Copied to public/ by the pdfjs:worker postinstall script — kept in
        // sync with the installed pdfjs-dist version automatically.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"

        const pdf = await pdfjs.getDocument({ url: src, disableAutoFetch: true, disableStream: false }).promise
        if (cancelled) {
          void pdf.destroy()
          return
        }
        const page = await pdf.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width })
        const canvas = document.createElement("canvas")
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("2d context unavailable")
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL("image/jpeg", 0.82)
        void pdf.destroy()
        if (cancelled) return
        setCached(src, url)
        setDataUrl(url)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()
        void render()
      },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [src, dataUrl, failed])

  return (
    <div ref={hostRef} className="absolute inset-0">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a rasterised data URL, not an optimizable remote image
        <img src={dataUrl} alt={alt} className="h-full w-full object-cover object-top" draggable={false} />
      ) : (
        fallback
      )}
    </div>
  )
}
