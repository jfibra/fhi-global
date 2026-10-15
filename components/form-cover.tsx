"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"

/**
 * A document's cover: page 1 as a plain <img>, rendered once on the server
 * (/forms/cover/<id>, lib/form-cover.ts; formCoverHref builds the URL) — for
 * the public Forms shelf, the dashboard's Documents shelf and its Library hub
 * tile. The browser fetches a ~40 KB image instead of pdf.js plus the whole
 * PDF. The fallback underneath shows while the image loads and stays if it
 * fails; it is decoration, so screen readers skip it (the title is always
 * next to it). Put it in a positioned box: the image fills it, and the
 * fallback should be absolutely positioned too.
 */
export function FormCover({
  src,
  alt,
  eager,
  priority,
  fallback,
}: {
  src: string
  alt: string
  /** Fetch with the page instead of when the browser's lazy-load check reaches it. */
  eager: boolean
  /** fetchpriority=high — for the first row. */
  priority: boolean
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  // A load that fails before hydration fires no React onError. Setting the
  // src again once mounted replays it (a loaded image answers from memory) —
  // the same fix next/image uses.
  const replayLoad = useCallback((img: HTMLImageElement | null) => {
    if (img) img.src = img.src
  }, [])
  useEffect(() => clearRetiredThumbnailCache(), [])
  return (
    <>
      <span aria-hidden="true">{fallback}</span>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element -- already a sized WebP from our own route; the optimizer would only re-encode it
        <img
          ref={replayLoad}
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
    </>
  )
}

// The in-browser renderer these covers replaced (PdfThumbnail) kept every page
// it drew in localStorage under this key — up to 60 data URLs, most of the
// origin's ~5 MB. Nothing reads it any more: drop it once per page load,
// wherever a cover renders.
const RETIRED_THUMBNAIL_CACHE = "fhi-library-doc-thumbs-v1"
let retiredCacheCleared = false

function clearRetiredThumbnailCache() {
  if (retiredCacheCleared) return
  retiredCacheCleared = true
  try {
    localStorage.removeItem(RETIRED_THUMBNAIL_CACHE)
  } catch {
    // storage unavailable (private mode, blocked) — nothing to clear
  }
}
