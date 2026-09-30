"use client"

// In-page PDF viewer for Library → Documents, with fillable form fields.
//
// The document page used to embed the S3 URL in an <iframe> and let Chrome's
// own PDF plugin draw it. That plugin renders form fields you can type into,
// but what you typed lives inside the plugin process — the page around it
// can't read the values, and there is no API to trigger the plugin's own
// "Download → With your changes" from outside. So a "Download with changes"
// button of our own was impossible with the iframe.
//
// This renders the PDF with pdf.js instead: each page is a <canvas> for the
// static content plus pdf.js's AnnotationLayer, which lays real HTML
// <input>/<textarea>/<select> elements over every form widget (renderForms).
// Everything typed is written to the document's AnnotationStorage, and
// `saveWithChanges()` asks pdf.js to write a new PDF with those values filled
// in (`PDFDocumentProxy.saveDocument`) — the same thing the browser's
// "With your changes" does, just under our own button. The bytes come back
// to the caller, who saves them via a blob URL + <a download>, so nothing
// opens in a new tab.
//
// Pages are stacked vertically and fit to the container's width (the
// iframe's `view=FitH`), re-laid on resize. The pdf.js form CSS lives in
// app/globals.css under `.fhi-pdf-page` — pdf.js's own pdf_viewer.css is
// ~7k lines and restyles :root, so only the AnnotationLayer subset is
// carried over.
//
// Text is forced to UPPER CASE, both on screen and in the saved file: the
// contract forms are meant to be filled in caps, and the browser-native
// viewer saved whatever case was typed. A capture-phase `input` listener on
// the page column upper-cases the field before pdf.js's own listener (on the
// input itself) copies the value into AnnotationStorage, and
// `saveWithChanges()` normalises the storage once more as a belt-and-braces.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist"
import type { AnnotationLayer } from "pdfjs-dist"

const LOAD_TIMEOUT_MS = 25_000
/** Breathing room either side of the page inside the scroller, in px. */
const SIDE_GUTTER = 16
/** Never blow a small page up past this, even in a very wide container. */
const MAX_SCALE = 2.5

export type PdfFormViewerHandle = {
  /**
   * The PDF with everything typed into its fields written in. `null` when the
   * document hasn't loaded (or failed to) — the caller should fall back to the
   * original file. Returns the original bytes when nothing was changed.
   */
  saveWithChanges: () => Promise<Uint8Array | null>
  /** Whether any field has been edited since the document loaded. */
  hasChanges: () => boolean
}

type Status = "loading" | "ready" | "error"

type Props = {
  /** Same-origin inline proxy URL (not `download=1`) — pdf.js fetches this itself (with Range requests). */
  src: string
  title: string
  onStatusChange?: (status: Status) => void
}

type PageSlot = {
  page: PDFPageProxy
  wrapper: HTMLDivElement
  canvas: HTMLCanvasElement
  layerDiv: HTMLDivElement
  layer: AnnotationLayer | null
  renderTask: RenderTask | null
}

