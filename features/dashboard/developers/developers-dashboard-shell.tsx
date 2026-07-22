"use client"

import { DevelopersClient } from "./developers-client"

export function DevelopersDashboardShell({
  role,
  userId,
}: {
  role: string
  userName: string
  userId: string
}) {
  return <DevelopersClient currentRole={role} userId={userId} />
}
