"use client"

import { useAuth } from "@/context/auth-context"
import { canManageDeveloperContent, isDeveloperRole } from "@/lib/app-roles"
import { useRequireAllowed } from "@/components/auth/use-require-allowed"
import { ProjectsDashboardShell } from "./projects-dashboard-shell"
import { DeveloperProjectsRoute } from "./developer-projects-route"

/** All-projects management — admin / super_admin / editor. */
export function AdminProjects() {
  const { user, profile, role } = useAuth()
  const allowed = useRequireAllowed(canManageDeveloperContent(role))
  if (!allowed) return null

  return (
    <ProjectsDashboardShell
      role={(role ?? "").toLowerCase().trim()}
      userName={profile?.fullname || user?.email || "User"}
      userId={user?.id ?? ""}
    />
  )
}

/** A developer's own projects. */
export function DeveloperProjects() {
  const { role } = useAuth()
  const allowed = useRequireAllowed(isDeveloperRole(role))
  if (!allowed) return null

  return <DeveloperProjectsRoute />
}
