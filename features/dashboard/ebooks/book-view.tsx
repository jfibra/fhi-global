"use client"

// Book view — the PDF as a two-page spread you flip through.
//
// pdf.js rasterises pages to canvases and react-pageflip animates the turn.
// Both are heavy, so this module is only ever reached through a dynamic
// import from the reader: someone who stays on Page view never downloads it.
//
// Pages are rendered lazily in a window around the current spread. A 572-page
// book would be minutes of work and hundreds of MB of canvas if drawn up
// front, so only what you are about to see is ever rasterised.

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import HTMLFlipBook from "react-pageflip"
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"

/** Pages kept rendered either side of the current spread. */
const WINDOW = 4
/**
 * Canvas width per page. Pages display up to ~700 CSS px wide, so rendering at
 * 1500 keeps text crisp on a 2x screen without the memory of a full-res draw.
 */
const RENDER_WIDTH = 1500
/** Below this the spread is cramped, so fall back to one page at a time. */
const SPREAD_MIN_WIDTH = 820
/** Give up opening after this and offer Page view instead. */
const LOAD_TIMEOUT_MS = 25_000

type Props = {
  /** Same-origin proxy URL — pdf.js cannot read the host directly (no CORS). */
  src: string
  title: string
}

type PageSize = { width: number; height: number }

