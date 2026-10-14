"use client"

/**
 * Admin Team Performance (boss via Juliecor, 2026-10-14): any recruiter's My
 * Team page exactly as they see it — masthead, KPIs, podium, who is selling,
 * charts, members and every deal, the member panel and the Top Sellers poster
 * — over app/api/admin/my-team?id= (admin staff only).
 */

import { useState } from "react"
import { TrendingUp } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import type { Recruiter } from "@/app/api/admin/genealogy/route"
import RecruiterPicker from "@/features/dashboard/genealogy/recruiter-picker"
import { MyTeamView } from "./page"

export default function AdminTeamPerformancePage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const [picked, setPicked] = useState<Recruiter | null>(null)

  if (!allowed) return null

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <TrendingUp className="h-6 w-6 text-[#001f3f]" /> Team Performance
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
          Any recruiter&apos;s My Team page, exactly as they see it — their network&apos;s sales, who is selling, top sellers and every deal. Pick a person below.
        </p>
      </div>

      <RecruiterPicker picked={picked} onPick={setPicked} />

      {picked && <MyTeamView key={picked.id} endpoint={`/api/admin/my-team?id=${picked.id}`} shareEndpoint={`/api/my-team/share-image?id=${picked.id}`} />}
    </div>
  )
}
