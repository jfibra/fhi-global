"use client"

// Scroll-spy for the report's left timeline: which section is the reader in, and a jump-to that
// scrolls the modal's own container. Sections are found through `data-section` inside the
// container (never document.getElementById — the Teams page behind the modal has its own ids).
//
// The active section is the last one whose top has passed the reading line (offset + a little);
// at the bottom of the container the last section wins. A rAF-throttled scroll listener plus a
// ResizeObserver on the content (the analysis streams in and changes heights). After a click the
// clicked section stays active until the scroll settles, so the highlight never flickers through
// the sections it passes; any wheel, touch or key press hands control back to the reader.

import { useEffect, useRef, useState, type RefObject } from "react"

const READING_LINE = 24

export function useSectionSpy({
  container,
  ids,
  offset,
  enabled,
}: {
  container: RefObject<HTMLElement | null>
  ids: readonly string[]
  /** Height of whatever is stuck to the top of the scroll area (the mobile jump bar), read at use time. */
  offset: () => number
  enabled: boolean
}) {
  const [active, setActive] = useState<string | null>(null)
  const locked = useRef(false)
  const release = useRef<number | null>(null)
  const idsKey = ids.join("|")
  // The caller's offset function changes identity every render; the listeners read the latest through a ref.
  const offsetRef = useRef(offset)
  useEffect(() => {
    offsetRef.current = offset
  })

  useEffect(() => {
    const root = container.current
    if (!enabled || !root) return
    const list = idsKey.split("|")
    let raf = 0
    const update = () => {
      raf = 0
      if (locked.current) return
      const rootTop = root.getBoundingClientRect().top
      let current = list[0]
      for (const id of list) {
        const el = root.querySelector<HTMLElement>(`[data-section="${id}"]`)
        if (el && el.getBoundingClientRect().top - rootTop <= offsetRef.current() + READING_LINE) current = id
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) current = list[list.length - 1]
      setActive((prev) => (prev === current ? prev : current))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const settle = () => {
      if (!locked.current) return
      if (release.current) window.clearTimeout(release.current)
      release.current = window.setTimeout(() => {
        locked.current = false
        schedule()
      }, 150)
    }
    const onScroll = () => {
      settle()
      schedule()
    }
    const takeOver = () => {
      locked.current = false
      schedule()
    }
    const content = root.querySelector("[data-spy-content]") ?? root.firstElementChild
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null
    if (content) ro?.observe(content)
    root.addEventListener("scroll", onScroll, { passive: true })
    root.addEventListener("scrollend", takeOver)
    root.addEventListener("wheel", takeOver, { passive: true })
    root.addEventListener("touchstart", takeOver, { passive: true })
    root.addEventListener("keydown", takeOver)
    window.addEventListener("resize", schedule)
    schedule()
    return () => {
      root.removeEventListener("scroll", onScroll)
      root.removeEventListener("scrollend", takeOver)
      root.removeEventListener("wheel", takeOver)
      root.removeEventListener("touchstart", takeOver)
      root.removeEventListener("keydown", takeOver)
      window.removeEventListener("resize", schedule)
      ro?.disconnect()
      if (raf) cancelAnimationFrame(raf)
      if (release.current) window.clearTimeout(release.current)
    }
  }, [container, enabled, idsKey])

  const jumpTo = (id: string) => {
    const root = container.current
    const el = root?.querySelector<HTMLElement>(`[data-section="${id}"]`)
    if (!root || !el) return
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offsetRef.current()
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    locked.current = true
    setActive(id)
    // If nothing scrolls (already there) the lock still has to let go.
    if (release.current) window.clearTimeout(release.current)
    release.current = window.setTimeout(() => {
      locked.current = false
    }, 700)
    root.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" })
  }

  return { activeId: active ?? ids[0] ?? "", jumpTo }
}
