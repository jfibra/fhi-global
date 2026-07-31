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
  //
  // Depends on `doc`: until the document loads this component renders the
  // "Opening…" state, wrapRef is null, and an attach-once effect would bail
  // out and never run again — leaving the book stuck on its fallback size.
  useEffect(() => {
    if (!doc) return
    const el = wrapRef.current
    if (!el) return
    const q = (n: number) => Math.max(0, Math.floor(n / 20) * 20)
    const measure = () => setBox({ w: q(el.clientWidth), h: q(el.clientHeight) })
    measure() // before the first observer tick, so the book starts right
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc])

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
   * The largest page that fits the measured shell, in both directions.
   *
   * Start from the width each page may occupy (half of it in a spread) and
   * derive the height from the page ratio; if that overflows, size from the
   * height instead. These go straight to the library in "fixed" mode — its
   * "stretch" mode computes its own size from the parent and honours neither
   * the max bounds nor the parent's height, which came out cropped on a short
   * window and tiny on a tall one.
   */
  const pagesAcross = spread ? 2 : 1
  const availW = box?.w ?? 900
  const availH = box?.h ?? 600
  let pageW = availW / pagesAcross
  let pageH = pageW * ratio
  if (pageH > availH) {
    pageH = availH
    pageW = pageH / ratio
  }
  pageW = Math.max(160, Math.floor(pageW))
  pageH = Math.max(200, Math.floor(pageH))

  return (
    <div className="flex h-full flex-col items-center gap-2 p-2">
      {/* w-full so this measures the full shell width rather than shrinking to
          its content, and overflow-hidden so a mis-sized book can never push
          the pager out of view — the reader always keeps its controls. */}
      <div ref={wrapRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <HTMLFlipBook
          // The library reads its bounds at construction, so a genuine size
          // change has to remount it. Quantised measurements keep that rare.
          key={`${spread ? "spread" : "single"}-${pageW}x${pageH}`}
          ref={flipRef}
          className="ebook-flip"
          style={{}}
          // "fixed" with an explicit page size, rather than "stretch": stretch
          // derives its own size from the parent and ignored the bounds given
          // to it, coming out either cropped or tiny depending on the window.
          // These numbers are computed from the measured shell above, so the
          // book is exactly as large as will fit.
          width={pageW}
          height={pageH}
          size="fixed"
          minWidth={100}
          maxWidth={3000}
          minHeight={100}
          maxHeight={3000}
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
