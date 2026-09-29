"use client"

// Videos shelf — poster grid with category tabs. Watching opens the same
// cinema as the public About page (FilmTrigger: streams from S3, nothing
// loads until play). Downloading goes through /api/library/videos/download,
// which redirects to a short-lived signed S3 URL that tells the browser to
// save the file (a plain cross-origin link would just play it).

import { useMemo, useState } from "react"
import Image from "next/image"
import { Download, MonitorPlay, Play } from "lucide-react"
import { FilmTrigger } from "@/components/public/film-player"
import type { LibraryVideo, VideoCategory, VideoLanguage } from "@/lib/films"

const ALL = "All"
const ORDER: VideoCategory[] = ["Company", "Agent stories", "Landlords"]
const LANGS: VideoLanguage[] = ["English", "Arabic"]
const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`
const downloadHref = (v: LibraryVideo, q: "hd" | "sd") => `/api/library/videos/download?id=${encodeURIComponent(v.film.id)}&q=${q}`

export function VideosClient({ videos }: { videos: LibraryVideo[] }) {
  const [tab, setTab] = useState<string>(ALL)
  const [lang, setLang] = useState<string>(ALL)
  const langs = useMemo(() => LANGS.filter((l) => videos.some((v) => v.lang === l)), [videos])
  const inLang = useMemo(() => (lang === ALL ? videos : videos.filter((v) => v.lang === lang)), [videos, lang])
  // Only the categories this language has (Arabic has no landlord films); a tab
  // left empty by a language switch falls back to All.
  const categories = useMemo(() => [ALL, ...ORDER.filter((c) => inLang.some((v) => v.category === c))], [inLang])
  const activeTab = categories.includes(tab) ? tab : ALL
  const shown = activeTab === ALL ? inLang : inLang.filter((v) => v.category === activeTab)

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#001f3f] shadow-lg">
          <MonitorPlay className="h-6 w-6 text-[#d6b357]" />
        </div>
        <div className="min-w-0">
          <h1 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">Videos</h1>
          <p className="text-sm text-[#6b7280]">FHI&apos;s films to watch here, or download and share with your clients.</p>
        </div>
        {videos.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-[#f3f4f6] px-3 py-1.5 text-xs font-bold text-[#6b7280]">
            {videos.length} {videos.length === 1 ? "video" : "videos"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === activeTab
            const count = c === ALL ? inLang.length : inLang.filter((v) => v.category === c).length
            return (
              <button
                key={c}
                type="button"
                onClick={() => setTab(c)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[#001f3f] text-white" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e8eaee]"
                }`}
              >
                {c}
                <span className={`text-[11px] font-bold ${active ? "text-[#d6b357]" : "text-[#9ca3af]"}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}
      {/* Language: agents with Arabic-speaking clients can show only the Arabic versions. */}
      {langs.length > 1 && (
        <div role="group" aria-label="Language" className="inline-flex self-start rounded-lg bg-[#f3f4f6] p-1">
          {[ALL, ...langs].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={l === lang}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                l === lang ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#0d1117]"
              }`}
            >
              {l === ALL ? "All languages" : l === "Arabic" ? <>Arabic · <bdi lang="ar" dir="rtl">عربي</bdi></> : l}
            </button>
          ))}
        </div>
      )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {shown.map((v) => (
          <article key={v.film.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e8eaed] bg-white shadow-sm">
            <FilmTrigger
              film={v.film}
              className="group relative block aspect-[16/9] w-full overflow-hidden bg-[#0b2a4d] text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#001f3f]/20"
              ariaLabel={`Watch ${v.name}${v.lang === "Arabic" ? " (Arabic)" : ""}, ${v.film.duration}`}
            >
              <Image src={v.film.poster} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#06182e]/70 via-transparent to-transparent" aria-hidden="true" />
              <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#d6b357] text-[#001f3f] shadow-lg transition-transform duration-300 group-hover:scale-110">
                <Play className="ml-1 h-6 w-6 fill-current" />
              </span>
              <span className="absolute left-3 top-3 rounded-md bg-[#06182e]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                {v.category}
              </span>
              {v.lang === "Arabic" && (
                <span className="absolute right-3 top-3 rounded-md bg-[#d6b357] px-2 py-1 text-[11px] font-bold text-[#001f3f]">
                  Arabic · <bdi lang="ar" dir="rtl">عربي</bdi>
                </span>
              )}
              <span className="absolute bottom-3 right-3 rounded-md bg-[#06182e]/70 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur">
                {v.film.duration}
              </span>
            </FilmTrigger>

            <div className="flex flex-1 flex-col p-4">
              <p className="font-['Outfit'] text-[16px] font-bold leading-snug text-[#0d1117]">{v.name}</p>
              <p className="text-[12.5px] text-[#6b7280]">{v.subtitle}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={downloadHref(v, "hd")}
                  className="inline-flex flex-col items-center justify-center rounded-lg bg-[#001f3f] px-3 py-2 text-center text-white transition-colors hover:bg-[#00356b]"
                  aria-label={`Download ${v.name}${v.lang === "Arabic" ? " (Arabic)" : ""} in HD, ${mb(v.bytes.hd)}`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
                    <Download className="h-3.5 w-3.5 text-[#d6b357]" /> Download HD
                  </span>
                  <span className="text-[11px] text-white/70">1080p · {mb(v.bytes.hd)}</span>
                </a>
                <a
                  href={downloadHref(v, "sd")}
                  className="inline-flex flex-col items-center justify-center rounded-lg border border-[#e5e7eb] px-3 py-2 text-center text-[#374151] transition-colors hover:border-[#001f3f] hover:text-[#001f3f]"
                  aria-label={`Download ${v.name}${v.lang === "Arabic" ? " (Arabic)" : ""}, smaller file for WhatsApp, ${mb(v.bytes.sd)}`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold">
                    <Download className="h-3.5 w-3.5" /> For WhatsApp
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">720p · {mb(v.bytes.sd)}</span>
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
