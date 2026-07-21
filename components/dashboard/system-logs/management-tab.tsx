"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, FileText, HardDrive, CalendarClock, Clock, Trash2, Download, AlertTriangle } from "lucide-react"
import { StatCard, SectionCard, ProgressBar } from "@/components/dashboard/shell"
import { type StorageStats, formatBytes, formatDateTime, relativeTime } from "./log-meta"

const AGE_BARS: { key: keyof StorageStats["age_buckets"]; label: string; color: string }[] = [
  { key: "last_30d", label: "Last 30 days", color: "#16a34a" },
  { key: "in_30_90d", label: "30–90 days", color: "#2563eb" },
  { key: "in_90_180d", label: "90–180 days", color: "#f59e0b" },
  { key: "older_180d", label: "Older than 180 days", color: "#9ca3af" },
]

const THRESHOLDS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
]

export function ManagementTab({
  canClear,
  onBanner,
}: {
  canClear: boolean
  onBanner: (type: "success" | "error", msg: string) => void
}) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [olderThan, setOlderThan] = useState("180")
  const [clearing, setClearing] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [format, setFormat] = useState<"csv" | "json">("csv")
  const [exporting, setExporting] = useState(false)

  const loadStorage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/system-logs/storage")
      const json = (await res.json()) as StorageStats
      if (res.ok) setStats(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStorage()
  }, [loadStorage])

  const bucketTotal = stats
    ? AGE_BARS.reduce((sum, b) => sum + (stats.age_buckets[b.key] ?? 0), 0)
    : 0
  const deletionPreview = stats?.deletion_preview?.[olderThan] ?? 0

  const handleClear = async () => {
    if (!confirm(`Permanently delete ${deletionPreview.toLocaleString()} audit log(s) older than ${olderThan} days? This cannot be undone.`)) return
    setClearing(true)
    try {
      const res = await fetch("/api/admin/system-logs/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: Number(olderThan) }),
      })
      const json = (await res.json()) as { deleted?: number; error?: string }
      if (!res.ok) {
        onBanner("error", json.error ?? "Failed to clear logs.")
      } else {
        onBanner("success", `Cleared ${(json.deleted ?? 0).toLocaleString()} audit log(s).`)
        void loadStorage()
      }
    } finally {
      setClearing(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const sp = new URLSearchParams({ format })
      if (exportFrom) sp.set("from", exportFrom)
      if (exportTo) sp.set("to", exportTo)
      const res = await fetch(`/api/admin/system-logs/export?${sp.toString()}`)
      if (!res.ok) {
        onBanner("error", "Export failed.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title="Storage Overview"
        subtitle="Audit log storage statistics and management"
        action={
          <button
            type="button"
            onClick={() => void loadStorage()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Records" value={loading ? "—" : (stats?.total_rows ?? 0).toLocaleString()} icon={FileText} accentColor="#0ea5e9" />
          <StatCard label="Estimated Size" value={loading ? "—" : formatBytes(stats?.bytes)} icon={HardDrive} accentColor="#7c3aed" />
          <StatCard label="Oldest Entry" value={loading ? "—" : formatDateTime(stats?.oldest ?? null)} icon={CalendarClock} accentColor="#16a34a" sub={stats?.oldest ? relativeTime(stats.oldest) : undefined} />
          <StatCard label="Newest Entry" value={loading ? "—" : formatDateTime(stats?.newest ?? null)} icon={Clock} accentColor="#d6b357" sub={stats?.newest ? relativeTime(stats.newest) : undefined} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-3">Age Distribution</p>
        <div className="space-y-3">
          {AGE_BARS.map((b) => {
            const count = stats?.age_buckets[b.key] ?? 0
            const pct = bucketTotal > 0 ? Math.round((count / bucketTotal) * 100) : 0
            return (
              <ProgressBar
                key={b.key}
                value={count}
                max={bucketTotal || 1}
                color={b.color}
                label={b.label}
                sub={`${count.toLocaleString()} (${pct}%)`}
              />
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Clear Old Logs */}
        <div className="bg-white rounded-2xl border border-rose-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-bold text-rose-600">Clear Old Logs</h3>
          </div>
          <p className="text-xs text-[#6b7280] mb-4">Permanently delete audit logs older than a specified period.</p>

          <label className="block text-xs font-semibold text-[#374151] mb-1.5">Delete logs older than</label>
          <select
            value={olderThan}
            onChange={(e) => setOlderThan(e.target.value)}
            disabled={!canClear}
            className="w-full h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:border-[#001f3f] disabled:opacity-50 mb-3"
          >
            {THRESHOLDS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-rose-700">
                {deletionPreview.toLocaleString()} record(s) will be permanently deleted
              </p>
              <p className="text-[11px] text-rose-600/80">This action cannot be undone.</p>
            </div>
          </div>

          {!canClear ? (
            <p className="text-[11px] text-[#9ca3af]">Only a super admin can clear audit logs.</p>
          ) : (
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={clearing || deletionPreview === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {clearing ? "Clearing…" : "Clear Old Logs"}
            </button>
          )}
        </div>

        {/* Export Logs */}
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-4 h-4 text-[#001f3f]" />
            <h3 className="text-sm font-bold text-[#0d1117]">Export Logs</h3>
          </div>
          <p className="text-xs text-[#6b7280] mb-4">Download audit logs as a CSV or JSON file.</p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">From date</label>
              <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="w-full h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm focus:outline-none focus:border-[#001f3f]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">To date</label>
              <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="w-full h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm focus:outline-none focus:border-[#001f3f]" />
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            {(["csv", "json"] as const).map((f) => (
              <label key={f} className="inline-flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
                <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} className="accent-[#001f3f]" />
                {f.toUpperCase()}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#001f3f] to-[#002a52] text-white text-sm font-semibold hover:shadow-lg disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Downloading…" : "Download Logs"}
          </button>
        </div>
      </div>
    </div>
  )
}
