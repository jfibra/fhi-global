"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Building2,
  Layers,
  TrendingUp,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Boxes,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/shell"
import { getRoleColor } from "@/components/dashboard/sidebar-config"
import { roleToLabel } from "@/lib/auth"
import {
  fetchDeveloperStats,
  fetchRecentDeveloperProjects,
  type DeveloperStats,
} from "@/lib/developer-portal-service"
import type { Project } from "@/lib/project-service"

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string }
> = {
  pre_launch:          { label: "Pre-Launch",    cls: "bg-violet-100 text-violet-700" },
  launch:              { label: "Launch",         cls: "bg-blue-100 text-blue-700" },
  under_construction:  { label: "Under Const.",   cls: "bg-amber-100 text-amber-700" },
  completed:           { label: "Completed",      cls: "bg-green-100 text-green-700" },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}>
      {c.label}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  detail,
  accentClass,
  textClass,
}: {
  label: string
  value: number | string
  detail?: string
  accentClass: string
  textClass: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-[#e8eaed] p-5 hover:shadow-[0_4px_20px_-2px_rgba(0,31,63,0.06)] transition-all duration-300">
      <div className={`absolute top-4 bottom-4 left-0 w-1.5 rounded-r ${accentClass}`} />
      <div className="pl-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#374151]">{label}</p>
        <p className={`font-['Outfit'] text-[40px] leading-tight font-bold ${textClass} mt-1 tracking-tight`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {detail && <p className="text-[13px] text-[#6b7280]">{detail}</p>}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-[#e8eaed] p-5 animate-pulse">
      <div className="absolute top-4 bottom-4 left-0 w-1.5 rounded-r bg-[#f3f4f6]" />
      <div className="pl-3 space-y-3">
        <div className="h-2 w-16 rounded bg-[#f3f4f6]" />
        <div className="h-10 w-24 rounded bg-[#f3f4f6]" />
        <div className="h-3 w-20 rounded bg-[#f3f4f6]" />
      </div>
    </div>
  )
}

// ─── No-developer placeholder ─────────────────────────────────────────────────
function NoDeveloperLinked() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-24 px-4">
      <div className="w-20 h-20 rounded-[28px] bg-indigo-50 flex items-center justify-center mb-6">
        <Building2 className="w-9 h-9 text-indigo-400" />
      </div>
      <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] mb-3">
        No Developer Company Linked
      </h2>
      <p className="text-[#6b7280] max-w-md leading-relaxed mb-8">
        Your account hasn&apos;t been linked to a developer company yet. Please contact an administrator to complete your setup.
      </p>
      <Link
        href="/dashboard/profile"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all"
      >
        Go to Profile
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────
export function DeveloperDashboardShell({
  userId,
  userName,
  developerId,
  developerName,
  developerSlug,
  developerLogoUrl,
}: {
  userId: string
  userName: string
  developerId: string | null
  developerName: string | null
  developerSlug: string | null
  developerLogoUrl: string | null
}) {
  const [stats, setStats]     = useState<DeveloperStats | null>(null)
  const [recent, setRecent]   = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!developerId) { setLoading(false); return }
    setLoading(true)

    const [statsResult, recentResult] = await Promise.all([
      fetchDeveloperStats(developerId),
      fetchRecentDeveloperProjects(developerId, 5),
    ])

    if (statsResult.error)  setError(statsResult.error)
    else                    setStats(statsResult.data)

    setRecent(recentResult.data)
    setLoading(false)
  }, [developerId])

  useEffect(() => { void loadData() }, [loadData])

  return (
    <DashboardShell
      role="developer"
      roleLabel={roleToLabel("developer")}
      roleColor={getRoleColor("developer")}
      userName={userName}
    >
      {!developerId ? (
        <NoDeveloperLinked />
      ) : (
        <div className="space-y-8">
          {/* Page header */}
          <div className="flex items-start gap-4">
            {developerLogoUrl && (
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#e5e5e5] bg-white shadow-sm shrink-0">
                <Image src={developerLogoUrl} alt={developerName ?? "Developer"} width={56} height={56} className="object-contain" />
              </div>
            )}
            <div>
              <h2 className="font-['Outfit'] text-2xl font-bold tracking-tight text-[#0d1117]">
                {developerName ?? "Developer Dashboard"}
              </h2>
              <p className="text-sm text-[#6b7280] mt-0.5">
                Welcome back, {userName.split(" ")[0]}. Here&apos;s an overview of your account.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard
                  label="Total Projects"
                  value={stats?.totalProjects ?? 0}
                  detail="All projects"
                  accentClass="bg-[#001f3f]"
                  textClass="text-[#001f3f]"
                />
                <StatCard
                  label="Active Projects"
                  value={stats?.activeProjects ?? 0}
                  detail="Live status"
                  accentClass="bg-[#001f3f]"
                  textClass="text-[#001f3f]"
                />
                <StatCard
                  label="Published"
                  value={stats?.publishedProjects ?? 0}
                  detail="Publicly visible"
                  accentClass="bg-[#001f3f]"
                  textClass="text-[#001f3f]"
                />
                <StatCard
                  label="Total Units"
                  value={stats?.totalUnits ?? 0}
                  detail="Inventory"
                  accentClass="bg-[#001f3f]"
                  textClass="text-[#001f3f]"
                />
                <StatCard
                  label="Total Views"
                  value={stats?.totalViews ?? 0}
                  detail="Analytics"
                  accentClass="bg-[#001f3f]"
                  textClass="text-[#001f3f]"
                />
              </>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Manage Company Info",  desc: "Update your company profile & logo",  href: "/dashboard/developer/company",  icon: Building2,       color: "#001f3f" },
              { label: "Manage Projects",       desc: "View, edit and publish your projects", href: "/dashboard/developer/projects", icon: Layers,          color: "#001f3f" },
              { label: "Media & Files",         desc: "Manage images, videos & brochures",    href: "/dashboard/developer/media",    icon: LayoutDashboard, color: "#001f3f" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white/70 backdrop-blur-xl rounded-[24px] border border-white/60 p-5 shadow-md shadow-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: `${item.color}18` }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#d1d5db] group-hover:text-[#6b7280] transition-colors ml-auto" />
                </div>
                <p className="font-semibold text-[#0d1117] text-sm mb-0.5">{item.label}</p>
                <p className="text-xs text-[#9ca3af]">{item.desc}</p>
              </Link>
            ))}
          </div>

          {/* Recent projects */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Outfit'] text-base font-bold text-[#0d1117]">Recent Projects</h3>
              <Link
                href="/dashboard/developer/projects"
                className="text-xs font-semibold text-[#001f3f] hover:text-[#001f3f]/80 transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/70 rounded-[20px] border border-white/60 p-4 animate-pulse flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#f3f4f6]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-40 rounded bg-[#f3f4f6]" />
                      <div className="h-3 w-24 rounded bg-[#f3f4f6]" />
                    </div>
                    <div className="h-6 w-20 rounded-full bg-[#f3f4f6]" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/60 p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#001f3f]/10 flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-7 h-7 text-[#001f3f]" />
                </div>
                <p className="font-semibold text-[#374151] mb-1">No projects yet</p>
                <p className="text-sm text-[#9ca3af] mb-5">Create your first project to start listing properties.</p>
                <Link
                  href="/dashboard/developer/projects"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#001f3f] text-white text-sm font-semibold hover:bg-[#001f3f]/90 transition-all"
                >
                  Create Project <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/developer/projects`}
                    className="bg-white/70 backdrop-blur-xl rounded-[20px] border border-white/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200 flex items-center gap-4"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[#f3f4f6] border border-[#e5e5e5] shrink-0">
                      {project.main_image ? (
                        <Image src={project.main_image} alt={project.name} width={48} height={48} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-[#d1d5db]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#0d1117] truncate">{project.name}</p>
                      <p className="text-xs text-[#9ca3af] flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {project.city ?? "—"} &middot; Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Status */}
                    <StatusBadge status={project.status} />

                    {/* Published dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${project.is_published ? "bg-green-500" : "bg-[#d1d5db]"}`} title={project.is_published ? "Published" : "Not published"} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
