"use client"

import { useEffect, useState } from "react"
import { BarChart3, FileText, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import { OverviewTab } from "./overview-tab"
import { AllLogsTab } from "./all-logs-tab"
import { ManagementTab } from "./management-tab"

type TabKey = "overview" | "all" | "security" | "management"
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "all", label: "All Logs", icon: FileText },
  { key: "security", label: "Security Events", icon: ShieldCheck },
  { key: "management", label: "Management", icon: SlidersHorizontal },
]

function tabFromHash(): TabKey {
  if (typeof window === "undefined") return "overview"
  const h = window.location.hash.replace("#", "")
  return (["overview", "all", "security", "management"] as const).includes(h as TabKey) ? (h as TabKey) : "overview"
}

export function SystemLogsClient({ currentRole, canClear }: { currentRole: string; canClear: boolean }) {
  const [tab, setTab] = useState<TabKey>("overview")
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null)

  // URL-hash-driven tabs (deep-linkable: #security, #management, …).
  useEffect(() => {
    setTab(tabFromHash())
    const onHash = () => setTab(tabFromHash())
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/system-logs/categories")
        const json = (await res.json()) as { counts: Record<string, number> }
        if (res.ok) setCategoryCounts(json.counts ?? {})
      } catch {
        /* non-fatal */
      }
    })()
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(t)
  }, [banner])

  const selectTab = (key: TabKey) => {
    setTab(key)
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${key}`)
  }

  return (
    <DashboardShell
      role={currentRole}
      roleLabel={roleToLabel(currentRole)}
      roleColor={getRoleColor(currentRole)}
      userName="Admin"
    >
      <div className="mb-6">
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117]">System Logs</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Full audit trail — trace every action, change, and security event.</p>
      </div>

      {banner && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{banner.msg}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-current/60 hover:text-current">
            ✕
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 p-1 rounded-2xl bg-[#eef1f5] border border-[#e8eaed]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === key ? "bg-white text-[#001f3f] shadow-sm" : "text-[#6b7280] hover:text-[#001f3f]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "all" && <AllLogsTab categoryCounts={categoryCounts} />}
      {tab === "security" && <AllLogsTab scope="security" categoryCounts={categoryCounts} />}
      {tab === "management" && <ManagementTab canClear={canClear} onBanner={(type, msg) => setBanner({ type, msg })} />}
    </DashboardShell>
  )
}
