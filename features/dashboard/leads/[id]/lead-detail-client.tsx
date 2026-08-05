"use client"

// The standalone lead page was folded into the Gmail-style Emails client —
// the conversation now opens in its reading pane. This route survives only
// for old links (browser history, the lead-notification emails), so it
// forwards to the inbox with the conversation open.

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"

export function LeadDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const base = getDashboardRouteByRole(useAuth().role)

  useEffect(() => {
    router.replace(`${base}/leads?open=${encodeURIComponent(id)}`)
  }, [router, base, id])

  return (
    <div className="flex items-center gap-2 text-sm text-[#9ca3af] py-20 justify-center">
      <Loader2 className="w-5 h-5 animate-spin" /> Opening conversation…
    </div>
  )
}
