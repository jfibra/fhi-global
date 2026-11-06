"use client"

// The website chat's launcher (boss via Juliecor, 2026-11-06): the public FHI
// Assistant on fhiglobal.ae. A small "Ask FHI" pill beside the WhatsApp
// button on every public page; the panel itself (site-chat-panel.tsx) is
// loaded only when someone taps it, so the pages we tuned for speed pay
// nothing for it. Not on a Buyers or Sellers Link and not on an agent's
// event page — those visitors belong to the agent (same rule as the
// WhatsApp button). The open/closed state survives a page change in
// sessionStorage, and so does the conversation (kept by the panel).

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sparkles } from "lucide-react"
import { AGENT_PAGES, useFabBelongsToAgent } from "@/components/public/whatsapp-fab"
import { gaEvent } from "@/lib/ga"

const SiteChatPanel = dynamic(() => import("./site-chat-panel").then((m) => m.SiteChatPanel), { ssr: false })

const OPEN_KEY = "fhi-site-chat-open"

export function SiteChat() {
  const pathname = usePathname()
  const agentOwned = useFabBelongsToAgent()
  const [open, setOpen] = useState(false)
  // Once opened, the panel stays mounted (closed) so the conversation and a half-typed message survive a close.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Deferred a tick so the effect never sets state synchronously.
    const id = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(OPEN_KEY) === "1") {
          setMounted(true)
          setOpen(true)
        }
      } catch {
        // Storage can be unavailable (private mode); the chat simply starts closed.
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const show = (next: boolean) => {
    setMounted(true)
    setOpen(next)
    try {
      sessionStorage.setItem(OPEN_KEY, next ? "1" : "0")
    } catch {
      // Nothing to remember then.
    }
    if (next) gaEvent("site_chat_open", { page: pathname ?? "/" })
  }

  if (pathname && AGENT_PAGES.some((p) => pathname.startsWith(p))) return null
  if (agentOwned) return null

  return (
    <>
      {mounted && <SiteChatPanel open={open} onClose={() => show(false)} page={pathname ?? "/"} />}
      {!open && (
        <button
          type="button"
          onClick={() => show(true)}
          aria-label="Ask FHI Assistant about any project"
          className="sc-fab fixed bottom-5 right-[84px] z-50 inline-flex h-14 items-center gap-2 rounded-full bg-[#001f3f] pl-4 pr-5 text-[14px] font-bold text-white shadow-[0_10px_28px_-6px_rgba(0,31,63,0.55)] transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#001f3f]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d6b357]">
            <Sparkles className="h-4 w-4 text-[#001f3f]" />
          </span>
          Ask FHI
        </button>
      )}
    </>
  )
}
