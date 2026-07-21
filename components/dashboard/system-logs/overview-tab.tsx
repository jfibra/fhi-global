"use client"

import { useEffect, useState } from "react"
import { Activity, CalendarDays, CalendarRange, ShieldAlert, Layers } from "lucide-react"
import { StatCard, SectionCard } from "@/components/dashboard/shell"
import { RoleBadge } from "@/components/role-badge"
import {
  type AuditLogRow,
  type AuditListResponse,
  type OverviewStats,
  categoryMeta,
  eventColor,
  humanizeEvent,
  relativeTime,
} from "./log-meta"
import { LogDetailDrawer } from "./log-detail-drawer"

export function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [recent, setRecent] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch("/api/admin/system-logs/overview"),
          fetch("/api/admin/system-logs?perPage=10&page=1"),
        ])
        const s = (await sRes.json()) as OverviewStats
        const r = (await rRes.json()) as AuditListResponse
        if (cancelled) return
        if (sRes.ok) setStats(s)
        if (rRes.ok) setRecent(r.rows ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const topCat = stats?.top_category_7d ? categoryMeta(stats.top_category_7d).label : "—"

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Events Today" value={loading ? "—" : (stats?.today ?? 0).toLocaleString()} icon={Activity} accentColor="#16a34a" />
        <StatCard label="Last 7 Days" value={loading ? "—" : (stats?.last_7d ?? 0).toLocaleString()} icon={CalendarDays} accentColor="#2563eb" />
        <StatCard label="Last 30 Days" value={loading ? "—" : (stats?.last_30d ?? 0).toLocaleString()} icon={CalendarRange} accentColor="#7c3aed" />
        <StatCard
          label="Top Category (7d)"
          value={loading ? "—" : topCat}
          icon={Layers}
          accentColor="#0891b2"
          sub={stats?.top_category_7d ? `${(stats.top_category_7d_count ?? 0).toLocaleString()} events` : undefined}
        />
        <StatCard
          label="Security Events (7d)"
          value={loading ? "—" : (stats?.security_7d ?? 0).toLocaleString()}
          icon={ShieldAlert}
          accentColor="#dc2626"
          sub={stats && stats.security_7d > 0 ? "Review the Security tab" : "Healthy"}
        />
      </div>

      <SectionCard title="Recent Activity" subtitle="Last 10 events across all categories">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#f0f2f5] rounded animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-[#9ca3af] text-center py-6">No activity yet.</p>
        ) : (
          <div className="divide-y divide-[#f4f6f9]">
            {recent.map((row) => {
              const cat = categoryMeta(row.category)
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#f9fafb] transition-colors -mx-2 px-2 rounded-lg"
                >
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold" style={{ color: eventColor(row.event) }}>
                      {humanizeEvent(row.event)}
                    </span>
                    <p className="text-xs text-[#111827] truncate">
                      {row.description || row.subject_label || row.subject_type || "—"}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#6b7280]">{row.actor_name ?? "System"}</span>
                    {row.actor_role && <RoleBadge role={row.actor_role} />}
                  </div>
                  <span className="text-[10px] text-[#bbb] shrink-0 w-16 text-right">{relativeTime(row.occurred_at)}</span>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      {selected && <LogDetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
