"use client"

// "My Website" (sidebar, under Overview) for the sales ladder: their Website
// Builder site's public link to open or copy, or — without a site yet — the
// prompt to create one.

import { useAuth } from "@/context/auth-context"
import { getDashboardRouteByRole } from "@/lib/auth"
import { MyWebsiteCard } from "@/components/dashboard/my-website-card"

export default function MyWebsitePage() {
  const { user, role } = useAuth()
  return (
    <div className="w-full">
      <MyWebsiteCard userId={user?.id} websiteBuilderHref={`${getDashboardRouteByRole(role)}/website-builder`} />
    </div>
  )
}
