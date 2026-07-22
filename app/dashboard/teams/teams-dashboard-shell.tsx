"use client"

import { TeamsClient } from "./teams-client"

export function TeamsDashboardShell({
  role,
  userId,
}: {
  role: string
  userName: string
  userId: string
}) {
  return <TeamsClient currentRole={role} userId={userId} />
}
