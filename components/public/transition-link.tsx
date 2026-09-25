"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { CSSProperties, MouseEvent, ReactNode } from "react"

/**
 * A link whose image carries over into the next page.
 *
 * On click, the element matching `imageSelector` inside the link is given the
 * view-transition name the destination's hero also uses, and the navigation
 * is wrapped in `document.startViewTransition`, so the browser morphs the
 * card photo into the page's hero instead of cutting to white. The CSS for
 * the morph lives under `::view-transition-*` in app/globals.css.
 *
 * Browsers without the API, reduced-motion readers, modified clicks
 * (new tab, middle button) and anything that already prevented default all
 * get an ordinary Link navigation. If the destination has not rendered its
 * hero within 1.5s the transition simply completes as a crossfade.
 */
export function TransitionLink({
  href,
  className,
  style,
  children,
  imageSelector = "[data-vt-img]",
  name = "project-hero",
  prefetch,
}: {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  imageSelector?: string
  name?: string
  prefetch?: boolean | null
}) {
  const router = useRouter()

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } }
    if (typeof doc.startViewTransition !== "function") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    e.preventDefault()
    const img = e.currentTarget.querySelector<HTMLElement>(imageSelector)
    // A view-transition name must be unique on the page, or the browser skips
    // the whole transition. On a project page the masthead already carries
    // "project-hero" (cards elsewhere land on it), so a card clicked there —
    // More from, Nearby — would duplicate it: the masthead lends the name to
    // the card until the new page is in.
    const holders = img ? [...document.querySelectorAll<HTMLElement>(`[data-vt="${name}"]`)].filter((el) => el !== img) : []
    const held = holders.map((el) => el.style.viewTransitionName)
    for (const el of holders) el.style.viewTransitionName = "none"
    if (img) img.style.viewTransitionName = name
    const handBack = () => {
      if (img) img.style.viewTransitionName = ""
      holders.forEach((el, i) => { el.style.viewTransitionName = held[i] })
    }
    const targetPath = new URL(href, window.location.origin).pathname

    const transition = doc.startViewTransition(async () => {
      router.push(href)
      await waitFor(() => window.location.pathname === targetPath && !!document.querySelector(`[data-vt="${name}"]`), 1500)
      // Before the new state is captured, so a masthead React kept across
      // the navigation is named again for the morph.
      handBack()
    })
    transition.finished.finally(handBack)
  }

  return (
    <Link href={href} className={className} style={style} onClick={onClick} prefetch={prefetch}>
      {children}
    </Link>
  )
}

function waitFor(test: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      // No requestAnimationFrame here: rendering is paused while a view
      // transition's update callback runs, so frame callbacks never fire and
      // the transition would abort on its own timeout. A short timeout lets
      // the new page's layout settle instead.
      if (test() || performance.now() - start > timeoutMs) {
        setTimeout(resolve, 40)
        return
      }
      setTimeout(tick, 32)
    }
    tick()
  })
}
