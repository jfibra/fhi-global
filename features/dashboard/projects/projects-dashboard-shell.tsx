"use client"

import { ProjectsClient } from "./projects-client"

export function ProjectsDashboardShell({
  role,
  userId,
}: {
  role: string
  userName: string
  userId: string
}) {
  return <ProjectsClient currentRole={role} userId={userId} />
}