const PdfFormViewer = forwardRef<PdfFormViewerHandle, Props>(function PdfFormViewer({ src, title, onStatusChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  /** Annotation ids of text fields (`/FT /Tx`) — the only values that get upper-cased. */
  const textFieldIdsRef = useRef<Set<string>>(new Set())
  const [status, setStatus] = useState<Status>("loading")

  useImperativeHandle(
    ref,
    () => ({
      saveWithChanges: async () => {
        const pdf = pdfRef.current
        if (!pdf) return null
        // pdf.js warns (only) when saveDocument runs with an empty storage;
        // getData is the original bytes and is what it asks for in that case.
        if (pdf.annotationStorage.size === 0) return pdf.getData()
        const storage = pdf.annotationStorage
        for (const id of textFieldIdsRef.current) {
          const entry = storage.getRawValue(id) as { value?: unknown } | undefined
          const value = entry?.value
          if (typeof value === "string" && value !== value.toUpperCase()) {
            storage.setValue(id, { value: value.toUpperCase() })
          }
        }
        return pdf.saveDocument()
      },
      hasChanges: () => (pdfRef.current?.annotationStorage.size ?? 0) > 0,
    }),
    [],
  )

  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let alive = true
    let pdf: PDFDocumentProxy | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let observer: ResizeObserver | null = null
    const slots: PageSlot[] = []
    const column = document.createElement("div")
    column.className = "flex flex-col items-center gap-3 py-3"
    const textFieldIds = textFieldIdsRef.current
    textFieldIds.clear()

    // Capture phase on the column runs before pdf.js's target-phase `input`
    // listener on the field, so the value it copies into storage is already
    // upper-cased. Caret position is preserved (the length doesn't change).
    const upperCaseOnInput = (e: Event) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
      if (el instanceof HTMLInputElement && el.type !== "text") return
      if (!el.closest(".textWidgetAnnotation")) return
      const upper = el.value.toUpperCase()
      if (upper === el.value) return
      const { selectionStart, selectionEnd } = el
      el.value = upper
      try {
        el.setSelectionRange(selectionStart, selectionEnd)
      } catch {
        /* not all input types support selection ranges */
      }
    }
    column.addEventListener("input", upperCaseOnInput, true)

    setStatus("loading")

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        // SimpleLinkService is the no-op link handler the AnnotationLayer
        // needs for link annotations; it lives in the viewer bundle.
        const { SimpleLinkService } = await import("pdfjs-dist/web/pdf_viewer.mjs")
        // Served from public/ (copied by the `pdfjs:worker` postinstall
        // script) — same reasoning as PdfThumbnail / the Ebooks reader.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"

        const task = pdfjs.getDocument({ url: src, disableAutoFetch: true, disableStream: false })
        const loaded = await Promise.race([
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
          void loaded.destroy()
          return
        }
        pdf = loaded
        pdfRef.current = loaded

        const [fieldObjects, hasJSActions] = await Promise.all([loaded.getFieldObjects(), loaded.hasJSActions()])
        const pages = await Promise.all(Array.from({ length: loaded.numPages }, (_, i) => loaded.getPage(i + 1)))
        if (!alive) return

        for (const page of pages) {
          const wrapper = document.createElement("div")
          wrapper.className = "fhi-pdf-page shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
          const canvas = document.createElement("canvas")
          const layerDiv = document.createElement("div")
          layerDiv.className = "annotationLayer"
          wrapper.append(canvas, layerDiv)
          column.append(wrapper)
          slots.push({ page, wrapper, canvas, layerDiv, layer: null, renderTask: null })
        }
        host.replaceChildren(column)

        const linkService = new SimpleLinkService()
        const storage = loaded.annotationStorage

        const layout = async () => {
          if (!alive || !pdf) return
          const available = Math.max(host.clientWidth - SIDE_GUTTER * 2, 200)
          // Fit-to-width on the widest page so every page fits; most
          // documents are uniform anyway.
          const widest = Math.max(...slots.map((s) => s.page.getViewport({ scale: 1 }).width))
          const scale = Math.min(available / widest, MAX_SCALE)
          const dpr = window.devicePixelRatio || 1

          await Promise.all(
            slots.map(async (slot) => {
              const { page, wrapper, canvas, layerDiv } = slot
              const viewport = page.getViewport({ scale })
              wrapper.style.width = `${viewport.width}px`
              wrapper.style.height = `${viewport.height}px`
              // pdf.js sizes and positions the layer and every field from
              // these — see setLayerDimensions in pdf.js.
              wrapper.style.setProperty("--scale-factor", String(scale))
              wrapper.style.setProperty("--user-unit", String(page.userUnit))

              slot.renderTask?.cancel()
              canvas.width = Math.ceil(viewport.width * dpr)
              canvas.height = Math.ceil(viewport.height * dpr)
              canvas.style.width = `${viewport.width}px`
              canvas.style.height = `${viewport.height}px`
              const ctx = canvas.getContext("2d")
              if (!ctx) throw new Error("2d context unavailable")
              // ENABLE_FORMS: draw everything except the form widgets' own
              // appearance streams — the HTML fields in the annotation layer
              // stand in for those, so they'd otherwise show twice.
              const renderTask = page.render({
                canvas,
                canvasContext: ctx,
                viewport,
                transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
                annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS,
              })
              slot.renderTask = renderTask
              try {
                await renderTask.promise
              } catch (e) {
                // A cancel from a newer layout is expected, anything else is not.
                if (!(e instanceof pdfjs.RenderingCancelledException)) throw e
                return
              }

              const layerViewport = viewport.clone({ dontFlip: true })
              if (slot.layer) {
                slot.layer.update({ viewport: layerViewport } as Parameters<AnnotationLayer["update"]>[0])
                return
              }
              const annotations = await page.getAnnotations({ intent: "display" })
              if (!alive) return
              for (const a of annotations as Array<{ id: string; subtype?: string; fieldType?: string }>) {
                if (a.subtype === "Widget" && a.fieldType === "Tx") textFieldIds.add(a.id)
              }
              const layer = new pdfjs.AnnotationLayer({
                div: layerDiv,
                accessibilityManager: undefined,
                annotationCanvasMap: undefined,
                annotationEditorUIManager: undefined,
                page,
                viewport: layerViewport,
                structTreeLayer: undefined,
                commentManager: undefined,
                linkService,
                annotationStorage: storage,
              })
              slot.layer = layer
              await layer.render({
                annotations,
                div: layerDiv,
                page,
                viewport: layerViewport,
                linkService,
                annotationStorage: storage,
                renderForms: true,
                enableScripting: false,
                hasJSActions,
                fieldObjects: fieldObjects as Record<string, object[]> | null,
                imageResourcesPath: "",
              })
            }),
          )
        }

        await layout()
        if (!alive) return
        setStatus("ready")

        observer = new ResizeObserver(() => {
          clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => void layout().catch(() => {}), 150)
        })
        observer.observe(host)
      } catch {
        if (alive) setStatus("error")
      }
    })()

    return () => {
      alive = false
      clearTimeout(timeout)
      clearTimeout(resizeTimer)
      observer?.disconnect()
      column.removeEventListener("input", upperCaseOnInput, true)
      for (const slot of slots) slot.renderTask?.cancel()
      pdfRef.current = null
      host.replaceChildren()
      if (pdf) void pdf.destroy()
    }
  }, [src])

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} aria-label={title} className="h-full w-full overflow-auto" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="inline-flex items-center gap-2 text-sm text-[#6b7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing the preview…
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm text-[#6b7280]">
            The preview couldn&rsquo;t be rendered — use <span className="font-semibold text-[#374151]">Download without changes</span> to
            get the file.
          </p>
        </div>
      )}
    </div>
  )
})

export default PdfFormViewer
