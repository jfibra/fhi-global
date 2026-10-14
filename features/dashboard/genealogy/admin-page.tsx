"use client"

/**
 * Admin Genealogy (boss via Juliecor, 2026-10-13): pick any recruiter and see
 * their whole tree — the same chart and list agents get for their own, over
 * app/api/admin/genealogy. The biggest networks are one tap away as chips;
 * anyone else is a search away (RecruiterPicker).
 */

import { useState } from "react"
import { GitBranch } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { isAdminStaffRole } from "@/lib/app-roles"
import type { Recruiter } from "@/app/api/admin/genealogy/route"
import { GenealogyView } from "./page"
import RecruiterPicker from "./recruiter-picker"

export default function AdminGenealogyPage() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isAdminStaffRole(role))
  const [picked, setPicked] = useState<Recruiter | null>(null)

  if (!allowed) return null

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-['Outfit'] text-2xl font-bold text-[#0d1117]">
          <GitBranch className="h-6 w-6 text-[#001f3f]" /> Genealogy
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b7280]">
          Any recruiter&apos;s whole tree — everyone who joined through their link and everyone under them, level by level. Pick a person below.
        </p>
      </div>

      <RecruiterPicker picked={picked} onPick={setPicked} />

      {picked && <GenealogyView key={picked.id} endpoint={`/api/admin/genealogy?id=${picked.id}`} heading={false} />}
    </div>
  )
}
