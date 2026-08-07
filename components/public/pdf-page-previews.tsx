"use client"

// First N pages of a PDF, rendered to canvases as clickable thumbnails.
//
// Used by Construction Updates on the project page so a visitor can see what's
// inside without downloading the file first.
//
// Two deliberate choices about cost. These PDFs are large — the live one is
// 22 MB — so:
//   * nothing loads until the section scrolls into view (IntersectionObserver),
//     which keeps it off the critical path of every project page; and
//   * disableAutoFetch keeps pdf.js on ranged requests, so it pulls only the
//     bytes the first pages need instead of the whole document.
// The file host must allow cross-origin reads. Supabase storage sends
// `access-control-allow-origin: *` and the CSP already lists it in connect-src,
// so its files load directly; the uploads S3 bucket sends no CORS header and
// isn't in connect-src, so its files fetch through our same-origin
// /api/pdf-proxy instead. Click-to-view links always keep the original URL —
// navigation isn't subject to CORS or connect-src.

import { useEffect, useRef, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"

function fetchUrlFor(url: string): string {
  try {
    if (new URL(url).hostname.endsWith(".supabase.co")) return url
  } catch {
    return url // relative or malformed — let pdf.js try it as-is
  }
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}`
}

const PAGE_COUNT = 4
const LOAD_TIMEOUT_MS = 45_000

type Status = "idle" | "ready" | "failed"

export function PdfPagePreviews({ url, title }: { url: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const [status, setStatus] = useState<Status>("idle")
  const [pages, setPages] = useState(0)

  // Render begins when the block nears the viewport. The observer fires a
  // ref-guarded start() rather than flipping state in the effect body, so
  // nothing is set synchronously during the effect.
  const startedRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => {
    const node = hostRef.current
    if (!node) return
    aliveRef.current = true
    let timeout: ReturnType<typeof setTimeout> | undefined

    const start = () => {
      if (startedRef.current) return
      startedRef.current = true
      void run()
    }

    const run = async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        // Served from public/ rather than resolved through the bundler —
        // webpack can't handle a bare specifier inside new URL(), and the
        // failure mode is a worker that silently never starts.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"

        const task = pdfjs.getDocument({ url: fetchUrlFor(url), disableAutoFetch: true, disableStream: false })
        const pdf = await Promise.race([
          task.promise,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => { void task.destroy(); reject(new Error("timed out")) }, LOAD_TIMEOUT_MS)
          }),
        ])
        clearTimeout(timeout)
        if (!aliveRef.current) { void pdf.destroy(); return }

        const count = Math.min(PAGE_COUNT, pdf.numPages)
        setPages(count)

        for (let n = 1; n <= count; n++) {
          if (!aliveRef.current) break
          const page = await pdf.getPage(n)
          const canvas = canvasRefs.current[n - 1]
          if (!canvas) continue
          // Render at the tile's CSS width times the device ratio, so the
          // thumbnail is sharp without rasterising a full-size page.
          const targetWidth = Math.max(canvas.clientWidth, 220) * Math.min(window.devicePixelRatio || 1, 2)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: targetWidth / base.width })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          const ctx = canvas.getContext("2d")
          if (!ctx) continue
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
        }

        if (aliveRef.current) setStatus("ready")
        void pdf.destroy()
      } catch {
        clearTimeout(timeout)
        // Any failure — CORS, a dead link, a stalled worker — leaves the link
        // below, which is the thing that actually matters.
        if (aliveRef.current) setStatus("failed")
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      start()
      return () => { aliveRef.current = false; clearTimeout(timeout) }
    }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) start() },
      { rootMargin: "300px" },
    )
    io.observe(node)
    return () => { aliveRef.current = false; io.disconnect(); clearTimeout(timeout) }
  }, [url])

  return (
    <div ref={hostRef} className="border border-[#e5e8ec] bg-white">
      <div className="p-4 sm:p-5">
        {status === "failed" ? (
          <div className="flex items-center gap-3 py-6 justify-center text-[#9ca3af]">
            <FileText className="w-5 h-5" />
            <span className="text-sm">Preview unavailable — open the PDF below.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: PAGE_COUNT }).map((_, i) => {
              const visible = status === "ready" ? i < pages : true
              if (!visible) return null
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${title} — page ${i + 1}`}
                  className="group relative block border border-[#eef0f3] bg-[#f7f8fa] overflow-hidden aspect-[3/4]"
                >
                  <canvas
                    ref={(el) => { canvasRefs.current[i] = el }}
                    className="w-full h-full object-contain"
                  />
                  {status !== "ready" && (
                    <span className="absolute inset-0 animate-pulse bg-[#eef1f5]" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 bg-[#001f3f]/0 group-hover:bg-[#001f3f]/25 transition-colors" aria-hidden="true" />
                  <span className="absolute bottom-1.5 left-1.5 bg-[#0a2647] text-white text-[10px] font-bold px-1.5 py-0.5">
                    {i + 1}
                  </span>
                </a>
              )
            })}
          </div>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-4 border-t border-[#eef0f3] px-4 sm:px-5 py-3.5 hover:bg-[#f7f8fa] transition-colors"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#0d1117] truncate">{title}</span>
          <span className="block text-xs text-[#9ca3af] uppercase tracking-wide">PDF · Click to view</span>
        </span>
        <ExternalLink className="w-4 h-4 text-[#b8913f] shrink-0" />
      </a>
    </div>
  )
}
