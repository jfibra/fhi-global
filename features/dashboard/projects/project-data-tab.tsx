"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowUpRight, CheckCircle2, RefreshCcw } from "lucide-react"
import { fetchProjectStats, type Project, type ProjectStats } from "@/lib/project-service"
import type { TabId } from "./projects-client"

type Props = {
  project: Project
  onJump: (tab: TabId) => void
  showToast: (variant: "success" | "error", message: string) => void
}

type Row = {
  key: string
  label: string
  ok: boolean
  detail: string
  count?: number
  targetTab: TabId
}

export function ProjectDataTab({ project, onJump, showToast }: Props) {
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await fetchProjectStats(project.id)
    setLoading(false)
    setError(err)
    if (err) {
      showToast("error", err)
      return
    }
    setStats(data)
  }, [project.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const rows: Row[] = [
    {
      key: "images",
      label: "Images",
      ok: Boolean(project.main_image) && (stats?.images ?? 0) > 0,
      detail: stats ? `${stats.images} images` : "",
      count: stats?.images,
      targetTab: "images",
    },
    {
      key: "media",
      label: "Media (video/virtual tour)",
      ok: (stats?.media ?? 0) > 0,
      detail: stats ? `${stats.media} items` : "",
      count: stats?.media,
      targetTab: "media",
    },
    {
      key: "units",
      label: "Unit types",
      ok: (stats?.units ?? 0) > 0,
      detail: stats ? `${stats.units} units` : "",
      count: stats?.units,
      targetTab: "units",
    },
    {
      key: "amenities",
      label: "Amenities",
      ok: (stats?.amenities ?? 0) > 0,
      detail: stats ? `${stats.amenities} selected` : "",
      count: stats?.amenities,
      targetTab: "amenities",
    },
    {
      key: "property_types",
      label: "Property types",
      ok: (stats?.property_types ?? 0) > 0,
      detail: stats ? `${stats.property_types} selected` : "",
      count: stats?.property_types,
      targetTab: "property_types",
    },
    {
      key: "features",
      label: "Features",
      ok: (stats?.features ?? 0) > 0,
      detail: stats ? `${stats.features} features` : "",
      count: stats?.features,
      targetTab: "features",
    },
    {
      key: "neighbors",
      label: "Nearby places",
      ok: (stats?.neighbors ?? 0) > 0,
      detail: stats ? `${stats.neighbors} places` : "",
      count: stats?.neighbors,
      targetTab: "nearby",
    },
    {
      key: "keywords",
      label: "SEO / Keywords",
      ok: Boolean(project.meta_title && project.meta_description) && (stats?.keywords ?? 0) > 0,
      detail: stats ? `${stats.keywords} keywords` : "",
      count: stats?.keywords,
      targetTab: "seo",
    },
    {
      key: "settings",
      label: "Status",
      ok: project.is_active && project.is_published,
      detail: `${project.is_published ? "Published" : "Draft"} Â· ${project.is_active ? "Active" : "Inactive"}`,
      targetTab: "settings",
    },
  ]

  const okCount = rows.filter((r) => r.ok).length
  const total = rows.length

  const StatusIcon = ({ ok }: { ok: boolean }) => (
    ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Data health check</h3>
          <p className="text-sm text-[#6b7280]">See which parts of this project are missing data and jump to the right tab.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#e5e5e5] text-sm font-semibold text-[#374151] hover:border-[#001f3f] transition-colors disabled:opacity-50"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#f0f0f0] p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${okCount === total ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {okCount === total ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">{okCount} of {total} sections completed</p>
          <p className="text-xs text-[#6b7280]">Keep every section in green before publishing.</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          Failed to load stats: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {loading && !stats ? (
          Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[#f3f4f6] animate-pulse" />
          ))
        ) : (
          rows.map((row) => (
            <div key={row.key} className="border border-[#f0f0f0] rounded-xl p-4 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon ok={row.ok} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827] truncate">{row.label}</p>
                  <p className="text-xs text-[#6b7280] truncate">{row.detail || "No data yet"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onJump(row.targetTab)}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  row.ok ? "border-[#e5e5e5] text-[#374151] hover:border-[#001f3f]" : "border-amber-300 text-amber-700 bg-amber-50"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Open tab
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
