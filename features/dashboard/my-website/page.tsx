"use client"

// "My Website" (sidebar, under Overview) for the sales ladder: their Website
// Builder site's public link to open or copy, or — without a site yet — the
// prompt to create one.

import { Globe } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"
import { MyWebsiteCard } from "@/components/dashboard/my-website-card"

export default function MyWebsitePage() {
  const { user, role } = useAuth()
  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
          <Globe className="w-6 h-6 text-[#001f3f]" />
          My Website
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Your personal website — open it, copy the link to send to clients, or edit it in the Website Builder.
        </p>
      </div>
      <MyWebsiteCard userId={user?.id} websiteBuilderHref={`${getDashboardRouteByRole(role)}/website-builder`} />
    </div>
  )
}