export default function BookView({ src, title }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [size, setSize] = useState<PageSize | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [rendered, setRendered] = useState<Record<number, string>>({})

  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const renderingRef = useRef<Set<number>>(new Set())
  /** Mirrors `rendered` so the windowing logic can read it without being a
   *  reactive dependency — otherwise every finished page would re-trigger it. */
  const doneRef = useRef<Set<number>>(new Set())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-pageflip ships no ref type
  const flipRef = useRef<any>(null)

  // ── Render one page to a data URL ────────────────────────────────────────
  const renderPage = useCallback(
    async (pdf: PDFDocumentProxy, n: number) => {
      if (renderingRef.current.has(n)) return
      renderingRef.current.add(n)
      try {
        const page = await pdf.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width })
        const canvas = document.createElement("canvas")
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        const url = canvas.toDataURL("image/jpeg", 0.9)
        doneRef.current.add(n)
        setRendered((prev) => (prev[n] ? prev : { ...prev, [n]: url }))
      } catch {
        /* a page that won't draw stays blank rather than breaking the book */
      } finally {
        renderingRef.current.delete(n)
      }
    },
    [],
  )

  /**
   * Rasterise the pages around `center`, skipping any already drawn or in
   * flight. Driven by load and by flips rather than by an effect watching
   * `rendered` — that would re-fire on every page that finished.
   */
  const ensureWindow = useCallback(
    (pdf: PDFDocumentProxy, total: number, center: number) => {
      const from = Math.max(1, center - WINDOW)
      const to = Math.min(total, center + WINDOW + 2)
      for (let n = from; n <= to; n++) {
        if (!doneRef.current.has(n)) void renderPage(pdf, n)
      }
    },
    [renderPage],
  )

  // ── Load the document ────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    let loaded: PDFDocumentProxy | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    const rendering = renderingRef.current
    const done = doneRef.current

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        // Served from public/ rather than resolved through the bundler:
        // webpack can't handle a bare package specifier inside new URL(), and
        // the silent failure is a worker that never starts, so the book just
        // hangs on "Opening…". The copy is refreshed by the `pdfjs:worker`
        // postinstall script so it can't drift from the installed version.
        // CSP allows it: worker-src 'self' blob:.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"

        const task = pdfjs.getDocument({ url: src, disableAutoFetch: true, disableStream: false })
        // Bounded so a stalled worker or a dead connection ends in a message
        // and a way out, rather than a spinner that never resolves.
        const pdf = await Promise.race([
          task.promise,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              void task.destroy()
              reject(new Error("timed out"))
            }, LOAD_TIMEOUT_MS)
          }),
        ])
        clearTimeout(timeout)
        if (!alive) {
          void pdf.destroy()
          return
        }
        loaded = pdf

        const first = await pdf.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        if (!alive) return

        setSize({ width: vp.width, height: vp.height })
        setPageCount(pdf.numPages)
        setDoc(pdf)
        ensureWindow(pdf, pdf.numPages, 1)
      } catch {
        if (alive) setError("Couldn't open this book in Book view.")
      }
    })()

    return () => {
      alive = false
      clearTimeout(timeout)
      rendering.clear()
      done.clear()
      void loaded?.destroy()
    }
  }, [src, ensureWindow])

  // Measure the shell. Quantised to 20px so ordinary layout jitter doesn't
  // churn the size (which the library only reads when it is constructed).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      const q = (n: number) => Math.max(0, Math.floor(n / 20) * 20)
      setBox({ w: q(r.width), h: q(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="inline-flex items-center gap-2 text-sm text-white/80">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#d6b357]" /> {error} Try Page view instead.
        </p>
      </div>
    )
  }

  if (!doc || !size) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="inline-flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening {title}…
        </p>
      </div>
    )
  }

  const ratio = size.height / size.width

  // Two pages side by side once there's room; one page on narrow screens.
  const spread = (box?.w ?? 0) >= SPREAD_MIN_WIDTH

  /**
   * Widest a page may be. Stretch mode fits to the parent's WIDTH, so on a wide
   * screen it happily makes pages taller than the shell and crops them top and
   * bottom. Deriving the cap from the available HEIGHT is what keeps the whole
   * page on screen; the width cap then stops a short, wide window from
   * overflowing sideways. Falls back to a sane value before the first measure
   * so the book is never blank.
   */
  const maxPageWidth =
    box && box.h > 0
      ? Math.max(240, Math.min(Math.floor(box.h / ratio), Math.floor(spread ? box.w / 2 : box.w)))
      : 640

  return (
    <div className="flex h-full flex-col items-center gap-2 p-2">
      {/* w-full matters: the library's "stretch" mode fills its parent, and in
          a centred flex column the parent would otherwise shrink to nothing and
          collapse the book to its minimum size. */}
      <div ref={wrapRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <HTMLFlipBook
          // The library reads its bounds at construction, so a genuine size
          // change has to remount it. Quantised measurements keep that rare.
          key={`${spread ? "spread" : "single"}-${maxPageWidth}`}
          ref={flipRef}
          className="ebook-flip"
          style={{}}
          // In stretch mode these set the page's aspect ratio and its bounds,
          // not a literal size.
          width={550}
          height={Math.round(550 * ratio)}
          size="stretch"
          minWidth={240}
          maxWidth={maxPageWidth}
          minHeight={320}
          maxHeight={Math.max(360, box?.h ?? 900)}
          maxShadowOpacity={0.4}
          showCover
          mobileScrollSupport
          drawShadow
          flippingTime={700}
          usePortrait={!spread}
          startPage={current}
          startZIndex={0}
          autoSize
          clickEventForward={false}
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={false}
          onFlip={(e: { data: number }) => {
            setCurrent(e.data)
            // Draw ahead of where the reader just landed.
            ensureWindow(doc, pageCount, e.data + 1)
          }}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <Page key={i} number={i + 1} src={rendered[i + 1]} />
          ))}
        </HTMLFlipBook>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-white">
        <button
          type="button"
          onClick={() => flipRef.current?.pageFlip?.()?.flipPrev()}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-xs tabular-nums text-white/70">
          {Math.min(current + 1, pageCount)} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => flipRef.current?.pageFlip?.()?.flipNext()}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

/** One leaf. react-pageflip requires real DOM children, so this takes a ref. */
const Page = forwardRef<HTMLDivElement, { number: number; src?: string }>(
  function Page({ number, src }, ref) {
    return (
      <div ref={ref} className="bg-white">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- already a rasterised data URL
          <img src={src} alt={`Page ${number}`} className="h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#f3f4f6]">
            <Loader2 className="h-5 w-5 animate-spin text-[#9ca3af]" />
          </div>
        )}
      </div>
    )
  },
)
