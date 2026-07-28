"use client"

import { ProjectsClient } from "./projects-client"

export function ProjectsDashboardShell({
  role,
  userId,
  readOnly,
}: {
  role: string
  userName: string
  userId: string
  readOnly?: boolean
}) {
  return <ProjectsClient currentRole={role} userId={userId} readOnly={readOnly} />
}
