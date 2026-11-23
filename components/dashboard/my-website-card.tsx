"use client"

// "My Website" on the sales-ladder dashboards (agent, team leader, unit manager,
// global partner): their Website Builder site's public link to open or copy in
// one click, and the site itself below it as clients see it (the saved site,
// drawn by the real template — LivePreview) — or, if they haven't built one
// yet, a prompt to create it.

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Pencil, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { SITE_URL } from "@/lib/seo"
import { STORY_BY_AGENT } from "@/lib/films"
import { loadAgentWebsiteReviews, orderWebsiteReviews } from "@/lib/website-reviews"
import type { Testimonial, WebsiteData } from "@/app/website/_data"
import { LivePreview } from "@/features/dashboard/my-website/site-preview"

type Site = { slug: string; isPublished: boolean }
type SiteContact = { phone: string; whatsapp: string; phoneCode: string; whatsappCode: string }

/** A stored number with its country code, as the live site dials it (lib/website-project-share.ts). */
function dial(code: string, number: string) {
  const n = number.trim()
  if (!n) return ""
  if (n.startsWith("+")) return n
  const digits = `${code.replace(/\D/g, "")}${n.replace(/\D/g, "").replace(/^0+/, "")}`
  return code ? `+${digits}` : n
}

export function MyWebsiteCard({ userId, websiteBuilderHref }: { userId: string | undefined; websiteBuilderHref: string }) {
  // undefined = still loading; null = no website yet.
  const [site, setSite] = useState<Site | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  // The saved site as the live page draws it: its data (My story film, dialable numbers) + approved reviews.
  const [preview, setPreview] = useState<{ data: WebsiteData; reviews: Testimonial[] } | null | undefined>(undefined)

  useEffect(() => {
    if (!site || !userId) return
    let active = true
    Promise.all([
      fetch("/api/website-builder/site").then((r) => (r.ok ? r.json() : null)),
      loadAgentWebsiteReviews(createClient(), userId).catch(() => [] as Testimonial[]),
    ])
      .then(([j, approved]: [{ exists?: boolean; data?: WebsiteData; contact?: SiteContact } | null, Testimonial[]]) => {
        if (!active) return
        if (!j?.exists || !j.data) return setPreview(null)
        const story = STORY_BY_AGENT[userId]
        const withStory = !j.data.hero.video?.trim() && story ? { ...j.data, hero: { ...j.data.hero, video: story.hd } } : j.data
        const c = j.contact
        const data = c
          ? { ...withStory, agent: { ...withStory.agent, phone: dial(c.phoneCode, withStory.agent.phone), whatsapp: dial(c.whatsappCode || c.phoneCode, withStory.agent.whatsapp) } }
          : withStory
        setPreview({ data, reviews: orderWebsiteReviews(approved, data.reviewIds) })
      })
      .catch(() => { if (active) setPreview(null) })
    return () => {
      active = false
    }
  }, [site, userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    // Sites are publicly readable (migration 035), so the browser client reads it.
    void createClient()
      .from("website_builder")
      .select("slug, is_published")
      .eq("agent_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { slug: unknown; is_published: unknown } | null }) => {
        if (active) setSite(data ? { slug: String(data.slug), isPublished: data.is_published !== false } : null)
      })
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  if (site === undefined) {
    return <div className="h-[120px] rounded-2xl border border-[#e8eaed] bg-white animate-pulse" />
  }

  if (site === null) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#001f3f]">
          <Globe className="h-6 w-6 text-[#d6b357]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-['Outfit'] font-bold text-[#0d1117]">My Website</p>
          <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">
            You don&apos;t have a website yet. Create yours in the Website Builder — one link to share with clients for
            your profile, listings, projects and events.
          </p>
        </div>
        <Link
          href={websiteBuilderHref}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
        >
          <Sparkles className="h-4 w-4 text-[#d6b357]" />
          Create my website
        </Link>
      </div>
    )
  }

  const path = `/website/${site.slug}`
  const url = `${SITE_URL.replace(/\/$/, "")}${path}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked — the link is shown, copying by hand still works */
    }
  }

  return (
    <div className="space-y-4">
    <div className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#001f3f]">
          <Globe className="h-6 w-6 text-[#d6b357]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-['Outfit'] font-bold text-[#0d1117]">My Website</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#001f3f]" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#001f3f] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00356b]"
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </a>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5e5] px-4 py-2.5 text-sm font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <Link
            href={websiteBuilderHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5e5] px-4 py-2.5 text-sm font-bold text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>
      {!site.isPublished && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Your website was taken down by an admin, so clients can&apos;t see it. Contact support to have it restored.
        </p>
      )}
    </div>

    {/* The website itself, as clients see it — scroll inside the window. */}
    {preview !== null && (
      <div className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-[#f4f5f7] px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-1 text-xs text-[#6b7280]" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </span>
        </div>
        {/* As tall as the screen allows below the link card, so the site isn't cut short. */}
        <div className="h-[calc(100dvh-280px)] min-h-[420px]">
          {preview ? (
            <LivePreview data={preview.data} reviews={preview.reviews} target={null} qrValue={url} />
          ) : (
            <div className="h-full animate-pulse bg-[#eef0f3]" />
          )}
        </div>
      </div>
    )}
    </div>
  )
}
