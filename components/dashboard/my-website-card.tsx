"use client"

// "My Website" on the sales-ladder dashboards (agent, team leader, unit manager,
// global partner): their Website Builder site's public link to open or copy in
// one click — or, if they haven't built one yet, a prompt to create it.

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Pencil, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { SITE_URL } from "@/lib/seo"

type Site = { slug: string; isPublished: boolean }

export function MyWebsiteCard({ userId, websiteBuilderHref }: { userId: string | undefined; websiteBuilderHref: string }) {
  // undefined = still loading; null = no website yet.
  const [site, setSite] = useState<Site | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)

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
          Your website is hidden, so clients can&apos;t see it yet — publish it in the Website Builder.
        </p>
      )}
    </div>
  )
}
