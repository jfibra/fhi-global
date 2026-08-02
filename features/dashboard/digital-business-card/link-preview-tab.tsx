"use client"

import { useEffect, useState } from "react"
import { Info, Loader2 } from "lucide-react"
import {
  DESIGNS, THUMB_H, THUMB_W, renderCard, type CardData, type DesignId,
} from "@/features/business-card/card-render"
import {
  OG_DESCRIPTION_MAX,
  OG_TITLE_MAX,
  type ProfileOgCard,
} from "@/lib/profile-og-card"

/**
 * Link Preview — the card a network draws when this profile's URL is pasted
 * into a post, plus the two lines of text beside it.
 *
 * The templates are the six Business Card front designs, rendered by the real
 * canvas renderer rather than redrawn here: these cards are gradients, arcs and
 * a skyline photo, and a lookalike that was *nearly* the agent's card would be
 * worse than none. Picking nothing follows the Business Card page, so the two
 * stay in step by default.
 *
 * The live preview itself lives in the page's right-hand column — on this tab
 * that column shows the link, not the profile page.
 */

const DISPLAY = "font-[family-name:var(--font-outfit)]"

type Props = {
  value: ProfileOgCard
  onChange: (next: ProfileOgCard) => void
  /** Feeds the thumbnail renders — the agent's real name, phone and photo. */
  cardData: CardData
  /** The design set on the Business Card page, used when nothing is picked here. */
  inheritedDesign: DesignId
  /** What the page falls back to when the override fields are blank. */
  fallbackTitle: string
  fallbackDescription: string
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e8eaed] bg-white p-4">
      <p className={`${DISPLAY} text-sm font-bold text-[#0d1117]`}>{title}</p>
      {hint && <p className="mt-0.5 text-xs text-[#6b7280]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function LinkPreviewTab({
  value,
  onChange,
  cardData,
  inheritedDesign,
  fallbackTitle,
  fallbackDescription,
}: Props) {
  const [thumbs, setThumbs] = useState<Partial<Record<DesignId, string>>>({})

  // Thumbnails are real renders of the agent's own card, so the picker shows
  // their name and photo rather than six identical stock swatches. Re-rendered
  // when the underlying details change, and guarded so a slow render arriving
  // after unmount (or after the next change) can't overwrite fresher output.
  useEffect(() => {
    let alive = true
    void Promise.all(
      DESIGNS.map(async (d) => [d.id, await renderCard("front", d.id, cardData, THUMB_W, THUMB_H)] as const),
    ).then((pairs) => {
      if (alive) setThumbs(Object.fromEntries(pairs) as Partial<Record<DesignId, string>>)
    })
    return () => {
      alive = false
    }
  }, [cardData])

  const set = <K extends keyof ProfileOgCard>(key: K, v: ProfileOgCard[K]) =>
    onChange({ ...value, [key]: v })

  const activeDesign = value.design || inheritedDesign

  return (
    <div className="space-y-4">
      {/* ── Template ─────────────────────────────────────────────────────── */}
      <Section
        title="Template"
        hint="The design your link preview uses. These are your Business Card fronts."
      >
        <div className="grid grid-cols-2 gap-2.5 items-stretch sm:grid-cols-3">
          {DESIGNS.map((d) => {
            // "Follow the Business Card page" is the empty string, so the
            // inherited design reads as selected without being pinned.
            const on = activeDesign === d.id
            const src = thumbs[d.id]
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => set("design", d.id)}
                title={d.tagline}
                className={`flex h-full flex-col overflow-hidden rounded-xl border text-left transition-all ${
                  on
                    ? "border-[#001f3f] ring-4 ring-[#001f3f]/10"
                    : "border-[#e5e8ed] hover:border-[#c4c9d4]"
                }`}
              >
                <span className="relative block aspect-[7/4] w-full bg-[#f3f5f8]">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={d.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-[#9ca3af]" />
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col px-2.5 py-2">
                  <span className="text-xs font-bold text-[#0d1117]">{d.name}</span>
                  <span className="mt-0.5 min-h-[2.4em] text-[11px] leading-snug text-[#6b7280] line-clamp-2">
                    {d.tagline}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {value.design ? (
          <button
            type="button"
            onClick={() => set("design", "")}
            className="mt-2.5 text-xs font-semibold text-[#001f3f] underline underline-offset-2 hover:opacity-70"
          >
            Follow my Business Card design instead
          </button>
        ) : (
          <p className="mt-2.5 text-xs text-[#6b7280]">
            Following your Business Card design. Pick one above to pin a different card here.
          </p>
        )}
      </Section>

      {/* ── Text ─────────────────────────────────────────────────────────── */}
      <Section title="Title and description" hint="Leave blank to use your name and tagline.">
        <div className="space-y-3">
          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-[#374151]">
              Title
              <span className={value.title.length > OG_TITLE_MAX - 10 ? "text-[#b45309]" : "text-[#9ca3af]"}>
                {value.title.length}/{OG_TITLE_MAX}
              </span>
            </span>
            <input
              value={value.title}
              onChange={(e) => set("title", e.target.value.slice(0, OG_TITLE_MAX))}
              placeholder={fallbackTitle}
              className="mt-1 w-full rounded-xl border border-[#e5e8ed] px-3 py-2.5 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/10 transition-all"
            />
          </label>
          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-[#374151]">
              Description
              <span
                className={value.description.length > OG_DESCRIPTION_MAX - 20 ? "text-[#b45309]" : "text-[#9ca3af]"}
              >
                {value.description.length}/{OG_DESCRIPTION_MAX}
              </span>
            </span>
            <textarea
              value={value.description}
              onChange={(e) => set("description", e.target.value.slice(0, OG_DESCRIPTION_MAX))}
              placeholder={fallbackDescription}
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border border-[#e5e8ed] px-3 py-2.5 text-sm text-[#0d1117] placeholder:text-[#9ca3af] focus:border-[#001f3f] focus:outline-none focus:ring-4 focus:ring-[#001f3f]/10 transition-all"
            />
          </label>
        </div>
      </Section>

      <p className="flex items-start gap-2 rounded-xl bg-[#f2f6fb] px-3 py-2.5 text-xs leading-snug text-[#4b5563]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#001f3f]" />
        <span>
          The card is attached when you save, and the share buttons on your profile page use a
          fresh link each time — a redesign shows up there on its own. Only links you pasted
          somewhere before the change keep the old card until Facebook re-checks them.
        </span>
      </p>
    </div>
  )
}
