"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Check, Copy, ExternalLink, Link2, Share2 } from "lucide-react"

/**
 * Share panel for the agent's public profile page (app/business-card/[id]).
 *
 * The link is keyed by profile id, not email: the page is public, so an
 * email-keyed URL would let anyone harvest an agent's contact details by
 * guessing addresses. A uuid can't be guessed, and the agent still only has to
 * copy one link.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

/** Absolute URL — the point of the panel is a link the agent can paste anywhere. */
function profileUrl(profileId: string, origin: string): string {
  return `${origin}/business-card/${profileId}`
}

/**
 * `window.location.origin`, read without a setState-in-effect round trip.
 * The server snapshot is empty so the markup matches on hydration, then the
 * client snapshot fills in the real origin.
 */
const noopSubscribe = () => () => {}
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/35 active:scale-95 transition-all"
    >
      {children}
    </button>
  )
}

export function ShareProfileLink({ profileId }: { profileId: string | null }) {
  const origin = useOrigin()
  const [copied, setCopied] = useState(false)

  const url = profileId && origin ? profileUrl(profileId, origin) : ""

  const copy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked (insecure origin / denied permission) — the input is
         selectable, so the agent can still copy by hand */
    }
  }, [url])

  // Reset the "Copied" state a moment later without setting state from an effect body.
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const share = useCallback(async () => {
    if (!url) return
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "My FHI Global profile", url })
        return
      } catch {
        /* dismissed or unsupported — fall through to copying */
      }
    }
    void copy()
  }, [url, copy])


  return (
    <div className="mt-6 rounded-2xl bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] p-6 sm:p-7 shadow-[0_8px_28px_-8px_rgba(0,31,63,0.45)]">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

        {/* Link column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-[#d6b357]" />
            </span>
            <div>
              <h2 className={`${DISPLAY} text-lg sm:text-xl font-bold text-white`}>
                Share your business profile link.
              </h2>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <input
              readOnly
              value={url || "Preparing your link…"}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Your public profile link"
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/95 border border-white/30 text-sm text-[#0d1117] font-medium focus:outline-none focus:ring-4 focus:ring-[#d6b357]/30 truncate"
            />
            <div className="flex items-center gap-2.5">
              <IconButton label={copied ? "Link copied" : "Copy link"} onClick={copy}>
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </IconButton>
              <IconButton label="Share link" onClick={share}>
                <Share2 className="w-4 h-4" />
              </IconButton>
              <a
                href={url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                title="Open my profile"
                aria-label="Open my profile"
                aria-disabled={!url}
                className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-[#d6b357] text-[#001f3f] hover:bg-[#e0c477] active:scale-95 transition-all ${
                  url ? "" : "pointer-events-none opacity-50"
                }`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {copied && (
            <p className="mt-3 text-xs font-semibold text-emerald-300" role="status">
              Copied to your clipboard.
            </p>
          )}
        </div>


      </div>
    </div>
  )
}
